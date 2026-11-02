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

    const config = { apiKey: "AIzaSyBdcQW56DH7tM37elwMYFQdzfpfCdEkzMs", authDomain: "froggocord.firebaseapp.com", projectId: "froggocord", storageBucket: "froggocord.firebasestorage.app", messagingSenderId: "237791448036", appId: "1:237791448036:web:82886ca5b0ce6dafa6d5f1", measurementId: "G-J7CRQ9D4VD" };
    const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
window.auth = auth;
window.db = db;
    let chan = null, user = null, typingUnsub = null, typingTimer = null, isSignUpMode = false, pfp = '', reply = null, curStat = 'online', idle = null, mode = 'dms', dmWith = null, servers = [], currentServer = null, lastPresenceUsers = [], lastRead = {}, curActivity = '';
    let heartbeat = null, idleNow = false, lastActivity = Date.now();
    let allUsers = [], backfillUsers = [], userPfpMap = new Map(), userPrivacyMap = new Map(), userBannerMap = new Map(), userBackgroundMap = new Map(), userAccentMap = new Map(), userDecorationMap = new Map(), userBgColorMap = new Map(), userTextColorMap = new Map(), userCustomStatusMap = new Map(), userPronounsMap = new Map(), userBioMap = new Map(), userDisplayNameMap = new Map(), userBadgesMap = new Map();
    let avifEncoderPromise = null;
    const encodeAvifWithWasm = async (imageData, quality) => {
      avifEncoderPromise ||= import('https://cdn.jsdelivr.net/npm/@jsquash/avif@2.1.1/+esm');
      const { encode } = await avifEncoderPromise;
      const buffer = await encode(imageData, { cqLevel: Math.round(63 - quality * 45) });
      return new Blob([buffer], { type: 'image/avif' });
    };
    window.convertImageToAvif = async (file, options = {}) => {
      if (!file || !file.type.startsWith('image/')) return null;
      let sourceUrl = null;
      try {
        let source;
        if (typeof createImageBitmap === 'function') {
          source = await createImageBitmap(file);
        } else {
          sourceUrl = URL.createObjectURL(file);
          source = await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Could not decode image.'));
            image.src = sourceUrl;
          });
        }
        const maxSize = Number(options.maxSize) > 0 ? Number(options.maxSize) : Math.max(source.width, source.height);
        const maxBytes = Number(options.maxBytes) || 4 * 1024 * 1024;
        const qualities = [Number(options.quality) || 0.85, 0.7, 0.55];
        let scale = Math.min(maxSize / source.width, maxSize / source.height, 1);
        let blob = null;
        for (const quality of qualities) {
          const width = Math.max(1, Math.round(source.width * scale));
          const height = Math.max(1, Math.round(source.height * scale));
          const canvas = typeof OffscreenCanvas === 'function'
            ? new OffscreenCanvas(width, height)
            : Object.assign(document.createElement('canvas'), { width, height });
          const context = canvas.getContext('2d');
          if (!context) break;
          context.drawImage(source, 0, 0, width, height);
          blob = canvas.convertToBlob
            ? await canvas.convertToBlob({ type: 'image/avif', quality })
            : await new Promise(resolve => canvas.toBlob(resolve, 'image/avif', quality));
          if (!blob || blob.type !== 'image/avif') {
            blob = await encodeAvifWithWasm(context.getImageData(0, 0, width, height), quality);
          }
          if (blob && blob.type === 'image/avif' && blob.size <= maxBytes) break;
          scale *= 0.75;
        }
        if (source.close) source.close();
        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        if (!blob || blob.type !== 'image/avif' || blob.size > maxBytes) return null;
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.avif', { type: 'image/avif' });
      } catch (error) {
        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        console.warn('Browser AVIF conversion unavailable; preserving original media.', error);
        return null;
      }
    };
    window.convertMediaToAvif = window.convertImageToAvif;
    window.convertVideoToAv1Mkv = async (file) => {
      if (!file || !file.type.startsWith('video/')) return null;
      const mime = ['video/x-matroska;codecs=av01', 'video/x-matroska'].find(type => window.MediaRecorder && MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('This browser cannot encode AV1 MKV locally.');
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('Could not read video.'));
      });
      const stream = video.captureStream();
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise((resolve, reject) => {
        recorder.onerror = () => reject(new Error('AV1 MKV encoding failed.'));
        recorder.onstop = resolve;
      });
      video.onended = () => recorder.stop();
      recorder.start(250);
      await video.play();
      await stopped;
      stream.getTracks().forEach(track => track.stop());
      URL.revokeObjectURL(video.src);
      const blob = new Blob(chunks, { type: 'video/x-matroska' });
      if (!blob.size) throw new Error('AV1 MKV encoding produced no data.');
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.mkv', { type: 'video/x-matroska' });
    };
    let blockedUsers = new Set();
    function loadBlockedUsers() { try { const raw = localStorage.getItem('froggocord-blocked'); if (raw) blockedUsers = new Set(JSON.parse(raw)); } catch (e) {} }
    function saveBlockedUsers() { try { localStorage.setItem('froggocord-blocked', JSON.stringify([...blockedUsers])); } catch (e) {} }
    function isBlocked(u) { return blockedUsers.has(u); }
    function toggleBlock(u) {
      if (blockedUsers.has(u)) blockedUsers.delete(u); else blockedUsers.add(u);
      saveBlockedUsers();
      // Sync to Firestore
      if (user) {
        const blockId = [user, u].sort().join('__');
        if (blockedUsers.has(u)) {
          setDoc(doc(db, 'blocked', blockId), { blocker: user, blocked: u, timestamp: serverTimestamp() }).catch(() => {});
        } else {
          deleteDoc(doc(db, 'blocked', blockId)).catch(() => {});
        }
      }
    }
    window.isBlocked = isBlocked; window.toggleBlock = toggleBlock;
    const MAX_PFP_BYTES = 500 * 1024; // 500KB cap so messages stay under Firestore 1MB limit
    const IDLE_MS = 120000;
    const PRESENCE_TTL = 24 * 60 * 60 * 1000;
    const THEME_IDS = ['ash', 'obsidian', 'magma', 'fulgurite', 'plasma', 'alpenglow', 'frostbite', 'phantom', 'crystal', 'verdant', 'custom'];
    const DEFAULT_THEME = 'fulgurite';
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

    const CUSTOM_THEME_KEY = 'froggocord-custom-theme';
    const CUSTOM_THEME_DEFAULTS = {
      bgP: '#1e1f22', bgS: '#2b2d31', txt: '#dbdee1', bright: '#f2f3f5',
      accent: '#57f287', primary: '#23a55a', danger: '#da373c', yellow: '#f0b232'
    };
    let customThemeColors = { ...CUSTOM_THEME_DEFAULTS };
    const CUSTOM_THEME_VARS = ['--bg-p','--bg-s','--bg-t','--chat','--chat-hover','--hover','--active','--panel','--input','--txt','--bright','--mut','--bl','--pr','--danger','--yellow','--swatch-a','--swatch-b','--swatch-c'];

    function loadCustomTheme() {
      try {
        const raw = localStorage.getItem(CUSTOM_THEME_KEY);
        if (raw) customThemeColors = { ...CUSTOM_THEME_DEFAULTS, ...JSON.parse(raw) };
      } catch (e) {}
    }

    function clearCustomThemeVars() {
      const root = document.documentElement.style;
      CUSTOM_THEME_VARS.forEach(v => root.removeProperty(v));
    }

    function applyCustomTheme(colors) {
      const c = colors || customThemeColors;
      const root = document.documentElement.style;
      root.setProperty('--bg-p', c.bgP);
      root.setProperty('--bg-s', c.bgS);
      root.setProperty('--bg-t', c.bgP);
      root.setProperty('--chat', c.bgP);
      root.setProperty('--chat-hover', c.bgS);
      root.setProperty('--hover', c.bgS);
      root.setProperty('--active', c.bgS);
      root.setProperty('--panel', c.bgP);
      root.setProperty('--input', c.bgS);
      root.setProperty('--txt', c.txt);
      root.setProperty('--bright', c.bright);
      root.setProperty('--mut', c.txt);
      root.setProperty('--bl', c.accent);
      root.setProperty('--pr', c.primary);
      root.setProperty('--danger', c.danger);
      root.setProperty('--yellow', c.yellow);
      root.setProperty('--swatch-a', c.bgP);
      root.setProperty('--swatch-b', c.bgS);
      root.setProperty('--swatch-c', c.accent);
      activeTheme = 'custom';
      settings.theme = 'custom';
      themeLink.dataset.theme = 'custom';
      setThemeSelection('custom');
    }

    function applyTheme(theme, persist = true) {
      if (theme === 'custom') {
        applyCustomTheme(customThemeColors);
        if (persist) {
          try { localStorage.setItem(THEME_STORAGE_KEY, 'custom'); } catch (e) {}
        }
        saveSettings();
        return Promise.resolve(true);
      }
      // Clear any inline custom theme vars so the CSS file's :root takes over
      clearCustomThemeVars();
      if (!THEME_IDS.includes(theme) || !themeLink) return Promise.resolve(false);
      if (theme === activeTheme && themeLink.dataset.theme === theme) {
        setThemeSelection(theme);
        return Promise.resolve(true);
      }
      // Apply optimistically; the stylesheet load is async and unreliable to await.
      activeTheme = theme;
      settings.theme = theme;
      themeLink.dataset.theme = theme;
      setThemeSelection(theme);
      themeLink.href = '/themes/' + theme + '.css';
      if (persist) {
        try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) {}
        saveSettings();
      }
      const status = document.getElementById('theme-status');
      if (status) status.textContent = '';
      return Promise.resolve(true);
    }

    function openSettings() {
      const modal = document.getElementById('settings-modal');
      if (!modal) return;
      populateSettingsForm();
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
      applySettings();
      modal.classList.remove('visible');
      modal.querySelector('.modal-card').classList.remove('visible');
      modal.setAttribute('aria-hidden', 'true');
      setTimeout(() => { modal.style.display = 'none'; }, 180);
      document.getElementById('settings-btn').focus();
    }

    document.getElementById('settings-btn').addEventListener('click', openSettings);
    const mobileNavToggle = document.getElementById('mobile-nav-toggle');
    const mobileNavBackdrop = document.getElementById('mobile-nav-backdrop');
    function closeMobileNav() {
      document.body.classList.remove('mobile-nav-open');
      mobileNavToggle.setAttribute('aria-expanded', 'false');
      mobileNavToggle.setAttribute('aria-label', 'Open navigation');
    }
    window.closeMobileNav = closeMobileNav;
    mobileNavToggle.addEventListener('click', () => {
      const isOpen = document.body.classList.toggle('mobile-nav-open');
      mobileNavToggle.setAttribute('aria-expanded', String(isOpen));
      mobileNavToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
    mobileNavBackdrop.addEventListener('click', closeMobileNav);
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760) closeMobileNav();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMobileNav();
    });
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('settings-done').addEventListener('click', closeSettings);
    document.getElementById('settings-modal').addEventListener('click', event => {
      if (event.target.id === 'settings-modal') closeSettings();
    });
    document.querySelectorAll('.theme-option:not(.delta-theme-btn)').forEach(option => {
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
    /* ---------- settings state ---------- */
    const SETTINGS_DEFAULTS = {
      theme: 'fulgurite',
      status: 'online',
      notifications: { desktop: true, sound: true, mentions: true, dm: true },
      privacy: { onlineStatus: true, dmAnyone: true, activity: true },
      profile: { color: '#57f287', banner: '', bannerPos: 'center', bannerSize: 'cover', background: '', bgColor: '#1e1f22', bgPos: 'center', bgSize: 'cover', accent: '#57f287', textColor: '#ffffff', decoration: '', effect: false, effectType: 'glow', layout: 'default', appBg: '', customStatus: '', pronouns: '', bio: '', displayName: '', gradient: { enabled: false, from: '#57f287', to: '#23a55a', direction: 'to right' } },
      accessibility: { fontSize: 'medium', timeFormat: 'system', highContrast: false, reducedMotion: false, screenReader: false, chatDensity: 'cozy', autoTheme: { enabled: false, timezone: 'auto', dayTheme: 'fulgurite', nightTheme: 'obsidian', dayStart: 7, nightStart: 19 } }
    };
    const SETTINGS_STORAGE_KEY = 'froggocord-settings';
    let settings = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));

    if (savedTheme !== DEFAULT_THEME) applyTheme(savedTheme, false);
    else setThemeSelection(savedTheme);

    function loadSettings() {
      try {
        const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          settings = { ...SETTINGS_DEFAULTS, ...parsed };
          if (parsed.notifications) settings.notifications = { ...SETTINGS_DEFAULTS.notifications, ...parsed.notifications };
          if (parsed.privacy) settings.privacy = { ...SETTINGS_DEFAULTS.privacy, ...parsed.privacy };
          if (parsed.profile) settings.profile = { ...SETTINGS_DEFAULTS.profile, ...parsed.profile, gradient: { ...SETTINGS_DEFAULTS.profile.gradient, ...(parsed.profile.gradient||{}) } };
          if (parsed.accessibility) { settings.accessibility = { ...SETTINGS_DEFAULTS.accessibility, ...parsed.accessibility }; if (parsed.accessibility.autoTheme) settings.accessibility.autoTheme = { ...SETTINGS_DEFAULTS.accessibility.autoTheme, ...parsed.accessibility.autoTheme }; }
        }
      } catch (e) { settings = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS)); }
    }

    function saveSettings() {
      try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
    }

    function populateSettingsForm() {
      document.getElementById('sa-username').value = user || '';
      document.getElementById('sa-status').value = settings.status || curStat || 'online';
      const actEl = document.getElementById('sa-activity');
      if (actEl) actEl.value = curActivity || '';
      setThemeSelection(settings.theme || activeTheme);
      document.getElementById('sn-desktop').checked = settings.notifications.desktop;
      document.getElementById('sn-sound').checked = settings.notifications.sound;
      document.getElementById('sn-mentions').checked = settings.notifications.mentions;
      document.getElementById('sn-dm').checked = settings.notifications.dm;
      document.getElementById('sp-online-status').checked = settings.privacy.onlineStatus;
      document.getElementById('sp-dm-anyone').checked = settings.privacy.dmAnyone;
      document.getElementById('sp-activity').checked = settings.privacy.activity;
      document.getElementById('sa-font-size').value = settings.accessibility.fontSize;
      document.getElementById('sa-time-format').value = settings.accessibility.timeFormat || 'system';
      document.getElementById('sa-high-contrast').checked = settings.accessibility.highContrast;
      document.getElementById('sa-reduced-motion').checked = settings.accessibility.reducedMotion;
      document.getElementById('sa-screen-reader').checked = settings.accessibility.screenReader;
      const cd = document.getElementById('sa-chat-density');
      if (cd) cd.value = settings.accessibility.chatDensity || 'cozy';
      const prof = settings.profile || SETTINGS_DEFAULTS.profile;
      const pc = document.getElementById('sp-profile-color');
      if (pc) pc.value = prof.color || '#57f287';
      const bposEl = document.getElementById('sp-banner-position');
    if (bposEl) bposEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.bannerPos = bposEl.value;
      saveSettings();
      const pbp = document.getElementById('sp-profile-banner-preview');
      if (pbp) pbp.style.backgroundPosition = prof.bannerPos;
    });
    const bszEl = document.getElementById('sp-banner-size');
    if (bszEl) bszEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.bannerSize = bszEl.value;
      saveSettings();
      const pbp = document.getElementById('sp-profile-banner-preview');
      if (pbp) pbp.style.backgroundSize = prof.bannerSize;
    });
    const bgposEl = document.getElementById('sp-bg-position');
    if (bgposEl) bgposEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.bgPos = bgposEl.value;
      saveSettings();
      const pbgp = document.getElementById('sp-profile-bg-preview');
      if (pbgp) pbgp.style.backgroundPosition = prof.bgPos;
    });
    const bgszEl = document.getElementById('sp-bg-size');
    if (bgszEl) bgszEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.bgSize = bgszEl.value;
      saveSettings();
      const pbgp = document.getElementById('sp-profile-bg-preview');
      if (pbgp) pbgp.style.backgroundSize = prof.bgSize;
    });
    const ptcolEl = document.getElementById('sp-profile-text-color');
    if (ptcolEl) ptcolEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.textColor = ptcolEl.value;
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,textColor:prof.textColor,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pdnEl = document.getElementById('sp-display-name');
    if (pdnEl) pdnEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.displayName = pdnEl.value.trim();
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,displayName:prof.displayName,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pcsEl = document.getElementById('sp-custom-status');
    if (pcsEl) pcsEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.customStatus = pcsEl.value.trim();
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,customStatus:prof.customStatus,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pprEl = document.getElementById('sp-pronouns');
    if (pprEl) pprEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.pronouns = pprEl.value.trim();
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,pronouns:prof.pronouns,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pbioEl = document.getElementById('sp-bio');
    if (pbioEl) pbioEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.bio = pbioEl.value.trim();
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,bio:prof.bio,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pge = document.getElementById('sp-profile-gradient-enabled');
      if (pge) pge.checked = !!(prof.gradient && prof.gradient.enabled);
      const pgf = document.getElementById('sp-profile-grad-from');
      if (pgf) pgf.value = (prof.gradient && prof.gradient.from) || '#57f287';
      const pgt = document.getElementById('sp-profile-grad-to');
      if (pgt) pgt.value = (prof.gradient && prof.gradient.to) || '#23a55a';
      const pgd = document.getElementById('sp-profile-grad-dir');
      if (pgd) pgd.value = (prof.gradient && prof.gradient.direction) || 'to right';
      const pbp = document.getElementById('sp-profile-banner-preview');
      if (pbp) { const b = prof.banner; if (b) { pbp.style.backgroundImage = 'url('+b+')'; } else { pbp.style.backgroundImage = 'none'; } }
      const bpos = document.getElementById('sp-banner-position'); if (bpos) bpos.value = prof.bannerPos || 'center';
      const bsz = document.getElementById('sp-banner-size'); if (bsz) bsz.value = prof.bannerSize || 'cover';
      const pbg = document.getElementById('sp-profile-bg'); if (pbg) pbg.value = prof.background || '';
      const pbgp = document.getElementById('sp-profile-bg-preview'); if (pbgp) { const b = prof.background; if (b) pbgp.style.backgroundImage = 'url('+b+')'; else pbgp.style.backgroundImage = 'none'; }
      const bgpos = document.getElementById('sp-bg-position'); if (bgpos) bgpos.value = prof.bgPos || 'center';
      const bgsz = document.getElementById('sp-bg-size'); if (bgsz) bgsz.value = prof.bgSize || 'cover';
      const ptcol = document.getElementById('sp-profile-text-color'); if (ptcol) ptcol.value = prof.textColor || '#ffffff';
      const pdn = document.getElementById('sp-display-name'); if (pdn) pdn.value = prof.displayName || '';
      const pcs = document.getElementById('sp-custom-status'); if (pcs) pcs.value = prof.customStatus || '';
      const ppr = document.getElementById('sp-pronouns'); if (ppr) ppr.value = prof.pronouns || '';
      const pbio = document.getElementById('sp-bio'); if (pbio) pbio.value = prof.bio || '';
      const pbc = document.getElementById('sp-profile-bg-color'); if (pbc) pbc.value = prof.bgColor || '#1e1f22';
      const pef = document.getElementById('sp-profile-effect'); if (pef) pef.checked = !!prof.effect;
      const pet = document.getElementById('sp-profile-effect-type'); if (pet) pet.value = prof.effectType || 'glow';
      const pac = document.getElementById('sp-profile-accent'); if (pac) pac.value = prof.accent || prof.color || '#57f287';
      const pdc = document.getElementById('sp-profile-decoration'); if (pdc) pdc.value = prof.decoration || '';
      const pab = document.getElementById('sp-app-bg'); if (pab) pab.value = prof.appBg || '';
      const ppl = document.getElementById('sp-profile-layout'); if (ppl) ppl.value = prof.layout || 'default';
      updateProfilePreview();
      // Auto theme population
      const at = settings.accessibility.autoTheme || SETTINGS_DEFAULTS.accessibility.autoTheme;
      const autoCb = document.getElementById('sa-auto-theme');
      if (autoCb) autoCb.checked = !!at.enabled;
      const daySel = document.getElementById('sa-day-theme');
      const nightSel = document.getElementById('sa-night-theme');
      if (daySel && daySel.options.length === 0) {
        THEME_IDS.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t[0].toUpperCase() + t.slice(1); daySel.appendChild(o); nightSel.appendChild(o.cloneNode(true)); });
      }
      if (daySel) daySel.value = at.dayTheme || 'fulgurite';
      if (nightSel) nightSel.value = at.nightTheme || 'obsidian';
      const tzSel = document.getElementById('sa-timezone');
      if (tzSel && tzSel.options.length === 0) {
        ['auto', 'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney'].forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t === 'auto' ? 'Auto (browser)' : t; tzSel.appendChild(o); });
      }
      if (tzSel) tzSel.value = at.timezone || 'auto';
      const dayStartSel = document.getElementById('sa-day-start');
      const nightStartSel = document.getElementById('sa-night-start');
      if (dayStartSel && dayStartSel.options.length === 0) {
        for (let h = 0; h < 24; h++) {
          const o = document.createElement('option'); o.value = h; o.textContent = (h % 12 === 0 ? 12 : h % 12) + ':00 ' + (h < 12 ? 'AM' : 'PM'); dayStartSel.appendChild(o); nightStartSel.appendChild(o.cloneNode(true));
        }
      }
      if (dayStartSel) dayStartSel.value = at.dayStart ?? 7;
      if (nightStartSel) nightStartSel.value = at.nightStart ?? 19;
      const av = document.getElementById('my-pfp');
      const prev = document.getElementById('sa-avatar-preview');
      if (av && av.style.backgroundImage && av.style.backgroundImage !== 'none') {
        prev.style.backgroundImage = av.style.backgroundImage;
        prev.textContent = '';
      } else {
        prev.style.backgroundImage = 'none';
        prev.textContent = (user || '?')[0].toUpperCase();
      }
    }

    function switchSettingsTab(tabId) {
      document.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('[id$="-panel"]').forEach(p => p.classList.remove('visible'));
      const tab = document.getElementById(tabId);
      const panel = document.getElementById(tabId.replace('-tab', '-panel'));
      if (tab) { tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); }
      if (panel) panel.classList.add('visible');
    }

    function applySettings() {
      // Theme
      if (settings.theme && settings.theme !== activeTheme) {
        applyTheme(settings.theme, false);
      }
      // Status
      const statusSel = document.getElementById('status-select');
      if (settings.status && statusSel) {
        statusSel.value = settings.status;
        statusSel.dispatchEvent(new Event('change'));
      }
      // Font size on body
      const fs = settings.accessibility.fontSize;
      document.body.style.fontSize = fs === 'small' ? '14px' : fs === 'large' ? '20px' : '16px';
      // Reduced motion
      if (settings.accessibility.reducedMotion) {
        document.documentElement.style.setProperty('--motion', 'none');
      } else {
        document.documentElement.style.removeProperty('--motion');
      }
      // High contrast
      if (settings.accessibility.highContrast) {
        document.body.classList.add('high-contrast');
      } else {
        document.body.classList.remove('high-contrast');
      }
      document.body.classList.toggle('compact', settings.accessibility.chatDensity === 'compact');
      applyAppBg(settings.profile && settings.profile.appBg);
      applyAutoTheme();
      saveSettings();
    }
    function applyAppBg(url) {
      if (url) {
        document.body.style.backgroundImage = 'url('+url+')';
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundPosition = 'center';
      } else {
        document.body.style.backgroundImage = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundAttachment = '';
        document.body.style.backgroundPosition = '';
      }
    }
    function applyAutoTheme() {
      const at = settings.accessibility && settings.accessibility.autoTheme;
      if (!at || !at.enabled) return;
      let now;
      try {
        if (at.timezone && at.timezone !== 'auto') {
          now = new Date(new Date().toLocaleString('en-US', { timeZone: at.timezone }));
        } else {
          now = new Date();
        }
      } catch (e) { now = new Date(); }
      const hour = now.getHours();
      const dayStart = (at.dayStart == null) ? 7 : at.dayStart;
      const nightStart = (at.nightStart == null) ? 19 : at.nightStart;
      let isDay;
      if (dayStart < nightStart) {
        isDay = hour >= dayStart && hour < nightStart;
      } else {
        isDay = hour >= dayStart || hour < nightStart;
      }
      const target = isDay ? (at.dayTheme || settings.theme) : (at.nightTheme || settings.theme);
      if (target && target !== activeTheme) {
        applyTheme(target, false);
      }
    }


    function openCustomTheme() {
      const builder = document.getElementById('custom-theme-builder');
      if (!builder) return;
      // populate with current colors
      const c = customThemeColors;
      document.getElementById('ct-bg-p').value = c.bgP;
      document.getElementById('ct-bg-s').value = c.bgS;
      document.getElementById('ct-txt').value = c.txt;
      document.getElementById('ct-bright').value = c.bright;
      document.getElementById('ct-accent').value = c.accent;
      document.getElementById('ct-primary').value = c.primary;
      document.getElementById('ct-danger').value = c.danger;
      document.getElementById('ct-yellow').value = c.yellow;
      builder.style.display = 'block';
    }

    function closeCustomTheme() {
      const builder = document.getElementById('custom-theme-builder');
      if (builder) builder.style.display = 'none';
    }

    function saveCustomTheme() {
      customThemeColors = {
        bgP: document.getElementById('ct-bg-p').value,
        bgS: document.getElementById('ct-bg-s').value,
        txt: document.getElementById('ct-txt').value,
        bright: document.getElementById('ct-bright').value,
        accent: document.getElementById('ct-accent').value,
        primary: document.getElementById('ct-primary').value,
        danger: document.getElementById('ct-danger').value,
        yellow: document.getElementById('ct-yellow').value
      };
      try { localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(customThemeColors)); } catch (e) {}
      settings.theme = 'custom';
      saveSettings();
      applyCustomTheme(customThemeColors);
      applyTheme('custom', false);
      appAlert('Custom theme applied!');
    }

    window.openCustomTheme = openCustomTheme;
    window.closeCustomTheme = closeCustomTheme;
    window.saveCustomTheme = saveCustomTheme;

    function resetSettingsToDefaults() {
      settings = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
      saveSettings();
      clearCustomThemeVars();
      document.body.classList.remove('high-contrast');
      populateSettingsForm();
      applySettings();
      appAlert('Settings reset to defaults.');
    }

    document.getElementById('settings-reset').addEventListener('click', resetSettingsToDefaults);

    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => switchSettingsTab(tab.id));
    });

    document.getElementById('sn-desktop').addEventListener('change', (e) => { settings.notifications.desktop = e.target.checked; saveSettings(); });
    document.getElementById('sn-sound').addEventListener('change', (e) => { settings.notifications.sound = e.target.checked; saveSettings(); });
    document.getElementById('sn-mentions').addEventListener('change', (e) => { settings.notifications.mentions = e.target.checked; saveSettings(); });
    document.getElementById('sn-dm').addEventListener('change', (e) => { settings.notifications.dm = e.target.checked; saveSettings(); });
    document.getElementById('sp-online-status').addEventListener('change', (e) => { settings.privacy.onlineStatus = e.target.checked; saveSettings(); if (user) setDoc(doc(db, 'users', user), { user, privacy: settings.privacy }, { merge: true }).catch(() => {}); });
    document.getElementById('sp-dm-anyone').addEventListener('change', (e) => { settings.privacy.dmAnyone = e.target.checked; saveSettings(); if (user) setDoc(doc(db, 'users', user), { user, privacy: settings.privacy }, { merge: true }).catch(() => {}); });
    document.getElementById('sp-activity').addEventListener('change', (e) => { settings.privacy.activity = e.target.checked; saveSettings(); if (user) setDoc(doc(db, 'users', user), { user, privacy: settings.privacy }, { merge: true }).catch(() => {}); });
    document.getElementById('sa-font-size').addEventListener('change', (e) => { settings.accessibility.fontSize = e.target.value; applySettings(); });
    document.getElementById('sa-time-format').addEventListener('change', (e) => {
      settings.accessibility.timeFormat = e.target.value;
      saveSettings();
      if (typeof window.refreshMessageTimestamps === 'function') window.refreshMessageTimestamps();
    });
    document.getElementById('sa-high-contrast').addEventListener('change', (e) => { settings.accessibility.highContrast = e.target.checked; applySettings(); });
    document.getElementById('sa-reduced-motion').addEventListener('change', (e) => { settings.accessibility.reducedMotion = e.target.checked; applySettings(); });
    document.getElementById('sa-screen-reader').addEventListener('change', (e) => { settings.accessibility.screenReader = e.target.checked; saveSettings(); });
    const cdEl = document.getElementById('sa-chat-density');
    if (cdEl) cdEl.addEventListener('change', (e) => { settings.accessibility.chatDensity = e.target.value; applySettings(); });
    function updateProfilePreview() {
      const prev = document.getElementById('sp-profile-preview');
      if (!prev) return;
      const prof = settings.profile || SETTINGS_DEFAULTS.profile;
      const grad = prof.gradient || {};
      if (grad.enabled) {
        prev.style.background = 'linear-gradient(' + (grad.direction||'to right') + ', ' + (grad.from||prof.color) + ', ' + (grad.to||prof.color) + ')';
      } else {
        prev.style.background = prof.color || '#57f287';
      }
      prev.style.color = '#fff';
    }
    window.updateProfilePreview = updateProfilePreview;
    const profileInputs = ['sp-profile-color','sp-profile-grad-from','sp-profile-grad-to','sp-profile-grad-dir'];
    profileInputs.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
        prof.color = document.getElementById('sp-profile-color').value;
        prof.gradient = prof.gradient || { ...SETTINGS_DEFAULTS.profile.gradient };
        prof.gradient.enabled = document.getElementById('sp-profile-gradient-enabled').checked;
        prof.gradient.from = document.getElementById('sp-profile-grad-from').value;
        prof.gradient.to = document.getElementById('sp-profile-grad-to').value;
        prof.gradient.direction = document.getElementById('sp-profile-grad-dir').value;
        saveSettings();
        updateProfilePreview();
      });
    });
    const pbgEl = document.getElementById('sp-profile-bg');
    if (pbgEl) pbgEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.background = pbgEl.value.trim();
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,background:prof.background,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pbcEl = document.getElementById('sp-profile-bg-color');
    if (pbcEl) pbcEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.bgColor = pbcEl.value;
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,bgColor:prof.bgColor,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pefEl = document.getElementById('sp-profile-effect');
    if (pefEl) pefEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.effect = pefEl.checked;
      saveSettings();
    });
    const petEl = document.getElementById('sp-profile-effect-type');
    if (petEl) petEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.effectType = petEl.value;
      saveSettings();
    });
    const pacEl = document.getElementById('sp-profile-accent');
    if (pacEl) pacEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.accent = pacEl.value;
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,accent:prof.accent,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pdcEl = document.getElementById('sp-profile-decoration');
    if (pdcEl) pdcEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.decoration = pdcEl.value.trim();
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,decoration:prof.decoration,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pabEl = document.getElementById('sp-app-bg');
    if (pabEl) pabEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.appBg = pabEl.value.trim();
      saveSettings();
      applyAppBg(prof.appBg);
    });
    const pplEl = document.getElementById('sp-profile-layout');
    if (pplEl) pplEl.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.layout = pplEl.value;
      saveSettings();
      if (user) setDoc(doc(db,'users',user),{user,layout:prof.layout,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
    });
    const pge = document.getElementById('sp-profile-gradient-enabled');
    if (pge) pge.addEventListener('change', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.gradient = prof.gradient || { ...SETTINGS_DEFAULTS.profile.gradient };
      prof.gradient.enabled = pge.checked;
      saveSettings();
      updateProfilePreview();
    });
    const autoThemeCb = document.getElementById('sa-auto-theme');
    if (autoThemeCb) autoThemeCb.addEventListener('change', (e) => { settings.accessibility.autoTheme = settings.accessibility.autoTheme || Object.assign({}, SETTINGS_DEFAULTS.accessibility.autoTheme); settings.accessibility.autoTheme.enabled = e.target.checked; saveSettings(); applyAutoTheme(); });
    ['sa-timezone','sa-day-theme','sa-night-theme','sa-day-start','sa-night-start'].forEach(id => { const el = document.getElementById(id); if (!el) return; el.addEventListener('change', () => { const at = settings.accessibility.autoTheme = settings.accessibility.autoTheme || Object.assign({}, SETTINGS_DEFAULTS.accessibility.autoTheme); at.timezone = document.getElementById('sa-timezone').value; at.dayTheme = document.getElementById('sa-day-theme').value; at.nightTheme = document.getElementById('sa-night-theme').value; at.dayStart = parseInt(document.getElementById('sa-day-start').value, 10); at.nightStart = parseInt(document.getElementById('sa-night-start').value, 10); saveSettings(); applyAutoTheme(); }); });
    document.getElementById('sa-status').addEventListener('change', (e) => { settings.status = e.target.value; applySettings(); });
    document.getElementById('sa-activity').addEventListener('change', (e) => { settings.activity = e.target.value.trim(); curActivity = settings.activity; saveSettings(); if (user) setDoc(doc(db,'presence',user),{activity:curActivity,lastActive:serverTimestamp()},{merge:true}).catch(()=>{}); });
    // Mark profile as customized on any profile change
    ['sp-profile-color','sp-profile-grad-from','sp-profile-grad-to','sp-profile-grad-dir','sp-profile-bg','sp-profile-bg-color','sp-profile-accent','sp-profile-decoration','sp-profile-layout','sp-app-bg','sp-custom-status','sp-pronouns','sp-bio','sp-profile-text-color'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => { if (typeof markProfileCustomized === 'function') markProfileCustomized(); });
    });
    // No accessibility theme toggles - themes are selected from the Theme tab
    const bannerFile = document.getElementById('sp-profile-banner-file');
    if (bannerFile) bannerFile.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f || !f.type.startsWith('image/')) return;
      if (f.size > 2 * 1024 * 1024) { appAlert('Banner too large (max 2MB).'); e.target.value=''; return; }
      try {
        const data = await compressImage(f, 1200, true);
        const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
        prof.banner = data;
        saveSettings();
        const pbp = document.getElementById('sp-profile-banner-preview');
        if (pbp) pbp.style.backgroundImage = 'url('+data+')';
        if (user) setDoc(doc(db,'users',user),{user,banner:data,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
      } catch (err) { appAlert('Failed to process banner.'); }
      e.target.value = '';
    });
    const resetBannerBg = document.getElementById('sp-reset-banner-bg');
    if (resetBannerBg) resetBannerBg.addEventListener('click', () => {
      const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
      prof.banner = '';
      prof.background = '';
      prof.bgColor = '#1e1f22';
      prof.bannerPos = 'center';
      prof.bannerSize = 'cover';
      prof.bgPos = 'center';
      prof.bgSize = 'cover';
      saveSettings();
      const pbp = document.getElementById('sp-profile-banner-preview');
      if (pbp) pbp.style.backgroundImage = 'none';
      const pbg = document.getElementById('sp-profile-bg');
      if (pbg) pbg.value = '';
      const pbgp = document.getElementById('sp-profile-bg-preview');
      if (pbgp) pbgp.style.backgroundImage = 'none';
      const pbc = document.getElementById('sp-profile-bg-color');
      if (pbc) pbc.value = '#1e1f22';
      const bpos = document.getElementById('sp-banner-position');
      if (bpos) bpos.value = 'center';
      const bsz = document.getElementById('sp-banner-size');
      if (bsz) bsz.value = 'cover';
      const bgpos = document.getElementById('sp-bg-position');
      if (bgpos) bgpos.value = 'center';
      const bgsz = document.getElementById('sp-bg-size');
      if (bgsz) bgsz.value = 'cover';
      if (user) setDoc(doc(db,'users',user),{user,banner:'',background:'',bgColor:'#1e1f22',lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
      appAlert('Banner and background reset.');
    });
    const bgFile = document.getElementById('sp-profile-bg-file');
    if (bgFile) bgFile.addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f || !f.type.startsWith('image/')) return;
      if (f.size > 2 * 1024 * 1024) { appAlert('Background too large (max 2MB).'); e.target.value=''; return; }
      try {
        const data = await compressImage(f, 1200, true);
        const prof = settings.profile = settings.profile || { ...SETTINGS_DEFAULTS.profile };
        prof.background = data;
        saveSettings();
        const pbp = document.getElementById('sp-profile-bg-preview');
        if (pbp) pbp.style.backgroundImage = 'url('+data+')';
        if (user) setDoc(doc(db,'users',user),{user,background:data,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
      } catch (err) { appAlert('Failed to process background.'); }
      e.target.value = '';
    });
    document.getElementById('sa-avatar-file').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f || !f.type.startsWith('image/')) return;
      if (f.size > MAX_PFP_BYTES) { appAlert('Avatar too large (max 500KB).'); e.target.value = ''; return; }
      try {
        pfp = await compressImage(f);
        localStorage.setItem('pfp_' + user, pfp);
        await setDoc(doc(db, 'users', user), { user, pfp, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
        document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`;
        document.getElementById('my-pfp').textContent = '';
        document.getElementById('sa-avatar-preview').style.backgroundImage = `url(${pfp})`;
        document.getElementById('sa-avatar-preview').textContent = '';
        e.target.value = '';
      } catch (err) { appAlert('Failed to process image.'); }
    });



    // ---------- Client-side achievement badges ----------
    async function awardBadge(badgeName) {
      if (!user) return;
      try {
        const userRef = doc(db, 'users', user);
        const snap = await getDoc(userRef);
        const badges = snap.exists() ? (snap.data().badges || []) : [];
        if (badges.includes(badgeName)) return; // already has it
        badges.push(badgeName);
        await setDoc(userRef, { badges }, { merge: true });
        console.log('Badge awarded:', badgeName, 'to', user);
      } catch (e) {
        console.error('Badge award failed', e);
      }
    }
    window.awardBadge = awardBadge;

    async function checkMessageBadges() {
      if (!user) return;
      // First message badge
      await awardBadge('first-message');
      // Active chatter: 100+ messages (approximate via localStorage counter)
      try {
        const count = parseInt(localStorage.getItem('froggocord-msg-count') || '0', 10) + 1;
        localStorage.setItem('froggocord-msg-count', String(count));
        if (count >= 100) await awardBadge('active-chatter');
      } catch (e) {}
    }



    // ---------- Additional achievement badges ----------
    async function checkAchievementBadges() {
      if (!user) return;
      try {
        // Server creator
        if (typeof servers !== 'undefined' && servers.some(srv => srv.owner === user)) {
          await awardBadge('server-creator');
        }
        // Popular: 10+ friends
        try {
          const snap = await getDocs(query(collection(db, 'friends'), where('from', '==', user)));
          const snap2 = await getDocs(query(collection(db, 'friends'), where('to', '==', user)));
          const all = [...snap.docs, ...snap2.docs];
          const accepted = all.filter(d => d.data().status === 'accepted');
          const friends = new Set();
          accepted.forEach(d => { friends.add(d.data().from); friends.add(d.data().to); });
          friends.delete(user);
          if (friends.size >= 10) await awardBadge('popular');
          if (friends.size >= 1) await awardBadge('first-friend');
        } catch (e) {}
        // Message count badges
        const msgCount = parseInt(localStorage.getItem('froggocord-msg-count') || '0', 10);
        if (msgCount >= 10) await awardBadge('chatter');
        if (msgCount >= 50) await awardBadge('active-chatter');
        if (msgCount >= 100) await awardBadge('super-chatter');
        // Theme explorer: changed theme at least once
        const themeChanges = parseInt(localStorage.getItem('froggocord-theme-changes') || '0', 10);
        if (themeChanges >= 1) await awardBadge('theme-explorer');
        // Profile customizer: customized profile
        const profileCustomized = localStorage.getItem('froggocord-profile-customized');
        if (profileCustomized === 'true') await awardBadge('profile-customizer');
      } catch (e) { console.error('Achievement check failed', e); }
    }
    window.checkAchievementBadges = checkAchievementBadges;

    // Track theme changes
    const _origApplyTheme = (typeof applyTheme === 'function') ? applyTheme : null;
    if (_origApplyTheme) {
      const wrappedApplyTheme = function(theme, persist) {
        try {
          const count = parseInt(localStorage.getItem('froggocord-theme-changes') || '0', 10) + 1;
          localStorage.setItem('froggocord-theme-changes', String(count));
        } catch (e) {}
        return _origApplyTheme(theme, persist);
      };
      // Replace applyTheme reference
      window.applyTheme = wrappedApplyTheme;
    }

    // Track profile customization
    function markProfileCustomized() {
      try { localStorage.setItem('froggocord-profile-customized', 'true'); } catch (e) {}
    }
    window.markProfileCustomized = markProfileCustomized;

    // Pending message tracking for sending/sent/failed states
    const INLINE_ATTACHMENT_LIMIT = 700000;
    const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024;
    const ATTACHMENT_CHUNK_SIZE = 300000;
    let pendingMessages = [];

    async function writeAttachmentChunks(messageId, attachments) {
      for (const attachment of attachments || []) {
        const chunks = [];
        for (let offset = 0; offset < attachment.data.length; offset += ATTACHMENT_CHUNK_SIZE) {
          chunks.push(setDoc(doc(db, 'messageChunks', messageId + '_' + attachment.id + '_' + chunks.length), {
            messageId,
            attachmentId: attachment.id,
            index: chunks.length,
            data: attachment.data.slice(offset, offset + ATTACHMENT_CHUNK_SIZE),
            channel: attachment.channel,
            user,
            uid: auth.currentUser.uid
          }));
        }
        await Promise.all(chunks);
      }
    }

    let _notifyDebounce = null;
    function notifyPendingChanged() {
      if (typeof renderMessagePages !== 'function') return;
      if (_notifyDebounce) clearTimeout(_notifyDebounce);
      _notifyDebounce = setTimeout(() => {
        _notifyDebounce = null;
        renderMessagePages({ preserveScroll: true });
      }, 40);
    }
    function notifyPendingChangedNow() {
      if (_notifyDebounce) { clearTimeout(_notifyDebounce); _notifyDebounce = null; }
      if (typeof renderMessagePages === 'function') renderMessagePages({ preserveScroll: true });
    }

    window.sendMessage = async () => {
      const input = document.getElementById('chat-input');
      if (!input) return;
      const t = input.value.trim();
      if (!t && pendingFiles.length === 0) return;
      if (!user || !auth.currentUser) {
        appAlert('You must be signed in to send messages.');
        return;
      }
      if (!chan) {
        appAlert('Select a channel or direct message before sending.');
        return;
      }
      // Slow mode check
      if (chan && chan.startsWith('srv_')) {
        const parts = chan.split('_');
        const sid = parts[1];
        const cname = parts.slice(2).join('_');
        const s = (typeof servers !== 'undefined') ? servers.find(x => x.id === sid) : null;
        const ch = s && s.channels ? s.channels.find(c => c.name === cname) : null;
        if (ch && ch.slowMode > 0) {
          const lastSend = parseInt(localStorage.getItem('froggocord-lastsend-' + chan) || '0', 10);
          const elapsed = Date.now() - lastSend;
          if (elapsed < ch.slowMode * 1000) {
            const remaining = Math.ceil((ch.slowMode * 1000 - elapsed) / 1000);
            appAlert('Slow mode: wait ' + remaining + 's before sending again.');
            return;
          }
          localStorage.setItem('froggocord-lastsend-' + chan, String(Date.now()));
        }
      }

      const clientId = 'pending_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const pending = {
        clientId: clientId,
        text: t,
        images: pendingFiles.filter(p => p.isImage && p.file.size <= INLINE_ATTACHMENT_LIMIT).map(p => p.preview),
        files: pendingFiles.filter(p => !p.isImage && p.file.size <= INLINE_ATTACHMENT_LIMIT).map(p => ({ name: p.name, size: p.size, type: p.type, preview: p.preview })),
        imageW: null,
        imageH: null,
        user: user,
        channel: chan,
        pfp: pfp,
        replyTo: reply ? { user: reply.user, text: reply.text } : null,
        status: 'sending',
        _clientTimestamp: Date.now()
      };
      const chunkedAttachments = [];
      pendingFiles.forEach((file, index) => {
        if (file.file && file.file.size > INLINE_ATTACHMENT_LIMIT) {
          chunkedAttachments.push({
            id: String(index),
            name: file.name,
            size: file.size,
            type: file.type,
            isImage: file.isImage,
            chunks: Math.ceil(file.preview.length / ATTACHMENT_CHUNK_SIZE),
            data: file.preview,
            channel: chan
          });
        }
      });
      pending.chunkedAttachments = chunkedAttachments;

      input.value = '';
      if (reply) { window.cancelReply(); }
      setTyping(false);

      // Add to pending messages for optimistic rendering
      pendingMessages.push(pending);
      notifyPendingChangedNow();

      // Handle image dimensions
      if (pendingFiles.some(p => p.isImage)) {
        for (const pf of pendingFiles) {
          if (pf.isImage && pf.file && pf.file.size > MAX_ATTACHMENT_SIZE) {
            pending.status = 'failed';
            pending.error = 'Image too large (max ~700KB)';
            pendingMessages = pendingMessages.filter(m => m.clientId !== clientId);
            pendingMessages.push(pending);
            notifyPendingChanged();
            input.value = t;
            return;
          }
        }
        try {
          const im = new Image();
          const firstImg = pendingFiles.find(p => p.isImage);
          const first = firstImg ? firstImg.preview : pendingFiles[0].preview;
          const dims = await new Promise((resolve) => {
            im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
            im.onerror = () => resolve(null);
            im.src = first;
          });
          if (dims && dims.w && dims.h) { pending.imageW = dims.w; pending.imageH = dims.h; }
        } catch (e) {}
      }

      // Send to Firestore
      try {
        const payload = { text: t, user, uid: (auth.currentUser && auth.currentUser.uid) || null, channel: chan, pfp, timestamp: serverTimestamp(), clientMsgId: clientId };
        if (pending.images && pending.images.length) payload.images = pending.images;
        if (pending.files && pending.files.length) payload.files = pending.files;
        if (chunkedAttachments.length) payload.attachments = chunkedAttachments.map(({ data, channel, ...attachment }) => attachment);
        if (pending.imageW) { payload.imageW = pending.imageW; payload.imageH = pending.imageH; }
        if (pending.replyTo) payload.replyTo = pending.replyTo;

        const messageRef = await addDoc(collection(db, "messages"), payload);
        await writeAttachmentChunks(messageRef.id, chunkedAttachments);
        pending.status = 'sent';
        notifyPendingChanged();
        // Award achievement badges
        checkMessageBadges().catch(() => {});

        // Remove pending message after delay (real message from snapshot will take over)
        setTimeout(() => {
          const idx = pendingMessages.findIndex(m => m.clientId === clientId);
          if (idx >= 0) {
            pendingMessages.splice(idx, 1);
            notifyPendingChanged();
          }
        }, 3000);
      } catch (err) {
        pending.status = 'failed';
        pending.error = (err && err.code === 'permission-denied') ? 'Permission denied - you may not have access to this channel.' : (err.message || 'Send failed');
        notifyPendingChangedNow();
        appAlert('Message failed to send: ' + pending.error);
      }

      // Clean up
      pendingFiles = [];
      window.cancelFile();
    };

    window.retryMessage = async (clientId) => {
      const pending = pendingMessages.find(m => m.clientId === clientId);
      if (!pending) return;
      pending.status = 'sending';
      notifyPendingChanged();

      try {
        const payload = { text: pending.text, user: pending.user, uid: (auth.currentUser && auth.currentUser.uid) || null, channel: pending.channel, pfp: pending.pfp, timestamp: serverTimestamp(), clientMsgId: clientId };
        if (pending.images && pending.images.length) payload.images = pending.images;
        if (pending.files && pending.files.length) payload.files = pending.files;
        if (pending.imageW) { payload.imageW = pending.imageW; payload.imageH = pending.imageH; }
        if (pending.replyTo) payload.replyTo = pending.replyTo;

        if (pending.chunkedAttachments && pending.chunkedAttachments.length) {
          payload.attachments = pending.chunkedAttachments.map(({ data, channel, ...attachment }) => attachment);
        }
        const messageRef = await addDoc(collection(db, "messages"), payload);
        await writeAttachmentChunks(messageRef.id, pending.chunkedAttachments || []);
        pending.status = 'sent';
        notifyPendingChanged();

        setTimeout(() => {
          const idx = pendingMessages.findIndex(m => m.clientId === clientId);
          if (idx >= 0) {
            pendingMessages.splice(idx, 1);
            notifyPendingChanged();
          }
        }, 3000);
      } catch (err) {
        pending.status = 'failed';
        pending.error = (err && err.code === 'permission-denied') ? 'Permission denied - you may not have access to this channel.' : (err.message || 'Send failed');
        notifyPendingChanged();
      }
    };

    // ---------- Announcement Support ----------
    window.announceChannel = async (channelId, messageId) => {
      if (!channelId || !channelId.startsWith('srv_')) return;
      const parts = channelId.split('_');
      const sid = parts[1];
      const s = servers.find(x => x.id === sid);
      if (!s) return;
      const ch = s.channels && s.channels.find(c => c.id === channelId.split('_').slice(2).join('_') || c.name === channelId.split('_').slice(2).join('_'));
      if (!ch || !ch.announcement) return;
      // Notify all server members via presence update
      try {
        const memberList = s.members || [];
        const mentions = memberList.filter(m => m !== user);
        if (mentions.length) {
          await addDoc(collection(db, 'messages'), {
            text: '@everyone New announcement in #' + (ch.name || channelId),
            user: user,
            uid: (auth.currentUser && auth.currentUser.uid) || null,
            channel: channelId,
            pfp: pfp,
            timestamp: serverTimestamp(),
            announcement: true,
            announcementFor: messageId
          });
        }
      } catch (e) { console.error('Announce failed', e); }
    };

    // ---------- @everyone Notifications ----------
    window.notifyEveryone = async (channelId, messageId) => {
      if (!channelId || !channelId.startsWith('srv_')) return;
      const parts = channelId.split('_');
      const sid = parts[1];
      const s = servers.find(x => x.id === sid);
      if (!s) return;
      const chName = channelId.split('_').slice(2).join('_');
      const memberList = s.members || [];
      const mentions = memberList.filter(m => m !== user);
      if (!mentions.length) return;
      try {
        await addDoc(collection(db, 'messages'), {
          text: '@everyone ' + (chName || channelId),
          user: user,
          uid: (auth.currentUser && auth.currentUser.uid) || null,
          channel: channelId,
          pfp: pfp,
          timestamp: serverTimestamp(),
          everyoneMention: true,
          mentionFor: messageId
        });
      } catch (e) { console.error('Everyone notify failed', e); }
    };

    // ---------- Message Threads ----------
    window.createThread = async (rootMsgId) => {
      if (!rootMsgId) { appAlert('No message to thread.'); return; }
      const channelForThread = chan;
      if (!channelForThread) { appAlert('No channel selected.'); return; }
      const threadName = await appPrompt('Thread name:', '');
      const threadId = 'thread_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      try {
        await addDoc(collection(db, 'threads'), {
          id: threadId,
          name: (threadName || 'Thread').trim(),
          parentMessageId: rootMsgId,
          channel: channelForThread,
          creator: user,
          messageCount: 0,
          lastActivity: serverTimestamp(),
          archived: false
        });
        appAlert('Thread created!');
        openThread(threadId);
      } catch (e) { appAlert('Failed to create thread.'); }
    };

    window.openThread = (threadId) => {
      // Store thread context and switch view
      sessionStorage.setItem('froggocord-active-thread', threadId);
      appAlert('Thread opened: ' + threadId + ' (view in thread panel)');
    };

    window.getActiveThread = () => sessionStorage.getItem('froggocord-active-thread') || null;

    // ---------- Custom Status Emoji ----------
    window.pickStatusEmoji = async () => {
      const emoji = await appPrompt('Enter emoji for custom status:', '');
      if (emoji === null) return;
      const input = document.getElementById('sp-custom-status');
      if (input) input.value = (input.value + ' ' + emoji).trim();
    };

    // ---------- Message Translation ----------
    window.translateMessage = async (msgId) => {
      const msg = document.querySelector(`[data-id="${msgId}"]`);
      if (!msg) { appAlert('Message not found.'); return; }
      const textEl = msg.querySelector('.msg-bubble');
      if (!textEl) { appAlert('No text to translate.'); return; }
      const text = textEl.textContent.trim();
      if (!text) { appAlert('No text to translate.'); return; }
      const targetLang = await appPrompt('Translate to (language code, e.g. en, es, fr, de, ja):', 'en');
      if (targetLang === null) return;
      try {
        // Use LibreTranslate or similar free API
        const response = await fetch('https://libretranslate.de/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text, source: 'auto', target: targetLang })
        });
        const data = await response.json();
        const translated = data.translatedText || data.translation || '';
        if (translated) {
          appAlert('Translation: ' + translated);
        } else {
          appAlert('Translation failed.');
        }
      } catch (e) { appAlert('Translation service unavailable.'); }
    };

    // ---------- Download your data ----------
    window.downloadMyData = async () => {
      if (!user) { appAlert('Sign in first.'); return; }
      try {
        const out = { user, exportedAt: new Date().toISOString() };
        // profile
        try {
          const snap = await getDoc(doc(db, 'users', user));
          out.profile = snap.exists() ? snap.data() : null;
        } catch (e) {}
        // messages authored by user
        try {
          const ms = await getDocs(query(collection(db, 'messages'), where('user', '==', user)));
          out.messages = ms.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { out.messages = []; }
        // friends
        try {
          const f1 = await getDocs(query(collection(db, 'friends'), where('from', '==', user)));
          const f2 = await getDocs(query(collection(db, 'friends'), where('to', '==', user)));
          out.friends = [...f1.docs, ...f2.docs].map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { out.friends = []; }
        const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'froggocord-data-' + user + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        appAlert('Your data export has started.');
      } catch (e) { console.error(e); appAlert('Export failed.'); }
    };

    loadCustomTheme();
    loadSettings();
    loadBlockedUsers();
    applySettings();

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
      const raw0 = String(t ?? '');
      const msgLinks = [];
      let raw = raw0.replace(/https?:\/\/[^\s]+(?:[?#&]msg=|#msg-)([A-Za-z0-9_-]+)/g, (m, id) => {
        msgLinks.push(id);
        return '@@MSGLINK' + (msgLinks.length - 1) + '@@';
      });
      const gif = raw.match(/^\s*<img src="([^"]+)"\s*style="max-width:[^;]+; border-radius:8px; display:block;">\s*$/i);
      if (gif && SAFE_IMG.test(gif[1])) {
        const u = gif[1];
        const d = (typeof chatGifDims !== 'undefined' && chatGifDims[u]) ? chatGifDims[u] : null;
        const ar = d ? `aspect-ratio:${d.w}/${d.h};` : 'aspect-ratio:4/3;';
        const isFav = (typeof isGifFavorite === 'function') ? isGifFavorite(u) : false;
        const isBlk = (typeof isGifBlocked === 'function') ? isGifBlocked(u) : false;
        const blur = isBlk ? 'filter:blur(8px);' : '';
        return `<div class="gif-wrap" data-gif-url="${escHtml(u)}" style="position:relative; display:inline-block; max-width:min(320px,100%);">
          <img data-src="${escHtml(u)}" src="" alt="gif" loading="lazy" style="max-width:100%; border-radius:8px; display:block; background:transparent; min-height:60px; ${ar} ${blur}">
          <div class="gif-actions-bar" style="margin-top:4px; display:flex; gap:4px; justify-content:center;">
            <button class="gif-star" onclick="toggleGifFavorite('${escHtml(u)}')" title="Favorite" style="background:rgba(0,0,0,.5); border:none; border-radius:4px; width:28px; height:28px; cursor:pointer; font-size:14px; color:${isFav?'#f0b232':'#fff'}; opacity:1; transition:opacity .15s;">${isFav?'★':'☆'}</button>
            <button class="gif-block" onclick="toggleGifBlock('${escHtml(u)}')" title="Block" style="background:rgba(0,0,0,.5); border:none; border-radius:4px; width:28px; height:28px; cursor:pointer; font-size:14px; color:${isBlk?'#da373c':'#fff'}; opacity:1; transition:opacity .15s;">${isBlk?'●':'○'}</button>
          </div>
        </div>`;
      }
      // Handle invite cards
      const inviteMatch = raw.match(/^<invite server="([^"]*)" icon="([^"]*)" banner="([^"]*)" desc="([^"]*)" link="([^"]*)"><\/invite>$/i);
      if (inviteMatch) {
        const serverName = inviteMatch[1];
        const serverIcon = inviteMatch[2];
        const serverBanner = inviteMatch[3];
        const serverDesc = inviteMatch[4];
        const inviteLink = inviteMatch[5];
        return renderInviteCard(serverName, serverIcon, serverBanner, serverDesc, inviteLink);
      }
      // Server emoji support: replace :name: with image
      try {
        const emojis = (window.serverEmojis && currentServer && window.serverEmojis[currentServer]) || [];
        if (emojis.length) {
          emojis.forEach(e => {
            if (!e || !e.name || !e.url) return;
            const re = new RegExp(':' + e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':', 'g');
            raw = raw.replace(re, '<img src="' + escHtml(e.url) + '" alt="' + escHtml(e.name) + '" style="height:1.2em;vertical-align:middle;display:inline-block;">');
          });
        }
      } catch (ex) {}
      // Server stickers: replace :stickername: with larger image
      try {
        const stickers = (window.serverStickers && currentServer && window.serverStickers[currentServer]) || [];
        if (stickers.length) {
          stickers.forEach(e => {
            if (!e || !e.name || !e.url) return;
            const re = new RegExp(':' + e.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':', 'g');
            raw = raw.replace(re, '<img src="' + escHtml(e.url) + '" alt="' + escHtml(e.name) + '" style="max-width:120px;max-height:120px;display:block;margin:4px 0;border-radius:8px;">');
          });
        }
      } catch (ex) {}
      // Handle poll cards
      const pollMatch = raw.match(/^<poll q="([^"]*)" multi="([^"]*)" opts="([^"]*)"><\/poll>$/i);
      if (pollMatch) {
        const q = pollMatch[1];
        const multi = pollMatch[2] === '1';
        const opts = pollMatch[3].split('|');
        const pollId = 'poll_' + Date.now();
        let html = '<div class="poll-card" style="margin:8px 0;padding:12px;background:var(--panel);border-radius:8px;border:1px solid var(--border);">';
        html += '<div style="font-weight:600;color:var(--bright);margin-bottom:8px;">' + escHtml(q) + '</div>';
        opts.forEach((opt, i) => {
          html += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0;"><button onclick="votePoll(\'' + pollId + '\',' + i + ',' + (multi ? 'true' : 'false') + ')" style="flex:1;padding:6px 10px;background:var(--bg-t);border:1px solid var(--border);border-radius:6px;color:var(--txt);cursor:pointer;text-align:left;font-size:13px;">' + escHtml(opt) + '</button><span id="poll-' + pollId + '-' + i + '" style="font-size:12px;color:var(--mut);min-width:30px;text-align:right;">0</span></div>';
        });
        html += '<div style="font-size:11px;color:var(--mut);margin-top:8px;">' + (multi ? 'Multiple choice' : 'Single choice') + '</div>';
        html += '</div>';
        return html;
      }
      let _out = renderMarkdown(raw);
      msgLinks.forEach((id, i) => {
        _out = _out.replace('@@MSGLINK' + i + '@@', '<span class="msg-link-chip" onclick="window.jumpToMessage(\'' + escHtml(id) + '\')" style="display:inline-block;padding:2px 8px;border-radius:10px;background:var(--bg-t);color:var(--bl);cursor:pointer;font-size:12px;border:1px solid var(--hover);">🔗 Jump to message</span>');
      });
      return _out;
    };
    function renderInviteCard(name, icon, banner, desc, link) {
      let html = '<div class="invite-msg-card">';
      if (banner) html += `<div class="invite-msg-banner" style="background-image:url('${escHtml(banner)}');"></div>`;
      html += '<div class="invite-msg-body">';
      if (icon) html += `<img src="${escHtml(icon)}" alt="" style="width:32px;height:32px;border-radius:50%;margin-bottom:4px;">`;
      html += `<div class="invite-msg-name">${escHtml(name)}</div>`;
      if (desc) html += `<div class="invite-msg-desc">${escHtml(desc)}</div>`;
      html += `<button class="invite-msg-join" onclick="window.open('${escHtml(link)}','_blank')">Join Server</button>`;
      html += '</div></div>';
      return html;
    }
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
      // Rich embeds: YouTube iframes (no CORS needed)
      s = s.replace(/(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11}))/g, '<div class="embed embed-youtube"><iframe src="https://www.youtube.com/embed/$2" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>');
      s = s.replace(/(https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+))/g, '<div class="embed embed-twitter"><a href="$1" target="_blank" rel="noopener noreferrer">$1</a></div>');
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
      const converted = await window.convertImageToAvif(file, { maxSize, maxBytes: 2 * 1024 * 1024 });
      if (!converted) throw new Error('This browser cannot encode images as AVIF.');
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(converted);
      });
    };
    const drop = document.getElementById('pfp-dropzone');
    drop.ondragover = (e) => e.preventDefault();
    drop.ondrop = async (e) => {
      e.preventDefault(); const f = e.dataTransfer.files[0];
      if (!f || !f.type.startsWith('image/')) return;
      if (f.size > MAX_PFP_BYTES) { appAlert('PFP too large (max 500KB).'); return; }
      try {
        pfp = await compressImage(f, 512);
        localStorage.setItem('pfp_'+user, pfp);
        await setDoc(doc(db,"users",user),{user,pfp,uid:(auth.currentUser&&auth.currentUser.uid)||null,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
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
        pfp = await compressImage(f, 512);
        localStorage.setItem('pfp_'+user, pfp);
        await setDoc(doc(db,"users",user),{user,pfp,uid:(auth.currentUser&&auth.currentUser.uid)||null,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
        document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`;
        document.getElementById('my-pfp').textContent = '';
        listen();
        e.target.value = '';
      } catch (err) { appAlert('Failed to process image.'); }
    };


    // Periodically re-evaluate auto theme
    setInterval(() => { try { applyAutoTheme(); } catch (e) {} }, 60000);
    setInterval(() => { try { if (typeof window.processScheduledMessages === 'function') window.processScheduledMessages(); } catch (e) {} }, 30000);const GIF_FAV_KEY = 'froggocord-gif-favorites';
const GIF_BLK_KEY = 'froggocord-gif-blocked';
function loadGifSets() {
  try { window.gifFavorites = new Set(JSON.parse(localStorage.getItem(GIF_FAV_KEY) || '[]')); } catch(e){ window.gifFavorites = new Set(); }
  try { window.gifBlocked = new Set(JSON.parse(localStorage.getItem(GIF_BLK_KEY) || '[]')); } catch(e){ window.gifBlocked = new Set(); }
}
loadGifSets();
window.isGifFavorite = (u) => window.gifFavorites.has(u);
window.isGifBlocked = (u) => window.gifBlocked.has(u);
window.toggleGifFavorite = (u) => {
  if (window.gifFavorites.has(u)) window.gifFavorites.delete(u); else window.gifFavorites.add(u);
  try { localStorage.setItem(GIF_FAV_KEY, JSON.stringify([...window.gifFavorites])); } catch(e){}
  // update DOM
  document.querySelectorAll('.gif-wrap[data-gif-url]').forEach(w => {
    if (w.getAttribute('data-gif-url') !== u) return;
    const fav = window.gifFavorites.has(u);
    const btn = w.querySelector('.gif-star');
    if (btn) { btn.textContent = fav ? '★' : '☆'; btn.style.color = fav ? '#f0b232' : '#fff'; }
  });
};
window.toggleGifBlock = (u) => {
  if (window.gifBlocked.has(u)) window.gifBlocked.delete(u); else window.gifBlocked.add(u);
  try { localStorage.setItem(GIF_BLK_KEY, JSON.stringify([...window.gifBlocked])); } catch(e){}
  document.querySelectorAll('.gif-wrap[data-gif-url]').forEach(w => {
    if (w.getAttribute('data-gif-url') !== u) return;
    const blk = window.gifBlocked.has(u);
    const img = w.querySelector('img');
    if (img) img.style.filter = blk ? 'blur(8px)' : '';
    const btn = w.querySelector('.gif-block');
    if (btn) { btn.textContent = blk ? '●' : '○'; btn.style.color = blk ? '#da373c' : '#fff'; }
  });
};

    // Pinned messages support
    window.canPinMessages = () => {
      if (!currentServer) return false;
      const s = servers.find(x => x.id === currentServer);
      if (!s) return false;
      return s.owner === user || (s.admins || []).includes(user);
    };
    window.pinMessage = async (msgId) => {
      if (!msgId || !chan) return;
      try {
        await setDoc(doc(db, 'pins', chan + '__' + msgId), { channel: chan, messageId: msgId, pinnedBy: user, timestamp: serverTimestamp() });
        if (typeof renderPinnedBar === 'function') renderPinnedBar();
      } catch (e) { appAlert('Failed to pin message.'); }
    };
    window.unpinMessage = async (msgId) => {
      if (!msgId || !chan) return;
      try {
        await deleteDoc(doc(db, 'pins', chan + '__' + msgId));
        if (typeof renderPinnedBar === 'function') renderPinnedBar();
      } catch (e) { appAlert('Failed to unpin message.'); }
    };


    window.renderPinnedBar = async () => {
      const bar = document.getElementById('pinned-bar');
      if (!bar || !chan) { if (bar) bar.style.display = 'none'; return; }
      try {
        const snap = await getDocs(query(collection(db, 'pins'), where('channel', '==', chan)));
        const pins = snap.docs.map(d => d.data());
        if (!pins.length) { bar.style.display = 'none'; return; }
        bar.style.display = 'block';
        bar.innerHTML = '<span style="font-weight:600;margin-right:8px;">📌 Pinned</span>' + pins.map(p => {
          const msg = (typeof messagePages !== 'undefined' && messagePages.length) ? messagePages[0].messages.get(p.messageId) : null;
          const text = msg ? String(msg.text || '').slice(0, 40) : 'Message';
          return `<span style="cursor:pointer;color:var(--bl);margin-right:8px;" onclick="jumpToMessage('${p.messageId}')">${escHtml(text)}</span>`;
        }).join('');
      } catch (e) { bar.style.display = 'none'; }
    };

    window.jumpToMessage = (msgId) => {
      const el = document.querySelector(`[data-id="${msgId}"]`);
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.background = 'var(--mention-bg)'; setTimeout(() => { el.style.background = ''; }, 2000); }
      else {
        // Message not loaded; try to load older pages then retry
        if (typeof loadOlderMessages === 'function') {
          let attempts = 0;
          const tryAgain = () => {
            const el2 = document.querySelector(`[data-id="${msgId}"]`);
            if (el2) { el2.scrollIntoView({ behavior: 'smooth', block: 'center' }); el2.style.background = 'var(--mention-bg)'; setTimeout(() => { el2.style.background = ''; }, 2000); return; }
            if (attempts < 10) { attempts++; loadOlderMessages(); setTimeout(tryAgain, 400); }
          };
          tryAgain();
        }
      }
    };
    window.copyMessageLink = (msgId) => {
      const url = window.location.origin + window.location.pathname + '#msg-' + encodeURIComponent(msgId);
      const done = () => { if (typeof appAlert === 'function') appAlert('Message link copied.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(() => { prompt('Copy this link:', url); });
      } else {
        prompt('Copy this link:', url);
      }
    };
    // Jump to message on load if hash present
    window.addEventListener('load', () => {
      const m = window.location.hash.match(/^#msg-(.+)$/);
      if (m) setTimeout(() => window.jumpToMessage(decodeURIComponent(m[1])), 1200);
    });

    // Call renderPinnedBar when channel changes
    const _origListen = (typeof listen === 'function') ? listen : null;


    // ---------- Network reconnect support ----------
    let isOnline = navigator.onLine;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    function updateNetworkStatus() {
      const wasOnline = isOnline;
      isOnline = navigator.onLine;
      if (wasOnline && !isOnline) {
        // Went offline
        const indicator = document.getElementById('network-status');
        if (indicator) { indicator.style.display = 'block'; indicator.textContent = 'Reconnecting...'; }
      } else if (!wasOnline && isOnline) {
        // Came back online - re-establish listeners
        const indicator = document.getElementById('network-status');
        if (indicator) { indicator.style.display = 'none'; }
        reconnectAttempts = 0;
        // Re-trigger listen() if we have a channel
        if (user && chan) {
          try { listen(); } catch (e) { console.error('reconnect listen failed', e); }
        }
        if (user) {
          try { loadServers(); } catch (e) { console.error('reconnect loadServers failed', e); }
        }
      }
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Periodic reconnect check
    setInterval(async () => {
      if (!navigator.onLine) return;
      if (!user) return;
      try {
        // Lightweight check: try to read presence doc
        await getDoc(doc(db, 'presence', user));
        const indicator = document.getElementById('network-status');
        if (indicator) indicator.style.display = 'none';
      } catch (e) {
        console.warn('Reconnect check failed, retrying...', e);
        const indicator = document.getElementById('network-status');
        if (indicator) { indicator.style.display = 'block'; indicator.textContent = 'Reconnecting...'; }
        // Attempt reconnect
        try {
          if (chan) listen();
          if (user) loadServers();
          if (indicator) indicator.style.display = 'none';
        } catch (err) {
          console.error('Reconnect failed', err);
        }
      }
    }, 30000);


    // ---------- Keyboard shortcuts ----------
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K: focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) searchBtn.click();
      }
      // Escape: close modals/popups
      if (e.key === 'Escape') {
        const mediaPicker = document.getElementById('media-picker');
        if (mediaPicker && mediaPicker.style.display !== 'none') {
          mediaPicker.style.display = 'none';
        }
        const favTooltip = document.getElementById('fav-gifs-tooltip');
        if (favTooltip && favTooltip.style.display !== 'none') {
          favTooltip.style.display = 'none';
        }
        const soundboard = document.getElementById('soundboard-panel');
        if (soundboard && soundboard.style.display !== 'none') {
          soundboard.style.display = 'none';
        }
      }
      // Ctrl/Cmd + Enter: send message
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (typeof window.sendMessage === 'function') window.sendMessage();
      }
      // Ctrl/Cmd + Shift + M: mark all read
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        if (typeof window.markAllRead === 'function') window.markAllRead();
      }
      // Ctrl/Cmd + Shift + U: toggle DM view
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        if (typeof window.toggleDMView === 'function') window.toggleDMView();
      }
      // Ctrl/Cmd + /: show keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        appAlert('Keyboard Shortcuts:\\n\\nCtrl+K: Search\\nCtrl+Enter: Send\\nCtrl+Shift+M: Mark all read\\nCtrl+Shift+U: Toggle DMs\\nEsc: Close modals\\nArrow keys: Navigate messages\\nEnter: Open profile\\nCtrl+Shift+J: Jump to first unread');
      }
      // Ctrl/Cmd + Shift + J: jump to first unread
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        if (typeof window.jumpToFirstUnread === 'function') window.jumpToFirstUnread();
      }
    });


    // ---------- Reporting ----------
    window.reportContent = async (type, id, reason) => {
      if (!user) return;
      try {
        await addDoc(collection(db, 'reports'), {
          type: type, // 'message', 'user', 'server'
          targetId: id,
          reporter: user,
          reason: reason || 'No reason provided',
          timestamp: serverTimestamp(),
          status: 'pending'
        });
        appAlert('Report submitted. Thank you.');
      } catch (e) {
        appAlert('Failed to submit report.');
      }
    };

    window.reportMessage = async (msgId) => {
      const reason = await appPrompt('Reason for reporting this message:');
      if (reason === null) return;
      await reportContent('message', msgId, reason);
    };

    window.reportUser = async (username) => {
      const reason = await appPrompt('Reason for reporting this user:');
      if (reason === null) return;
      await reportContent('user', username, reason);
    };


    // ---------- Useful error handling ----------
    window.showError = (msg) => {
      const el = document.getElementById('error-toast');
      if (el) {
        el.textContent = msg;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 5000);
      } else {
        console.error(msg);
      }
    };


    // ---------- Keyboard navigation ----------
    document.addEventListener('keydown', (e) => {
      // Arrow key navigation in message list (when not in input)
      if (document.activeElement && document.activeElement.id === 'chat-input') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const msgs = Array.from(document.querySelectorAll('#message-container .msg'));
        if (!msgs.length) return;
        const focused = document.activeElement;
        let idx = msgs.indexOf(focused);
        if (idx === -1) idx = (e.key === 'ArrowUp') ? msgs.length - 1 : 0;
        else idx = (e.key === 'ArrowUp') ? Math.max(0, idx - 1) : Math.min(msgs.length - 1, idx + 1);
        msgs[idx].focus();
        msgs[idx].scrollIntoView({ block: 'nearest' });
        e.preventDefault();
      }
      // Enter on a message: open profile of author
      if (e.key === 'Enter') {
        const focused = document.activeElement;
        if (focused && focused.classList.contains('msg')) {
          const author = focused.querySelector('.msg-author');
          if (author && author.onclick) author.click();
        }
      }
    });

    // Make messages focusable
    const msgObserver = new MutationObserver(() => {
      document.querySelectorAll('#message-container .msg').forEach(m => {
        if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '0');
      });
    });
    const messageContainer = document.getElementById('message-container');
    if (messageContainer) msgObserver.observe(messageContainer, { childList: true, subtree: true });


    // ---------- Link Previews ----------
    window.fetchLinkPreview = async (url) => {
      try {
        // Try Open Graph / meta tags via a CORS proxy or direct fetch
        const response = await fetch(url, { redirect: 'follow' });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                      doc.querySelector('title')?.textContent ||
                      '';
        const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                            doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
                            '';
        const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                      doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
                      '';
        
        return { title, description, image };
      } catch (e) {
        console.error('Link preview failed', e);
        return null;
      }
    };

    window.renderLinkPreview = (url, data) => {
      if (!data) return '';
      const imgHtml = data.image ? `<img src="${escHtml(data.image)}" alt="Preview" style="width:100px;height:60px;object-fit:cover;border-radius:6px;">` : '';
      return `<div class="link-preview" style="margin-top:6px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--panel);display:flex;gap:8px;align-items:flex-start;">
        ${imgHtml}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--bright);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(data.title)}</div>
          <div style="font-size:11px;color:var(--mut);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:-webkit-line-clamp:2;line-height:1.4;">${escHtml(data.description)}</div>
          <div style="font-size:11px;color:var(--bl);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(url)}</div>
        </div>
      </div>`;
    };

    // Check URL for link preview
    const URL_REGEX = /https?:\/\/[^\s<]+/g;
    window.checkLinkPreview = async (text) => {
      const matches = text.match(URL_REGEX);
      if (!matches) return '';
      const firstUrl = matches[0];
      const data = await fetchLinkPreview(firstUrl);
      return data ? renderLinkPreview(firstUrl, data) : '';
    };


    // ---------- Polls ----------
    window.createPoll = async () => {
      const question = await appPrompt('Poll question:');
      if (!question) return;
      const optionsStr = await appPrompt('Poll options (comma-separated):');
      if (!optionsStr) return;
      const options = optionsStr.split(',').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) { appAlert('Need at least 2 options.'); return; }
      const multi = await appConfirm('Allow multiple choices?');
      const poll = '<poll q="' + escHtml(question) + '" multi="' + (multi ? '1' : '0') + '" opts="' + options.map(o => escHtml(o)).join('|') + '"></poll>';
      await addDoc(collection(db, "messages"), { text: poll, user, uid: (auth.currentUser && auth.currentUser.uid) || null, channel: chan, pfp, timestamp: serverTimestamp() });
    };

    window.votePoll = (pollId, optionIdx, multi) => {
      const key = 'poll_' + pollId + '_' + optionIdx;
      const voted = localStorage.getItem('poll_voted_' + pollId);
      if (voted && !multi) {
        appAlert('You already voted on this poll.');
        return;
      }
      const current = parseInt(localStorage.getItem(key) || '0', 10);
      localStorage.setItem(key, String(current + 1));
      localStorage.setItem('poll_voted_' + pollId, '1');
      const el = document.getElementById('poll-' + pollId + '-' + optionIdx);
      if (el) el.textContent = current + 1;
    };


    // ---------- User Notes ----------
    window.getUserNote = (u) => {
      try { return localStorage.getItem('froggocord-note-' + u) || ''; } catch (e) { return ''; }
    };
    window.setUserNote = (u, note) => {
      try {
        if (note && note.trim()) {
          localStorage.setItem('froggocord-note-' + u, note.trim());
        } else {
          localStorage.removeItem('froggocord-note-' + u);
        }
      } catch (e) {}
    };
    window.editUserNote = async (u) => {
      const current = getUserNote(u);
      const note = await appPrompt('Note for ' + u + ':', current);
      if (note === null) return;
      setUserNote(u, note);
      appAlert('Note saved.');
    };


    // ---------- Message Bookmarks ----------
    window.getBookmarks = () => {
      try { return JSON.parse(localStorage.getItem('froggocord-bookmarks') || '[]'); } catch (e) { return []; }
    };
    window.saveBookmarks = (b) => {
      try { localStorage.setItem('froggocord-bookmarks', JSON.stringify(b)); } catch (e) {}
    };
    window.toggleBookmark = (msgId) => {
      const b = getBookmarks();
      const idx = b.indexOf(msgId);
      if (idx >= 0) b.splice(idx, 1); else b.push(msgId);
      saveBookmarks(b);
      return idx < 0;
    };
    window.isBookmarked = (msgId) => getBookmarks().includes(msgId);

    // ---------- Server Folders ----------
    window.getServerFolders = () => {
      try { return JSON.parse(localStorage.getItem('froggocord-server-folders') || '[]'); } catch (e) { return []; }
    };
    window.saveServerFolders = (folders) => {
      try { localStorage.setItem('froggocord-server-folders', JSON.stringify(folders)); } catch (e) {}
    };
    window.createServerFolder = async (folderName) => {
      const folders = getServerFolders();
      folders.push({ id: 'folder_' + Date.now(), name: folderName, serverIds: [] });
      saveServerFolders(folders);
      appAlert('Server folder created: ' + folderName);
      if (typeof renderServerList === 'function') renderServerList();
    };
    window.moveServerToFolder = (serverId, folderId) => {
      const folders = getServerFolders();
      // Remove from all folders
      folders.forEach(f => { f.serverIds = f.serverIds.filter(id => id !== serverId); });
      // Add to target folder
      if (folderId) {
        const f = folders.find(x => x.id === folderId);
        if (f && !f.serverIds.includes(serverId)) f.serverIds.push(serverId);
      }
      saveServerFolders(folders);
      if (typeof renderServerList === 'function') renderServerList();
    };

    // ---------- Message Quoting ----------
    window.quoteMessage = async (msgId) => {
      if (!msgId) return;
      const input = document.getElementById('chat-input');
      if (!input) return;
      // Find the message in the DOM
      const msgEl = document.querySelector(`[data-id="${msgId}"]`);
      const text = msgEl ? msgEl.textContent.trim() : '';
      const prefix = '> ' + text.split('\n').join('\n> ') + '\n\n';
      input.value = prefix + input.value;
      input.focus();
      appAlert('Message quoted.');
    };

    // ---------- Scheduled Messages ----------
    window.scheduleMessage = async (text, sendAt, channelId) => {
      if (!user || !text || !sendAt || !channelId) return;
      const clientId = 'scheduled_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      try {
        const payload = {
          text: text,
          user: user,
          uid: (auth.currentUser && auth.currentUser.uid) || null,
          channel: channelId || chan,
          pfp: pfp,
          timestamp: serverTimestamp(),
          clientMsgId: clientId,
          scheduledFor: new Date(sendAt).toISOString(),
          status: 'scheduled'
        };
        await addDoc(collection(db, "messages"), payload);
        appAlert('Message scheduled for ' + new Date(sendAt).toLocaleString());
      } catch (e) { appAlert('Failed to schedule message.'); }
    };

    // Process any pending scheduled messages (client-side fallback)
    window.processScheduledMessages = async () => {
      if (!user) return;
      try {
        const now = new Date().toISOString();
        const snap = await getDocs(query(collection(db, 'messages'), where('status', '==', 'scheduled')));
        for (const d of snap.docs) {
          const data = d.data();
          if (data.user === user && data.scheduledFor && data.scheduledFor <= now) {
            await setDoc(doc(db, 'messages', d.id), { status: 'sending' }, { merge: true });
            // Actually send it by removing the scheduled flag
            const schedPayload = { ...data };
            delete schedPayload.status;
            delete schedPayload.scheduledFor;
            await addDoc(collection(db, "messages"), schedPayload);
            await deleteDoc(doc(db, 'messages', d.id));
            appAlert('Sent scheduled message.');
          }
        }
      } catch (e) { console.error('Scheduled message processing failed', e); }
    };

    // ---------- New messages pill ----------
    window.showNewMessagesPill = () => {
      const pill = document.getElementById('new-messages-pill');
      if (pill) pill.style.display = 'block';
    };
    window.hideNewMessagesPill = () => {
      const pill = document.getElementById('new-messages-pill');
      if (pill) pill.style.display = 'none';
    };
    const pillEl = document.getElementById('new-messages-pill');
    if (pillEl) {
      pillEl.addEventListener('click', () => {
        const msgBox = document.getElementById('message-container');
        if (msgBox) { msgBox.scrollTop = msgBox.scrollHeight; }
        hideNewMessagesPill();
      });
    }

    // ---------- Read Receipts ----------
    window.markChannelRead = (channel) => {
      if (!channel || !user) return;
      try {
        const key = 'froggocord-read-' + channel;
        localStorage.setItem(key, String(Date.now()));
      } catch (e) {}
      try {
        setDoc(doc(db, 'reads', user + '__' + channel), { user, channel, timestamp: serverTimestamp() }, { merge: true }).catch(() => {});
      } catch (e) {}
    };

    window.getChannelReadTime = (channel) => {
      try {
        const key = 'froggocord-read-' + channel;
        const val = localStorage.getItem(key);
        return val ? parseInt(val, 10) : 0;
      } catch (e) { return 0; }
    };

    window.isMessageRead = (msg, channel) => {
      if (!msg || !msg.timestamp) return true;
      const readTime = getChannelReadTime(channel);
      const msgTime = msg.timestamp && msg.timestamp.toMillis ? msg.timestamp.toMillis() : (msg.timestamp || 0);
      return msgTime <= readTime;
    };

    // ---------- Text-to-Speech ----------
    let ttsEnabled = false;
    try { ttsEnabled = localStorage.getItem('froggocord-tts') === 'true'; } catch (e) {}
    window.toggleTTS = () => {
      ttsEnabled = !ttsEnabled;
      try { localStorage.setItem('froggocord-tts', String(ttsEnabled)); } catch (e) {}
      appAlert(ttsEnabled ? 'Text-to-speech enabled.' : 'Text-to-speech disabled.');
    };
    window.speakMessage = (text) => {
      if (!ttsEnabled) return;
      if (!('speechSynthesis' in window)) return;
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
      } catch (e) {}
    };
