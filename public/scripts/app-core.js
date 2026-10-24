// Firebase SDK bindings are provided by loader.js before this classic script runs.
const {
  initializeApp,
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  where,
  getDocs,
  getDoc
} = window.froggocordFirebase;

    const config = { apiKey: "AIzaSyDicR3VX9ClJoO8SDEu_xMGR4fbbqsrSVE", authDomain: "discordcord-7c0b2.firebaseapp.com", projectId: "discordcord-7c0b2", storageBucket: "discordcord-7c0b2.firebasestorage.app", messagingSenderId: "138455635458", appId: "1:138455635458:web:a236f0ceca0cb6de22b91b" };
    const app = initializeApp(config), auth = getAuth(app), db = getFirestore(app);
    let chan = 'general', user = null, typingUnsub = null, typingTimer = null, isSignUpMode = false, pfp = '', reply = null, curStat = 'online', idle = null, mode = 'channels', dmWith = null, servers = [], currentServer = null, lastPresenceUsers = [], lastRead = {};
    let heartbeat = null, idleNow = false, lastActivity = Date.now();
    let allUsers = [], backfillUsers = [], userPfpMap = new Map();
    const MAX_PFP_BYTES = 500 * 1024; // 500KB cap so messages stay under Firestore 1MB limit
    const IDLE_MS = 120000;
    const PRESENCE_TTL = 24 * 60 * 60 * 1000;
    const THEME_IDS = ['ash', 'obsidian', 'magma', 'fulgurite', 'plasma', 'alpenglow'];
    const DEFAULT_THEME = 'fulgurite';
    const THEME_ASSET_VERSION = '20261024-1445';
    const THEME_STORAGE_KEY = 'froggocord-theme';
    const themeLink = document.getElementById('theme-stylesheet');
    let activeTheme = DEFAULT_THEME;
    let themeLoadId = 0;

    function setThemeSelection(theme) {
      document.querySelectorAll('.theme-option').forEach(option => {
        const selected = option.dataset.theme === theme;
        option.setAttribute('aria-checked', String(selected));
      });
    }

    function applyTheme(theme, persist = true) {
      if (!THEME_IDS.includes(theme) || !themeLink) return Promise.resolve(false);
      if (theme === activeTheme && themeLink.dataset.theme === theme) {
        setThemeSelection(theme);
        return Promise.resolve(true);
      }

      const requestId = ++themeLoadId;
      const previousHref = themeLink.href;
      const previousTheme = activeTheme;
      const status = document.getElementById('theme-status');
      if (status) status.textContent = 'Applying ' + theme[0].toUpperCase() + theme.slice(1) + '…';

      return new Promise(resolve => {
        themeLink.onload = () => {
          if (requestId !== themeLoadId) return resolve(false);
          activeTheme = theme;
          themeLink.dataset.theme = theme;
          setThemeSelection(theme);
          if (persist) {
            try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) {}
          }
          if (status) status.textContent = '';
          resolve(true);
        };
        themeLink.onerror = () => {
          if (requestId !== themeLoadId) return resolve(false);
          themeLink.onload = null;
          themeLink.onerror = null;
          themeLink.href = previousHref;
          activeTheme = previousTheme;
          setThemeSelection(previousTheme);
          if (!persist) {
            try { localStorage.removeItem(THEME_STORAGE_KEY); } catch (e) {}
          }
          if (status) status.textContent = 'Could not load that theme. Your current theme is unchanged.';
          resolve(false);
        };
        themeLink.href = 'themes/' + theme + '.css?v=' + THEME_ASSET_VERSION;
      });
    }

    function openSettings() {
      const modal = document.getElementById('settings-modal');
      if (!modal) return;
      modal.setAttribute('aria-hidden', 'false');
      modal.style.display = 'flex';
      requestAnimationFrame(() => {
        modal.classList.add('visible');
        modal.querySelector('.modal-card').classList.add('visible');
      });
      document.getElementById('settings-close').focus();
    }

    function closeSettings() {
      const modal = document.getElementById('settings-modal');
      if (!modal) return;
      modal.classList.remove('visible');
      modal.querySelector('.modal-card').classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => { modal.style.display = 'none'; }, 180);
      document.getElementById('settings-btn').focus();
    }

    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('settings-done').addEventListener('click', closeSettings);
    document.getElementById('settings-modal').addEventListener('click', event => {
      if (event.target.id === 'settings-modal') closeSettings();
    });
    document.querySelectorAll('.theme-option').forEach(option => {
      option.addEventListener('click', () => applyTheme(option.dataset.theme));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById('settings-modal').getAttribute('aria-hidden') === 'false') closeSettings();
    });

    themeLink.dataset.theme = DEFAULT_THEME;
    let savedTheme = DEFAULT_THEME;
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === 'alpenglow-dawn' || storedTheme === 'alpenglow-dusk') {
        savedTheme = 'alpenglow';
        localStorage.setItem(THEME_STORAGE_KEY, savedTheme);
      }
      else if (THEME_IDS.includes(storedTheme)) savedTheme = storedTheme;
    } catch (e) {}
    if (savedTheme !== DEFAULT_THEME) applyTheme(savedTheme, false);
    else setThemeSelection(savedTheme);

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
        document.getElementById('app-dialog').classList.add('visible');
        document.getElementById('app-dialog').querySelector('.modal-card').classList.add('visible');
        document.getElementById('app-dialog').style.display = 'flex';
        if (mode === 'prompt') inp.focus();
      });
    }
    function _closeDialog(val) {
      const dlg = document.getElementById('app-dialog');
      const card = dlg.querySelector('.modal-card');
      dlg.classList.remove('visible');
      card.classList.remove('visible');
      setTimeout(() => {
        dlg.style.display = 'none';
        if (_dlgResolve) { _dlgResolve(val); _dlgResolve = null; }
      }, 180);
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

