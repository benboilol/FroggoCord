// Message actions, reactions, attachments, emoji, GIF search, and presence updates.
    window.editMsg = async (id,txt) => { 
      const t = await appPrompt("Edit:", txt); 
      if (!t || t === txt) return; 
      try {
        await updateDoc(doc(db,"messages",id),{text:t}); 
      } catch (e) {
        // Ignore permission errors
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

