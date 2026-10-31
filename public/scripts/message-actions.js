// Message actions, reactions, attachments, emoji, GIF search, and presence updates.
    window.editMsg = async (id,txt) => { 
      const t = await appPrompt("Edit:", txt); 
      if (!t || t === txt) return; 
      try {
        await updateDoc(doc(db,"messages",id),{text:t,editedAt:serverTimestamp()}); 
      } catch (e) {
        appAlert('Failed to edit message.');
      }
    }
    window.deleteMsg = async (id) => { 
      if (!(await appConfirm("Delete this message?"))) return;
      try {
        await deleteDoc(doc(db,"messages",id));
      } catch (e) {
        // If delete fails due to permissions, ignore
      }
    }
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

const fileInputEl = document.getElementById('file-input');
if (fileInputEl) {
  const hasAnimation = async (file) => {
    if (file.type === 'image/gif' || file.type === 'image/apng' || file.type === 'image/svg+xml') return true;
    if (file.type === 'image/webp') {
      const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
      for (let i = 12; i + 9 < bytes.length;) {
        const chunk = String.fromCharCode(...bytes.slice(i, i + 4));
        const size = bytes[i + 4] | (bytes[i + 5] << 8) | (bytes[i + 6] << 16) | (bytes[i + 7] << 24);
        if (chunk === 'VP8X') return (bytes[i + 8] & 0x02) !== 0;
        if (size < 0) break;
        i += 8 + size + (size & 1);
      }
    }
    if (file.type === 'image/png') {
      const bytes = new Uint8Array(await file.arrayBuffer());
      for (let i = 8; i + 12 <= bytes.length;) {
        const length = (bytes[i] * 0x1000000) + (bytes[i + 1] << 16) + (bytes[i + 2] << 8) + bytes[i + 3];
        const chunk = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
        if (chunk === 'acTL') return true;
        if (length < 0 || i + 12 + length > bytes.length) break;
        i += 12 + length;
      }
    }
    return false;
  };
  const preferAvif = async (file) => {
    if (file.type === 'image/avif' || await hasAnimation(file)) return file;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.drawImage(bitmap, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/avif', 0.85));
      if (!blob || blob.type !== 'image/avif' || blob.size > 700000) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.avif', { type: 'image/avif' });
    } catch (error) {
      return file;
    } finally {
      if (bitmap) bitmap.close();
    }
  };
  fileInputEl.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const allowedTypes = new Set(['application/pdf', 'text/plain', 'text/csv', 'application/zip', 'application/json']);
    const valid = files.filter(f => f.type.startsWith('image/') || allowedTypes.has(f.type));
    if (valid.length !== files.length) appAlert('Unsupported file type. Use images, PDF, TXT, CSV, JSON, or ZIP files.');
    if (!valid.length) { fileInputEl.value = ''; return; }
    fileInputEl.value = '';
    try {
      const results = [];
      for (const f of valid) {
        if (f.size > 700000) { appAlert('File too large (max 700KB): ' + f.name); continue; }
        const pf = f.type.startsWith('image/') ? await preferAvif(f) : f;
        const preview = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(pf);
        });
        results.push({ file: pf, preview, isImage: pf.type.startsWith('image/'), name: pf.name, size: pf.size, type: pf.type });
      }
      if (!results.length) return;
      pendingFiles = results;
      document.getElementById('file-preview-img').src = results[0].preview;
      document.getElementById('file-preview-name').textContent = results.length + ' image(s) selected';
      document.getElementById('file-preview').style.display = 'block';
    } catch (error) {
      appAlert('Failed to read file.');
      pendingFiles = [];
    }
  });
}
window.cancelFile = () => {
  pendingFiles = [];
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
        return `<img data-src="${safe}" src="" alt="gif" loading="lazy" style="width:100%; height:auto; ${ar}display:block; cursor:pointer; border-radius:6px; background:var(--panel);" onclick="sendGif('${safe}')">`;
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
        if (!append) gifResults.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--danger);padding:20px;">Failed to load GIFs</div>';
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
            const msgContainer = document.getElementById('message-container');
            img.addEventListener('load', () => {
              if (img.naturalWidth && img.naturalHeight) {
                chatGifDims[img.dataset.src] = { w: img.naturalWidth, h: img.naturalHeight };
                img.style.aspectRatio = img.naturalWidth + '/' + img.naturalHeight;
              }
              // Only re-pin to bottom if the user is actually near the bottom;
              // otherwise a loading GIF mid-scroll would yank them to the bottom.
              if (msgContainer && typeof msgsPinned !== 'undefined' && msgsPinned &&
                  msgContainer.scrollHeight - msgContainer.scrollTop - msgContainer.clientHeight < 80) {
                pinMsgsBottom();
              }
            }, { once: true });
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
      const st = document.getElementById('sticker-tab');
      if (st) st.style.display = t==='stickers'?'flex':'none';
      if (t === 'gifs' && !gifResults.querySelector('img')) fetchGifs(gifQuery, 0, false);
      if (t === 'stickers') renderStickerTab();
    };
    function renderStickerTab() {
      const st = document.getElementById('sticker-tab');
      if (!st) return;
      const stickers = (window.serverStickers && currentServer && window.serverStickers[currentServer]) || [];
      if (!stickers.length) { st.innerHTML = '<div style="color:var(--mut);padding:8px;font-size:12px;">No server stickers yet.</div>'; return; }
      st.innerHTML = stickers.map(s => '<img src="' + escHtml(s.url) + '" alt="' + escHtml(s.name) + '" title="' + escHtml(s.name) + '" style="width:64px;height:64px;object-fit:contain;cursor:pointer;border-radius:6px;" data-url="' + escHtml(s.url) + '" onclick="sendSticker(this.dataset.url, this.title)">').join('');
    }
    window.sendSticker = async (url, name) => {
      document.getElementById('media-picker').style.display = 'none';
      await addDoc(collection(db,"messages"),{text:`<img src="${url}" style="max-width: 120px; border-radius:8px; display:block;">`,user,uid:(auth.currentUser&&auth.currentUser.uid)||null,channel:chan,pfp,timestamp:serverTimestamp()});
    };

    window.sendGif = async (url) => {
      document.getElementById('media-picker').style.display = 'none';
      await addDoc(collection(db,"messages"),{text:`<img src="${url}" style="max-width: min(320px, 100%); border-radius:8px; display:block;">`,user,uid:(auth.currentUser&&auth.currentUser.uid)||null,channel:chan,pfp,timestamp:serverTimestamp()});
    };

    // ---------- Soundboard (Web Audio API, no external files) ----------
    const SOUNDS = [
      { name: 'Ping', freq: 1000, type: 'sine', dur: 0.1 },
      { name: 'Ding', freq: 1500, type: 'sine', dur: 0.15 },
      { name: 'Buzz', freq: 400, type: 'sawtooth', dur: 0.2 },
      { name: 'Chime', freq: 800, type: 'sine', dur: 0.2 },
      { name: 'Alert', freq: 600, type: 'square', dur: 0.3 },
      { name: 'Pop', freq: 1200, type: 'triangle', dur: 0.1 }
    ];
    let audioCtx = null;
    function ensureAudioCtx() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }
    function playSound(freq, type, dur) {
      try {
        const ctx = ensureAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch (e) { console.error('sound error', e); }
    }
    window.toggleSoundboard = () => {
      const panel = document.getElementById('soundboard-panel');
      const btn = document.getElementById('soundboard-btn');
      if (panel.style.display === 'flex') {
        panel.style.display = 'none';
        btn.classList.remove('active');
        return;
      }
      panel.innerHTML = '<div style="font-size:11px;color:var(--mut);margin-bottom:6px;">Soundboard</div>' +
        SOUNDS.map(s => '<button onclick="playSound(' + s.freq + ',\'' + s.type + '\',' + s.dur + ')" style="width:100%;padding:6px 8px;margin:3px 0;background:var(--panel);border:1px solid var(--border);border-radius:4px;color:var(--txt);cursor:pointer;font-size:12px;text-align:left;" onmouseover="this.style.background=var(--hover)" onmouseout="this.style.background=var(--panel)">' + s.name + '</button>').join('') +
        '<div style="height:6px;"></div>';
      panel.style.display = 'flex';
      btn.classList.add('active');
    };
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('soundboard-panel');
      const btn = document.getElementById('soundboard-btn');
      if (panel && panel.style.display !== 'none' && !panel.contains(e.target) && e.target !== btn) {
        panel.style.display = 'none';
        btn.classList.remove('active');
      }
    });

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
      else if (act === 'pin') { if (typeof window.pinMessage === 'function') window.pinMessage(id); }
      else if (act === 'react') { showReactionPicker(id, el); }
      else if (act === 'toggle-reaction') { window.toggleReaction(id, el.dataset.emoji); }
      else if (act === 'reply') {
        const msg = el.closest('.msg'), body = msg && msg.querySelector('.msg-bubble');
        window.setReply(id, el.dataset.user, body ? body.textContent : '');
      }
    });

window.showFavoriteGifs = () => {
  const tip = document.getElementById('fav-gifs-tooltip');
  if (!tip) return;
  if (tip.style.display === 'flex') { tip.style.display = 'none'; return; }
  const favs = [...(window.gifFavorites || new Set())];
  if (!favs.length) {
    tip.innerHTML = '<div style="color:var(--mut); text-align:center; padding:20px;">No favorite GIFs yet. Hover a GIF and click the star.</div>';
  } else {
    tip.innerHTML = '<div style="display:grid; grid-template-columns:repeat(2,1fr); gap:6px;">' +
      favs.map(u => `<img data-src="${escHtml(u)}" src="" alt="gif" loading="lazy" style="width:100%; border-radius:6px; cursor:pointer; aspect-ratio:4/3;" onclick="sendGif('${escHtml(u)}'); document.getElementById('fav-gifs-tooltip').style.display='none';">`).join('') +
      '</div>';
    // lazy load
    tip.querySelectorAll('img[data-src]').forEach(img => {
      const s = img.dataset.src;
      if (s) { img.src = s; }
    });
  }
  tip.style.display = 'flex';
  tip.style.flexDirection = 'column';
};
document.addEventListener('click', (e) => {
  const tip = document.getElementById('fav-gifs-tooltip');
  const btn = document.getElementById('fav-gifs-btn');
  if (tip && tip.style.display !== 'none' && !tip.contains(e.target) && e.target !== btn) {
    tip.style.display = 'none';
  }
});