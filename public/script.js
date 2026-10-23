import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js'
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js'
    import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, where, getDocs, getDoc } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js'


    const config = { apiKey: "AIzaSyDicR3VX9ClJoO8SDEu_xMGR4fbbqsrSVE", authDomain: "discordcord-7c0b2.firebaseapp.com", projectId: "discordcord-7c0b2", storageBucket: "discordcord-7c0b2.firebasestorage.app", messagingSenderId: "138455635458", appId: "1:138455635458:web:a236f0ceca0cb6de22b91b" };
    const app = initializeApp(config), auth = getAuth(app), db = getFirestore(app);
    let chan = 'general', user = null, unsub = null, typingUnsub = null, typingTimer = null, isSignUpMode = false, pfp = '', reply = null, curStat = 'online', idle = null, mode = 'channels', dmWith = null, servers = [], currentServer = null, lastPresenceUsers = [], lastRead = {};
    let heartbeat = null, idleNow = false, lastActivity = Date.now();
    let allUsers = [], backfillUsers = [], userPfpMap = new Map();
    const MAX_PFP_BYTES = 500 * 1024; // 500KB cap so messages stay under Firestore 1MB limit
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
      if (gif && SAFE_IMG.test(gif[1])) {
        const u = gif[1];
        const d = (typeof chatGifDims !== 'undefined' && chatGifDims[u]) ? chatGifDims[u] : null;
        const ar = d ? `aspect-ratio:${d.w}/${d.h};` : 'aspect-ratio:4/3;';
        return `<img data-src="${escHtml(u)}" src="" alt="gif" loading="lazy" style="max-width: min(320px, 100%); border-radius:8px; display:block; background:transparent; min-height:60px; ${ar}">`;
      }
      return renderMarkdown(raw);
    };
    const renderMarkdown = (raw) => {
      let s = String(raw ?? '');
      const codeBlocks = [];
      s = s.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        const i = codeBlocks.length;
        codeBlocks.push(code);
        return '\u0000CB' + i + '\u0000';
      });
      s = escHtml(s);
      s = s.replace(/\|\|([\s\S]+?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
      s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
      s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<i>$2</i>');
      s = s.replace(/~~([\s\S]+?)~~/g, '<s>$1</s>');
      s = s.replace(/`([^`\n]+?)`/g, '<code class="inline-code">$1</code>');
      s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
      s = s.replace(/(^|\s)@(\w+)/g, (m, space, name) => space + '<span class="mention">@' + name + '</span>');
      s = s.replace(/\u0000CB(\d+)\u0000/g, (_, i) => {
        const code = codeBlocks[parseInt(i, 10)] || '';
        return '<pre class="codeblock"><code>' + escHtml(code).replace(/^\n/, '').replace(/\n$/, '') + '</code></pre>';
      });
      return s;
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
          allUsers = []; userPfpMap.clear();
          snap.docs.forEach(d => {
            const data = d.data();
            if (data.user) allUsers.push(data.user);
            if (data.user && data.pfp) userPfpMap.set(data.user, data.pfp);
          });
          renderUserList();
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
        onSnapshot(query(collection(db,"friends"),where("to","==",user)),(snap)=>{
          const pending = snap.docs.filter(d => d.data().status === "pending");
          document.getElementById('req-list').innerHTML = pending.map(d=>{
            const data = d.data();
            return `<div>${escHtml(data.from)} sent you a request <button onclick="acceptReq('${d.id}')" style="font-size:10px;padding:2px 6px;background:var(--bl);color:#000;border:none;border-radius:3px;">Accept</button> <button onclick="declineReq('${d.id}')" style="font-size:10px;padding:2px 6px;background:#ff4757;color:#fff;border:none;border-radius:3px;">Decline</button></div>`;
          }).join('');
        });
        pfp = localStorage.getItem('pfp_'+user) || '';
        if (pfp.startsWith('file:///')) { pfp = ''; localStorage.removeItem('pfp_'+user); }
        if (pfp) { document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`; document.getElementById('my-pfp').textContent = ''; }
        await setDoc(doc(db,"users",user),{user,pfp,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
        listen();
        loadServers().then(() => {
          const params = new URLSearchParams(window.location.search);
          const joinCode = params.get('join');
          if (joinCode) { joinServer(joinCode); }
        });
      } else { if (heartbeat) { clearInterval(heartbeat); heartbeat = null; } if (user) setDoc(doc(db,"presence",user),{status:'offline'},{merge:true}); document.getElementById('auth-overlay').style.display = 'flex'; }
    });

    window.acceptReq = async (id) => {
      await updateDoc(doc(db,"friends",id),{status:"accepted"});
      appAlert("Friend request accepted!");
    };
    window.declineReq = async (id) => {
      await updateDoc(doc(db,"friends",id),{status:"declined"});
      appAlert("Request declined.");
    };
    window.sendReq = async (u) => {
      if (!u || u === user) { appAlert("You can't friend yourself."); return; }
      // Block duplicate outgoing pending requests
      const existing = await getDocs(query(
        collection(db,"friends"),
        where("from","==",user),
        where("to","==",u),
        where("status","==","pending")
      ));
      if (!existing.empty) {
        appAlert("Friend request already sent to " + u);
        return;
      }
      // Block if they already sent you one (tell them to accept instead)
      const incoming = await getDocs(query(
        collection(db,"friends"),
        where("from","==",u),
        where("to","==",user),
        where("status","==","pending")
      ));
      if (!incoming.empty) {
        appAlert(u + " has already sent you a friend request. Check your requests.");
        return;
      }
      await addDoc(collection(db,"friends"),{from:user,to:u,status:"pending",timestamp:serverTimestamp()});
    };
    window.cancelReq = async (id) => {
      await updateDoc(doc(db,"friends",id),{status:"canceled"});
      appAlert("Request canceled.");
    };

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

    const compressImage = async (file, maxSize = 512) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          const scale = Math.min(maxSize / w, maxSize / h, 1);
          w = Math.round(w * scale); h = Math.round(h * scale);
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const types = ['image/avif', 'image/webp', 'image/jpeg'];
          let i = 0;
          const tryNext = () => {
            if (i >= types.length) { resolve(canvas.toDataURL('image/jpeg', 0.85)); return; }
            const url = canvas.toDataURL(types[i], 0.85);
            if (url.startsWith('data:' + types[i] + ';')) { resolve(url); }
            else { i++; tryNext(); }
          };
          tryNext();
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    };
    const drop = document.getElementById('pfp-dropzone');
    drop.ondragover = (e) => e.preventDefault();
    drop.ondrop = async (e) => {
      e.preventDefault(); const f = e.dataTransfer.files[0];
      if (!f || !f.type.startsWith('image/')) return;
      if (f.size > MAX_PFP_BYTES) { appAlert('PFP too large (max 500KB).'); return; }
      try {
        pfp = await compressImage(f);
        localStorage.setItem('pfp_'+user, pfp);
        await setDoc(doc(db,"users",user),{user,pfp,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
        document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`;
        document.getElementById('my-pfp').textContent = '';
        listen();
      } catch (err) { appAlert('Failed to process image.'); }
    };
    document.getElementById('pfp-file-input').onchange = async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > MAX_PFP_BYTES) { appAlert('PFP too large (max 500KB).'); e.target.value = ''; return; }
      try {
        pfp = await compressImage(f);
        localStorage.setItem('pfp_'+user, pfp);
        await setDoc(doc(db,"users",user),{user,pfp,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
        document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`;
        document.getElementById('my-pfp').textContent = '';
        listen();
        e.target.value = '';
      } catch (err) { appAlert('Failed to process image.'); }
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
    const unreadBadge = (c) => {
      const n = (window._unreadCounts && window._unreadCounts[c]) || 0;
      return n > 0 ? '<span class="badge">' + n + '</span>' : '';
    };

    function renderSidebar() {
      const h3 = document.querySelector('.sb h3');
      const ch = document.querySelector('.ch');
      if (mode === 'channels') {
        const srv = currentServer ? servers.find(sv=>sv.id===currentServer) : null;
        h3.textContent = srv ? srv.name : 'Channels';
        if (srv) {
          ch.innerHTML = `<div class="cat">Text Channels</div>` + (srv.channels||[{name:'general'}]).map(c => `<button class="cb ${chan===('srv_'+currentServer+'_'+c.name)?'active':''}" onclick="switchServerChannel('${srv.id}','${escHtml(c.name)}')"># ${escHtml(c.name)}</button>${unreadBadge('srv_' + currentServer + '_' + c.name)}`).join('');
        } else {
          ch.innerHTML = `<div class="cat">Text Channels</div>` +
            `<button class="cb ${chan==='general'?'active':''}" onclick="switchChannel('general')"># general</button>` + unreadBadge('general') +
            `<button class="cb ${chan==='random'?'active':''}" onclick="switchChannel('random')"># random</button>` + unreadBadge('random');
        }
      } else {
        h3.textContent = 'Direct Messages';
        const users = knownUsers();
        let html = `<div class="cat">Direct Messages</div><button class="cb muted" onclick="toggleDMView()">← Back to channels</button>`;
        if (users.length === 0) html += `<div class="rs-empty" style="padding:8px;">No users yet</div>`;
        users.forEach(u => {
          const safe = escHtml(u);
          html += `<button class="cb ${dmWith===u?'active':''}" onclick="openDM(this.dataset.user)" data-user="${safe}">@ ${safe}</button>${unreadBadge('dm_' + [user,u].sort().join('_'))}`;
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
       const row = (name, status) => {
         const upfp = userPfpMap.get(name);
         const hasPfp = upfp && !upfp.startsWith('file:///');
         const avStyle = hasPfp ? `style="background-image:url('${escHtml(upfp)}');"` : '';
         const avContent = hasPfp ? '' : escHtml((name||'?')[0].toUpperCase());
         return `<div class="member ${status === 'offline' ? 'off' : ''}" data-user="${escHtml(name)}" onclick="openProfile(this.dataset.user)">` +
           `<div class="member-avatar" ${avStyle}>${avContent}<span class="status-dot" title="${labels[status]||'Online'}" style="background:${colors[status]||'#80848e'}"></span></div>` +
           `<div class="member-name">${escHtml(name)}</div>` +
         `</div>`;
       };
       const ul = document.getElementById('user-list');
       const pfpSig = [...userPfpMap.entries()].map(([k,v]) => k + ':' + v.slice(0,16)).join('|');
       const sig = 'O:' + online.map(u => u.user + ':' + u.status).join('|') + '#F:' + offline.join('|') + '#P:' + pfpSig + '#' + (currentServer || '') + '/' + (mode || '');
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
let pendingReactMsgId = null;
window.toggleReaction = async (id, emoji) => {
  if (!user || !id || !emoji) return;
  try {
    const ref = doc(db, 'messages', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const current = (data.reactions && typeof data.reactions === 'object') ? { ...data.reactions } : {};
    const users = Array.isArray(current[emoji]) ? [...current[emoji]] : [];
    const idx = users.indexOf(user);
    if (idx >= 0) users.splice(idx, 1); else users.push(user);
    if (users.length) current[emoji] = users; else delete current[emoji];
    // drop empty
    Object.keys(current).forEach(k => { if (!Array.isArray(current[k]) || !current[k].length) delete current[k]; });
    await updateDoc(ref, { reactions: current });
  } catch (e) { console.error('toggleReaction', e); }
};
function showReactionPicker(msgId, anchor) {
  pendingReactMsgId = msgId;
  const picker = document.getElementById('reaction-picker');
  if (!picker.dataset.filled) {
    picker.innerHTML = REACTION_EMOJIS.map(e => `<span style="cursor:pointer;padding:4px;border-radius:4px;font-size:20px;text-align:center;line-height:1;" data-emoji="${escHtml(e)}" onclick="pickReaction('${e}')">${e}</span>`).join('');
    picker.dataset.filled = '1';
  }
  const rect = anchor.getBoundingClientRect();
  let left = rect.left;
  if (left + 270 > window.innerWidth) left = window.innerWidth - 280;
  if (left < 8) left = 8;
  picker.style.left = left + 'px';
  picker.style.top = (rect.bottom + 4) + 'px';
  picker.style.display = 'grid';
}
function hideReactionPicker() { const p = document.getElementById('reaction-picker'); if (p) p.style.display = 'none'; pendingReactMsgId = null; }
window.showReactionPicker = showReactionPicker; window.hideReactionPicker = hideReactionPicker;
window.pickReaction = async (emoji) => {
  if (pendingReactMsgId) await window.toggleReaction(pendingReactMsgId, emoji);
  hideReactionPicker();
};
    window.showTab = (t) => { document.getElementById('emoji-tab').style.display = t==='emojis'?'grid':'none'; document.getElementById('gif-tab').style.display = t==='gifs'?'flex':'none'; };
    window.insertEmoji = (e) => { document.getElementById('chat-input').value += e; document.getElementById('media-picker').style.display = 'none'; }
    
    document.getElementById('emoji-btn').addEventListener('click', () => {
      const p = document.getElementById('media-picker'); p.style.display = p.style.display==='none'?'flex':'none';
    });

    // ---- file upload (images / gifs) ----
const fileInputEl = document.getElementById('file-input');
if (fileInputEl) {
  fileInputEl.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { appAlert('Only images and GIFs can be uploaded.'); fileInputEl.value = ''; return; }
    if (f.size > 700000) { appAlert('Image too large (max ~700KB).'); fileInputEl.value = ''; return; }
    pendingFile = f;
    const r = new FileReader();
    r.onload = () => {
      pendingPreview = r.result;
      document.getElementById('file-preview-img').src = pendingPreview;
      document.getElementById('file-preview-name').textContent = f.name + ' (' + (f.size/1024).toFixed(0) + 'KB)';
      document.getElementById('file-preview').style.display = 'block';
    };
    r.onerror = () => { appAlert('Failed to read file.'); pendingFile = null; };
    r.readAsDataURL(f);
    fileInputEl.value = '';
  });
}
window.cancelFile = () => {
  pendingFile = null; pendingPreview = null;
  const fp = document.getElementById('file-preview');
  if (fp) fp.style.display = 'none';
  const img = document.getElementById('file-preview-img');
  if (img) img.src = '';
};

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
          if (img.dataset.src && !img.getAttribute('src')) {
            img.src = img.dataset.src;
            img.addEventListener('load', () => {
              if (img.naturalWidth && img.naturalHeight) {
                chatGifDims[img.dataset.src] = { w: img.naturalWidth, h: img.naturalHeight };
                img.style.aspectRatio = img.naturalWidth + '/' + img.naturalHeight;
              }
              if (typeof msgsPinned !== 'undefined' && msgsPinned) pinMsgsBottom();
            }, { once: true });
          }
        } else {
          const s = img.getAttribute('src');
          if (s) {
            img.dataset.src = s;
            if (img.naturalWidth && img.naturalHeight && !img.style.aspectRatio) img.style.aspectRatio = img.naturalWidth + '/' + img.naturalHeight;
            if (!img.style.aspectRatio && chatGifDims[s]) { const d = chatGifDims[s]; img.style.aspectRatio = d.w + '/' + d.h; }
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
     function setTyping(active) {
       if (!user || !chan) return;
       const tid = chan + '__' + user;
       if (active) {
         setDoc(doc(db,'typing',tid), { channel: chan, user, timestamp: serverTimestamp() }, { merge: true }).catch(()=>{});
         if (typingTimer) clearTimeout(typingTimer);
         typingTimer = setTimeout(() => setTyping(false), 3000);
       } else {
         if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
         deleteDoc(doc(db,'typing',tid)).catch(()=>{});
       }
     }
     function markRead(c) {
       if (!user || !c) return;
       lastRead[c] = Date.now();
       if (window._unreadCounts) window._unreadCounts[c] = 0;
       const key = c + '__' + user;
       setDoc(doc(db,'reads',key), { channel: c, user, lastRead: serverTimestamp() }, { merge: true }).catch(()=>{});
       renderSidebar();
     }
     function getLastRead(c) { return lastRead[c] || 0; }

    document.getElementById('message-container').addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]'); if (!el) return;
      const act = el.dataset.action, id = el.dataset.id || el.dataset.msgid;
      if (act === 'edit') window.editMsg(id, el.dataset.text || '');
      else if (act === 'delete') window.deleteMsg(id);
      else if (act === 'react') { showReactionPicker(id, el); }
      else if (act === 'toggle-reaction') { window.toggleReaction(id, el.dataset.emoji); }
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
document.addEventListener('click', (e) => {
  const p = document.getElementById('reaction-picker');
  if (p && p.style.display !== 'none' && !p.contains(e.target) && !e.target.closest('[data-action="react"]')) hideReactionPicker();
});
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
     window.openLightbox = (url, label) => {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const info = document.getElementById('lightbox-info');
  if (!lb || !img) return;
  img.src = url;
  info.textContent = label || '';
  lb.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};
window.closeLightbox = () => {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (!lb) return;
  lb.classList.add('hidden');
  if (img) img.src = '';
  document.body.style.overflow = '';
};
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
      document.querySelector('.ch').innerHTML = `<div class="cat">Text Channels</div>` + (s.channels||[{name:'general'}]).map(c => `<button class="cb ${chan===('srv_'+sid+'_'+c.name)?'active':''}" onclick="switchServerChannel('${sid}','${escHtml(c.name)}')"># ${escHtml(c.name)}</button>${unreadBadge('srv_' + sid + '_' + c.name)}`).join('') +
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
    window.openProfile = async (u) => {
      const modal = document.getElementById('profile-modal');
      document.getElementById('prof-avatar').textContent = (u||'?')[0].toUpperCase();
      document.getElementById('prof-name').textContent = u;
      const pres = Array.from(document.getElementById('user-list').children).find(el => el.dataset.user === u);
      const dot = pres && pres.querySelector('.status-dot');
      document.getElementById('prof-status').textContent = dot ? (dot.getAttribute('title') || 'Online') : 'Offline';
      const actions = document.getElementById('prof-actions');
      let html = '';
      if (u !== user) {
        let btnHtml = `<button onclick="sendReq('${escHtml(u)}'); closeProfile();" style="background:var(--bl);color:#000;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Send Friend Request</button>`;
        try {
          const existing = await getDocs(query(
            collection(db,"friends"),
            where("from","==",user),
            where("to","==",u),
            where("status","==","pending")
          ));
          if (!existing.empty) {
            btnHtml = `<button onclick="cancelReq('${existing.docs[0].id}'); closeProfile();" style="background:var(--mut);color:#fff;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Cancel Request</button>`;
          } else {
            const incoming = await getDocs(query(
              collection(db,"friends"),
              where("from","==",u),
              where("to","==",user),
              where("status","==","pending")
            ));
            if (!incoming.empty) {
              btnHtml = `<button onclick="acceptReq('${incoming.docs[0].id}'); closeProfile();" style="background:var(--bl);color:#000;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Accept Request</button>`;
            }
          }
        } catch (e) { console.log("friend check failed", e); }
        html += btnHtml;
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
    const msgBox = document.getElementById('message-container');
    let msgsPinned = true;
    let isPinning = false;
    let userScrolling = false;
    let userScrollTimer = null;
    function markUserScroll() { userScrolling = true; clearTimeout(userScrollTimer); userScrollTimer = setTimeout(() => { userScrolling = false; }, 300); }
    msgBox.addEventListener('wheel', markUserScroll, { passive: true });
    msgBox.addEventListener('touchstart', markUserScroll, { passive: true });
    msgBox.addEventListener('mousedown', markUserScroll, { passive: true });
    msgBox.addEventListener('scroll', () => {
      if (isPinning) return;
      if (userScrolling) msgsPinned = msgBox.scrollHeight - msgBox.scrollTop - msgBox.clientHeight < 80;
    }, { passive: true });
    function pinMsgsBottom() {
      msgsPinned = true;
      isPinning = true;
      msgBox.scrollTop = msgBox.scrollHeight;
      setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; isPinning = false; }, 0);
    }
    const chatGifDims = {};
    const REACTION_EMOJIS = ['👍','👎','❤️','😂','😮','😢','😡','🎉','🔥','👀','✅','❌','💯','🤔','😍','🙏','👏','💀','😭','😎','🥳','🤯'];
    function renderReactions(m) {
      const r = (m && m.reactions) || {};
      const entries = Object.entries(r).filter(function(e){ return Array.isArray(e[1]) && e[1].length > 0; });
      if (!entries.length) return '';
      return '<div class="reactions" data-msgid="' + escHtml(m.id) + '" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">' +
        entries.map(function(pair){
          const emoji = pair[0]; const users = pair[1];
          const mine = Array.isArray(users) && users.indexOf(user) >= 0;
          return '<button data-action="toggle-reaction" data-msgid="' + escHtml(m.id) + '" data-emoji="' + escHtml(emoji) + '" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;border:1px solid ' + (mine?'var(--bl)':'#4f545c') + ';background:' + (mine?'rgba(87,242,135,.12)':'var(--bg-t)') + ';color:var(--txt);font-size:13px;cursor:pointer;line-height:1.4;">' +
            '<span>' + emoji + '</span><span style="font-weight:600;">' + users.length + '</span>' +
          '</button>';
        }).join('') +
      '</div>';
    }

let pendingFile = null; let pendingPreview = null;
    function listen() {
      if (typingUnsub) { typingUnsub(); typingUnsub = null; }
      setTyping(false);
      if (!chan) {
        if (unsub) { unsub(); unsub = null; }
        const container = document.getElementById('message-container');
        container.innerHTML = '<div class="msgs-inner"><div class="msgs-empty">Select a user to start a DM</div></div>';
        return;
      }
      markRead(chan);
      const key = chan + '__' + user;
      getDoc(doc(db,'reads',key)).then((snap) => {
        if (snap.exists()) lastRead[chan] = snap.data().lastRead ? snap.data().lastRead.toMillis() : Date.now();
        renderSidebar();
      }).catch(()=>{});
      if (unsub) unsub();
      // typing listener
      const typingQuery = query(collection(db,'typing'), where('channel','==',chan));
      let cachedTypingDocs = [];
      function renderTyping() {
        const now = Date.now();
        const names = [];
        cachedTypingDocs.forEach(d => {
          const t = d.data();
          if (!t || !t.user || t.user === user) return;
          const ts = t.timestamp && t.timestamp.toMillis ? t.timestamp.toMillis() : 0;
          if (!ts || now - ts > 5000) return;
          names.push(t.user);
        });
        const el = document.getElementById('typing-indicator');
        if (!el) return;
        if (names.length === 0) { el.style.display = 'none'; el.textContent = ''; }
        else if (names.length === 1) { el.style.display = 'block'; el.textContent = names[0] + ' is typing...'; }
        else if (names.length === 2) { el.style.display = 'block'; el.textContent = names[0] + ' and ' + names[1] + ' are typing...'; }
        else { el.style.display = 'block'; el.textContent = names.length + ' people are typing...'; }
      }
      typingUnsub = onSnapshot(typingQuery, (snap) => {

        cachedTypingDocs = snap.docs;
        renderTyping();
      });
      if (window._typingRefresh) clearInterval(window._typingRefresh);
      window._typingRefresh = setInterval(renderTyping, 1000);
      unsub = onSnapshot(query(collection(db,"messages"),where("channel","==",chan)), (snap) => {
        const container = document.getElementById('message-container');
        const wasPinned = msgsPinned || snap.docChanges().some(c => c.type === "added" && c.doc.data().user === user);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.channel === chan).sort((a,b) => (a.timestamp ? a.timestamp.toMillis() : 0) - (b.timestamp ? b.timestamp.toMillis() : 0));
        window._unreadCounts = {};
        snap.docs.forEach(d => {
          const m = d.data();
          if (!m || !m.channel) return;
          const ch = m.channel;
          const chLr = lastRead[ch] || 0;
          if ((m.timestamp ? m.timestamp.toMillis() : 0) > chLr && m.user !== user) {
            window._unreadCounts[ch] = (window._unreadCounts[ch] || 0) + 1;
          }
        });
        renderSidebar();
        container.innerHTML = docs.map(m => {
          const me = m.user === user;
          const safeUser = escHtml(m.user);
          const av = (m.pfp && !m.pfp.startsWith('file:///')) ? `style="background-image:url('${escHtml(m.pfp)}');text-indent:-9999px;"` : '';
          const rep = m.replyTo ? `<div class="msg-reply"><span class="bar"></span><span>Replying to <b>@${escHtml(m.replyTo.user)}</b> ${escHtml(m.replyTo.text)}</span></div>` : '';

          const textVal = String(m.text ?? '');
          const isP = textVal.includes('@everyone') || textVal.includes(`@${user}`);

          const btns = me ? `<span data-action="edit" data-id="${m.id}" data-text="${escHtml(textVal)}" style="color:var(--bl);">Edit</span><span data-action="delete" data-id="${m.id}" style="color:#f23f43;">Delete</span>` : '';
          const rBtn = `<span data-action="reply" data-id="${m.id}" data-user="${safeUser}" style="color:var(--mut);">Reply</span>`;
          const reactBtn = `<span data-action="react" data-id="${m.id}" style="color:var(--mut);">😀</span>`;
          return `
            <div class="msg ${me ? 'me' : ''} ${isP ? 'mention' : ''}" data-id="${m.id}">
              <div class="pfp" ${av}>${safeUser ? safeUser[0].toUpperCase() : '?'}</div>
              <div class="msg-content">
                <div class="msg-head">
                  <span class="msg-author ${me ? 'self' : ''}">${safeUser}</span>
                  <span class="msg-time">${fmtMsgTime(m.timestamp)}</span>
                  <span class="msg-actions">${reactBtn}${rBtn}${btns}</span>
                </div>
                ${rep}
                ${textVal ? `<div class="msg-bubble">${renderText(textVal)}</div>` : ''}
                ${m.image ? `<img src="${escHtml(m.image)}" alt="image" style="max-width: min(320px, 100%); border-radius:8px; display:block; margin-top:4px;cursor:pointer;${m.imageW && m.imageH ? ' aspect-ratio:' + m.imageW + '/' + m.imageH + ';' : ''}" onclick="openLightbox('${escHtml(m.image)}','Image')">` : ''}
                ${renderReactions(m)}
              </div>
            </div>`;
        }).join('');
        container.innerHTML = '<div class="msgs-inner">' + container.innerHTML + '</div>';
        const inner = container.querySelector('.msgs-inner');
        if (inner) {
          if (container._ro) container._ro.disconnect();
          let prevH = inner.scrollHeight;
          let first = true;
          const ro = new ResizeObserver(() => {
            const newH = inner.scrollHeight;
            const delta = newH - prevH;
            if (!first && delta !== 0) {
              if (msgsPinned) {
                container.scrollTop = container.scrollHeight;
              } else {
                container.scrollTop += delta;
              }
            }
            first = false;
            prevH = newH;
          });
          ro.observe(inner);
          container._ro = ro;
        }
        if (wasPinned) {
          msgsPinned = true;
          pinMsgsBottom();
          let n = 0;
          const iv = setInterval(() => {
            if (!msgsPinned || ++n > 10) { clearInterval(iv); return; }
            pinMsgsBottom();
          }, 50);
        }
        observeChatImages();
        container.querySelectorAll('img').forEach(img => {
          if (!img.complete) img.addEventListener('load', () => { if (msgsPinned) pinMsgsBottom(); }, { once: true });
        });
        snap.docChanges().forEach(c => {
          if (c.type === "added" && user) {
            const m = c.doc.data();
            const mt = m.timestamp ? m.timestamp.toMillis() : Date.now();
            if (mt > appLoadTime && m.user && m.user !== user && document.hidden) {
              const txt = String(m.text ?? '');
              const isP = txt.includes('@everyone') || txt.includes(`@${user}`);
              const hasImg = txt.includes('<img') || !!m.image;
               new Notification(isP ? `⚠️ PINGED` : `@${m.user}`, { body: hasImg ? 'Sent an image 📷' : txt });
            }
          }
        });
      });
    }

    const atPopup = document.getElementById('at-popup');
    const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('blur', () => { if (user) setTyping(false); });
    chatInput.addEventListener('input', (e) => {
      const val = e.target.value; const at = val.lastIndexOf('@');
      if (user && chan) {
        if (val.trim()) { setTyping(true); } else { setTyping(false); }
      }
      if (at !== -1 && at === val.length - 1) {
        const uList = knownUsers();
        atPopup.innerHTML = ['everyone', ...uList].map(u => `<div style="cursor:pointer;padding:6px 12px;border-radius:4px;color:#fff;" data-u="${escHtml(u)}" onmouseover="this.style.background='var(--bl)'" onmouseout="this.style.background='transparent'">@${escHtml(u)}</div>`).join('');
        atPopup.style.display = 'flex';
      } else if (!val.includes('@') || val.endsWith(' ')) { atPopup.style.display = 'none'; }
    });
    atPopup.addEventListener('click', (e) => { const el = e.target.closest('[data-u]'); if (el) window.insertAt(el.dataset.u); });
    window.insertAt = (u) => { const val = chatInput.value; const at = val.lastIndexOf('@'); chatInput.value = val.substring(0, at) + `@${u} `; atPopup.style.display = 'none'; chatInput.focus(); }

    window.handleKeyPress = async (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if ((e.target.value.trim() || pendingFile) && user) {
        const t = e.target.value.trim(); e.target.value = '';
        const payload = { text: t, user, channel: chan, pfp, timestamp: serverTimestamp() };
        if (pendingFile) {
          if (pendingFile.size > 700000) {
            appAlert('Image too large (max ~700KB). Larger files need Firebase Storage, which requires billing.');
            setTyping(false);
            pendingFile = null; pendingPreview = null;
            window.cancelFile();
            document.getElementById('chat-input').value = t;
            return;
          }
          payload.image = pendingPreview;
          // read dimensions so the image reserves space before it decodes (prevents scroll/layout glitch)
          try {
            const dims = await new Promise((resolve) => {
              const im = new Image();
              im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
              im.onerror = () => resolve(null);
              im.src = pendingPreview;
            });
            if (dims && dims.w && dims.h) { payload.imageW = dims.w; payload.imageH = dims.h; }
          } catch (e) {}
          pendingFile = null; pendingPreview = null;
          window.cancelFile();
        }
        if (reply) { payload.replyTo = { user: reply.user, text: reply.text }; window.cancelReply(); }
        setTyping(false);
        await addDoc(collection(db, "messages"), payload);
      }
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