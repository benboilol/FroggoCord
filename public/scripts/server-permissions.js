(function () {
  function getServerPermissions(server) {
    const admins = Array.isArray(server && server.admins) ? server.admins : [];
    const isOwner = !!server && server.owner === user;
    const isAdmin = isOwner || admins.includes(user);
    return { isOwner, isAdmin, canManage: isAdmin };
  }

  function renderServerMembersList(server) {
    const el = document.getElementById('ss-members');
    if (!el || !server) return;
    const admins = new Set(Array.isArray(server.admins) ? server.admins : []);
    const members = Array.isArray(server.members) ? server.members : [];
    el.innerHTML = members.map((member) => {
      const isOwner = member === server.owner;
      const isAdmin = admins.has(member);
      const badge = isOwner ? ' (Owner)' : (isAdmin ? ' (Admin)' : '');
      let action = '';
      const canManageAdmins = server.owner === user;
      if (canManageAdmins && !isOwner) {
        action = isAdmin
          ? `<button onclick="toggleAdmin('${String(member).replace(/'/g, "\\'")}', false)" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--danger);color:var(--white);cursor:pointer;">Remove Admin</button>`
          : `<button onclick="toggleAdmin('${String(member).replace(/'/g, "\\'")}', true)" style="font-size:11px;padding:2px 8px;border:none;border-radius:4px;background:var(--bl);color:var(--accent-contrast);cursor:pointer;">Make Admin</button>`;
      }
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bg-t);font-size:12px;color:var(--txt);"><span>${escHtml(member)}${badge}</span>${action}</div>`;
    }).join('');
  }

  function enforceServerManage(server, actionText) {
    if (!server) return false;
    const { canManage } = getServerPermissions(server);
    if (!canManage) {
      if (typeof appAlert === 'function') {
        appAlert('You do not have permission to ' + actionText + '.');
      }
      return false;
    }
    return true;
  }

  if (typeof window !== 'undefined') {
    const originalShowServerCtx = window.showServerCtx;
    window.showServerCtx = function (event, sid) {
      if (typeof originalShowServerCtx === 'function') {
        originalShowServerCtx(event, sid);
      }
      const server = Array.isArray(window.servers) ? window.servers.find((entry) => entry.id === sid) : null;
      const settingsButton = document.getElementById('ctx-settings');
      if (settingsButton) {
        const { canManage } = getServerPermissions(server);
        settingsButton.style.display = canManage ? 'block' : 'none';
      }
    };

    window.openServerSettings = function (sid) {
      if (sid) {
        window.ctxServerId = sid;
      }
      const server = Array.isArray(window.servers) ? window.servers.find((entry) => entry.id === (window.ctxServerId || sid)) : null;
      if (!server) return;

      const { isOwner, canManage } = getServerPermissions(server);
      if (!canManage) {
        if (typeof appAlert === 'function') appAlert('Only the server owner or admins can access settings.');
        return;
      }

      const nameField = document.getElementById('ss-name');
      const descField = document.getElementById('ss-desc');
      const iconUrlField = document.getElementById('ss-icon-url');
      const bannerUrlField = document.getElementById('ss-banner-url');
      const iconFileField = document.getElementById('ss-icon-file');
      const bannerFileField = document.getElementById('ss-banner-file');
      const adminsSection = document.getElementById('ss-admins-section');
      const deleteButton = document.getElementById('ss-delete-btn');

      if (nameField) nameField.value = server.name || '';
      if (descField) descField.value = server.description || '';
      if (iconUrlField) iconUrlField.value = server.icon || '';
      if (bannerUrlField) bannerUrlField.value = server.banner || '';
      if (document.getElementById('ss-accent')) {
        document.getElementById('ss-accent').value = server.accent || '#57f287';
      }
      const emojiField = document.getElementById('ss-emojis');
      if (emojiField) {
        emojiField.value = (server.emojis || []).map((emoji) => emoji.name + ':' + emoji.url).join('\n');
      }
      const preview = document.getElementById('ss-preview');
      if (preview) {
        preview.innerHTML = server.banner ? `<img src="${escHtml(server.banner)}" style="width:100%;height:60px;object-fit:cover;border-radius:6px;">` : '';
      }

      if (isOwner) {
        if (adminsSection) adminsSection.style.display = 'block';
        if (deleteButton) deleteButton.style.display = 'inline-block';
        renderServerMembersList(server);
      } else {
        if (adminsSection) adminsSection.style.display = 'none';
        if (deleteButton) deleteButton.style.display = 'none';
      }

      ['ss-name', 'ss-desc', 'ss-icon-url', 'ss-banner-url', 'ss-icon-file', 'ss-banner-file'].forEach((id) => {
        const field = document.getElementById(id);
        if (field) field.disabled = false;
      });
      if (iconFileField) iconFileField.value = '';
      if (bannerFileField) bannerFileField.value = '';

      const ssm = document.getElementById('server-settings-modal');
      if (ssm) {
        ssm.style.display = 'flex';
        requestAnimationFrame(() => {
          ssm.classList.add('visible');
          const card = ssm.querySelector('.modal-card');
          if (card) card.classList.add('visible');
        });
      }
    };

    window.toggleAdmin = async function (member, makeAdmin) {
      const server = Array.isArray(window.servers) ? window.servers.find((entry) => entry.id === window.ctxServerId) : null;
      if (!server) return;
      const { isOwner } = getServerPermissions(server);
      if (!isOwner) {
        if (typeof appAlert === 'function') appAlert('Only the server owner can manage admin roles.');
        return;
      }
      if (member === server.owner) {
        if (typeof appAlert === 'function') appAlert('The owner cannot be changed through admin roles.');
        return;
      }

      const admins = new Set(Array.isArray(server.admins) ? server.admins : []);
      if (makeAdmin) admins.add(member);
      else admins.delete(member);

      await updateDoc(doc(db, 'servers', window.ctxServerId), { admins: Array.from(admins) });
      await loadServers();
      const updated = Array.isArray(window.servers) ? window.servers.find((entry) => entry.id === window.ctxServerId) : null;
      if (updated) renderServerMembersList(updated);
    };

    window.saveServerSettings = async function () {
      const server = Array.isArray(window.servers) ? window.servers.find((entry) => entry.id === window.ctxServerId) : null;
      if (!server) return;
      if (!enforceServerManage(server, 'save server settings')) return;

      const name = document.getElementById('ss-name').value.trim() || server.name;
      const description = document.getElementById('ss-desc').value.trim();
      let icon = document.getElementById('ss-icon-url').value.trim();
      let banner = document.getElementById('ss-banner-url').value.trim();
      const accent = document.getElementById('ss-accent').value.trim() || '#57f287';
      const iconFile = document.getElementById('ss-icon-file').files[0];
      const bannerFile = document.getElementById('ss-banner-file').files[0];

      if (iconFile) icon = await fileToDataUrl(iconFile);
      if (bannerFile) banner = await fileToDataUrl(bannerFile);

      const emojiField = document.getElementById('ss-emojis');
      const emojisRaw = (emojiField ? emojiField.value : '').trim();
      const emojis = emojisRaw
        ? emojisRaw.split('\n').map((line) => {
            const index = line.indexOf(':');
            if (index < 0) return null;
            const name = line.slice(0, index).trim();
            const url = line.slice(index + 1).trim();
            if (!name || !url) return null;
            return { name, url };
          }).filter(Boolean)
        : [];

      await updateDoc(doc(db, 'servers', window.ctxServerId), {
        name,
        description,
        icon,
        banner,
        accent,
        emojis
      });
      await loadServers();
      if (currentServer === window.ctxServerId) switchServer(window.ctxServerId);
      const settingsModal = document.getElementById('server-settings-modal');
      if (settingsModal) {
        settingsModal.classList.remove('visible');
        const card = settingsModal.querySelector('.modal-card');
        if (card) card.classList.remove('visible');
        setTimeout(() => { settingsModal.style.display = 'none'; }, 180);
      }
    };

    window.createChannel = async function (sid) {
      const server = Array.isArray(window.servers) ? window.servers.find((entry) => entry.id === sid) : null;
      if (!server) return;
      if (!enforceServerManage(server, 'create channels')) return;

      const name = await appPrompt('Channel name:');
      if (!name) return;
      const channels = Array.isArray(server.channels) ? server.channels.slice() : [{ name: 'general', id: 'general' }];
      if (channels.some((channel) => channel.name === name)) {
        appAlert('Channel already exists');
        return;
      }
      channels.push({ name, id: name });
      await updateDoc(doc(db, 'servers', sid), { channels });
      await loadServers();
      if (typeof switchServerChannel === 'function') switchServerChannel(sid, name);
    };

    window.leaveServer = async function () {
      const server = Array.isArray(window.servers) ? window.servers.find((entry) => entry.id === window.ctxServerId) : null;
      if (!server) return;
      if (server.owner === user) {
        if (typeof appAlert === 'function') appAlert('The owner must transfer ownership or delete the server instead of leaving.');
        return;
      }
      if (!(await appConfirm('Leave ' + server.name + '?'))) return;
      const remaining = (server.members || []).filter((member) => member !== user);
      const admins = Array.isArray(server.admins) ? server.admins.filter((member) => member !== user) : [];
      if (remaining.length === 0) {
        await deleteDoc(doc(db, 'servers', window.ctxServerId));
      } else {
        await updateDoc(doc(db, 'servers', window.ctxServerId), {
          members: remaining,
          admins
        });
      }
      if (currentServer === window.ctxServerId) {
        currentServer = null;
        chan = null;
        mode = 'channels';
        dmWith = null;
      }
      await loadServers();
      if (currentServer) switchServer(currentServer);
      else if (servers.length > 0) switchServer(servers[0].id);
      else {
        document.querySelector('.sb h3').textContent = 'Channels';
        document.getElementById('server-banner').style.display = 'none';
        document.querySelector('.ch').innerHTML = '<div class="cat">Servers</div><div class="rs-empty" style="padding:8px;">Select a server from the rail</div>';
      }
    };
  }
})();
