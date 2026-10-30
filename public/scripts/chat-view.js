// Profiles, message rendering, live listeners, composer, and authentication startup.
window.openProfile = async (u) => {
  const modal = document.getElementById('profile-modal');
  const banner = document.getElementById('prof-banner');
  const ub = (typeof userBannerMap !== 'undefined') ? userBannerMap.get(u) : null;
  if (banner) { if (ub) { banner.style.backgroundImage = 'url('+escHtml(ub)+')'; } else { banner.style.backgroundImage = 'none'; } 
    const prof = (typeof settings !== 'undefined' && settings.profile) ? settings.profile : null;
    if (prof && u === user) {
      banner.style.backgroundPosition = prof.bannerPos || 'center';
      banner.style.backgroundSize = prof.bannerSize || 'cover';
    }
  }
  const modalCard = modal.querySelector('.modal-card');
  const bg = (typeof userBackgroundMap !== 'undefined') ? userBackgroundMap.get(u) : null;
  if (modalCard) { if (bg) { modalCard.style.backgroundImage = 'url('+escHtml(bg)+')'; modalCard.style.backgroundSize = (typeof settings !== 'undefined' && settings.profile && u === user) ? (settings.profile.bgSize || 'cover') : 'cover'; modalCard.style.backgroundPosition = (typeof settings !== 'undefined' && settings.profile && u === user) ? (settings.profile.bgPos || 'center') : 'center'; } else { modalCard.style.backgroundImage = ''; } const bgColor = (typeof userBgColorMap !== 'undefined') ? userBgColorMap.get(u) : null; if (bgColor) modalCard.style.backgroundColor = bgColor; else modalCard.style.backgroundColor = ''; }
  const av = document.getElementById('prof-avatar');
  const upfp = (typeof userPfpMap !== 'undefined') ? userPfpMap.get(u) : null;
  const hasPfp = upfp && !upfp.startsWith('file:///');
  if (hasPfp) {
    av.style.backgroundImage = `url('${escHtml(upfp)}')`;
    av.textContent = '';
    av.style.textIndent = '-9999px';
  } else {
    av.style.backgroundImage = 'none';
    av.textContent = (u||'?')[0].toUpperCase();
    av.style.textIndent = '0';
  }
  const pname = document.getElementById('prof-name');
  pname.textContent = u;
  const txtCol = (typeof userTextColorMap !== 'undefined') ? userTextColorMap.get(u) : null;
  if (txtCol) pname.style.color = txtCol;
  // Apply profile layout
  try {
    const prof = (typeof settings !== 'undefined' && settings.profile) ? settings.profile : null;
    if (prof && u === user && modalCard) {
      modalCard.classList.remove('profile-compact', 'profile-spacious');
      if (prof.layout === 'compact') modalCard.classList.add('profile-compact');
      if (prof.layout === 'spacious') modalCard.classList.add('profile-spacious');
    }
  } catch (e) {}
  // Apply profile effect
  try {
    const prof = (typeof settings !== 'undefined' && settings.profile) ? settings.profile : null;
    if (prof && u === user) {
      const av = document.getElementById('prof-avatar');
      if (av) {
        av.classList.remove('profile-effect-glow', 'profile-effect-pulse', 'profile-effect-shimmer');
        if (prof.effect) {
          const type = prof.effectType || 'glow';
          if (type === 'glow' || type === 'pulse' || type === 'shimmer') {
            av.classList.add('profile-effect-' + type);
          }
        }
      }
      if (prof.effect && prof.effectType === 'rainbow') {
        pname.classList.add('profile-effect-rainbow');
      } else {
        pname.classList.remove('profile-effect-rainbow');
      }
    } else {
      const av = document.getElementById('prof-avatar');
      if (av) av.classList.remove('profile-effect-glow', 'profile-effect-pulse', 'profile-effect-shimmer');
      pname.classList.remove('profile-effect-rainbow');
    }
  } catch (e) {}
  try {
    const prof = (typeof settings !== 'undefined' && settings.profile) ? settings.profile : null;
    if (prof && u === user) {
      if (prof.gradient && prof.gradient.enabled) {
        pname.style.background = 'linear-gradient(' + (prof.gradient.direction||'to right') + ', ' + (prof.gradient.from||prof.color) + ', ' + (prof.gradient.to||prof.color) + ')';
        pname.style.webkitBackgroundClip = 'text';
        pname.style.backgroundClip = 'text';
        pname.style.color = 'transparent';
      } else {
        pname.style.background = '';
        pname.style.webkitBackgroundClip = '';
        pname.style.backgroundClip = '';
        pname.style.color = prof.color || '';
      }
    } else {
      pname.style.background = '';
      pname.style.webkitBackgroundClip = '';
      pname.style.backgroundClip = '';
      const accent = (typeof userAccentMap !== 'undefined') ? userAccentMap.get(u) : null;
      if (accent) pname.style.color = accent;
      else pname.style.color = '';
    }
  } catch (e) {}
  const pres = Array.from(document.getElementById('user-list').children).find(el => el.dataset.user === u);
  const dot = pres && pres.querySelector('.status-dot');
  document.getElementById('prof-status').textContent = dot ? (dot.getAttribute('title') || 'Online') : 'Offline';
  const cs = (typeof userCustomStatusMap !== 'undefined') ? userCustomStatusMap.get(u) : null;
  const pr = (typeof userPronounsMap !== 'undefined') ? userPronounsMap.get(u) : null;
  const profStatusEl = document.getElementById('prof-status');
  if (profStatusEl) {
    let statusText = profStatusEl.textContent;
    if (pr) statusText = pr + ' \u00b7 ' + statusText;
    if (cs) statusText = '\"' + cs + '\" \u00b7 ' + statusText;
    profStatusEl.textContent = statusText;
  }
  const badgesEl = document.getElementById('prof-badges');
  if (badgesEl) {
    const badges = [];
    try {
      if (typeof servers !== 'undefined') {
        if (servers.some(srv => srv.owner === u)) badges.push('Server Owner');
        if (servers.some(srv => (srv.admins||[]).includes(u))) badges.push('Admin');
      }
    } catch (e) {}
    const dec = (typeof userDecorationMap !== 'undefined') ? userDecorationMap.get(u) : null;
    if (dec) badges.push('<img src="'+escHtml(dec)+'" alt="decoration" style="width:20px;height:20px;border-radius:4px;display:block;">');
    badgesEl.innerHTML = badges.map(b => {
      if (b.startsWith('<img')) return '<span style="display:inline-block;margin:2px;">'+b+'</span>';
      return '<span style="background:var(--bg-t);color:var(--bright);padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;border:1px solid var(--hover);display:inline-block;margin:2px;">'+escHtml(b)+'</span>';
    }).join('');
  }
  const actions = document.getElementById('prof-actions');
  actions.innerHTML = '<div style="color:var(--mut);font-size:12px;">Loading...</div>';
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.add('visible');
    modal.querySelector('.modal-card').classList.add('visible');
  });

  let html = '';
  if (u !== user) {
    let friendDoc = null;
    try {
      const snap = await getDocs(query(collection(db,"friends"), where("from","==",user)));
      const outgoing = snap.docs.find(d => d.data().to === u && d.data().status === "accepted");
      if (outgoing) friendDoc = outgoing;
      else {
        const snap2 = await getDocs(query(collection(db,"friends"), where("to","==",user)));
        const incoming = snap2.docs.find(d => d.data().from === u && d.data().status === "accepted");
        if (incoming) friendDoc = incoming;
      }
    } catch (e) { console.log("friend check failed", e); }
    if (friendDoc) {
      html += `<span style="color:var(--mut);font-size:11px;display:block;margin-bottom:4px;">Friends</span>`;
      html += `<button onclick="unfriendReq('${friendDoc.id}'); closeProfile();" style="background:var(--danger);color:var(--white);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Unfriend</button>`;
    } else {
      let btnHtml = `<button onclick="sendReq('${escHtml(u)}'); closeProfile();" style="background:var(--bl);color:var(--accent-contrast);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Send Friend Request</button>`;
      try {
        const snap = await getDocs(query(collection(db,"friends"), where("from","==",user)));
        const existing = snap.docs.find(d => d.data().to === u && d.data().status === "pending");
        if (existing) {
          btnHtml = `<button onclick="cancelReq('${existing.id}'); closeProfile();" style="background:var(--mut);color:var(--white);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Cancel Request</button>`;
        } else {
          const snap2 = await getDocs(query(collection(db,"friends"), where("to","==",user)));
          const incoming = snap2.docs.find(d => d.data().from === u && d.data().status === "pending");
          if (incoming) {
            btnHtml = `<button onclick="acceptReq('${incoming.id}'); closeProfile();" style="background:var(--bl);color:var(--accent-contrast);border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:bold;">Accept Request</button>`;
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
};
window.closeProfile = () => {
  const modal = document.getElementById('profile-modal');
  const card = modal.querySelector('.modal-card');
  modal.classList.remove('visible');
  if (card) card.classList.remove('visible');
  setTimeout(() => { modal.style.display = 'none'; }, 180);
};

function fmtMsgTime(ts) {
  try {
    const d = ts && ts.toDate ? ts.toDate() : null;
    if (!d) return '';
    const same = d.toDateString() === new Date().toDateString();
    const format = settings?.accessibility?.timeFormat || 'system';
    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    if (format === '12-hour') timeOptions.hourCycle = 'h12';
    else if (format === '24-hour') timeOptions.hourCycle = 'h23';
    return (same ? 'Today at ' : d.toLocaleDateString([], {month:'short', day:'numeric'}) + ' at ') + d.toLocaleTimeString([], timeOptions);
  } catch (e) { return ''; }
}

const msgBox = document.getElementById('message-container');
const MESSAGE_PAGE_SIZE = 25;
let activeMessagesChannel = null;
let messagePages = [];
let loadingOlderMessages = false;
let hasOlderMessages = true;
let messageHistoryError = '';
let msgsPinned = true;
let isPinning = false;
let userScrolling = false;
let userScrollTimer = null;

function markUserScroll() {
  userScrolling = true;
  clearTimeout(userScrollTimer);
  userScrollTimer = setTimeout(() => { userScrolling = false; }, 300);
}

msgBox.addEventListener('wheel', markUserScroll, { passive: true });
msgBox.addEventListener('touchstart', markUserScroll, { passive: true });
msgBox.addEventListener('mousedown', markUserScroll, { passive: true });
msgBox.addEventListener('scroll', () => {
  if (isPinning) return;
  if (userScrolling) msgsPinned = msgBox.scrollHeight - msgBox.scrollTop - msgBox.clientHeight < 80;
  if (userScrolling && msgBox.scrollTop <= 80) loadOlderMessages();
}, { passive: true });

function pinMsgsBottom() {
  msgsPinned = true;
  isPinning = true;
  msgBox.scrollTop = msgBox.scrollHeight;
  setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; isPinning = false; }, 0);
}

const chatGifDims = {};
const REACTION_EMOJIS = ['👍','👎','❤️','😂','👮','😢','😡','🎉','🔥','👀','✅','❌','💯','🤔','😍','🙏','👏','💀','😭','😎','🥳','🤯'];

function renderReactions(m) {
  const r = (m && m.reactions) || {};
  const entries = Object.entries(r).filter(function(e){ return Array.isArray(e[1]) && e[1].length > 0; });
  if (!entries.length) return '';
  return '<div class="reactions" data-msgid="' + escHtml(m.id) + '" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">' +
    entries.map(function(pair){
      const emoji = pair[0];
      const users = pair[1];
      const mine = Array.isArray(users) && users.indexOf(user) >= 0;
      return '<button data-action="toggle-reaction" data-msgid="' + escHtml(m.id) + '" data-emoji="' + escHtml(emoji) + '" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;border:1px solid ' + (mine ? 'var(--bl)' : 'var(--reply-line)') + ';background:' + (mine ? 'var(--mention-bg)' : 'var(--bg-t)') + ';color:var(--txt);font-size:13px;cursor:pointer;line-height:1.4;">' +
        '<span>' + emoji + '</span><span style="font-weight:600;">' + users.length + '</span>' +
      '</button>';
    }).join('') +
  '</div>';
}

function svgMarkupFromDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:image\/svg\+xml((?:;[^,]*)*),(.*)$/is);
  if (!match) return null;
  const metadata = match[1];
  const payload = match[2];
  try {
    if (/(?:^|;)base64(?:;|$)/i.test(metadata)) {
      const bytes = Uint8Array.from(atob(payload), character => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(payload);
  } catch (error) {
    console.warn('Could not decode SVG attachment', error);
    return null;
  }
}

function interactiveSvgDocument(markup) {
  const contentPolicy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + contentPolicy + '"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}body{display:grid;place-items:center}svg{display:block;width:100%;height:100%}</style></head><body>' + markup + '</body></html>';
}

    function renderMessageImage(message) {
      const imgs = Array.isArray(message.images) ? message.images : (message.image ? [message.image] : []);
      const files = Array.isArray(message.files) ? message.files : [];
      const hasImages = imgs.length > 0;
      const hasFiles = files.length > 0;
      if (!hasImages && !hasFiles) return '';

      let parts = [];

      // Render images
      if (imgs.length > 1) {
        parts.push('<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:4px;margin-top:4px;">' +
          imgs.map(u => '<img src="' + escHtml(u) + '" alt="image" style="width:100%;border-radius:8px;display:block;cursor:pointer;aspect-ratio:1/1;object-fit:cover;" onclick="openLightbox(\'\' + escHtml(u) + \'\',\'\'Image\'\')">').join('') +
          '</div>');
      } else if (imgs.length === 1) {
        const img = imgs[0];
        const svgMarkup = svgMarkupFromDataUrl(img);
        if (svgMarkup !== null) {
          const srcdoc = interactiveSvgDocument(svgMarkup);
          const imageWidth = Number(message.imageW);
          const imageHeight = Number(message.imageH);
          const hasDimensions = Number.isFinite(imageWidth) && imageWidth > 0 && Number.isFinite(imageHeight) && imageHeight > 0;
          const aspectRatio = hasDimensions ? `${Math.min(imageWidth, 100000)} / ${Math.min(imageHeight, 100000)}` : '4 / 3';
          parts.push(`<iframe class="interactive-svg" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy" title="Interactive SVG attachment" srcdoc="${escHtml(srcdoc)}" style="width:min(320px, 100%);height:auto;min-height:80px;max-height:60vh;aspect-ratio:${aspectRatio};"></iframe>`);
        } else {
          parts.push(`<img src="${escHtml(img)}" alt="image" style="max-width:min(320px, 100%);border-radius:8px;display:block;margin-top:4px;cursor:pointer;${message.imageW && message.imageH ? ' aspect-ratio:' + Number(message.imageW) + '/' + Number(message.imageH) + ';' : ''}" onclick="openLightbox('${escHtml(img)}','Image')">`);
        }
      }

      // Render file attachments
      if (hasFiles) {
        parts.push('<div class="file-attachments" style="margin-top:4px;">' +
          files.map(f => {
            const sizeKB = (f.size / 1024).toFixed(1);
            const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
            const sizeStr = f.size >= 1024 * 1024 ? sizeMB + ' MB' : sizeKB + ' KB';
            const isPreviewable = f.preview && f.preview.startsWith('data:');
            return '<div class="file-attachment" style="display:flex;align-items:center;gap:8px;margin-top:4px;padding:6px 8px;background:var(--panel);border-radius:6px;border:1px solid var(--border);max-width:100%;">' +
              '<div style="width:32px;height:32px;border-radius:4px;background:var(--mut);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">📎</div>' +
              '<div style="flex:1;min-width:0;">' +
              '<div style="font-weight:600;color:var(--bright);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(f.name) + '</div>' +
              '<div style="font-size:11px;color:var(--mut);">' + sizeStr + ' \u00b7 ' + escHtml(f.type || 'file') + '</div>' +
              '</div>' +
              '<a href="' + escHtml(f.preview) + '" download="' + escHtml(f.name) + '" style="flex-shrink:0;color:var(--bl);text-decoration:none;font-size:13px;">Download</a>' +
              '</div>';
          }).join('') +
          '</div>');
      }

      return parts.join('');
    }

let pendingFiles = []; // array of {file, preview}

function resetMessagePages(channel) {
  messagePages.forEach(page => page.unsubscribe && page.unsubscribe());
  messagePages = [];
  activeMessagesChannel = channel;
  loadingOlderMessages = false;
  hasOlderMessages = true;
  messageHistoryError = '';
  msgsPinned = true;
  if (msgBox._ro) { msgBox._ro.disconnect(); msgBox._ro = null; }
}

function renderMessagePages({ forceBottom = false, preserveScroll = false, contentAddedAbove = false } = {}) {
  const previousHeight = msgBox.scrollHeight;
  const previousTop = msgBox.scrollTop;
  const byId = new Map();
  messagePages.forEach(page => page.messages.forEach((message, id) => byId.set(id, message)));

  const realClientIds = new Set();
  byId.forEach(m => { if (m.clientMsgId) realClientIds.add(m.clientMsgId); });

  const pendingForChannel = (typeof pendingMessages !== 'undefined' ? pendingMessages : []).filter(m =>
    m.channel === activeMessagesChannel && !realClientIds.has(m.clientId)
  );

  const allMessages = [...byId.values(), ...pendingForChannel];
  const docs = allMessages.sort((a, b) => {
    const aTime = a.timestamp ? (typeof a.timestamp.toMillis === 'function' ? a.timestamp.toMillis() : (a._clientTimestamp || 0)) : (a._clientTimestamp || 0);
    const bTime = b.timestamp ? (typeof b.timestamp.toMillis === 'function' ? b.timestamp.toMillis() : (b._clientTimestamp || 0)) : (b._clientTimestamp || 0);
    return aTime - bTime;
  });

  window._unreadCounts = {};
  docs.forEach(message => {
    if (!message.channel) return;
    const lastReadAt = lastRead[message.channel] || 0;
    if ((message.timestamp ? message.timestamp.toMillis() : 0) > lastReadAt && message.user !== user) {
      window._unreadCounts[message.channel] = (window._unreadCounts[message.channel] || 0) + 1;
    }
  });
  renderSidebar();

  const historyText = loadingOlderMessages
    ? 'Loading older messages…'
    : messageHistoryError || (!hasOlderMessages && docs.length ? 'Beginning of conversation' : (docs.length ? 'Scroll up for older messages' : ''));
  const isPendingMsg = (m) => m && m.clientId && String(m.clientId).startsWith('pending_');
  msgBox.innerHTML = '<div class="msgs-inner"><div class="message-history-status" aria-live="polite">' + escHtml(historyText) + '</div>' + docs.map(m => {
    const pending = isPendingMsg(m);
    const me = pending ? true : (m.user === user);
    const safeUser = escHtml(m.user);
    const av = (m.pfp && !m.pfp.startsWith('file:///')) ? `style="background-image:url('${escHtml(m.pfp)}');text-indent:-9999px;"` : '';
    const rep = m.replyTo ? `<div class="msg-reply"><span class="bar"></span><span>Replying to <b>@${escHtml(m.replyTo.user)}</b> ${escHtml(m.replyTo.text)}</span></div>` : '';
    const textVal = String(m.text ?? '');
    const isP = textVal.includes('@everyone') || textVal.includes(`@${user}`);
    const msgId = pending ? m.clientId : m.id;
    const btns = (me && !pending) ? `<span data-action="edit" data-id="${m.id}" data-text="${escHtml(textVal)}" style="color:var(--bl);">Edit</span><span data-action="delete" data-id="${m.id}" style="color:var(--danger);">Delete</span>` : '';
    const rBtn = `<span data-action="reply" data-id="${m.id}" data-user="${safeUser}" style="color:var(--mut);">Reply</span>`;
    const reactBtn = `<span data-action="react" data-id="${m.id}" style="color:var(--mut);">😀</span>`;
    let statusHtml = '';
    if (pending) {
      if (m.status === 'sending') statusHtml = '<div class="msg-status sending">⏳ Sending…</div>';
      else if (m.status === 'sent') statusHtml = '<div class="msg-status sent">✓ Sent</div>';
      else statusHtml = '<div class="msg-status failed">⚠️ Failed <button class="retry-btn" onclick="retryMessage(\'' + m.clientId + '\')">Retry</button></div>';
    }
    return `
      <div class="msg ${me ? 'me' : ''} ${isP ? 'mention' : ''} ${pending ? 'msg-pending' : ''} ${m.status === 'failed' ? 'msg-failed' : ''} ${m.replyTo ? 'has-reply' : ''}" data-id="${msgId}">
        <div class="pfp" ${av} onclick="openProfile('${safeUser}')">${safeUser ? safeUser[0].toUpperCase() : '?'}</div>
        <div class="msg-content">
          ${rep}
          <div class="msg-head">
            <span class="msg-author ${me ? 'self' : ''}" onclick="openProfile('${safeUser}')" style="cursor:pointer;">${safeUser}</span>
            <span class="msg-time">${pending ? 'just now' : fmtMsgTime(m.timestamp)}</span>
            <span class="msg-actions">${pending ? '' : reactBtn + rBtn + btns}</span>
          </div>
          ${textVal ? `<div class="msg-bubble">${renderText(textVal)}</div>` : ''}
          ${pending ? (m.images && m.images.length ? m.images.map(u => `<img src="${escHtml(u)}" alt="image" style="max-width: min(320px, 100%); border-radius:8px; display:block; margin-top:4px; opacity:0.7;">`).join('') : (m.image ? `<img src="${escHtml(m.image)}" alt="image" style="max-width: min(320px, 100%); border-radius:8px; display:block; margin-top:4px; opacity:0.7;">` : '')) : renderMessageImage(m)}
          ${pending ? '' : renderReactions(m)}
          ${statusHtml}
        </div>
      </div>`;
  }).join('') + '</div>';

  const inner = msgBox.querySelector('.msgs-inner');
  if (inner) {
    if (msgBox._ro) msgBox._ro.disconnect();
    let previousInnerHeight = inner.scrollHeight;
    let firstResize = true;
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.scrollHeight;
      const delta = nextHeight - previousInnerHeight;
      if (!firstResize && delta !== 0) {
        if (msgsPinned) msgBox.scrollTop = msgBox.scrollHeight;
        else msgBox.scrollTop += delta;
      }
      firstResize = false;
      previousInnerHeight = nextHeight;
    });
    observer.observe(inner);
    msgBox._ro = observer;
  }
  observeChatImages();

  const msgContainer = document.getElementById('message-container');
  msgBox.querySelectorAll('img').forEach(img => {
    if (!img.complete) img.addEventListener('load', () => {
      if (msgContainer && typeof msgsPinned !== 'undefined' && msgsPinned &&
          msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight < 80) {
        pinMsgsBottom();
      }
    }, { once: true });
  });

  if (preserveScroll) {
    requestAnimationFrame(() => {
      msgBox.scrollTop = previousTop + (contentAddedAbove ? msgBox.scrollHeight - previousHeight : 0);
    });
  }
  if (forceBottom) {
    msgsPinned = true;
    pinMsgsBottom();
  }
}

window.refreshMessageTimestamps = () => renderMessagePages();

function subscribeMessagePage(afterDocument = null) {
  const channel = activeMessagesChannel;
  const page = { channel, messages: new Map(), cursor: null, unsubscribe: null, ready: false };
  messagePages.push(page);
  const constraints = [
    collection(db, 'messages'),
    where('channel', '==', channel),
    orderBy('timestamp', 'desc')
  ];
  if (afterDocument) constraints.push(startAfter(afterDocument));
  constraints.push(limit(MESSAGE_PAGE_SIZE));

  page.unsubscribe = onSnapshot(query(...constraints), snap => {
    if (activeMessagesChannel !== channel || !messagePages.includes(page)) return;
    const wasReady = page.ready;
    const pageIndex = messagePages.indexOf(page);
    const shouldPin = pageIndex === 0 && (
      msgsPinned || snap.docChanges().some(change => change.type === 'added' && change.doc.data().user === user)
    );
    if (!wasReady) {
      page.messages = new Map(snap.docs.map(document => [document.id, { id: document.id, ...document.data() }]));
      page.cursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      page.hasMore = snap.docs.length === MESSAGE_PAGE_SIZE;
    } else {
      const changes = snap.docChanges();
      const added = changes.filter(change => change.type === 'added');
      changes.forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          page.messages.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        } else if (change.type === 'removed') {
          const removedAt = change.doc.data().timestamp?.toMillis?.() || 0;
          const wasPushedOutByNewerMessage = added.some(addedChange => {
            const addedAt = addedChange.doc.data().timestamp?.toMillis?.() || 0;
            return addedAt > removedAt;
          });
          if (!wasPushedOutByNewerMessage) page.messages.delete(change.doc.id);
        }
      });
    }
    page.ready = true;
    if (pageIndex === messagePages.length - 1) {
      loadingOlderMessages = false;
      hasOlderMessages = page.hasMore;
      messageHistoryError = '';
    }
    renderMessagePages({
      forceBottom: shouldPin,
      preserveScroll: pageIndex > 0 || (wasReady && !shouldPin),
      contentAddedAbove: pageIndex > 0
    });

    if (pageIndex === 0) {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added' || !user) return;
        const message = change.doc.data();
        const messageTime = message.timestamp ? message.timestamp.toMillis() : Date.now();
        if (messageTime > appLoadTime && message.user && message.user !== user && document.hidden) {
          const text = String(message.text ?? '');
          const isMention = text.includes('@everyone') || text.includes(`@${user}`);
          const hasImage = text.includes('<img') || !!message.image;
          const isDM = message.channel && message.channel.startsWith('dm_');
          const desktopEnabled = !settings || settings.notifications.desktop !== false;
          const mentionsEnabled = !settings || settings.notifications.mentions !== false;
          const dmEnabled = !settings || settings.notifications.dm !== false;
          if (!desktopEnabled) return;
          if (isMention && !mentionsEnabled) return;
          if (isDM && !dmEnabled) return;
          new Notification(isMention ? '⚠️ PINGED' : `@${message.user}`, {
            body: hasImage ? 'Sent an image 📷' : text
          });
        }
      });
    }
  }, error => {
    if (activeMessagesChannel !== channel || !messagePages.includes(page)) return;
    const pageIndex = messagePages.indexOf(page);
    page.unsubscribe();
    if (pageIndex > 0 || !page.ready) {
      messagePages.splice(pageIndex, 1);
    }
    loadingOlderMessages = false;
    messageHistoryError = pageIndex === 0 && !page.ready
      ? 'Could not load messages. Scroll up to retry.'
      : 'Could not load older messages. Scroll up to retry.';
    renderMessagePages({ preserveScroll: pageIndex > 0 });
    console.error('Message page listener failed', error);
  });
}

function loadOlderMessages() {
  if (loadingOlderMessages || !hasOlderMessages) return;
  if (!messagePages.length) {
    loadingOlderMessages = true;
    messageHistoryError = '';
    renderMessagePages({ preserveScroll: true });
    subscribeMessagePage();
    return;
  }
  const lastPage = messagePages[messagePages.length - 1];
  if (!lastPage.ready || !lastPage.cursor) return;
  loadingOlderMessages = true;
  messageHistoryError = '';
  renderMessagePages({ preserveScroll: true });
  subscribeMessagePage(lastPage.cursor);
}

function listen() {
  if (typingUnsub) { typingUnsub(); typingUnsub = null; }
  setTyping(false);
  if (!chan) {
    resetMessagePages(null);
    const container = document.getElementById('message-container');
    if (mode === 'dms') {
      container.innerHTML = '<div class="msgs-inner"><div class="msgs-empty">Select a user to start a DM</div></div>';
    } else {
      container.innerHTML = '<div class="msgs-inner"><div class="msgs-empty">Select a server from the rail to start chatting</div></div>';
    }
    return;
  }
  markRead(chan);

  const key = chan + '__' + user;
  getDoc(doc(db,'reads',key)).then((snap) => {
    if (snap.exists()) lastRead[chan] = snap.data().lastRead ? snap.data().lastRead.toMillis() : Date.now();
    renderSidebar();
  }).catch(()=>{});

  if (activeMessagesChannel !== chan) {
    resetMessagePages(chan);
    subscribeMessagePage();
  }

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
}

const atPopup = document.getElementById('at-popup');
const chatInput = document.getElementById('chat-input');

chatInput.addEventListener('blur', () => { if (user) setTyping(false); });
chatInput.addEventListener('input', (e) => {
  const val = e.target.value;
  const at = val.lastIndexOf('@');
  if (user && chan) {
    if (val.trim()) { setTyping(true); } else { setTyping(false); }
  }
  if (at !== -1 && at === val.length - 1) {
    const uList = knownUsers();
    atPopup.innerHTML = ['everyone', ...uList].map(u => `<div style="cursor:pointer;padding:6px 12px;border-radius:4px;color:var(--white);" data-u="${escHtml(u)}" onmouseover="this.style.background='var(--bl)'" onmouseout="this.style.background='transparent'">@${escHtml(u)}</div>`).join('');
    atPopup.style.display = 'flex';
  } else if (!val.includes('@') || val.endsWith(' ')) { atPopup.style.display = 'none'; }
});

atPopup.addEventListener('click', (e) => {
  const el = e.target.closest('[data-u]');
  if (el) window.insertAt(el.dataset.u);
});

window.insertAt = (u) => {
  const val = chatInput.value;
  const at = val.lastIndexOf('@');
  chatInput.value = val.substring(0, at) + `@${u} `;
  atPopup.style.display = 'none';
  chatInput.focus();
};

window.sendMessage = async () => {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const text = (input.value || '').trim();
  if (!text) return;

  const channel = chan;
  if (!channel) {
    appAlert('No channel selected.');
    return;
  }

  if (channel.startsWith('srv_')) {
    const serverId = channel.split('_')[1];
    const server = servers.find(s => s.id === serverId);
    if (!server || !(server.members || []).includes(user)) {
      appAlert('You are not a member of this server.');
      return;
    }
  }

  if (channel.startsWith('dm_')) {
    const participants = channel.split('_').slice(1);
    if (!participants.includes(user)) {
      appAlert('You cannot send a message to a DM channel you are not in.');
      return;
    }
  }

  await addDoc(collection(db, 'messages'), {
    text,
    user,
    uid: (auth.currentUser && auth.currentUser.uid) || null,
    channel,
    pfp,
    timestamp: serverTimestamp()
  });

  input.value = '';
  if (typeof listen === 'function') listen();
};

window.handleKeyPress = async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    window.sendMessage();
  }
};

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
    user = u.email.split('@')[0];
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('my-pfp').textContent = user[0].toUpperCase();
    document.getElementById('up-name').textContent = user;

    if (Notification.permission !== "granted") Notification.requestPermission();

    await setDoc(doc(db,"presence",user),{
      user,
      uid:(auth.currentUser&&auth.currentUser.uid)||null,
      status:'online',
      lastActive:serverTimestamp()
    }, {merge:true}).catch((e)=>{ console.error('presence write failed', e); });

    setDoc(doc(db,"users",user),{
      user,
      uid:(auth.currentUser&&auth.currentUser.uid)||null,
      lastSeen:serverTimestamp()
    }, {merge:true}).catch(()=>{});

    onSnapshot(collection(db,"users"),(snap)=>{
      allUsers = [];
      userPfpMap.clear();
      userPrivacyMap.clear();

      snap.docs.forEach(d => {
        const data = d.data();
        if (data.user) allUsers.push(data.user);
        if (data.user && data.pfp) userPfpMap.set(data.user, data.pfp);
        if (data.user && data.banner) userBannerMap.set(data.user, data.banner);
        if (data.user && data.background) userBackgroundMap.set(data.user, data.background);
        if (data.user && data.accent) userAccentMap.set(data.user, data.accent);
        if (data.user && data.decoration) userDecorationMap.set(data.user, data.decoration);
        if (data.user && data.bgColor) userBgColorMap.set(data.user, data.bgColor);
        if (data.user && data.textColor) userTextColorMap.set(data.user, data.textColor);
        if (data.user && data.customStatus) userCustomStatusMap.set(data.user, data.customStatus);
        if (data.user && data.pronouns) userPronounsMap.set(data.user, data.pronouns);
        if (data.user && data.privacy) userPrivacyMap.set(data.user, data.privacy);
      });

      renderUserList();
      if (mode === 'dms') renderSidebar();
    }, (err) => { console.error('users snapshot failed', err); });

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
      const pending = snap.docs.filter(d => {
        if (d.data().status !== "pending") return false;
        const from = d.data().from;
        const hasAccepted = snap.docs.some(d2 => d2.data().from === from && d2.data().status === "accepted");
        return !hasAccepted;
      });
      document.getElementById('req-list').innerHTML = pending.map(d=>{
        const data = d.data();
        return `<div>${escHtml(data.from)} sent you a request <button onclick="acceptReq('${d.id}')" style="font-size:10px;padding:2px 6px;background:var(--bl);color:var(--accent-contrast);border:none;border-radius:3px;">Accept</button> <button onclick="declineReq('${d.id}')" style="font-size:10px;padding:2px 6px;background:var(--danger);color:var(--white);border:none;border-radius:3px;">Decline</button></div>`;
      }).join('');
    });

    pfp = localStorage.getItem('pfp_'+user) || '';
    if (pfp.startsWith('file:///')) { pfp = ''; localStorage.removeItem('pfp_'+user); }
    if (pfp) {
      document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`;
      document.getElementById('my-pfp').textContent = '';
    }

    await setDoc(doc(db,"users",user),{
      user,
      pfp,
      uid:(auth.currentUser&&auth.currentUser.uid)||null,
      lastSeen:serverTimestamp()
    }, {merge:true}).catch(()=>{});

    document.getElementById('dm-btn').classList.add('active');
    renderSidebar();
    renderUserList();
    updateHeader();
    listen();

    loadServers().then(() => {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join');
      if (joinCode) { joinServer(joinCode); }

      try {
        const parts = window.location.pathname.split('/').filter(Boolean);
        if (parts[0] === 'channel' && parts[1] && parts[2]) {
          window.__skipPush = true;
          const sid = parts[1];
          const cname = decodeURIComponent(parts[2]);
          setTimeout(() => {
            if (typeof switchServerChannel === 'function') switchServerChannel(sid, cname);
            else if (typeof switchServer === 'function') switchServer(sid);
            window.__skipPush = false;
          }, 0);
        }
      } catch (e) { window.__skipPush = false; }
    });
  } else {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
    if (user) setDoc(doc(db,"presence",user),{status:'offline'},{merge:true});
    document.getElementById('auth-overlay').style.display = 'flex';
  }
});

window.acceptReq = async (id) => {
  await updateDoc(doc(db,"friends",id),{status:"accepted"});
};

window.declineReq = async (id) => {
  await updateDoc(doc(db,"friends",id),{status:"declined"});
};

window.sendReq = async (u) => {
  if (!u || u === user) return;
  try {
    const pairId = [user, u].sort().join('__');
    const existingDoc = await getDoc(doc(db, "friends", pairId));
    if (existingDoc.exists()) {
      const status = existingDoc.data().status;
      if (status === "accepted" || status === "pending") return;
    }
    await setDoc(doc(db, "friends", pairId), {
      from:user,
      fromUid:(auth.currentUser&&auth.currentUser.uid)||null,
      to:u,
      toUid:null,
      status:"pending",
      timestamp:serverTimestamp()
    });
  } catch (e) { console.error("sendReq failed", e); }
};

window.cancelReq = async (id) => {
  await updateDoc(doc(db,"friends",id),{status:"canceled"});
};

window.unfriendReq = async (id) => {
  await updateDoc(doc(db,"friends",id),{status:"unfriended"});
};

window.addEventListener('popstate', () => {
  try {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'channel' && parts[1] && parts[2]) {
      window.__skipPush = true;
      const sid = parts[1];
      const cname = decodeURIComponent(parts[2]);
      if (typeof switchServerChannel === 'function') switchServerChannel(sid, cname);
      window.__skipPush = false;
    }
  } catch (e) { window.__skipPush = false; }
});