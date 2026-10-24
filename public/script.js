
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js'
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js'
    import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js'

    const config = { apiKey: "AIzaSyDicR3VX9ClJoO8SDEu_xMGR4fbbqsrSVE", authDomain: "discordcord-7c0b2.firebaseapp.com", projectId: "discordcord-7c0b2", storageBucket: "discordcord-7c0b2.firebasestorage.app", messagingSenderId: "138455635458", appId: "1:138455635458:web:a236f0ceca0cb6de22b91b" };
    const app = initializeApp(config), auth = getAuth(app), db = getFirestore(app);
    let chan = 'general', user = null, unsub = null, isSignUpMode = false, pfp = '', reply = null, curStat = 'online', idle = null, mode = 'channels', dmWith = null, servers = [], currentServer = null, lastPresenceUsers = [];
    let heartbeat = null, idleNow = false, lastActivity = Date.now();
    let allUsers = [], backfillUsers = [];
    const IDLE_MS = 120000;
    const PRESENCE_TTL = 24 * 60 * 60 * 1000;
    const prunePending = new Set();
    function prunePresence(id) {
      if (prunePending.has(id)) return;
      prunePending.add(id);
      deleteDoc(doc(db, 'presence', id)).catch(() => {}).finally(() => prunePending.delete(id));
    }
    function effStatus(u) {
      if (u.status === 'dnd') return 'dnd';
      if (u.status === 'idle') return 'idle';
      const ms = u.lastActive && u.lastActive.toMillis ? u.lastActive.toMillis() : Date.now();
      return (Date.now() - ms > IDLE_MS) ? 'idle' : 'online';
    }
    const appLoadTime = Date.now();
    let _dlgMode = 'alert', _dlgResolve = null;
    function _showDialog(mode, message, opts) {
      opts = opts || {};
      _dlgMode = mode;
      return new Promise(resolve => {
        _dlgResolve = resolve;
        document.getElementById('dlg-title').textContent = opts.title || (mode === 'confirm' ? 'Confirm' : mode === 'prompt' ? 'Input' : 'Notice');
        document.getElementById('dlg-msg').textContent = message;
        const inp = document.getElementById('dlg-input');
        inp.style.display = mode === 'prompt' ? 'block' : 'none';
        inp.value = opts.defaultVal || '';
        const ok = document.getElementById('dlg-ok');
        const cancel = document.getElementById('dlg-cancel');
        ok.textContent = opts.okText || 'OK';
        cancel.style.display = (mode === 'alert') ? 'none' : 'inline-block';
        cancel.textContent = opts.cancelText || 'Cancel';
        document.getElementById('app-dialog').style.display = 'flex';
        if (mode === 'prompt') inp.focus();
      });
    }
    function _closeDialog(val) {
      document.getElementById('app-dialog').style.display = 'none';
      if (_dlgResolve) { _dlgResolve(val); _dlgResolve = null; }
    }
    (function wireDlg() {
      const ok = document.getElementById('dlg-ok');
      const cancel = document.getElementById('dlg-cancel');
      if (!ok) return;
      ok.onclick = () => {
        const inp = document.getElementById('dlg-input');
        let val;
        if (_dlgMode === 'prompt') val = inp.value;
        else if (_dlgMode === 'confirm') val = true;
        else val = undefined;
        _closeDialog(val);
      };
      cancel.onclick = () => {
        let val;
        if (_dlgMode === 'prompt') val = null;
        else if (_dlgMode === 'confirm') val = false;
        else val = undefined;
        _closeDialog(val);
      };
    })();
    function appAlert(msg, title) { _showDialog('alert', msg, { title: title }); }
    function appConfirm(msg, title) { return _showDialog('confirm', msg, { title: title }); }
    function appPrompt(msg, defaultVal, title) { return _showDialog('prompt', msg, { defaultVal: defaultVal, title: title }); }
    window.appAlert = appAlert; window.appConfirm = appConfirm; window.appPrompt = appPrompt;
    const escHtml = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const SAFE_IMG = /^https:\/\/media\d*\.giphy\.com\/[\w\-\.\/]+(\?.*)?$/i;
    const renderText = (t) => {
      const raw = String(t ?? '');
      const gif = raw.match(/^\s*<img src="([^"]+)"\s*style="max-width:[^;]+; border-radius:8px; display:block;">\s*$/i);
      if (gif && SAFE_IMG.test(gif[1])) return `<img data-src="${escHtml(gif[1])}" src="" alt="gif" loading="lazy" style="max-width: min(320px, 100%); border-radius:8px; display:block; background:transparent; min-height:60px;">`;
      return escHtml(raw);
    };

    onAuthStateChanged(auth, async (u) => {
      if (u) {
        user = u.email.split('@')[0]; document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('my-pfp').textContent = user[0].toUpperCase();
        document.getElementById('up-name').textContent = user;
        if (Notification.permission !== "granted") Notification.requestPermission();
        await setDoc(doc(db,"presence",user),{user,status:'online',lastActive:serverTimestamp()},{merge:true});
        setDoc(doc(db,"users",user),{user,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
        onSnapshot(collection(db,"users"),(snap)=>{
          allUsers = snap.docs.map(d => d.data().user).filter(Boolean);
          if (mode === 'dms') renderSidebar();
        });
        getDocs(collection(db,"messages")).then(snap=>{
          const names = new Set(backfillUsers);
          snap.docs.forEach(d => {
            const m = d.data();
            if (m.user) names.add(m.user);
            if (m.replyTo && m.replyTo.user) names.add(m.replyTo.user);
          });
          backfillUsers = Array.from(names);
          if (mode === 'dms') renderSidebar();
        }).catch(()=>{});
        lastActivity = Date.now();
        if (heartbeat) clearInterval(heartbeat);
        idleNow = false;
        heartbeat = setInterval(() => {
          if (!user) return;
          const active = document.visibilityState === 'visible' && (Date.now() - lastActivity < IDLE_MS);
          if (active) { idleNow = false; updatePresence(curStat || 'online'); }
          else { idleNow = true; }
        }, 30000);
        onSnapshot(collection(db,"presence"),(snap)=>{
          const now = Date.now();
          const all = [];
          snap.docs.forEach(d => {
            const p = d.data();
            if (p.status === 'offline') { prunePresence(d.id); return; }
            if (!('lastActive' in p)) { prunePresence(d.id); return; }
            if (p.lastActive) {
              const ms = p.lastActive.toMillis ? p.lastActive.toMillis() : 0;
              if (!ms || now - ms > PRESENCE_TTL) { prunePresence(d.id); return; }
            }
            all.push(p);
          });
          lastPresenceUsers = all;
          renderUserList();
        });
        onSnapshot(query(collection(db,"friends"),where("to","==",user),where("status","==","pending")),(snap)=>{
          document.getElementById('req-list').innerHTML = snap.docs.map(d=>`<div>${escHtml(d.data().from)} <button onclick="acceptReq('${d.id}')" style="font-size:10px;">Accept</button></div>`).join('');
        });
        pfp = localStorage.getItem('pfp_'+user) || '';
        if (pfp.startsWith('file:///')) { pfp = ''; localStorage.removeItem('pfp_'+user); }
        if (pfp) document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`;
        listen();
        loadServers().then(() => {
          const params = new URLSearchParams(window.location.search);
          const joinCode = params.get('join');
          if (joinCode) { joinServer(joinCode); }
        });
      } else { if (heartbeat) { clearInterval(heartbeat); heartbeat = null; } if (user) setDoc(doc(db,"presence",user),{status:'offline'},{merge:true}); document.getElementById('auth-overlay').style.display = 'flex'; }
    });

    window.acceptReq = async (id) => { await updateDoc(doc(db,"friends",id),{status:"accepted"}); appAlert("Accepted!"); }
    window.sendReq = async (u) => { if(u) await addDoc(collection(db,"friends"),{from:user,to:u,status:"pending",timestamp:serverTimestamp()}); }

    function rst() {
      lastActivity = Date.now();
      if (user && idleNow) { idleNow = false; updatePresence(curStat || 'online'); }
    }
    window.addEventListener('mousemove', rst, { passive: true });
    window.addEventListener('mousedown', rst, { passive: true });
    window.addEventListener('keydown', rst);
    window.addEventListener('scroll', rst, { passive: true });
    window.addEventListener('touchstart', rst, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) rst(); });

    const drop = document.getElementById('pfp-dropzone');
    drop.ondragover = (e) => e.preventDefault();
    drop.ondrop = (e) => {
      e.preventDefault(); const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith('image/')) {
        const r = new FileReader(); r.onload=() => {
          pfp = r.result; localStorage.setItem('pfp_'+user, pfp);
          document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`;
          document.getElementById('my-pfp').textContent = ''; listen();
        }; r.readAsDataURL(f);
      }
    };

    window.switchChannel = (c) => { mode = 'channels'; dmWith = null; currentServer = null; chan = c; document.getElementById('dm-btn').classList.remove('active'); renderServerList(); renderUserList(); renderSidebar(); updateHeader(); listen(); }
    window.toggleDMView = () => {
      if (mode === 'dms') { mode = 'channels'; dmWith = null; chan = chan || 'general'; if (!chan || chan.startsWith('dm_')) chan = 'general'; document.getElementById('dm-btn').classList.remove('active'); }
      else { mode = 'dms'; dmWith = null; currentServer = null; chan = null; document.getElementById('dm-btn').classList.add('active'); }
      document.getElementById('server-banner').style.display = 'none';
      renderServerList(); renderUserList(); renderSidebar(); updateHeader(); listen();
    };
    window.openDM = (u) => {
      dmWith = u; mode = 'dms'; currentServer = null; chan = 'dm_' + [user, u].sort().join('_');
      document.getElementById('dm-btn').classList.add('active');
      renderServerList(); renderUserList(); renderSidebar(); updateHeader(); listen();
    };
    function dmKey(a,b){ return 'dm_' + [a,b].sort().join('_'); }
    function knownUsers() {
      const set = new Set();
      allUsers.forEach(u => u && set.add(u));
      backfillUsers.forEach(u => u && set.add(u));
      lastPresenceUsers.forEach(x => x && x.user && set.add(x.user));
      servers.forEach(s => (s.members || []).forEach(u => u && set.add(u)));
      set.delete(user);
      return Array.from(set).sort((a,b) => a.localeCompare(b));
    }
    function renderSidebar() {
      const h3 = document.querySelector('.sb h3');
      const ch = document.querySelector('.ch');
      if (mode === 'channels') {
        const srv = currentServer ? servers.find(sv=>sv.id===currentServer) : null;
        h3.textContent = srv ? srv.name : 'Channels';
        ch.innerHTML = `<div class="cat">Text Channels</div>` +
          `<button class="cb ${chan==='general'?'active':''}" onclick="switchChannel('general')"># general</button>` +
          `<button class="cb ${chan==='random'?'active':''}" onclick="switchChannel('random')"># random</button>`;
      } else {
        h3.textContent = 'Direct Messages';
        const users = knownUsers();
        let html = `<div class="cat">Direct Messages</div><button class="cb muted" onclick="toggleDMView()">← Back to channels</button>`;
        if (users.length === 0) html += `<div class="rs-empty" style="padding:8px;">No users yet</div>`;
        users.forEach(u => {
          const safe = escHtml(u);
          html += `<button class="cb ${dmWith===u?'active':''}" onclick="openDM(this.dataset.user)" data-user="${safe}">@ ${safe}</button>`;
        });
        ch.innerHTML = html;
      }
     }
     function renderUserList() {
       const server = currentServer ? servers.find(sv => sv.id === currentServer) : null;
       const scope = server ? (server.members || []) : (user ? [...knownUsers(), user] : knownUsers());
       const presMap = new Map(lastPresenceUsers.map(p => [p.user, p]));
       const colors = { online: '#23a55a', idle: '#f0b232', dnd: '#f23f43', offline: '#80848e' };
       const labels = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };
       const order = { online: 0, idle: 1, dnd: 2, offline: 3 };
       const seen = new Set();
       const online = [], offline = [];
       scope.forEach(name => {
         if (!name || seen.has(name)) return;
         seen.add(name);
         const p = presMap.get(name);
         if (p) online.push({ ...p, status: effStatus(p) });
         else if (name === user) online.push({ user: name, status: 'online' });
         else offline.push(name);
       });
       online.sort((a,b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.user.localeCompare(b.user));
       offline.sort((a,b) => a.localeCompare(b));
       const row = (name, status) =>
         `<div class="member ${status === 'offline' ? 'off' : ''}" data-user="${escHtml(name)}" onclick="openProfile(this.dataset.user)">` +
           `<div class="member-avatar">${escHtml((name||'?')[0].toUpperCase())}<span class="status-dot" title="${labels[status]||'Online'}" style="background:${colors[status]||'#80848e'}"></span></div>` +
           `<div class="member-name">${escHtml(name)}</div>` +
         `</div>`;
       const ul = document.getElementById('user-list');
       const sig = 'O:' + online.map(u => u.user + ':' + u.status).join('|') + '#F:' + offline.join('|') + '#' + (currentServer || '') + '/' + (mode || '');
       if (sig !== userListSig) {
         userListSig = sig;
         let html = online.map(u => row(u.user, u.status)).join('');
         if (offline.length) html += `<div class="rs-cat">Offline — ${offline.length}</div>` + offline.map(n => row(n, 'offline')).join('');
         ul.innerHTML = (online.length || offline.length) ? html : `<div class="rs-empty">No one is around...</div>`;
         if (mode === 'dms') renderSidebar();
       }
       const rt = document.getElementById('rs-title');
       if (rt) rt.textContent = 'Online — ' + online.length;
     }
     let userListSig = '';
     setInterval(() => { if (user && lastPresenceUsers.length) renderUserList(); }, 15000);
     function updateHeader() {
      const h = document.getElementById('chat-header');
      h.style.display = 'flex';
      if (mode === 'dms' && dmWith) {
        h.innerHTML = `<span class="hash">@</span><span class="hname">${escHtml(dmWith)}</span>`;
      } else if (mode === 'dms') {
        h.innerHTML = `<span class="hname">Direct Messages</span>`;
      } else {
        const label = chan && chan.startsWith('srv_') ? chan.split('_').slice(2).join('_') : (chan || 'general');
        h.innerHTML = `<span class="hash">#</span><span class="hname">${escHtml(label)}</span>`;
      }
      document.body.classList.toggle('dm-mode', mode === 'dms');
      document.getElementById('chat-input').placeholder = (mode === 'dms' && dmWith) ? 'Message @' + dmWith : 'Message #' + (chan || 'general');
    }
    window.editMsg = async (id,txt) => { const t = await appPrompt("Edit:", txt); if (t) await updateDoc(doc(db,"messages",id),{text:t}); }
    window.deleteMsg = async (id) => { if (await appConfirm("Delete?")) await deleteDoc(doc(db,"messages",id)); }
    window.setReply = (id,u,t) => { reply = { id, user: u, text: t }; document.getElementById('reply-preview').style.display = 'block'; document.getElementById('reply-user').textContent = u; }
    window.cancelReply = () => { reply = null; document.getElementById('reply-preview').style.display = 'none'; }
    window.showTab = (t) => { document.getElementById('emoji-tab').style.display = t==='emojis'?'grid':'none'; document.getElementById('gif-tab').style.display = t==='gifs'?'flex':'none'; };
    window.insertEmoji = (e) => { document.getElementById('chat-input').value += e; document.getElementById('media-picker').style.display = 'none'; }
    
    document.getElementById('emoji-btn').addEventListener('click', () => {
      const p = document.getElementById('media-picker'); p.style.display = p.style.display==='none'?'flex':'none';
    });

    const emojis = ['😀','😂','😍','🥰','😘','😎','🤩','🥳','🤔','😮','😢','😡','🤯','😱','😴','🤤','😵','🤪','😜','😛','🤑','🤫','🤭','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵‍💫','🤠','😈','👿','👹','👺','🤡','👻','👽','👾','🤖','💩','😺','😸','😹','😻','😼','😽','🙀','😿','😾','👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄','💋','🩸','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','🔥','✨','⭐','🌟','💫','⚡','☀️','🌙','☁️','🌧','⛈','🌩','❄️','☃️','⛄','🌬','💨','🌪','🌈','☂️','☔','⚡','🎉','🎊','🎈','🎁','🎀','🏆','🥇','🥈','🥉','🏅','🎖','🎯','🎲','🎮','🕹','🎰','🧩','♟','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🪕','📱','💻','⌨️','🖥','🖨','🖱','🖲','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🎙','🎚','🎛','⏱','⏲','⏰'];
    document.getElementById('emoji-tab').innerHTML = emojis.map(e => `<span style="cursor:pointer;" onclick="insertEmoji('${e}')">${e}</span>`).join('');

    let gifTimer = null, gifQuery = '', gifOffset = 0, gifLoading = false, gifHasMore = true;
    const GIPHY_KEY = 'gmckadHbkEbJaNUWq5RRkydofZmoj8Mp';
    const gifResults = document.getElementById('gif-results');

    const renderGifBatch = (gifs, append) => {
      const html = gifs.map(g => {
        const u = g.images.fixed_height.url;
        const safe = escHtml(u);
        const w = parseInt(g.images.fixed_height.width, 10) || 0;
        const h = parseInt(g.images.fixed_height.height, 10) || 0;
        const ar = (w > 0 && h > 0) ? `aspect-ratio:${w}/${h};` : '';
        return `<img data-src="${safe}" src="" alt="gif" loading="lazy" style="width:100%; height:auto; ${ar}display:block; cursor:pointer; border-radius:6px; background:#232428;" onclick="sendGif('${safe}')">`;
      }).join('');
      if (append) gifResults.insertAdjacentHTML('beforeend', html);
      else gifResults.innerHTML = html;
      observeGifs();
    };

    const fetchGifs = async (q, offset, append) => {
      if (gifLoading) return;
      gifLoading = true;
      if (!append) gifResults.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--mut);padding:20px;">Loading…</div>';
      try {
        const url = q
          ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=12&offset=${offset}&rating=pg-13`
          : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&offset=${offset}&rating=pg-13`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Giphy ' + res.status);
        const json = await res.json();
        const gifs = json.data || [];
        const total = (json.pagination && json.pagination.total_count) || Infinity;
        gifHasMore = gifs.length === 12 && (offset + gifs.length < total);
        gifOffset = offset + gifs.length;
        if (gifs.length) renderGifBatch(gifs, append && offset > 0);
        else if (!append) gifResults.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--mut);padding:20px;">No GIFs found</div>';
      } catch (err) {
        if (!append) gifResults.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#ff4757;padding:20px;">Failed to load GIFs</div>';
      } finally {
        gifLoading = false;
      }
    };

    const gifObserver = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        const img = en.target;
        if (en.isIntersecting) {
          if (img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src;
        } else {
          if (img.getAttribute('src')) img.removeAttribute('src');
        }
      });
    }, { root: gifResults, threshold: 0.1 });

    function observeGifs() {
      gifResults.querySelectorAll('img[data-src]').forEach(img => gifObserver.observe(img));
    }

    const chatImgObserver = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        const img = en.target;
        if (en.isIntersecting) {
          if (img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src;
        } else {
          const s = img.getAttribute('src');
          if (s) {
            img.dataset.src = s;
            if (img.naturalWidth && img.naturalHeight && !img.style.aspectRatio) img.style.aspectRatio = img.naturalWidth + '/' + img.naturalHeight;
            img.removeAttribute('src');
          }
        }
      });
    }, { root: document.getElementById('message-container'), threshold: 0.1 });

    function observeChatImages() {
      document.querySelectorAll('#message-container img[data-src]').forEach(img => chatImgObserver.observe(img));
    }

    document.getElementById('gif-search').addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(gifTimer);
      gifTimer = setTimeout(() => {
        gifQuery = q;
        gifOffset = 0;
        gifHasMore = true;
        fetchGifs(q.length < 2 ? '' : q, 0, false);
      }, 300);
    });

    gifResults.addEventListener('scroll', () => {
      if (gifLoading || !gifHasMore) return;
      if (gifResults.scrollTop + gifResults.clientHeight >= gifResults.scrollHeight - 60) {
        fetchGifs(gifQuery, gifOffset, true);
      }
    });

    window.showTab = (t) => {
      document.getElementById('emoji-tab').style.display = t==='emojis'?'grid':'none';
      document.getElementById('gif-tab').style.display = t==='gifs'?'flex':'none';
      if (t === 'gifs' && !gifResults.querySelector('img')) fetchGifs(gifQuery, 0, false);
    };

    window.sendGif = async (url) => {
      document.getElementById('media-picker').style.display = 'none';
      await addDoc(collection(db,"messages"),{text:`<img src="${url}" style="max-width: min(320px, 100%); border-radius:8px; display:block;">`,user,channel:chan,pfp,timestamp:serverTimestamp()});
    };

    async function updatePresence(s) { if (user) { curStat = s; await setDoc(doc(db,"presence",user),{user,status:s,lastActive:serverTimestamp()},{merge:true}); } }

    document.getElementById('message-container').addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]'); if (!el) return;
      const act = el.dataset.action, id = el.dataset.id;
      if (act === 'edit') window.editMsg(id, el.dataset.text || '');
      else if (act === 'delete') window.deleteMsg(id);
      else if (act === 'reply') {
        const msg = el.closest('.msg'), body = msg && msg.querySelector('.msg-bubble');
        window.setReply(id, el.dataset.user, body ? body.textContent : '');
      }
    });

    function serverMenu() { openServerModal(); }
    function openServerModal() {
      document.getElementById('sm-name').value = '';
      document.getElementById('sm-code').value = '';
      document.getElementById('sm-result').textContent = '';
      showServerTab('create');
      document.getElementById('server-modal').style.display = 'flex';
    }
    function closeServerModal() { document.getElementById('server-modal').style.display = 'none'; }
    function showServerTab(tab) {
      document.getElementById('sm-create').style.display = tab==='create'?'block':'none';
      document.getElementById('sm-join').style.display = tab==='join'?'block':'none';
      document.getElementById('sm-create-tab').style.background = tab==='create'?'var(--bl)':'var(--bg-t)';
      document.getElementById('sm-create-tab').style.color = tab==='create'?'#000':'#fff';
      document.getElementById('sm-join-tab').style.background = tab==='join'?'var(--bl)':'var(--bg-t)';
      document.getElementById('sm-join-tab').style.color = tab==='join'?'#000':'#fff';
    }
    async function createServerFromModal() {
      const name = document.getElementById('sm-name').value.trim(); if (!name) { appAlert('Enter a server name'); return; }
      const code = Math.random().toString(36).substring(2,8).toUpperCase();
      const ref = await addDoc(collection(db,'servers'), { name, owner: user, inviteCode: code, members: [user], admins: [], channels: [{name:'general', id:'general'}], createdAt: serverTimestamp() });
      document.getElementById('sm-result').textContent = 'Created! Invite code: ' + code;
      await loadServers();
      switchServer(ref.id);
    }
    async function joinServerFromModal() {
      const code = document.getElementById('sm-code').value.trim(); if (!code) { appAlert('Enter an invite code'); return; }
      await joinServer(code);
      closeServerModal();
    }
    window.openServerModal = openServerModal;
    window.closeServerModal = closeServerModal;
    window.showServerTab = showServerTab;
    window.createServerFromModal = createServerFromModal;
    window.joinServerFromModal = joinServerFromModal;
    async function createServer() {
      const name = await appPrompt('Server name:'); if (!name) return;
      const code = Math.random().toString(36).substring(2,8).toUpperCase();
      const ref = await addDoc(collection(db,'servers'), { name, owner: user, inviteCode: code, members: [user], admins: [], channels: [{name:'general', id:'general'}], createdAt: serverTimestamp() });
      appAlert('Server created! Invite code: ' + code);
      await loadServers();
      switchServer(ref.id);
    }
    async function joinServer(codeParam) {
      const code = codeParam || await appPrompt('Invite code:'); if (!code) return;
      const snap = await getDocs(query(collection(db,'servers'), where('inviteCode','==', code.trim().toUpperCase())));
      if (snap.empty) { appAlert('Invalid code'); return; }
      const s = snap.docs[0];
      const data = s.data();
      if ((data.members||[]).includes(user)) { switchServer(s.id); return; }
      await updateDoc(doc(db,'servers',s.id), { members: [...(data.members||[]), user] });
      appAlert('Joined ' + data.name);
      await loadServers();
      switchServer(s.id);
    }
    async function loadServers() {
      const snap = await getDocs(query(collection(db,'servers'), where('members','array-contains', user)));
      servers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderServerList();
    }
    function renderServerList() {
      const el = document.getElementById('server-list');
      el.innerHTML = servers.map(s => {
        const active = currentServer === s.id;
        const iconStyle = s.icon ? `background-image:url('${s.icon}');background-size:cover;background-position:center;` : '';
        return `<div class="si ${active?'active':''}" onclick="switchServer('${s.id}')" oncontextmenu="showServerCtx(event,'${s.id}')" title="${escHtml(s.name)}" style="${iconStyle}">${s.icon?'':escHtml(s.name)[0].toUpperCase()}</div>`;
      }).join('');
     }
     let ctxServerId = null;
     function showServerCtx(e, sid) {
       e.preventDefault();
       ctxServerId = sid;
       const m = document.getElementById('server-ctx');
       const s = servers.find(x=>x.id===sid);
       const isOwner = s && s.owner === user;
       const isAdmin = s && (isOwner || (s.admins||[]).includes(user));
       document.getElementById('ctx-settings').style.display = isAdmin ? 'block' : 'none';
       document.getElementById('ctx-leave').style.display = 'block';
       m.style.display = 'block';
       m.style.left = e.clientX + 'px';
       m.style.top = e.clientY + 'px';
     }
     function hideServerCtx() { document.getElementById('server-ctx').style.display = 'none'; }
     document.addEventListener('click', hideServerCtx);
     function openServerSettings(sid) {
       if (sid) ctxServerId = sid;
       hideServerCtx();
       const s = servers.find(x=>x.id===ctxServerId); if (!s) return;
       const isOwner = s.owner === user;
       const isAdmin = isOwner || (s.admins||[]).includes(user);
       document.getElementById('ss-name').value = s.name || '';
       document.getElementById('ss-desc').value = s.description || '';
       document.getElementById('ss-icon-url').value = s.icon || '';
       document.getElementById('ss-banner-url').value = s.banner || '';
       document.getElementById('ss-preview').innerHTML = s.banner ? `<img src="${escHtml(s.banner)}" style="width:100%;height:60px;object-fit:cover;border-radius:6px;">` : '';
       // admins section (owner only)
       const adminsSection = document.getElementById('ss-admins-section');
       const deleteBtn = document.getElementById('ss-delete-btn');
       if (isOwner) {
         adminsSection.style.display = 'block';
         deleteBtn.style.display = 'inline-block';
         renderMembersList(s);
       } else {
         adminsSection.style.display = 'none';
         deleteBtn.style.display = 'none';
       }
       // disable editing for non-admins
       const canEdit = isAdmin;
       ['ss-name','ss-desc','ss-icon-url','ss-banner-url','ss-icon-file','ss-banner-file'].forEach(id => {
         const el = document.getElementById(id); if (el) el.disabled = !canEdit;
       });
       document.getElementById('server-settings-modal').style.display = 'flex';
     }
     function renderMembersList(s) {
       const el = document.getElementById('ss-members');
       const admins = s.admins || [];
       el.innerHTML = (s.members||[]).map(m => {
         const isAdmin = admins.includes(m);
         const isOwner = (m === s.owner);
         let badge = isOwner ? ' (Owner)' : (isAdmin ? ' (Admin)' : '');
         let btn = '';
         if (!isOwner && s.owner === user) {
           btn = isAdmin
             ? `<button onclick="toggleAdmin('${escHtml(m)}',false)" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:#ff4757;color:#fff;cursor:pointer;">Remove Admin</button>`
             : `<button onclick="toggleAdmin('${escHtml(m)}',true)" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--bl);color:#000;cursor:pointer;">Make Admin</button>`;
         }
         return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bg-t);font-size:12px;color:var(--txt);"><span>${escHtml(m)}${badge}</span>${btn}</div>`;
       }).join('');
     }
     async function toggleAdmin(member, makeAdmin) {
       const s = servers.find(x=>x.id===ctxServerId); if (!s) return;
       const admins = new Set(s.admins || []);
       if (makeAdmin) admins.add(member); else admins.delete(member);
       await updateDoc(doc(db,'servers',ctxServerId), { admins: Array.from(admins) });
       await loadServers();
       const updated = servers.find(x=>x.id===ctxServerId);
       if (updated) renderMembersList(updated);
     }
     async function deleteServer() {
       const s = servers.find(x=>x.id===ctxServerId); if (!s) return;
       if (s.owner !== user) { appAlert('Only the owner can delete the server'); return; }
       if (!(await appConfirm('Delete server "' + s.name + '"? This cannot be undone.'))) return;
       // delete all messages in server channels
       // (skip message cleanup for simplicity; just delete server doc)
       await deleteDoc(doc(db,'servers',ctxServerId));
       if (currentServer === ctxServerId) { currentServer = null; chan = 'general'; mode='channels'; dmWith=null; }
       await loadServers();
       if (currentServer) switchServer(currentServer);
       else { document.querySelector('.sb h3').textContent='Channels'; document.getElementById('server-banner').style.display='none'; document.querySelector('.ch').innerHTML = `<div class=\"cat\">Text Channels</div><button class=\"cb ${chan==='general'?'active':''}\" onclick=\"switchChannel('general')\"># general</button><button class=\"cb ${chan==='random'?'active':''}\" onclick=\"switchChannel('random')\"># random</button>`; updateHeader(); listen(); }
       closeServerSettings();
     }
     window.deleteServer = deleteServer;
     window.toggleAdmin = toggleAdmin;
     function closeServerSettings() { document.getElementById('server-settings-modal').style.display = 'none'; }
     async function saveServerSettings() {
       const s = servers.find(x=>x.id===ctxServerId); if (!s) return;
       const isOwner = s.owner === user;
       const isAdmin = isOwner || (s.admins||[]).includes(user);
       if (!isAdmin) { appAlert('No permission'); return; }
       const name = document.getElementById('ss-name').value.trim() || s.name;
       const description = document.getElementById('ss-desc').value.trim();
       let icon = document.getElementById('ss-icon-url').value.trim();
       let banner = document.getElementById('ss-banner-url').value.trim();
       // file uploads override urls
       const iconFile = document.getElementById('ss-icon-file').files[0];
       const bannerFile = document.getElementById('ss-banner-file').files[0];
       if (iconFile) icon = await fileToDataUrl(iconFile);
       if (bannerFile) banner = await fileToDataUrl(bannerFile);
       await updateDoc(doc(db,'servers',ctxServerId), { name, description, icon, banner });
       await loadServers();
       if (currentServer === ctxServerId) switchServer(ctxServerId);
       closeServerSettings();
     }
     function fileToDataUrl(file) {
       return new Promise((resolve, reject) => {
         if (file.size > 250000) { reject(new Error('Image too large (max 250KB)')); return; }
         const r = new FileReader();
         r.onload = () => resolve(r.result);
         r.onerror = reject;
         r.readAsDataURL(file);
       });
     }
     async function leaveServer() {
       hideServerCtx();
       const s = servers.find(x=>x.id===ctxServerId); if (!s) return;
       if (!(await appConfirm('Leave ' + s.name + '?'))) return;
       await updateDoc(doc(db,'servers',ctxServerId), { members: (s.members||[]).filter(m=>m!==user) });
       if (currentServer === ctxServerId) { currentServer = null; chan = 'general'; mode='channels'; dmWith=null; }
       await loadServers();
       if (currentServer) switchServer(currentServer); else { document.querySelector('.sb h3').textContent='Channels'; document.getElementById('server-banner').style.display='none'; document.querySelector('.ch').innerHTML = `<div class="cat">Text Channels</div><button class="cb ${chan==='general'?'active':''}" onclick="switchChannel('general')"># general</button><button class="cb ${chan==='random'?'active':''}" onclick="switchChannel('random')"># random</button>`; updateHeader(); listen(); }
     }
     // wire ctx menu clicks
     document.getElementById('ctx-settings').onclick = openServerSettings;
     document.getElementById('ctx-leave').onclick = leaveServer;
     window.hideServerCtx = hideServerCtx;
     window.showServerCtx = showServerCtx;
     window.openServerSettings = openServerSettings;
     window.closeServerSettings = closeServerSettings;
     window.saveServerSettings = saveServerSettings;
     window.leaveServer = leaveServer;

     function switchServer(id) {
      currentServer = id;
      mode = 'channels';
      dmWith = null;
      document.getElementById('dm-btn').classList.remove('active');
      const s = servers.find(x=>x.id===id);
      if (!s) { currentServer = null; }
      if (currentServer) {
        const firstCh = (s.channels && s.channels[0]) ? s.channels[0].name : 'general';
        chan = 'srv_' + currentServer + '_' + firstCh;
        document.querySelector('.sb h3').textContent = s.name;
        const banner = document.getElementById('server-banner');
        const bannerName = document.getElementById('server-banner-name');
        if (s.banner) { banner.style.display = 'block'; banner.style.backgroundImage = 'url(' + s.banner + ')'; }
        else { banner.style.display = 'none'; banner.style.backgroundImage = ''; }
        bannerName.textContent = s.name;
        if (s.description) banner.title = s.description;
        const chBtns = `<div class="cat">Text Channels</div>` + (s.channels||[{name:'general'}]).map(c => `<button class="cb ${chan===('srv_'+currentServer+'_'+c.name)?'active':''}" onclick="switchServerChannel('${s.id}','${escHtml(c.name)}')"># ${escHtml(c.name)}</button>`).join('');
        document.querySelector('.ch').innerHTML = chBtns +
          `<button class="cb muted" onclick="createChannel('${s.id}')" style="color:var(--bl);">+ Add Channel</button>` +
          `<button class="cb muted" onclick="shareInvite('${s.id}')">Invite Code: ${escHtml(s.inviteCode)}</button>`;
      } else {
        chan = 'general'; mode='channels'; dmWith=null;
        document.querySelector('.sb h3').textContent = 'Channels';
        document.getElementById('server-banner').style.display = 'none';
         document.querySelector('.ch').innerHTML = `<div class="cat">Text Channels</div><button class="cb ${chan==='general'?'active':''}" onclick="switchChannel('general')"># general</button><button class="cb ${chan==='random'?'active':''}" onclick="switchChannel('random')"># random</button>`;
      }
      renderServerList();
      updateHeader();
      renderUserList();
      listen();
    }
    window.switchServerChannel = (sid, cname) => {
      const s = servers.find(x=>x.id===sid);
      if (!s) return;
      currentServer = sid;
      mode = 'channels';
      dmWith = null;
      document.getElementById('dm-btn').classList.remove('active');
      chan = 'srv_' + sid + '_' + cname;
      document.querySelector('.ch').innerHTML = `<div class="cat">Text Channels</div>` + (s.channels||[{name:'general'}]).map(c => `<button class="cb ${chan===('srv_'+sid+'_'+c.name)?'active':''}" onclick="switchServerChannel('${sid}','${escHtml(c.name)}')"># ${escHtml(c.name)}</button>`).join('') +
        `<button class="cb muted" onclick="createChannel('${sid}')" style="color:var(--bl);">+ Add Channel</button>` +
        `<button class="cb muted" onclick="shareInvite('${sid}')">Invite Code: ${escHtml(s.inviteCode)}</button>`;
      renderServerList();
      updateHeader();
      renderUserList();
      listen();
    };
    async function createChannel(sid) {
      const name = await appPrompt('Channel name:'); if (!name) return;
      const s = servers.find(x=>x.id===sid); if (!s) return;
      const channels = s.channels || [{name:'general',id:'general'}];
      if (channels.some(c=>c.name===name)) { appAlert('Channel already exists'); return; }
      channels.push({name, id: name});
      await updateDoc(doc(db,'servers',sid), { channels });
      await loadServers();
      switchServerChannel(sid, name);
    }
    async function shareInvite(sid) {
      const s = servers.find(x=>x.id===sid); if (!s) return;
      const link = window.location.origin + window.location.pathname + '?join=' + s.inviteCode;
      try { await navigator.clipboard.writeText(link); appAlert('Invite link copied:\n' + link); }
      catch(e) { appAlert('Invite link (copy manually):\n' + link); }
    }
    window.createChannel = createChannel;
    window.shareInvite = shareInvite;
    window.serverMenu = serverMenu;
    window.switchServer = switchServer;
    window.joinServer = joinServer;
    window.loadServers = loadServers;

    // Profiles
    window.openProfile = (u) => {
      const modal = document.getElementById('profile-modal');
      document.getElementById('prof-avatar').textContent = (u||'?')[0].toUpperCase();
      document.getElementById('prof-name').textContent = u;
      const pres = Array.from(document.getElementById('user-list').children).find(el => el.dataset.user === u);
      const dot = pres && pres.querySelector('.status-dot');
      document.getElementById('prof-status').textContent = dot ? (dot.getAttribute('title') || 'Online') : 'Offline';
      const actions = document.getElementById('prof-actions');
      let html = '';
      if (u !== user) {
        html += `<button onclick="sendReq('${escHtml(u)}'); closeProfile();" style="background:var(--bl);color:#000;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Send Friend Request</button>`;
        html += `<button onclick="openDM('${escHtml(u)}'); closeProfile();" style="background:var(--bg-t);color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">Message</button>`;
      } else {
        html += `<div style="color:var(--mut);font-size:12px;">This is you</div>`;
      }
      actions.innerHTML = html;
      modal.style.display = 'flex';
    };
    window.closeProfile = () => { document.getElementById('profile-modal').style.display = 'none'; };

    // make active users clickable
    // (patch presence render to add onclick) done below
    function fmtMsgTime(ts) {
      try {
        const d = ts && ts.toDate ? ts.toDate() : null;
        if (!d) return '';
        const same = d.toDateString() === new Date().toDateString();
        return (same ? 'Today at ' : d.toLocaleDateString([], {month:'short', day:'numeric'}) + ' at ') + d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
      } catch (e) { return ''; }
    }
    function listen() {
      if (!chan) {
        if (unsub) { unsub(); unsub = null; }
        const container = document.getElementById('message-container');
        container.innerHTML = '<div class="msgs-empty">Select a user to start a DM</div>';
        return;
      }
      if (unsub) unsub();
      unsub = onSnapshot(query(collection(db,"messages"),orderBy("timestamp","asc")), (snap) => {
        const container = document.getElementById('message-container');
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.channel === chan);
        container.innerHTML = docs.map(m => {
          const me = m.user === user;
          const safeUser = escHtml(m.user);
          const av = (m.pfp && !m.pfp.startsWith('file:///')) ? `style="background-image:url('${escHtml(m.pfp)}');text-indent:-9999px;"` : '';
          const rep = m.replyTo ? `<div class="msg-reply"><span class="bar"></span><span>Replying to <b>@${escHtml(m.replyTo.user)}</b> ${escHtml(m.replyTo.text)}</span></div>` : '';

          const textVal = String(m.text ?? '');
          const isP = textVal.includes('@everyone') || textVal.includes(`@${user}`);

          const btns = me ? `<span data-action="edit" data-id="${m.id}" data-text="${escHtml(textVal)}" style="color:var(--bl);">Edit</span><span data-action="delete" data-id="${m.id}" style="color:#f23f43;">Delete</span>` : '';
          const rBtn = `<span data-action="reply" data-id="${m.id}" data-user="${safeUser}" style="color:var(--mut);">Reply</span>`;
          return `
            <div class="msg ${me ? 'me' : ''} ${isP ? 'mention' : ''}" data-id="${m.id}">
              <div class="pfp" ${av}>${safeUser ? safeUser[0].toUpperCase() : '?'}</div>
              <div class="msg-content">
                <div class="msg-head">
                  <span class="msg-author ${me ? 'self' : ''}">${safeUser}</span>
                  <span class="msg-time">${fmtMsgTime(m.timestamp)}</span>
                  <span class="msg-actions">${rBtn}${btns}</span>
                </div>
                ${rep}
                <div class="msg-bubble">${renderText(textVal)}</div>
              </div>
            </div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
        observeChatImages();
        snap.docChanges().forEach(c => {
          if (c.type === "added" && user) {
            const m = c.doc.data();
            const mt = m.timestamp ? m.timestamp.toMillis() : Date.now();
            if (mt > appLoadTime && m.user && m.user !== user && document.hidden) {
              const txt = String(m.text ?? '');
              const isP = txt.includes('@everyone') || txt.includes(`@${user}`);
              new Notification(isP ? `⚠️ PINGED` : `@${m.user}`, { body: txt.includes('<img') ? 'Sent a GIF 📷' : txt });
            }
          }
        });
      });
    }

    const atPopup = document.getElementById('at-popup');
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('input', (e) => {
      const val = e.target.value; const at = val.lastIndexOf('@');
      if (at !== -1 && at === val.length - 1) {
        const uList = knownUsers();
        atPopup.innerHTML = ['everyone', ...uList].map(u => `<div style="cursor:pointer;padding:6px 12px;border-radius:4px;color:#fff;" data-u="${escHtml(u)}" onmouseover="this.style.background='var(--bl)'" onmouseout="this.style.background='transparent'">@${escHtml(u)}</div>`).join('');
        atPopup.style.display = 'flex';
      } else if (!val.includes('@') || val.endsWith(' ')) { atPopup.style.display = 'none'; }
    });
    atPopup.addEventListener('click', (e) => { const el = e.target.closest('[data-u]'); if (el) window.insertAt(el.dataset.u); });
    window.insertAt = (u) => { const val = chatInput.value; const at = val.lastIndexOf('@'); chatInput.value = val.substring(0, at) + `@${u} `; atPopup.style.display = 'none'; chatInput.focus(); }

    window.handleKeyPress = async (e) => {
      if (e.key === 'Enter' && e.target.value.trim() && user) {
        const t = e.target.value; e.target.value = '';
        const payload = { text: t, user, channel: chan, pfp, timestamp: serverTimestamp() };
        if (reply) { payload.replyTo = { user: reply.user, text: reply.text }; window.cancelReply(); }
        await addDoc(collection(db, "messages"), payload);
      }
    }

    document.getElementById('auth-submit-btn').addEventListener('click', () => {
      const u = document.getElementById('auth-username').value.trim();
      const p = document.getElementById('auth-password').value.trim();
      if (!u || !p) { appAlert("Please enter both fields."); return; }
      if (isSignUpMode) { createUserWithEmailAndPassword(auth, u + "@friends.com", p).catch(err => appAlert(err.message)); }
      else { signInWithEmailAndPassword(auth, u + "@friends.com", p).catch(err => appAlert(err.message)); }
    });

    document.getElementById('auth-switch-btn').addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      document.getElementById('auth-title').textContent = isSignUpMode ? 'Create Account' : 'Welcome Back';
      document.getElementById('auth-submit-btn').textContent = isSignUpMode ? 'Sign Up' : 'Login';
      document.getElementById('auth-switch-prompt').textContent = isSignUpMode ? 'Already have an account?' : "Don't have an account?";
      document.getElementById('auth-switch-btn').textContent = isSignUpMode ? 'Login' : 'Sign up';
    });

    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
    const statusSel = document.getElementById('status-select');
    if (statusSel) {
      statusSel.value = curStat;
      statusSel.addEventListener('change', () => { updatePresence(statusSel.value); });
    }
    window.render = () => {};