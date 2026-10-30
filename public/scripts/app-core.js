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
    const app = initializeApp(config), auth = getAuth(app), db = getFirestore(app);
    let chan = null, user = null, typingUnsub = null, typingTimer = null, isSignUpMode = false, pfp = '', reply = null, curStat = 'online', idle = null, mode = 'dms', dmWith = null, servers = [], currentServer = null, lastPresenceUsers = [], lastRead = {};
    let heartbeat = null, idleNow = false, lastActivity = Date.now();
    let allUsers = [], backfillUsers = [], userPfpMap = new Map(), userPrivacyMap = new Map(), userBannerMap = new Map(), userBackgroundMap = new Map(), userAccentMap = new Map(), userDecorationMap = new Map(), userBgColorMap = new Map(), userTextColorMap = new Map(), userCustomStatusMap = new Map(), userPronounsMap = new Map(), userBioMap = new Map();
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
    mobileNavToggle.addEventListener('click', () => {
      const isOpen = document.body.classList.toggle('mobile-nav-open');
      mobileNavToggle.setAttribute('aria-expanded', String(isOpen));
      mobileNavToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
    mobileNavBackdrop.addEventListener('click', closeMobileNav);
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
      profile: { color: '#57f287', banner: '', bannerPos: 'center', bannerSize: 'cover', background: '', bgColor: '#1e1f22', bgPos: 'center', bgSize: 'cover', accent: '#57f287', textColor: '#ffffff', decoration: '', effect: false, effectType: 'glow', layout: 'default', appBg: '', customStatus: '', pronouns: '', bio: '', gradient: { enabled: false, from: '#57f287', to: '#23a55a', direction: 'to right' } },
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

    // Pending message tracking for sending/sent/failed states
    let pendingMessages = [];

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
      const t = input.value.trim();
      if (!t && pendingFiles.length === 0) return;
      if (!user) return;

      const clientId = 'pending_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const pending = {
        clientId: clientId,
        text: t,
        images: pendingFiles.filter(p => p.isImage).map(p => p.preview),
        files: pendingFiles.filter(p => !p.isImage).map(p => ({ name: p.name, size: p.size, type: p.type, preview: p.preview })),
        imageW: null,
        imageH: null,
        user: user,
        channel: chan,
        pfp: pfp,
        replyTo: reply ? { user: reply.user, text: reply.text } : null,
        status: 'sending',
        _clientTimestamp: Date.now()
      };

      input.value = '';
      if (reply) { window.cancelReply(); }
      setTyping(false);

      // Add to pending messages for optimistic rendering
      pendingMessages.push(pending);
      notifyPendingChanged();

      // Handle image dimensions
      if (pendingFiles.some(p => p.isImage)) {
        for (const pf of pendingFiles) {
          if (pf.isImage && pf.file && pf.file.size > 700000) {
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
        if (pending.imageW) { payload.imageW = pending.imageW; payload.imageH = pending.imageH; }
        if (pending.replyTo) payload.replyTo = pending.replyTo;

        await addDoc(collection(db, "messages"), payload);
        pending.status = 'sent';
        notifyPendingChanged();

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
        pending.error = err.message || 'Send failed';
        notifyPendingChanged();
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

        await addDoc(collection(db, "messages"), payload);
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
        pending.error = err.message || 'Send failed';
        notifyPendingChanged();
      }
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
      const raw = String(t ?? '');
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
      return renderMarkdown(raw);
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

    const compressImage = async (file, maxSize = 512, animated = false) => {
      // Preserve animated images (GIF/APNG/WebP animation) without canvas conversion.
      if (animated && /image\/(gif|apng|webp)/i.test(file.type || '')) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
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
        pfp = await compressImage(f, 512, true);
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
        pfp = await compressImage(f, 512, true);
        localStorage.setItem('pfp_'+user, pfp);
        await setDoc(doc(db,"users",user),{user,pfp,uid:(auth.currentUser&&auth.currentUser.uid)||null,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
        document.getElementById('my-pfp').style.backgroundImage = `url(${pfp})`;
        document.getElementById('my-pfp').textContent = '';
        listen();
        e.target.value = '';
      } catch (err) { appAlert('Failed to process image.'); }
    };


    // Periodically re-evaluate auto theme
    setInterval(() => { try { applyAutoTheme(); } catch (e) {} }, 60000);const GIF_FAV_KEY = 'froggocord-gif-favorites';
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