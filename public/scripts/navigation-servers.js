// Channel navigation, direct messages, server management, and server settings.
window.switchChannel = (c) => {
  mode = 'channels';
  dmWith = null;
  currentServer = null;
  chan = c;
  document.getElementById('dm-btn').classList.remove('active');
  renderServerList();
  renderUserList();
  renderSidebar();
  updateHeader();
  listen();
};

// Helper: go to first server if available, otherwise show empty state
window.goToServer = () => {
  if (servers.length > 0) { switchServer(servers[0].id); return; }
  currentServer = null;
  mode = 'channels';
  dmWith = null;
  chan = null;
  document.getElementById('dm-btn').classList.remove('active');
  renderServerList();
  renderUserList();
  renderSidebar();
  updateHeader();
  listen();
};

window.toggleDMView = () => {
  if (mode === 'dms') {
    mode = 'channels';
    dmWith = null;
    if (!chan || chan.startsWith('dm_')) chan = null;
    document.getElementById('dm-btn').classList.remove('active');
  } else {
    mode = 'dms';
    dmWith = null;
    currentServer = null;
    chan = null;
    document.getElementById('dm-btn').classList.add('active');
  }
  document.getElementById('server-banner').style.display = 'none';
  renderServerList();
  renderUserList();
  renderSidebar();
  updateHeader();
  listen();
};

window.openDM = async (u) => {
  const privacy = userPrivacyMap.get(u) || {};
  if (privacy.dmAnyone === false) {
    try {
      const snap1 = await getDocs(query(collection(db, "friends"), where("from", "==", user)));
      const snap2 = await getDocs(query(collection(db, "friends"), where("to", "==", user)));
      const isFriend =
        snap1.docs.some(d => d.data().to === u && d.data().status === "accepted") ||
        snap2.docs.some(d => d.data().from === u && d.data().status === "accepted");

      if (!isFriend) {
        appAlert('This user has disabled direct messages from people they are not friends with.');
        return;
      }
    } catch (e) {}
  }

  dmWith = u;
  mode = 'dms';
  currentServer = null;
  chan = 'dm_' + [user, u].sort().join('_');
  document.getElementById('dm-btn').classList.add('active');
  renderServerList();
  renderUserList();
  renderSidebar();
  updateHeader();
  listen();
};

function dmKey(a, b) {
  return 'dm_' + [a, b].sort().join('_');
}

function knownUsers() {
  const set = new Set();
  allUsers.forEach(u => u && set.add(u));
  backfillUsers.forEach(u => u && set.add(u));
  lastPresenceUsers.forEach(x => x && x.user && set.add(x.user));
  servers.forEach(s => (s.members || []).forEach(u => u && set.add(u)));
  set.delete(user);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

const unreadBadge = (c) => {
  const n = (window._unreadCounts && window._unreadCounts[c]) || 0;
  return n > 0 ? '<span class="badge">' + n + '</span>' : '';
};

function renderSidebar() {
  const h3 = document.querySelector('.sb h3');
  const ch = document.querySelector('.ch');

  if (mode === 'channels') {
    const srv = currentServer ? servers.find(sv => sv.id === currentServer) : null;
    h3.textContent = srv ? srv.name : 'Channels';

    if (srv) {
      ch.innerHTML =
        `<div class="cat">Text Channels</div>` +
        (srv.channels || [{ name: 'general' }]).map(c => {
          return `<button class="cb ${chan === ('srv_' + currentServer + '_' + c.name) ? 'active' : ''}" onclick="switchServerChannel('${srv.id}','${escHtml(c.name)}')"># ${escHtml(c.name)}</button>${unreadBadge('srv_' + currentServer + '_' + c.name)}`;
        }).join('');
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
      html += `<button class="cb ${dmWith === u ? 'active' : ''}" onclick="openDM(this.dataset.user)" data-user="${safe}">@ ${safe}</button>${unreadBadge('dm_' + [user, u].sort().join('_'))}`;
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
  const online = [];
  const offline = [];

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

  online.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.user.localeCompare(b.user));
  offline.sort((a, b) => a.localeCompare(b));

  const row = (name, status) => {
    const upfp = userPfpMap.get(name);
    const hasPfp = upfp && !upfp.startsWith('file:///');
    const avStyle = hasPfp ? `style="background-image:url('${escHtml(upfp)}');"` : '';
    const avContent = hasPfp ? '' : escHtml((name || '?')[0].toUpperCase());

    return `<div class="member ${status === 'offline' ? 'off' : ''}" data-user="${escHtml(name)}" onclick="openProfile(this.dataset.user)">` +
      `<div class="member-avatar" ${avStyle}>${avContent}<span class="status-dot" title="${labels[status] || 'Online'}" style="background:${colors[status] || 'var(--mut)'}"></span></div>` +
      `<div class="member-name">${escHtml(name)}</div>` +
      `</div>`;
  };

  const ul = document.getElementById('user-list');
  const pfpSig = [...userPfpMap.entries()].map(([k, v]) => k + ':' + v.slice(0, 16)).join('|');
  const privSig = [...userPrivacyMap.entries()].map(([k, v]) => k + ':' + JSON.stringify(v)).join('|');
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
    const s = servers.find(x => x.id === currentServer);
    const ch = s && (s.channels || []).find(c => c.name === label);
    const topic = ch && ch.topic ? ch.topic : '';
    const desc = ch && ch.description ? ch.description : '';
    const canEdit = s && (s.owner === user || (s.admins || []).includes(user));
    const topicBtn = canEdit ? `<button onclick="setChannelTopic('${currentServer}','${escHtml(label)}')" style="margin-left:8px;background:transparent;border:none;color:var(--mut);cursor:pointer;font-size:11px;" title="Set topic">✎</button>` : '';
    const descBtn = canEdit ? `<button onclick="setChannelDescription('${currentServer}','${escHtml(label)}')" style="margin-left:4px;background:transparent;border:none;color:var(--mut);cursor:pointer;font-size:11px;" title="Set description">📝</button>` : '';
    h.innerHTML = `<span class="hash">#</span><span class="hname">${escHtml(label)}</span>${topic ? `<span class="channel-topic" style="margin-left:12px;color:var(--mut);font-size:12px;font-weight:400;">${escHtml(topic)}</span>` : ''}${topicBtn}${descBtn}${desc ? `<div style="width:100%;color:var(--mut);font-size:11px;margin-top:2px;">${escHtml(desc)}</div>` : ''}`;
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

function closeServerModal() {
  const m = document.getElementById('server-modal');
  m.classList.remove('visible');
  const c = m.querySelector('.modal-card');
  if (c) c.classList.remove('visible');
  setTimeout(() => { m.style.display = 'none'; }, 180);
}

function showServerTab(tab) {
  document.getElementById('sm-create').style.display = tab === 'create' ? 'block' : 'none';
  document.getElementById('sm-join').style.display = tab === 'join' ? 'block' : 'none';
  document.getElementById('sm-create-tab').style.background = tab === 'create' ? 'var(--bl)' : 'var(--bg-t)';
  document.getElementById('sm-create-tab').style.color = tab === 'create' ? 'var(--accent-contrast)' : 'var(--white)';
  document.getElementById('sm-join-tab').style.background = tab === 'join' ? 'var(--bl)' : 'var(--bg-t)';
  document.getElementById('sm-join-tab').style.color = tab === 'join' ? 'var(--accent-contrast)' : 'var(--white)';
}

async function createServerFromModal() {
  const name = document.getElementById('sm-name').value.trim();
  if (!name) { appAlert('Enter a server name'); return; }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ref = await addDoc(collection(db, 'servers'), {
    name,
    owner: user,
    ownerUid: (auth.currentUser && auth.currentUser.uid) || null,
    inviteCode: code,
    members: [user],
    memberUids: [(auth.currentUser && auth.currentUser.uid) || null],
    admins: [],
    adminUids: [],
    banned: [],
    channels: [{ name: 'general', id: 'general' }],
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, 'invites', code), { serverId: ref.id, createdBy: user, createdAt: serverTimestamp() });
  document.getElementById('sm-result').textContent = 'Created! Invite code: ' + code;
  await loadServers();
  switchServer(ref.id);
}

async function joinServerFromModal() {
  const code = document.getElementById('sm-code').value.trim();
  if (!code) { appAlert('Enter an invite code'); return; }
  await joinServer(code);
  closeServerModal();
}

window.openServerModal = openServerModal;
window.closeServerModal = closeServerModal;
window.showServerTab = showServerTab;
window.createServerFromModal = createServerFromModal;
window.joinServerFromModal = joinServerFromModal;

async function createServer() {
  const name = await appPrompt('Server name:');
  if (!name) return;

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ref = await addDoc(collection(db, 'servers'), {
    name,
    owner: user,
    ownerUid: (auth.currentUser && auth.currentUser.uid) || null,
    inviteCode: code,
    members: [user],
    memberUids: [(auth.currentUser && auth.currentUser.uid) || null],
    admins: [],
    adminUids: [],
    banned: [],
    channels: [{ name: 'general', id: 'general' }],
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, 'invites', code), { serverId: ref.id, createdBy: user, createdAt: serverTimestamp() });
  appAlert('Server created! Invite code: ' + code);
  await loadServers();
  switchServer(ref.id);
}

async function joinServer(codeParam) {
  const code = (codeParam || await appPrompt('Invite code:') || '').trim();
  if (!code) return;

  // Look up invite code in separate invites collection (readable by any auth user)
  const inviteSnap = await getDoc(doc(db, 'invites', code.toUpperCase()));
  if (!inviteSnap.exists()) { appAlert('Invalid code'); return; }
  const inviteData = inviteSnap.data();
  const serverId = inviteData.serverId;
  // Now read the server doc
  const serverSnap = await getDoc(doc(db, 'servers', serverId));
  if (!serverSnap.exists()) { appAlert('Server not found'); return; }
  const s = serverSnap;
  const data = s.data();

  const members = Array.isArray(data.members) ? data.members : [];
  const memberUids = Array.isArray(data.memberUids) ? data.memberUids : [];

  if (members.includes(user)) {
    switchServer(s.id);
    return;
  }
  if (Array.isArray(data.banned) && data.banned.includes(user)) {
    appAlert('You are banned from this server.');
    return;
  }

  await updateDoc(doc(db, 'servers', s.id), {
    members: [...members, user],
    memberUids: Array.from(new Set([...memberUids, (auth.currentUser && auth.currentUser.uid) || null].filter(Boolean)))
  });

  appAlert('Joined ' + data.name);
  await loadServers();
  switchServer(s.id);
}

async function loadServers() {
  const snap = await getDocs(query(collection(db, 'servers'), where('members', 'array-contains', user)));
  servers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  window.serverEmojis = window.serverEmojis || {};
  window.serverStickers = window.serverStickers || {};
  servers.forEach(s => { window.serverEmojis[s.id] = Array.isArray(s.emojis) ? s.emojis : []; window.serverStickers[s.id] = Array.isArray(s.stickers) ? s.stickers : []; });
  renderServerList();
}

function renderServerList() {
  const el = document.getElementById('server-list');
  el.innerHTML = servers.map(s => {
    const active = currentServer === s.id;
    const iconStyle = s.icon ? `background-image:url('${s.icon}');background-size:cover;background-position:center;` : '';
    const accentStyle = s.accent ? `border-left:3px solid ${escHtml(s.accent)};` : '';
    return `<div class="si ${active ? 'active' : ''}" onclick="switchServer('${s.id}')" oncontextmenu="showServerCtx(event,'${s.id}')" title="${escHtml(s.name)}" style="${iconStyle}${accentStyle}">${s.icon ? '' : escHtml(s.name)[0].toUpperCase()}</div>`;
  }).join('');
}

let ctxServerId = null;

function getServerRole(server) {
  const admins = Array.isArray(server && server.admins) ? server.admins : [];
  const isOwner = !!server && server.owner === user;
  const isAdmin = isOwner || admins.includes(user);
  return { isOwner, isAdmin };
}

function getServerById(id) {
  if (!id || !Array.isArray(servers)) return null;
  return servers.find(s => s.id === id) || null;
}

function canManageServer(server) {
  if (!server || !user) return false;
  const { isOwner, isAdmin } = getServerRole(server);
  return isOwner || isAdmin;
}

function showServerCtx(e, sid) {
  e.preventDefault();
  e.stopPropagation();
  ctxServerId = sid;

  const m = document.getElementById('server-ctx');
  m.dataset.serverId = sid;

  const s = getServerById(sid);
  const canManage = s && canManageServer(s);

  document.getElementById('ctx-invite').style.display = 'block';
  document.getElementById('ctx-settings').style.display = canManage ? 'block' : 'none';
  document.getElementById('ctx-leave').style.display = 'block';
  m.style.display = 'block';
  m.style.left = e.clientX + 'px';
  m.style.top = e.clientY + 'px';
}

function hideServerCtx() {
  document.getElementById('server-ctx').style.display = 'none';
}

document.addEventListener('click', hideServerCtx);

document.addEventListener('click', (e) => {
  const p = document.getElementById('reaction-picker');
  if (p && p.style.display !== 'none' && !p.contains(e.target) && !e.target.closest('[data-action="react"]')) hideReactionPicker();
});

function openServerSettings(sid) {
  if (sid) ctxServerId = sid;
  hideServerCtx();

  const s = getServerById(ctxServerId || sid);
  if (!s) return;

  const { isOwner, isAdmin } = getServerRole(s);
  if (!isAdmin) {
    if (typeof appAlert === 'function') appAlert('Only the server owner or admins can access settings.');
    return;
  }

  document.getElementById('ss-name').value = s.name || '';
  document.getElementById('ss-desc').value = s.description || '';
  document.getElementById('ss-icon-url').value = s.icon || '';
  document.getElementById('ss-banner-url').value = s.banner || '';
  document.getElementById('ss-accent').value = s.accent || '#57f287';

  const ssEmojis = document.getElementById('ss-emojis');
  if (ssEmojis) ssEmojis.value = (s.emojis || []).map(e => e.name + ':' + e.url).join('\n');
  const ssStickers = document.getElementById('ss-stickers');
  if (ssStickers) ssStickers.value = (s.stickers || []).map(e => e.name + ':' + e.url).join('\n');

  document.getElementById('ss-preview').innerHTML = s.banner
    ? `<img src="${escHtml(s.banner)}" style="width:100%;height:60px;object-fit:cover;border-radius:6px;">`
    : '';

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

  ['ss-name', 'ss-desc', 'ss-icon-url', 'ss-banner-url', 'ss-icon-file', 'ss-banner-file'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });

  const ssm = document.getElementById('server-settings-modal');
  if (ssm) {
    ssm.style.display = 'flex';
    requestAnimationFrame(() => {
      ssm.classList.add('visible');
      const card = ssm.querySelector('.modal-card');
      if (card) card.classList.add('visible');
    });
  }
}

function renderMembersList(s) {
  const el = document.getElementById('ss-members');
  if (!el || !s) return;

  const admins = new Set(Array.isArray(s.admins) ? s.admins : []);
  const members = Array.isArray(s.members) ? s.members : [];

  el.innerHTML = members.map(m => {
    const isOwner = (m === s.owner);
    const isAdmin = admins.has(m);
    let badge = isOwner ? ' (Owner)' : (isAdmin ? ' (Admin)' : '');
    let btn = '';

    if (s.owner === user && !isOwner) {
      btn = isAdmin
        ? `<button onclick="toggleAdmin('${escHtml(m)}', false)" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--danger);color:var(--white);cursor:pointer;">Remove Admin</button>`
        : `<button onclick="toggleAdmin('${escHtml(m)}', true)" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--bl);color:var(--accent-contrast);cursor:pointer;">Make Admin</button>`;
      btn += ` <button onclick="kickMember('${escHtml(m)}')" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--danger);color:var(--white);cursor:pointer;">Kick</button>`;
      btn += ` <button onclick="banMember('${escHtml(m)}')" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--danger);color:var(--white);cursor:pointer;">Ban</button>`;
      btn += ` <button onclick="transferOwnership('${escHtml(m)}')" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--yellow);color:var(--accent-contrast);cursor:pointer;">Transfer Owner</button>`;
    } else if ((s.admins || []).includes(user) && !isOwner) {
      btn = `<button onclick="kickMember('${escHtml(m)}')" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--danger);color:var(--white);cursor:pointer;">Kick</button>`;
    }

    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bg-t);font-size:12px;color:var(--txt);"><span>${escHtml(m)}${badge}</span>${btn}</div>`;
  }).join('');
  // Show banned users
  const banned = Array.isArray(s.banned) ? s.banned : [];
  if (banned.length && (s.owner === user || (s.admins || []).includes(user))) {
    el.innerHTML += '<div style="margin-top:8px;font-size:11px;color:var(--mut);">Banned:</div>' + banned.map(b => `<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;font-size:12px;color:var(--mut);"><span>${escHtml(b)}</span><button onclick="unbanMember('${escHtml(b)}')" style="font-size:10px;padding:2px 6px;border:none;border-radius:4px;background:var(--bl);color:var(--accent-contrast);cursor:pointer;">Unban</button></div>`).join('');
  }
}

async function renameChannel(sid, cname) {
  const s = servers.find(x => x.id === sid);
  if (!s) return;
  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) { appAlert('Only the owner or admins can rename channels.'); return; }
  const newName = await appPrompt('New channel name:', cname);
  if (!newName || newName === cname) return;
  const channels = s.channels || [];
  if (channels.some(c => c.name === newName)) { appAlert('Channel already exists'); return; }
  const ch = channels.find(c => c.name === cname);
  if (ch) ch.name = newName;
  await updateDoc(doc(db, 'servers', sid), { channels });
  await loadServers();
  if (currentServer === sid) switchServerChannel(sid, newName);
  appAlert('Channel renamed to ' + newName + '.');
}

async function setChannelTopic(sid, cname) {
  const s = servers.find(x => x.id === sid);
  if (!s) return;
  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) { appAlert('Only the owner or admins can set channel topics.'); return; }
  const ch = (s.channels || []).find(c => c.name === cname);
  const currentTopic = ch && ch.topic ? ch.topic : '';
  const topic = await appPrompt('Channel topic:', currentTopic);
  if (topic === null) return;
  if (ch) ch.topic = topic;
  await updateDoc(doc(db, 'servers', sid), { channels: s.channels });
  await loadServers();
  updateHeader();
}

async function toggleAdmin(member, makeAdmin) {
  const s = getServerById(ctxServerId);
  if (!s) return;

  if (s.owner !== user) {
    appAlert('Only the server owner can manage admin roles.');
    return;
  }

  if (member === s.owner) {
    appAlert('The owner cannot be changed through admin roles.');
    return;
  }

  if (!Array.isArray(s.members) || !s.members.includes(member)) {
    appAlert('That user is not a member of this server.');
    return;
  }

  const admins = new Set(Array.isArray(s.admins) ? s.admins : []);
  if (makeAdmin) admins.add(member);
  else admins.delete(member);

  await updateDoc(doc(db, 'servers', ctxServerId), { admins: Array.from(admins) });
  await loadServers();

  const updated = getServerById(ctxServerId);
  if (updated) renderMembersList(updated);
}

async function deleteServer() {
  const s = getServerById(ctxServerId);
  if (!s) return;

  if (s.owner !== user) {
    appAlert('Only the owner can delete the server');
    return;
  }

  if (!(await appConfirm('Delete server "' + s.name + '"? This cannot be undone.'))) return;

  await deleteDoc(doc(db, 'servers', ctxServerId));
  if (currentServer === ctxServerId) { currentServer = null; chan = null; mode = 'channels'; dmWith = null; }
  await loadServers();

  if (currentServer) switchServer(currentServer);
  else if (servers.length > 0) { switchServer(servers[0].id); }
  else {
    document.querySelector('.sb h3').textContent = 'Channels';
    document.getElementById('server-banner').style.display = 'none';
    document.querySelector('.ch').innerHTML = `<div class="cat">Servers</div><div class="rs-empty" style="padding:8px;">Select a server from the rail</div>`;
    updateHeader();
    listen();
  }
}

window.deleteServer = deleteServer;
async function kickMember(member) {
  const s = getServerById(ctxServerId);
  if (!s) return;
  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) { appAlert('No permission.'); return; }
  if (member === s.owner) { appAlert('Cannot kick the owner.'); return; }
  if (!(await appConfirm('Kick ' + member + ' from the server?'))) return;
  const members = (s.members || []).filter(m => m !== member);
  const memberUids = (s.memberUids || []).filter((_, i) => (s.members || [])[i] !== member);
  await updateDoc(doc(db, 'servers', ctxServerId), { members, memberUids });
  await loadServers();
  if (currentServer === ctxServerId) switchServer(ctxServerId);
  appAlert(member + ' has been kicked.');
}

async function banMember(member) {
  const s = getServerById(ctxServerId);
  if (!s) return;
  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) { appAlert('No permission.'); return; }
  if (member === s.owner) { appAlert('Cannot ban the owner.'); return; }
  if (!(await appConfirm('Ban ' + member + ' from the server? They will not be able to rejoin.'))) return;
  const members = (s.members || []).filter(m => m !== member);
  const memberUids = (s.memberUids || []).filter((_, i) => (s.members || [])[i] !== member);
  const banned = Array.isArray(s.banned) ? [...s.banned, member] : [member];
  await updateDoc(doc(db, 'servers', ctxServerId), { members, memberUids, banned });
  await loadServers();
  if (currentServer === ctxServerId) switchServer(ctxServerId);
  appAlert(member + ' has been banned.');
}

async function unbanMember(member) {
  const s = getServerById(ctxServerId);
  if (!s) return;
  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) { appAlert('No permission.'); return; }
  const banned = (s.banned || []).filter(m => m !== member);
  await updateDoc(doc(db, 'servers', ctxServerId), { banned });
  await loadServers();
  appAlert(member + ' has been unbanned.');
}

async function transferOwnership(newOwner) {
  const s = getServerById(ctxServerId);
  if (!s) return;
  if (s.owner !== user) { appAlert('Only the server owner can transfer ownership.'); return; }
  if (newOwner === user) { appAlert('You are already the owner.'); return; }
  if (!(s.members || []).includes(newOwner)) { appAlert('That user is not a member of this server.'); return; }
  if (!(await appConfirm('Transfer ownership to ' + newOwner + '? This cannot be undone.'))) return;
  await updateDoc(doc(db, 'servers', ctxServerId), { owner: newOwner, ownerUid: null });
  await loadServers();
  if (currentServer === ctxServerId) switchServer(ctxServerId);
  appAlert('Ownership transferred to ' + newOwner + '.');
}

window.toggleAdmin = toggleAdmin;
window.kickMember = kickMember;
window.banMember = banMember;
window.unbanMember = unbanMember;
window.transferOwnership = transferOwnership;

function closeServerSettings() {
  const m = document.getElementById('server-settings-modal');
  m.classList.remove('visible');
  const c = m.querySelector('.modal-card');
  if (c) c.classList.remove('visible');
  setTimeout(() => { m.style.display = 'none'; }, 180);
}

async function saveServerSettings() {
  const s = getServerById(ctxServerId);
  if (!s) return;

  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) {
    appAlert('You do not have permission to save server settings.');
    return;
  }

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
  const emojis = emojisRaw
    ? emojisRaw.split('\n').map(line => {
        const idx = line.indexOf(':');
        if (idx < 0) return null;
        const name = line.slice(0, idx).trim();
        const url = line.slice(idx + 1).trim();
        if (!name || !url) return null;
        return { name, url };
      }).filter(Boolean)
    : [];

  await updateDoc(doc(db, 'servers', ctxServerId), {
    name,
    description,
    icon,
    banner,
    accent,
    emojis,
    stickers
  });
  const stickersRaw = (document.getElementById('ss-stickers').value || '').trim();
  const stickers = stickersRaw.split('\n').map(line => {
    const idx = line.indexOf(':');
    if (idx < 0) return null;
    const name = line.slice(0, idx).trim();
    const url = line.slice(idx+1).trim();
    if (!name || !url) return null;
    return { name, url };
  }).filter(Boolean);
  await updateDoc(doc(db, 'servers', ctxServerId), { stickers });

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
    r.readAsDataURL(file);
  });
}

async function leaveServer() {
  hideServerCtx();
  const s = getServerById(ctxServerId);
  if (!s) return;

  if (s.owner === user) {
    appAlert('The owner must delete the server instead of leaving it.');
    return;
  }

  if (!(await appConfirm('Leave ' + s.name + '?'))) return;

  const remaining = (s.members || []).filter(m => m !== user);
  const admins = (s.admins || []).filter(m => m !== user);

  if (remaining.length === 0) {
    await deleteDoc(doc(db, 'servers', ctxServerId));
  } else {
    await updateDoc(doc(db, 'servers', ctxServerId), {
      members: remaining,
      admins
    });
  }

  if (currentServer === ctxServerId) { currentServer = null; chan = null; mode = 'channels'; dmWith = null; }
  await loadServers();
  if (currentServer) switchServer(currentServer);
  else if (servers.length > 0) { switchServer(servers[0].id); }
  else {
    document.querySelector('.sb h3').textContent = 'Channels';
    document.getElementById('server-banner').style.display = 'none';
    document.querySelector('.ch').innerHTML = `<div class="cat">Servers</div><div class="rs-empty" style="padding:8px;">Select a server from the rail</div>`;
    updateHeader();
    listen();
  }
}

document.getElementById('ctx-invite').onclick = (e) => {
  e.stopPropagation();
  const sid = document.getElementById('server-ctx').dataset.serverId;
  hideServerCtx();
  openInviteModal(sid);
};

document.getElementById('ctx-settings').onclick = (e) => {
  e.stopPropagation();
  const sid = document.getElementById('server-ctx').dataset.serverId;
  hideServerCtx();
  openServerSettings(sid);
};

document.getElementById('ctx-leave').onclick = (e) => {
  e.stopPropagation();
  hideServerCtx();
  leaveServer();
};

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

  const s = servers.find(x => x.id === id);
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

    const visibleChs = (s.channels || [{ name: 'general' }]).filter(c => !c.private || s.owner === user || (s.admins || []).includes(user));
    const chBtns = `<div class="cat">Text Channels</div>` + visibleChs.map(c => `<button class="cb ${chan === ('srv_' + currentServer + '_' + c.name) ? 'active' : ''}" onclick="switchServerChannel('${s.id}','${escHtml(c.name)}')">${c.private ? '🔒 ' : ''}# ${escHtml(c.name)}</button>`).join('');
    document.querySelector('.ch').innerHTML = chBtns +
      `<button class="cb muted" onclick="createChannel('${s.id}')" style="color:var(--bl);">+ Add Channel</button>` +
      `<button class="cb muted" onclick="shareInvite('${s.id}')">Invite Code: ${escHtml(s.inviteCode)}</button>` +
      `<button class="cb muted" onclick="revokeInvite('${s.id}')" style="color:var(--danger);">Revoke Invite</button>`;
  } else {
    chan = null; mode = 'channels'; dmWith = null;
    document.querySelector('.sb h3').textContent = 'Channels';
    document.getElementById('server-banner').style.display = 'none';
    document.querySelector('.ch').innerHTML = `<div class="cat">Servers</div><div class="rs-empty" style="padding:8px;">Select a server from the rail</div>`;
  }

  renderServerList();
  updateHeader();
  renderUserList();

  if (chan && currentServer) {
    const cname = chan.split('_').slice(2).join('_');
    if (window.__skipPush) {
      try { history.replaceState({ chan: chan }, '', '/channel/' + currentServer + '/' + cname); } catch (e) {}
    } else {
      try { history.pushState({ chan: chan }, '', '/channel/' + currentServer + '/' + cname); } catch (e) {}
    }
  }

  listen();
}

window.switchServerChannel = (sid, cname) => {
  const s = servers.find(x => x.id === sid);
  if (!s) return;

  currentServer = sid;
  mode = 'channels';
  dmWith = null;
  document.getElementById('dm-btn').classList.remove('active');

  chan = 'srv_' + sid + '_' + cname;
      const visibleChs2 = (s.channels || [{ name: 'general' }]).filter(c => !c.private || s.owner === user || (s.admins || []).includes(user));
      document.querySelector('.ch').innerHTML = `<div class="cat">Text Channels</div>` + visibleChs2.map(c => `<button class="cb ${chan === ('srv_' + sid + '_' + c.name) ? 'active' : ''}" onclick="switchServerChannel('${sid}','${escHtml(c.name)}')">${c.private ? '🔒 ' : ''}# ${escHtml(c.name)}</button>${unreadBadge('srv_' + sid + '_' + c.name)}`).join('') +
    `<button class="cb muted" onclick="createChannel('${sid}')" style="color:var(--bl);">+ Add Channel</button>` +
    `<button class="cb muted" onclick="shareInvite('${sid}')">Invite Code: ${escHtml(s.inviteCode)}</button>` +
    `<button class="cb muted" onclick="revokeInvite('${sid}')" style="color:var(--danger);">Revoke Invite</button>`;

  renderServerList();
  updateHeader();
  renderUserList();

  if (chan) {
    const cname2 = chan.split('_').slice(2).join('_');
    if (window.__skipPush) {
      try { history.replaceState({ chan: chan }, '', '/channel/' + sid + '/' + cname2); } catch (e) {}
    } else {
      try { history.pushState({ chan: chan }, '', '/channel/' + sid + '/' + cname2); } catch (e) {}
    }
  }

  listen();
};

async function createChannel(sid) {
  const name = await appPrompt('Channel name:');
  if (!name) return;

  const s = servers.find(x => x.id === sid);
  if (!s) return;

  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) {
    appAlert('Only the owner or admins can create channels.');
    return;
  }

  const channels = s.channels || [{ name: 'general', id: 'general' }];
  if (channels.some(c => c.name === name)) { appAlert('Channel already exists'); return; }

  channels.push({ name, id: name });
  await updateDoc(doc(db, 'servers', sid), { channels });
  await loadServers();
  switchServerChannel(sid, name);
}

async function shareInvite(sid) {
  const s = servers.find(x => x.id === sid);
  if (!s) return;

  const link = window.location.origin + window.location.pathname + '?join=' + s.inviteCode;
  try { await navigator.clipboard.writeText(link); appAlert('Invite link copied:\n' + link); }
  catch (e) { appAlert('Invite link (copy manually):\n' + link); }
}

window.createChannel = createChannel;
window.shareInvite = shareInvite;

async function revokeInvite(sid) {
  const s = servers.find(x => x.id === sid);
  if (!s) return;
  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner) { appAlert('Only the server owner can revoke invite codes.'); return; }
  if (!(await appConfirm('Revoke the current invite code and generate a new one?'))) return;
  const oldCode = s.inviteCode;
  const newCode = Math.random().toString(36).substring(2,8).toUpperCase();
  // Delete old invite doc
  try { await deleteDoc(doc(db, 'invites', oldCode.toUpperCase())); } catch (e) {}
  // Update server with new code
  await updateDoc(doc(db, 'servers', sid), { inviteCode: newCode });
  // Create new invite doc
  await setDoc(doc(db, 'invites', newCode), { serverId: sid, createdBy: user, createdAt: serverTimestamp() });
  await loadServers();
  if (currentServer === sid) switchServer(sid);
  appAlert('New invite code: ' + newCode);
}

window.revokeInvite = revokeInvite;
window.renameChannel = renameChannel;
window.setChannelTopic = setChannelTopic;

async function setChannelDescription(sid, cname) {
  const s = servers.find(x => x.id === sid);
  if (!s) return;
  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) { appAlert('Only the owner or admins can set channel descriptions.'); return; }
  const ch = (s.channels || []).find(c => c.name === cname);
  const currentDesc = ch && ch.description ? ch.description : '';
  const desc = await appPrompt('Channel description:', currentDesc);
  if (desc === null) return;
  if (ch) ch.description = desc;
  await updateDoc(doc(db, 'servers', sid), { channels: s.channels });
  await loadServers();
  updateHeader();
}

async function moveChannel(sid, cname, direction) {
  const s = servers.find(x => x.id === sid);
  if (!s) return;
  const { isOwner, isAdmin } = getServerRole(s);
  if (!isOwner && !isAdmin) { appAlert('No permission.'); return; }
  const channels = s.channels || [];
  const idx = channels.findIndex(c => c.name === cname);
  if (idx < 0) return;
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= channels.length) return;
  // Swap
  [channels[idx], channels[newIdx]] = [channels[newIdx], channels[idx]];
  await updateDoc(doc(db, 'servers', sid), { channels });
  await loadServers();
  if (currentServer === sid) switchServer(sid);
}

window.moveChannel = moveChannel;
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

  let previewHtml = '<div class="invite-card">';
  if (s.banner) previewHtml += `<div class="invite-card-banner" style="background-image:url('${escHtml(s.banner)}');"></div>`;
  previewHtml += `<div class="invite-card-body">`;
  if (s.icon) previewHtml += `<img src="${escHtml(s.icon)}" alt="" style="width:40px;height:40px;border-radius:50%;margin-bottom:8px;">`;
  previewHtml += `<div class="invite-card-name">${escHtml(s.name)}</div>`;
  if (s.description) previewHtml += `<div class="invite-card-desc">${escHtml(s.description)}</div>`;
  previewHtml += `</div></div>`;
  preview.innerHTML = previewHtml;

  try {
    const outgoing = await getDocs(query(collection(db, "friends"), where("from", "==", user)));
    const incoming = await getDocs(query(collection(db, "friends"), where("to", "==", user)));
    const friendSet = new Set();

    outgoing.docs.forEach(d => {
      const data = d.data();
      if (data.status === "accepted" && data.to) friendSet.add(data.to);
    });

    incoming.docs.forEach(d => {
      const data = d.data();
      if (data.status === "accepted" && data.from) friendSet.add(data.from);
    });

    const friendList = Array.from(friendSet).sort((a, b) => a.localeCompare(b));
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

  const friendSet = new Set();
  try {
    const outgoing = await getDocs(query(collection(db, "friends"), where("from", "==", user)));
    const incoming = await getDocs(query(collection(db, "friends"), where("to", "==", user)));
    outgoing.docs.forEach(d => { if (d.data().status === "accepted" && d.data().to) friendSet.add(d.data().to); });
    incoming.docs.forEach(d => { if (d.data().status === "accepted" && d.data().from) friendSet.add(d.data().from); });
  } catch (e) { console.error('Failed to verify friends:', e); }

  for (const cb of checked) {
    const friend = cb.value;
    if (!friendSet.has(friend)) {
      console.warn('Skipping non-friend:', friend);
      continue;
    }

    const inviteCard = `<invite server="${escHtml(s.name)}" icon="${escHtml(s.icon || '')}" banner="${escHtml(s.banner || '')}" desc="${escHtml(s.description || '')}" link="${escHtml(inviteLink)}"></invite>`;
    const chan = 'dm_' + [user, friend].sort().join('_');

    await addDoc(collection(db, "messages"), {
      text: inviteCard,
      user,
      uid: (auth.currentUser && auth.currentUser.uid) || null,
      channel: chan,
      pfp,
      timestamp: serverTimestamp()
    });
  }

  closeInviteModal();
  appAlert('Invites sent to ' + checked.length + ' friend(s)!');
};

window.openInviteModal = openInviteModal;
window.closeInviteModal = closeInviteModal;
window.sendInvites = sendInvites;