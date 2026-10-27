// Channel navigation, direct messages, server management, and server settings.
    window.switchChannel = (c) => { mode = 'channels'; dmWith = null; currentServer = null; chan = c; document.getElementById('dm-btn').classList.remove('active'); renderServerList(); renderUserList(); renderSidebar(); updateHeader(); listen(); }
    // Helper: go to first server if available, otherwise show empty state
    window.goToServer = () => {
      if (servers.length > 0) { switchServer(servers[0].id); return; }
      currentServer = null; mode = 'channels'; dmWith = null; chan = null;
      document.getElementById('dm-btn').classList.remove('active');
      renderServerList(); renderUserList(); renderSidebar(); updateHeader(); listen();
    }
    window.toggleDMView = () => {
      if (mode === 'dms') { mode = 'channels'; dmWith = null; if (!chan || chan.startsWith('dm_')) chan = null; document.getElementById('dm-btn').classList.remove('active'); }
      else { mode = 'dms'; dmWith = null; currentServer = null; chan = null; document.getElementById('dm-btn').classList.add('active'); }
      document.getElementById('server-banner').style.display = 'none';
      renderServerList(); renderUserList(); renderSidebar(); updateHeader(); listen();
    };
    window.openDM = async (u) => {
      // Check privacy: if user has dmAnyone disabled, only allow DMs from friends
      const privacy = userPrivacyMap.get(u) || {};
      if (privacy.dmAnyone === false) {
        // Check if they're friends
        try {
          const snap1 = await getDocs(query(collection(db,"friends"),where("from","==",user)));
          const snap2 = await getDocs(query(collection(db,"friends"),where("to","==",user)));
          const isFriend = snap1.docs.some(d => d.data().to === u && d.data().status === "accepted") ||
                           snap2.docs.some(d => d.data().from === u && d.data().status === "accepted");
          if (!isFriend) {
            appAlert('This user has disabled direct messages from people they are not friends with.');
            return;
          }
        } catch (e) {}
      }
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
          ch.innerHTML = `<div class="cat">Servers</div><div class="rs-empty" style="padding:8px;">Select a server from the rail</div>`;
        }
      } else {
        h3.textContent = 'Direct Messages';
        const users = knownUsers();
        let html = `<div class="cat">Direct Messages</div>`;
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
       const colors = { online: 'var(--pr)', idle: 'var(--yellow)', dnd: 'var(--danger)', offline: 'var(--mut)' };
       const labels = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };
       const order = { online: 0, idle: 1, dnd: 2, offline: 3 };
       const seen = new Set();
       const online = [], offline = [];
       scope.forEach(name => {
         if (!name || seen.has(name)) return;
         seen.add(name);
         const p = presMap.get(name);
         const privacy = name === user ? (settings ? settings.privacy : null) : (userPrivacyMap.get(name) || null);
         const showOnline = !privacy || privacy.onlineStatus !== false;
         if (p && showOnline) online.push({ ...p, status: effStatus(p) });
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
           `<div class="member-avatar" ${avStyle}>${avContent}<span class="status-dot" title="${labels[status]||'Online'}" style="background:${colors[status]||'var(--mut)'}"></span></div>` +
           `<div class="member-name">${escHtml(name)}</div>` +
         `</div>`;
       };
       const ul = document.getElementById('user-list');
       const pfpSig = [...userPfpMap.entries()].map(([k,v]) => k + ':' + v.slice(0,16)).join('|');
       const privSig = [...userPrivacyMap.entries()].map(([k,v]) => k + ':' + JSON.stringify(v)).join('|');
       const sig = 'O:' + online.map(u => u.user + ':' + u.status).join('|') + '#F:' + offline.join('|') + '#P:' + pfpSig + '#V:' + privSig + '#' + (currentServer || '') + '/' + (mode || '');
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
      const placeholderLabel = (mode === 'dms' && dmWith) ? 'Message @' + dmWith : 'Message #' + (chan && chan.startsWith('srv_') ? chan.split('_').slice(2).join('_') : (chan || 'general'));
  document.getElementById('chat-input').placeholder = placeholderLabel;
    }
    function serverMenu() { openServerModal(); }
    function openServerModal() {
      document.getElementById('sm-name').value = '';
      document.getElementById('sm-code').value = '';
      document.getElementById('sm-result').textContent = '';
      showServerTab('create');
      const m = document.getElementById('server-modal');
      m.style.display = 'flex';
      requestAnimationFrame(() => { m.classList.add('visible'); m.querySelector('.modal-card').classList.add('visible'); });
    }
    function closeServerModal() { const m = document.getElementById('server-modal'); m.classList.remove('visible'); const c = m.querySelector('.modal-card'); if (c) c.classList.remove('visible'); setTimeout(() => { m.style.display = 'none'; }, 180); }
    function showServerTab(tab) {
      document.getElementById('sm-create').style.display = tab==='create'?'block':'none';
      document.getElementById('sm-join').style.display = tab==='join'?'block':'none';
      document.getElementById('sm-create-tab').style.background = tab==='create'?'var(--bl)':'var(--bg-t)';
      document.getElementById('sm-create-tab').style.color = tab==='create'?'var(--accent-contrast)':'var(--white)';
      document.getElementById('sm-join-tab').style.background = tab==='join'?'var(--bl)':'var(--bg-t)';
      document.getElementById('sm-join-tab').style.color = tab==='join'?'var(--accent-contrast)':'var(--white)';
    }
    async function createServerFromModal() {
      const name = document.getElementById('sm-name').value.trim(); if (!name) { appAlert('Enter a server name'); return; }
      const code = Math.random().toString(36).substring(2,8).toUpperCase();
      const ref = await addDoc(collection(db,'servers'), { name, owner: user, ownerUid: (auth.currentUser&&auth.currentUser.uid)||null, inviteCode: code, members: [user], memberUids: [(auth.currentUser&&auth.currentUser.uid)||null], admins: [], channels: [{name:'general', id:'general'}], createdAt: serverTimestamp() });
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
      const ref = await addDoc(collection(db,'servers'), { name, owner: user, ownerUid: (auth.currentUser&&auth.currentUser.uid)||null, inviteCode: code, members: [user], memberUids: [(auth.currentUser&&auth.currentUser.uid)||null], admins: [], channels: [{name:'general', id:'general'}], createdAt: serverTimestamp() });
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
      window.serverEmojis = window.serverEmojis || {};
      servers.forEach(s => { window.serverEmojis[s.id] = Array.isArray(s.emojis) ? s.emojis : []; });
      renderServerList();
    }
    function renderServerList() {
      const el = document.getElementById('server-list');
      el.innerHTML = servers.map(s => {
        const active = currentServer === s.id;
        const iconStyle = s.icon ? `background-image:url('${s.icon}');background-size:cover;background-position:center;` : '';
        const accentStyle = s.accent ? `border-left:3px solid ${escHtml(s.accent)};` : '';
        return `<div class="si ${active?'active':''}" onclick="switchServer('${s.id}')" oncontextmenu="showServerCtx(event,'${s.id}')" title="${escHtml(s.name)}" style="${iconStyle}${accentStyle}">${s.icon?'':escHtml(s.name)[0].toUpperCase()}</div>`;
      }).join('');
     }
     let ctxServerId = null;
     function showServerCtx(e, sid) {
       e.preventDefault();
       e.stopPropagation();
       ctxServerId = sid;
       const m = document.getElementById('server-ctx');
       m.dataset.serverId = sid;
       const s = servers.find(x=>x.id===sid);
       const isOwner = s && s.owner === user;
       const isAdmin = isOwner;
       document.getElementById('ctx-invite').style.display = 'block';
       document.getElementById('ctx-settings').style.display = (s && s.owner === user) ? 'block' : 'none';
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
       if (!isOwner) {
         if (typeof appAlert === 'function') appAlert('Only the server owner can access settings.');
         return;
       }
       const isAdmin = true;
       document.getElementById('ss-name').value = s.name || '';
       document.getElementById('ss-desc').value = s.description || '';
       document.getElementById('ss-icon-url').value = s.icon || '';
       document.getElementById('ss-banner-url').value = s.banner || '';
       document.getElementById('ss-accent').value = s.accent || '#57f287';
       const ssEmojis = document.getElementById('ss-emojis');
       if (ssEmojis) ssEmojis.value = (s.emojis||[]).map(e => e.name + ':' + e.url).join('\n');
       document.getElementById('ss-preview').innerHTML = s.banner ? `<img src="${escHtml(s.banner)}" style="width:100%;height:60px;object-fit:cover;border-radius:6px;">` : '';
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
       const canEdit = isAdmin;
       ['ss-name','ss-desc','ss-icon-url','ss-banner-url','ss-icon-file','ss-banner-file'].forEach(id => {
         const el = document.getElementById(id); if (el) el.disabled = !canEdit;
       });
       const ssm = document.getElementById('server-settings-modal');
      ssm.style.display = 'flex';
      requestAnimationFrame(() => { ssm.classList.add('visible'); ssm.querySelector('.modal-card').classList.add('visible'); });
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
             ? `<button onclick="toggleAdmin('${escHtml(m)}',false)" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--danger);color:var(--white);cursor:pointer;">Remove Admin</button>`
             : `<button onclick="toggleAdmin('${escHtml(m)}',true)" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--bl);color:var(--accent-contrast);cursor:pointer;">Make Admin</button>`;
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
       await deleteDoc(doc(db,'servers',ctxServerId));
       if (currentServer === ctxServerId) { currentServer = null; chan = null; mode='channels'; dmWith=null; }
       await loadServers();
       if (currentServer) switchServer(currentServer);
       else if (servers.length > 0) { switchServer(servers[0].id); }
       else { document.querySelector('.sb h3').textContent='Channels'; document.getElementById('server-banner').style.display='none'; document.querySelector('.ch').innerHTML = `<div class="cat">Servers</div><div class="rs-empty" style="padding:8px;">Select a server from the rail</div>`; updateHeader(); listen(); }
     }
     window.deleteServer = deleteServer;
     window.toggleAdmin = toggleAdmin;
     function closeServerSettings() { const m = document.getElementById('server-settings-modal'); m.classList.remove('visible'); const c = m.querySelector('.modal-card'); if (c) c.classList.remove('visible'); setTimeout(() => { m.style.display = 'none'; }, 180); }
     async function saveServerSettings() {
       const s = servers.find(x=>x.id===ctxServerId); if (!s) return;
       const isOwner = s.owner === user;
       const isAdmin = isOwner || (s.admins||[]).includes(user);
       if (!isAdmin) { appAlert('No permission'); return; }
       const name = document.getElementById('ss-name').value.trim() || s.name;
       const description = document.getElementById('ss-desc').value.trim();
       let icon = document.getElementById('ss-icon-url').value.trim();
       let banner = document.getElementById('ss-banner-url').value.trim();
      const accent = document.getElementById('ss-accent').value.trim() || '#57f287';
       const iconFile = document.getElementById('ss-icon-file').files[0];
       const bannerFile = document.getElementById('ss-banner-file').files[0];
       if (iconFile) icon = await fileToDataUrl(iconFile);
       if (bannerFile) banner = await fileToDataUrl(bannerFile);
       const emojisRaw = (document.getElementById('ss-emojis').value || '').trim();
       const emojis = emojisRaw.split('\n').map(line => {
         const idx = line.indexOf(':');
         if (idx < 0) return null;
         const name = line.slice(0, idx).trim();
         const url = line.slice(idx+1).trim();
         if (!name || !url) return null;
         return { name, url };
       }).filter(Boolean);
      await updateDoc(doc(db,'servers',ctxServerId), { name, description, icon, banner, accent, emojis });
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
       const remaining = (s.members||[]).filter(m=>m!==user);
       if (remaining.length === 0) {
         // Last member leaving - delete the server entirely
         await deleteDoc(doc(db,'servers',ctxServerId));
       } else {
         await updateDoc(doc(db,'servers',ctxServerId), { members: remaining });
       }
       if (currentServer === ctxServerId) { currentServer = null; chan = null; mode='channels'; dmWith=null; }
       await loadServers();
       if (currentServer) switchServer(currentServer);
       else if (servers.length > 0) { switchServer(servers[0].id); }
       else { document.querySelector('.sb h3').textContent='Channels'; document.getElementById('server-banner').style.display='none'; document.querySelector('.ch').innerHTML = `<div class="cat">Servers</div><div class="rs-empty" style="padding:8px;">Select a server from the rail</div>`; updateHeader(); listen(); }
     }
     document.getElementById('ctx-invite').onclick = (e) => { e.stopPropagation(); const sid = document.getElementById('server-ctx').dataset.serverId; hideServerCtx(); openInviteModal(sid); };
     document.getElementById('ctx-settings').onclick = (e) => { e.stopPropagation(); const sid = document.getElementById('server-ctx').dataset.serverId; hideServerCtx(); openServerSettings(sid); };
     document.getElementById('ctx-leave').onclick = (e) => { e.stopPropagation(); hideServerCtx(); leaveServer(); };
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
        if (s.accent) { banner.style.borderLeft = `4px solid ${escHtml(s.accent)}`; bannerName.style.color = s.accent; }
        const chBtns = `<div class="cat">Text Channels</div>` + (s.channels||[{name:'general'}]).map(c => `<button class="cb ${chan===('srv_'+currentServer+'_'+c.name)?'active':''}" onclick="switchServerChannel('${s.id}','${escHtml(c.name)}')"># ${escHtml(c.name)}</button>`).join('');
        document.querySelector('.ch').innerHTML = chBtns +
          `<button class="cb muted" onclick="createChannel('${s.id}')" style="color:var(--bl);">+ Add Channel</button>` +
          `<button class="cb muted" onclick="shareInvite('${s.id}')">Invite Code: ${escHtml(s.inviteCode)}</button>`;
      } else {
         chan = null; mode='channels'; dmWith=null;
        document.querySelector('.sb h3').textContent = 'Channels';
        document.getElementById('server-banner').style.display = 'none';
         document.querySelector('.ch').innerHTML = `<div class="cat">Servers</div><div class="rs-empty" style="padding:8px;">Select a server from the rail</div>`;
      }
      renderServerList();
      updateHeader();
      renderUserList();
      if (chan && currentServer) {
        const cname = chan.split('_').slice(2).join('_');
        if (window.__skipPush) { try { history.replaceState({chan:chan}, '', '/channel/' + currentServer + '/' + cname); } catch(e){} }
        else { try { history.pushState({chan:chan}, '', '/channel/' + currentServer + '/' + cname); } catch(e){} }
      }
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
      if (chan) {
        const cname2 = chan.split('_').slice(2).join('_');
        if (window.__skipPush) { try { history.replaceState({chan:chan}, '', '/channel/' + sid + '/' + cname2); } catch(e){} }
        else { try { history.pushState({chan:chan}, '', '/channel/' + sid + '/' + cname2); } catch(e){} }
      }
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

    // ===== Invite to Server =====
    let inviteServerId = null;
    window.openInviteModal = async (sid) => {
      if (!sid) return;
      inviteServerId = sid;
      const s = servers.find(x => x.id === sid);
      if (!s) return;
      const modal = document.getElementById('invite-modal');
      const preview = document.getElementById('invite-server-preview');
      const friendsList = document.getElementById('invite-friends-list');
      // Server preview card
      let previewHtml = '<div class="invite-card">';
      if (s.banner) previewHtml += `<div class="invite-card-banner" style="background-image:url('${escHtml(s.banner)}');"></div>`;
      previewHtml += `<div class="invite-card-body">`;
      if (s.icon) previewHtml += `<img src="${escHtml(s.icon)}" alt="" style="width:40px;height:40px;border-radius:50%;margin-bottom:8px;">`;
      previewHtml += `<div class="invite-card-name">${escHtml(s.name)}</div>`;
      if (s.description) previewHtml += `<div class="invite-card-desc">${escHtml(s.description)}</div>`;
      previewHtml += `</div></div>`;
      preview.innerHTML = previewHtml;
      // Friends list with checkboxes - only show accepted friends
      try {
        const outgoing = await getDocs(query(collection(db,"friends"), where("from","==",user)));
        const incoming = await getDocs(query(collection(db,"friends"), where("to","==",user)));
        const friendSet = new Set();
        outgoing.docs.forEach(d => {
          const data = d.data();
          if (data.status === "accepted" && data.to) friendSet.add(data.to);
        });
        incoming.docs.forEach(d => {
          const data = d.data();
          if (data.status === "accepted" && data.from) friendSet.add(data.from);
        });
        const friendList = Array.from(friendSet).sort((a,b) => a.localeCompare(b));
        if (friendList.length === 0) {
          friendsList.innerHTML = '<div class="rs-empty" style="padding:8px;">No friends to invite yet</div>';
        } else {
          friendsList.innerHTML = friendList.map(f => {
            const safe = escHtml(f);
            return `<div class="invite-friend-row"><label><input type="checkbox" data-friend="${safe}" value="${safe}"> ${safe}</label></div>`;
          }).join('');
        }
      } catch (e) {
        console.error('Failed to load friends:', e);
        friendsList.innerHTML = '<div class="rs-empty" style="padding:8px;">Error loading friends</div>';
      }
      modal.style.display = 'flex';
      requestAnimationFrame(() => { modal.classList.add('visible'); modal.querySelector('.modal-card').classList.add('visible'); });
    };

    window.closeInviteModal = () => {
      const m = document.getElementById('invite-modal');
      m.classList.remove('visible');
      const c = m.querySelector('.modal-card');
      if (c) c.classList.remove('visible');
      setTimeout(() => { m.style.display = 'none'; }, 180);
      inviteServerId = null;
    };

    window.sendInvites = async () => {
      if (!inviteServerId) return;
      const s = servers.find(x => x.id === inviteServerId);
      if (!s) return;
      const checked = document.querySelectorAll('#invite-friends-list input[type="checkbox"]:checked');
      if (checked.length === 0) { appAlert('Select at least one friend to invite.'); return; }
      const inviteLink = window.location.origin + window.location.pathname + '?join=' + s.inviteCode;
      // Verify friendship before sending (safety check)
      const friendSet = new Set();
      try {
        const outgoing = await getDocs(query(collection(db,"friends"), where("from","==",user)));
        const incoming = await getDocs(query(collection(db,"friends"), where("to","==",user)));
        outgoing.docs.forEach(d => { if (d.data().status === "accepted" && d.data().to) friendSet.add(d.data().to); });
        incoming.docs.forEach(d => { if (d.data().status === "accepted" && d.data().from) friendSet.add(d.data().from); });
      } catch (e) { console.error('Failed to verify friends:', e); }
      for (const cb of checked) {
        const friend = cb.value;
        if (!friendSet.has(friend)) {
          console.warn('Skipping non-friend:', friend);
          continue;
        }
        const inviteCard = `<invite server="${escHtml(s.name)}" icon="${escHtml(s.icon||'')}" banner="${escHtml(s.banner||'')}" desc="${escHtml(s.description||'')}" link="${escHtml(inviteLink)}"></invite>`;
        const chan = 'dm_' + [user, friend].sort().join('_');
        await addDoc(collection(db, "messages"), { text: inviteCard, user, uid: (auth.currentUser&&auth.currentUser.uid)||null, channel: chan, pfp, timestamp: serverTimestamp() });
      }
      closeInviteModal();
      appAlert('Invites sent to ' + checked.length + ' friend(s)!');
    };

    window.openInviteModal = openInviteModal;
    window.closeInviteModal = closeInviteModal;
    window.sendInvites = sendInvites;