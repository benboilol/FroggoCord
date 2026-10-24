// Profiles, message rendering, live listeners, composer, and authentication startup.
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
        let friendDoc = null;
        try {
          const a = await getDocs(query(
            collection(db,"friends"),
            where("from","==",user),
            where("to","==",u),
            where("status","==","accepted")
          ));
          if (!a.empty) friendDoc = a.docs[0];
          else {
            const b = await getDocs(query(
              collection(db,"friends"),
              where("from","==",u),
              where("to","==",user),
              where("status","==","accepted")
            ));
            if (!b.empty) friendDoc = b.docs[0];
          }
        } catch (e) { console.log("friend check failed", e); }
        if (friendDoc) {
          html += `<span style="color:var(--mut);font-size:11px;display:block;margin-bottom:4px;">Friends</span>`;
          html += `<button onclick="unfriendReq('${friendDoc.id}'); closeProfile();" style="background:var(--danger);color:var(--white);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Unfriend</button>`;
        } else {
          let btnHtml = `<button onclick="sendReq('${escHtml(u)}'); closeProfile();" style="background:var(--bl);color:var(--accent-contrast);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Send Friend Request</button>`;
          try {
            const existing = await getDocs(query(
              collection(db,"friends"),
              where("from","==",user),
              where("to","==",u),
              where("status","==","pending")
            ));
            if (!existing.empty) {
              btnHtml = `<button onclick="cancelReq('${existing.docs[0].id}'); closeProfile();" style="background:var(--mut);color:var(--white);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Cancel Request</button>`;
            } else {
              const incoming = await getDocs(query(
                collection(db,"friends"),
                where("from","==",u),
                where("to","==",user),
                where("status","==","pending")
              ));
              if (!incoming.empty) {
                btnHtml = `<button onclick="acceptReq('${incoming.docs[0].id}'); closeProfile();" style="background:var(--bl);color:var(--accent-contrast);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Accept Request</button>`;
              }
            }
          } catch (e) { console.log("friend check failed", e); }
          html += btnHtml;
        }
        html += `<button onclick="openDM('${escHtml(u)}'); closeProfile();" style="background:var(--bg-t);color:var(--white);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">Message</button>`;
      } else {
        html += `<div style="color:var(--mut);font-size:12px;">This is you</div>`;
      }
      actions.innerHTML = html;
      modal.style.display = 'flex';
    };
    window.closeProfile = () => { document.getElementById('profile-modal').style.display = 'none'; };

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
          return '<button data-action="toggle-reaction" data-msgid="' + escHtml(m.id) + '" data-emoji="' + escHtml(emoji) + '" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;border:1px solid ' + (mine?'var(--bl)':'var(--reply-line)') + ';background:' + (mine?'var(--mention-bg)':'var(--bg-t)') + ';color:var(--txt);font-size:13px;cursor:pointer;line-height:1.4;">' +
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

      // [FIX APPLIED] Added limit(50) and orderBy("timestamp", "desc") to prevent full-collection reads per channel session
      unsub = onSnapshot(
        query(
          collection(db, "messages"),
          where("channel", "==", chan),
          orderBy("timestamp", "desc"),
          limit(50)
        ),
        (snap) => {
          const container = document.getElementById('message-container');
          const wasPinned = msgsPinned || snap.docChanges().some(c => c.type === "added" && c.doc.data().user === user);
          
          // Map and sort oldest-to-newest for chronological chat display
          const docs = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(m => m.channel === chan)
            .sort((a, b) => (a.timestamp ? a.timestamp.toMillis() : 0) - (b.timestamp ? b.timestamp.toMillis() : 0));

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

            const btns = me ? `<span data-action="edit" data-id="${m.id}" data-text="${escHtml(textVal)}" style="color:var(--bl);">Edit</span><span data-action="delete" data-id="${m.id}" style="color:var(--danger);">Delete</span>` : '';
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
        }
      );
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
        atPopup.innerHTML = ['everyone', ...uList].map(u => `<div style="cursor:pointer;padding:6px 12px;border-radius:4px;color:var(--white);" data-u="${escHtml(u)}" onmouseover="this.style.background='var(--bl)'" onmouseout="this.style.background='transparent'">@${escHtml(u)}</div>`).join('');
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
// Authentication starts after the feature scripts have registered their functions.
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
        
        // [FIX APPLIED] Removed the heavy getDocs(collection(db,"messages")) query here that was causing massive read counts on load.

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
            return `<div>${escHtml(data.from)} sent you a request <button onclick="acceptReq('${d.id}')" style="font-size:10px;padding:2px 6px;background:var(--bl);color:var(--accent-contrast);border:none;border-radius:3px;">Accept</button> <button onclick="declineReq('${d.id}')" style="font-size:10px;padding:2px 6px;background:var(--danger);color:var(--white);border:none;border-radius:3px;">Decline</button></div>`;
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
    };
    window.declineReq = async (id) => {
      await updateDoc(doc(db,"friends",id),{status:"declined"});
    };
    window.sendReq = async (u) => {
      if (!u || u === user) return;
      const existing = await getDocs(query(
        collection(db,"friends"),
        where("from","==",user),
        where("to","==",u),
        where("status","==","pending")
      ));
      if (!existing.empty) return;
      const incoming = await getDocs(query(
        collection(db,"friends"),
        where("from","==",u),
        where("to","==",user),
        where("status","==","pending")
      ));
      if (!incoming.empty) return;
      await addDoc(collection(db,"friends"),{from:user,to:u,status:"pending",timestamp:serverTimestamp()});
    };
    window.cancelReq = async (id) => {
      await updateDoc(doc(db,"friends",id),{status:"canceled"});
    };
    window.unfriendReq = async (id) => {
      await updateDoc(doc(db,"friends",id),{status:"unfriended"});
    };
