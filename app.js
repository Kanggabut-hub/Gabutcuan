/**
 * app.js — Quant OS Controller V-DEWA EVOLUTION
 * Targeted improvements: toast feedback, refresh-delta staleness,
 * row-flash on value change, rAF-batched scanner renders, brain-panel
 * gated to research mode. No logic changes.
 */
'use strict';

// ─── Helpers ───────────────────────────────────────────────
function safeParseJSON(s, fb) { try { return s ? JSON.parse(s) : fb; } catch { return fb; } }
function escapeHTML(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function setHTML(id, h) { const e = document.getElementById(id); if (e) e.innerHTML = h; }
function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = String(v ?? ''); }
function safeN(v)  { const n = parseFloat(v); return isFinite(n) ? n : 0; }
function fmtPrice(v) {
    const n = safeN(v);
    if (!n) return '$0';
    const d = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
    return '$' + n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function calcRR(entry, sl, tp) {
    const e = safeN(entry), s = safeN(sl), t = safeN(tp);
    if (!e || !s || !t) return '—';
    const risk = Math.abs(e - s), reward = Math.abs(t - e);
    return risk ? `1:${(reward / risk).toFixed(2)}` : '—';
}

// ─── Toast ─────────────────────────────────────────────────
// Lightweight: creates, auto-removes. No persistent DOM.
function showToast(msg, type = '') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast${type ? ' ' + type : ''}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('out');
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 2400);
}

// ─── i18n ──────────────────────────────────────────────────
const LANG = {
    en: {
        scan:'Scan', journal:'Journal', research:'Research',
        longSignals:'Potential Longs', shortSignals:'Potential Shorts',
        lockedSignals:'Locked Signals', tradingJournal:'Trading Journal',
        marketRegime:'Market Regime', topSignals:'Top Confluence Signals',
        conviction:'Conviction', risk:'Risk', intelligence:'Intelligence',
        totalPnl:'Total Est. PNL', terminalActive:'Terminal Active', modeLabel:'Mode',
        realized:'Realized', unrealized:'Unrealized', rrLabel:'R:R',
        editTrade:'Edit Trade', entry:'Entry', sl:'Stop Loss', tp:'Take Profit',
        leverage:'Leverage', margin:'Margin ($)', notes:'Notes',
        save:'Save', cancel:'Cancel', editJournal:'Edit Journal',
        noLocked:'No locked signals yet.', noJournal:'No journal entries yet.',
        initStream:'Initializing data stream…', calibrating:'Calibrating…',
        analyzing:'Analyzing pairs…', updatedNow:'Updated: Just now',
        confluenceScore:'Confluence Score', multiTimeframe:'Multi-Timeframe',
        indicators:'Indicators', orderFlow:'Order Flow', tradeStructure:'Trade Structure',
        reanalyze:'Re-Analyze', lockSignal:'Lock Signal', addJournal:'Add to Journal',
        loginTitle:'Gabut OS Access', loginDesc:'Enter passphrase to initialize terminal.',
        loginBtn:'Initialize System', filterLong:'Long', filterShort:'Short', filterAll:'All',
        brainStrategy:'Brain Strategy', stopStyle:'Stop', tpStyle:'TP',
        brainPanel:'Autonomous Brain Panel', brainFocus:'Focus Pairs', brainAvoid:'Avoid Pairs',
    },
    id: {
        scan:'Scan', journal:'Jurnal', research:'Riset',
        longSignals:'Potensi Long', shortSignals:'Potensi Short',
        lockedSignals:'Sinyal Terkunci', tradingJournal:'Jurnal Trading',
        marketRegime:'Kondisi Pasar', topSignals:'Sinyal Terbaik',
        conviction:'Keyakinan', risk:'Risiko', intelligence:'Intelijen',
        totalPnl:'Total Est. PNL', terminalActive:'Terminal Aktif', modeLabel:'Mode',
        realized:'Realisasi', unrealized:'Belum Realisasi', rrLabel:'R:R',
        editTrade:'Edit Trade', entry:'Entry', sl:'Stop Loss', tp:'Take Profit',
        leverage:'Leverage', margin:'Margin ($)', notes:'Catatan',
        save:'Simpan', cancel:'Batal', editJournal:'Edit Jurnal',
        noLocked:'Belum ada sinyal terkunci.', noJournal:'Belum ada jurnal.',
        initStream:'Inisialisasi aliran data…', calibrating:'Kalibrasi…',
        analyzing:'Menganalisis pasangan…', updatedNow:'Diperbarui: Baru saja',
        confluenceScore:'Skor Konfluens', multiTimeframe:'Multi-Timeframe',
        indicators:'Indikator', orderFlow:'Aliran Order', tradeStructure:'Struktur Trade',
        reanalyze:'Re-Analisis', lockSignal:'Kunci Sinyal', addJournal:'Tambah Jurnal',
        loginTitle:'Akses Gabut OS', loginDesc:'Masukkan frasa sandi untuk memulai.',
        loginBtn:'Inisialisasi Sistem', filterLong:'Long', filterShort:'Short', filterAll:'Semua',
        brainStrategy:'Strategi Otak', stopStyle:'Stop', tpStyle:'TP',
        brainPanel:'Panel Otak Otonom', brainFocus:'Pasangan Fokus', brainAvoid:'Pasangan Hindari',
    },
};
let currentLang = localStorage.getItem('quant_lang') || 'en';
function t(k) { return LANG[currentLang]?.[k] ?? LANG.en[k] ?? k; }
function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (v) el.textContent = v; });
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = currentLang.toUpperCase();
}
function toggleLang() {
    currentLang = currentLang === 'en' ? 'id' : 'en';
    localStorage.setItem('quant_lang', currentLang);
    applyLang(); renderScanners(); renderTrackingLists();
}

// ─── State ─────────────────────────────────────────────────
const S = {
    marketData:      [],
    analyzedPairs:   [],
    journal:         safeParseJSON(localStorage.getItem('quant_journal'), []),
    locked:          safeParseJSON(localStorage.getItem('quant_locked'),  []),
    userProfile:     safeParseJSON(localStorage.getItem('quant_user'), { name:'Quant User', avatar:'Q', avatarBase64:null }),
    activeModalPair: null,
    currentMode:     'scan',
    activeFilter:    'all',
    isFetching:      false,
    lastRefresh:     null,
    timers:          {},
    // score snapshot for row-flash detection
    _scoreSnapshot:  {},
};

// ─── DOM Cache ─────────────────────────────────────────────
const el = {};
function cacheEls() {
    [
        'login-btn','login-password','login-error','login-gate','app-container',
        'sidebar','sidebar-overlay','sidebar-fab','toggle-sidebar',
        'avatar-upload','user-avatar','user-name',
        'quant-modal','global-search','search-results',
        'status-data','status-refresh','status-mode','status-pairs',
        'footer-mode','footer-refresh','footer-status',
        'theme-toggle','regime-data','lang-toggle',
        'journal-edit-modal','jedit-entry','jedit-sl','jedit-tp',
        'jedit-leverage','jedit-margin','jedit-notes','jedit-rr-preview',
    ].forEach(id => { el[id.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = document.getElementById(id); });
    el.quantCard = document.querySelector('.quant-card');
}

// ─── Login ─────────────────────────────────────────────────
function bindLogin() {
    const go = () => {
        if (el.loginPassword.value === 'kitabisa') {
            el.loginGate.classList.add('hidden');
            el.appContainer.classList.remove('hidden');
            initTerminal();
        } else {
            el.loginError.classList.remove('hidden');
            el.loginPassword.value = '';
            el.loginPassword.focus();
        }
    };
    el.loginBtn.addEventListener('click', go);
    el.loginPassword.addEventListener('keypress', e => { if (e.key === 'Enter') go(); });
}

// ─── Init ──────────────────────────────────────────────────
async function initTerminal() {
    applyThemePreference();
    applyLang();
    bindEvents();
    updateUserProfileUI();
    renderRegimeSidebar();
    setMode('scan');
    renderTrackingLists();
    await fetchAndProcess();
    S.timers.master     = setInterval(fetchAndProcess,     15 * 60 * 1000);
    S.timers.autonomous = setInterval(runAutonomousEngine, 60 * 1000);
    S.timers.regime     = setInterval(() => {
        renderRegimeSidebar();
        if (S.currentMode === 'research') renderResearchRegime();
    }, 5 * 60 * 1000);
    // Refresh-delta ticker: updates "Refresh:" every 30s to show staleness
    S.timers.delta = setInterval(updateRefreshDelta, 30_000);
    Perf.scheduleClean();
}

// ─── Theme ─────────────────────────────────────────────────
function applyThemePreference() {
    const h = new Date().getHours();
    const saved = localStorage.getItem('quant_theme');
    const theme = saved || (h >= 20 || h < 7 ? 'dark' : 'light');
    applyTheme(theme);
}
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const m = document.getElementById('meta-theme-color');
    if (m) m.content = theme === 'dark' ? '#090c12' : '#eef1f7';
    if (el.themeToggle) {
        el.themeToggle.textContent = theme === 'dark' ? '☀' : '◑';
        el.themeToggle.title = theme === 'dark' ? 'Light mode' : 'Dark mode';
    }
}
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('quant_theme', next);
    applyTheme(next);
}

// ─── Mode ──────────────────────────────────────────────────
function setMode(mode) {
    S.currentMode = mode;
    document.documentElement.setAttribute('data-mode', mode);
    document.querySelectorAll('.mode-panels').forEach(p => p.classList.toggle('hidden', p.dataset.forMode !== mode));
    document.querySelectorAll('.mode-btn,.mob-mode-btn').forEach(b => {
        const on = b.dataset.mode === mode;
        b.classList.toggle('active', on);
        if (b.classList.contains('mode-btn')) b.setAttribute('aria-selected', on);
    });
    const lbl = mode.charAt(0).toUpperCase() + mode.slice(1);
    setText('status-mode', lbl);
    setText('footer-mode', lbl.toUpperCase());
    if (mode === 'research') renderResearchMode();
    if (mode === 'journal')  renderTrackingLists();
}

// ─── Sidebar ───────────────────────────────────────────────
function openSidebar() {
    el.sidebar?.classList.remove('collapsed');
    el.sidebarOverlay?.classList.remove('hidden');
    el.toggleSidebar?.setAttribute('aria-expanded','true');
    if (el.sidebarFab) el.sidebarFab.setAttribute('aria-label','Close sidebar');
}
function closeSidebar() {
    el.sidebar?.classList.add('collapsed');
    el.sidebarOverlay?.classList.add('hidden');
    el.toggleSidebar?.setAttribute('aria-expanded','false');
    if (el.sidebarFab) el.sidebarFab.setAttribute('aria-label','Open sidebar');
}
function toggleSidebar() { el.sidebar?.classList.contains('collapsed') ? openSidebar() : closeSidebar(); }

// ─── Performance Engine ────────────────────────────────────
const Perf = {
    _rafId: null,
    _pendingScan: false,

    diff(id, newHTML) {
        const e = document.getElementById(id);
        if (!e || e.innerHTML === newHTML) return false;
        e.innerHTML = newHTML;
        return true;
    },

    // rAF-batch scanner renders to avoid mid-frame layout work
    scheduleScan() {
        if (this._pendingScan) return;
        this._pendingScan = true;
        this._rafId = requestAnimationFrame(() => {
            this._pendingScan = false;
            _doRenderScanners();
        });
    },

    scheduleClean() {
        setInterval(() => {
            try {
                const before = S.analyzedPairs.length;
                S.analyzedPairs = S.analyzedPairs.filter(p =>
                    p.source !== 'dex' || S.locked.some(l => l.symbol === p.symbol)
                );
                if (S.analyzedPairs.length !== before) updateStatusPairs();
            } catch(e) { console.warn('[Perf] clean:', e.message); }
        }, 45_000);
    },

    adaptTimer() {
        try {
            const ms = API.adaptiveRefreshMs(S.analyzedPairs);
            if (S.timers.master) {
                clearInterval(S.timers.master);
                S.timers.master = setInterval(fetchAndProcess, ms);
            }
        } catch(e) { console.warn('[Perf] adaptTimer:', e.message); }
    },
};


// ─── Mood Bar ──────────────────────────────────────────────
function renderMoodBar() {
    try {
        const mood = API.getMarketMood(S.analyzedPairs);
        document.documentElement.setAttribute('data-mood', mood);
        const moodEmoji = { bullish:'🟢', bearish:'🔴', choppy:'🟡', volatile:'⚡' }[mood] ?? '—';
        const pairsEl = document.getElementById('status-pairs');
        if (pairsEl) {
            const l = S.analyzedPairs.filter(p => parseFloat(p.score) > 7).length;
            const s = S.analyzedPairs.filter(p => parseFloat(p.score) < 4).length;
            pairsEl.textContent = `Pairs: ${S.analyzedPairs.length} · ↑${l} ↓${s} ${moodEmoji}`;
        }
    } catch(e) { console.warn('[Perf] mood:', e.message); }
}

// ─── Journal Stats ─────────────────────────────────────────
function computeJournalStats() {
    const closed = S.journal.filter(j => j.status === 'closed');
    if (!closed.length) return { winRate:0, avgRR:0, avgLeverage:0, totalTrades:0 };
    let wins = 0, rrSum = 0, rrCount = 0, levSum = 0;
    closed.forEach(j => {
        const entry = safeN(j.entry), exit = safeN(j.exitPrice ?? j.entry);
        const sl = safeN(j.tradeStructure?.sl), tp = safeN(j.tradeStructure?.tp);
        const pct = entry > 0 ? ((exit - entry) / entry) * (j.direction === 'LONG' ? 1 : -1) : 0;
        if (pct > 0) wins++;
        if (entry && sl && tp) { const r = Math.abs(entry-sl), rw = Math.abs(tp-entry); if (r) { rrSum += rw/r; rrCount++; } }
        levSum += safeN(j.leverage) || 1;
    });
    return { winRate: wins/closed.length, avgRR: rrCount ? rrSum/rrCount : 0, avgLeverage: levSum/closed.length, totalTrades: closed.length };
}

// ─── Fetch & Process ───────────────────────────────────────
async function fetchAndProcess() {
    if (S.isFetching) return;
    S.isFetching = true;
    setStatus('ok','Fetching…');
    try {
        const raw = await API.fetchMarketData();
        if (!Array.isArray(raw) || !raw.length) throw new Error('Empty');
        S.marketData  = raw;
        S.lastRefresh = new Date();
        const jStats = computeJournalStats();
        // Capture score snapshot before update for row-flash detection
        const prevScores = { ...S._scoreSnapshot };
        S.analyzedPairs = raw.map(p => {
            try {
                const analyzed = { ...p, ...API.simulateIndicators(p.symbol, p.price, p.change24h) };
                analyzed.brain = Brain.analyze(analyzed, jStats);
                return analyzed;
            } catch(e) { console.warn('[QOS]', p.symbol, e.message); return { ...p, ...API._emptyIndicators() }; }
        });
        // Update snapshot
        S.analyzedPairs.forEach(p => { S._scoreSnapshot[p.symbol] = p.score; });
        setStatus('ok','Data: OK');
        updateRefreshTime();
        updateRefreshDelta();
        updateStatusPairs();
        renderMoodBar();
        Perf.adaptTimer();
        Perf.scheduleScan();
        renderTrackingLists();
        if (S.currentMode === 'research') renderResearchMode();
    } catch(err) {
        console.error('[QOS] fetch:', err.message);
        setStatus('warn','Data: Degraded');
        if (S.analyzedPairs.length) Perf.scheduleScan();
    } finally { S.isFetching = false; }
}

// ─── Autonomous Engine ─────────────────────────────────────
async function runAutonomousEngine() {
    try {
        const raw = await API.fetchMarketData();
        if (!Array.isArray(raw) || !raw.length) return;
        S.marketData = raw;
        S.locked = S.locked.map(sig => {
            try {
                const live = raw.find(d => d.symbol === sig.symbol);
                if (!live) return sig;
                const fresh = API.simulateIndicators(sig.symbol, live.price, live.change24h, true);
                return { ...sig, currentPrice: live.price, currentScore: fresh.score,
                    health: computeSignalHealth(sig, live.price, fresh.score), biasHint: fresh.biasHint };
            } catch { return sig; }
        });
        if (S.activeModalPair && !el.quantModal?.classList.contains('hidden')) {
            openModal(S.activeModalPair.symbol, true, true);
        }
        saveState();
        renderTrackingLists();
        const tEl = document.getElementById('locked-update-time');
        if (tEl) tEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        updateRefreshTime();
        updateRefreshDelta();
        setStatus('ok','Data: OK');
        // Brain panel only re-renders when user is on research mode
        if (S.currentMode === 'research') renderBrainPanel();
    } catch(err) { console.warn('[QOS] autonomous:', err.message); setStatus('warn','Data: Stale'); }
}

// ─── Status Helpers ────────────────────────────────────────
function setStatus(level, text) {
    if (el.statusData)   { el.statusData.textContent = text; el.statusData.className = level; }
    if (el.footerStatus) el.footerStatus.textContent = level.toUpperCase();
    const dot = document.querySelector('#status-bar .pulse-dot');
    if (dot) dot.className = `pulse-dot${level !== 'ok' ? ' '+level : ''}`;
}

function updateRefreshTime() {
    if (!S.lastRefresh) return;
    const s = S.lastRefresh.toLocaleTimeString();
    if (el.statusRefresh) el.statusRefresh.textContent = `Refresh: ${s}`;
    if (el.footerRefresh) el.footerRefresh.textContent = s;
}

// Refresh-delta: shows "2m ago" and marks .stale when > 3 min
function updateRefreshDelta() {
    if (!S.lastRefresh || !el.statusRefresh) return;
    const diffMs = Date.now() - S.lastRefresh.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffSec = Math.floor((diffMs % 60_000) / 1000);
    let label;
    if (diffMin >= 1) {
        label = `Refresh: ${S.lastRefresh.toLocaleTimeString()} (${diffMin}m ago)`;
    } else {
        label = `Refresh: ${S.lastRefresh.toLocaleTimeString()} (${diffSec}s ago)`;
    }
    el.statusRefresh.textContent = label;
    // Mark stale if > 3 minutes without a refresh
    el.statusRefresh.classList.toggle('stale', diffMin >= 3);
}

function updateStatusPairs() {
    const l = S.analyzedPairs.filter(p => parseFloat(p.score) > 7).length;
    const s = S.analyzedPairs.filter(p => parseFloat(p.score) < 4).length;
    setText('status-pairs', `Pairs: ${S.analyzedPairs.length} · ↑${l} ↓${s}`);
}

// ─── Signal Health ─────────────────────────────────────────
function computeSignalHealth(sig, curPrice, newScore) {
    try {
        const e  = safeN(sig?.tradeStructure?.entry ?? sig?.entry);
        const s  = safeN(sig?.tradeStructure?.sl);
        const sc = safeN(newScore);
        if (!e) return 'Neutral';
        if (s > 0 && Math.abs(curPrice - s) / e < 0.005) return 'At Risk';
        if (sig.direction === 'LONG') {
            if (sc > 7 && curPrice > e) return 'Strong';
            if (sc < 4) return 'Weak';
        } else {
            if (sc < 4 && curPrice < e) return 'Strong';
            if (sc > 7) return 'Weak';
        }
    } catch(e) { console.warn('[QOS] health:', e.message); }
    return 'Neutral';
}


// ─── Scanners ──────────────────────────────────────────────
// Internal render fn called by Perf.scheduleScan via rAF
function _doRenderScanners() {
    const f = S.activeFilter;
    let longs  = S.analyzedPairs.filter(p => parseFloat(p.score) > 7).sort((a,b) => parseFloat(b.score)-parseFloat(a.score));
    let shorts = S.analyzedPairs.filter(p => parseFloat(p.score) < 4).sort((a,b) => parseFloat(a.score)-parseFloat(b.score));
    if (f === 'long')  shorts = [];
    if (f === 'short') longs  = [];
    setText('count-longs',  longs.length);
    setText('count-shorts', shorts.length);
    const longsHTML  = longs.map(p  => rowHTML(p,'long')).join('')  || `<div class="empty-state">No long setups.</div>`;
    const shortsHTML = shorts.map(p => rowHTML(p,'short')).join('') || `<div class="empty-state">No short setups.</div>`;
    if (Perf.diff('list-longs',  longsHTML))  _flashChangedRows('list-longs',  longs);
    if (Perf.diff('list-shorts', shortsHTML)) _flashChangedRows('list-shorts', shorts);
}
// Public entry point — always goes through rAF batcher
function renderScanners() { Perf.scheduleScan(); }

// Flash rows whose score changed since last snapshot
function _flashChangedRows(listId, pairs) {
    const container = document.getElementById(listId);
    if (!container) return;
    // Give DOM a tick to paint, then add flash class to changed rows
    requestAnimationFrame(() => {
        const rows = container.querySelectorAll('.data-row[data-bias]');
        rows.forEach((row, i) => {
            const pair = pairs[i];
            if (!pair) return;
            const prev = S._scoreSnapshot[pair.symbol + '_prev'];
            if (prev !== undefined && prev !== pair.score) {
                row.classList.remove('row-flash');
                // Force reflow to restart animation
                void row.offsetWidth;
                row.classList.add('row-flash');
            }
        });
        // Update prev-snapshot after flashing
        pairs.forEach(p => { S._scoreSnapshot[p.symbol + '_prev'] = p.score; });
    });
}

function rowHTML(pair, type) {
    const sym = escapeHTML(pair.symbol);
    const of  = pair.orderFlow;
    const ofBadge    = of    ? `<span class="of-badge ${of.bullish?'bull':'bear'}">${of.bullish?'▲OF':'▼OF'}</span>` : '';
    const brainBadge = pair.brain ? `<span class="brain-tag ${pair.brain.type}">${pair.brain.type}</span>` : '';
    const cls = type === 'long' ? 'text-long' : 'text-short';
    return `<div class="data-row" data-bias="${type}" role="row" tabindex="0"
         onclick="openModal('${sym}')" onkeypress="if(event.key==='Enter')openModal('${sym}')">
        <span class="symbol">${sym}${ofBadge}${brainBadge}</span>
        <span class="score-cell ${cls}">${pair.score ?? '—'}</span>
        <span class="price-cell">${fmtPrice(pair.price)}</span>
        <div class="actions-cell">
            <button class="row-btn" type="button"
                onclick="event.stopPropagation();addLocked('${sym}')">Lock</button>
        </div>
    </div>`;
}

// ─── Tracking Lists ────────────────────────────────────────
function renderTrackingLists() { renderLockedList(); renderJournalList(); }

function renderLockedList() {
    const html = S.locked.map(p => {
        const hCls = p.health === 'Strong' ? 'strong' : (p.health === 'At Risk' || p.health === 'Weak') ? 'risk' : '';
        const dCls = p.direction === 'LONG' ? 'text-long' : 'text-short';
        const sym  = escapeHTML(p.symbol);
        return `<div class="data-row" role="row" tabindex="0" onclick="openModal('${sym}')">
            <div><span class="symbol">${sym}</span>
                 <span class="micro-badge ${hCls}">${p.health || 'Calibrating'}</span></div>
            <span class="${dCls}">${p.direction||'—'}</span>
            <span class="score-cell">${p.currentScore ?? p.score ?? '—'}</span>
            <div class="actions-cell">
                <button class="row-btn btn-danger" type="button"
                    onclick="event.stopPropagation();removeLocked('${sym}')">Drop</button>
            </div>
        </div>`;
    }).join('') || `<div class="empty-state">${t('noLocked')}</div>`;
    Perf.diff('list-locked', html);
}

function renderJournalList() {
    let unrealPNL = 0, realPNL = 0, wins = 0, losses = 0, totalRisk = 0, totalReward = 0;
    const html = S.journal.map((j, i) => {
        const closed   = j.status === 'closed';
        const entry    = safeN(j.entry);
        const margin   = safeN(j.margin) || 100;
        const leverage = safeN(j.leverage) || 1;
        const live     = S.marketData.find(m => m.symbol === j.symbol);
        const curPrice = closed ? safeN(j.exitPrice ?? j.entry) : (live ? live.price : entry);
        const pct      = entry > 0 ? ((curPrice - entry) / entry) * 100 * leverage : 0;
        const finalPct = j.direction === 'LONG' ? pct : -pct;
        const dollar   = isFinite(finalPct) ? margin * (finalPct / 100) : 0;
        const sl = safeN(j.tradeStructure?.sl), tp = safeN(j.tradeStructure?.tp);
        if (entry && sl && tp) { totalRisk += Math.abs(entry-sl); totalReward += Math.abs(tp-entry); }
        if (closed) { realPNL += dollar; finalPct > 0 ? wins++ : losses++; }
        else unrealPNL += dollar;
        const pnlCls = finalPct >= 0 ? 'text-long' : 'text-short';
        const pnlStr = `${finalPct > 0?'+':''}${(isFinite(finalPct)?finalPct:0).toFixed(2)}%`;
        const dolStr = `${dollar>=0?'+':''}$${Math.abs(dollar).toFixed(2)}`;
        const sym    = escapeHTML(j.symbol);
        return `<div class="data-row" style="opacity:${closed?'0.52':'1'}">
            <span class="symbol">${sym}</span>
            <span class="${pnlCls}" title="${dolStr}">${pnlStr}</span>
            <span class="price-cell">×${leverage}</span>
            <div class="actions-cell">
                ${!closed
                    ? `<button class="row-btn" type="button" onclick="openJournalEdit(${i})">Edit</button>
                       <button class="row-btn" type="button" onclick="closeTrade(${i})">Close</button>`
                    : `<button class="row-btn btn-danger" type="button" onclick="removeJournal(${i})">Del</button>`}
            </div>
        </div>`;
    }).join('') || `<div class="empty-state">${t('noJournal')}</div>`;
    Perf.diff('list-journal', html);

    const totalPNL = realPNL + unrealPNL;
    const rrRatio  = totalRisk > 0 ? `1:${(totalReward/totalRisk).toFixed(2)}` : '—';
    const realEl   = document.getElementById('stat-realized');
    if (realEl)   { realEl.textContent = `$${realPNL.toFixed(2)}`; realEl.className = realPNL >= 0 ? 'text-long' : 'text-short'; }
    const unrealEl = document.getElementById('stat-unrealized');
    if (unrealEl) { unrealEl.textContent = `$${unrealPNL.toFixed(2)}`; unrealEl.className = unrealPNL >= 0 ? 'text-long' : 'text-short'; }
    setText('stat-wl', `${wins}/${losses}`);
    setText('stat-rr', rrRatio);
    const sideEl = document.getElementById('sidebar-total-pnl');
    if (sideEl) {
        sideEl.textContent = `${totalPNL >= 0?'+':''}$${totalPNL.toFixed(2)}`;
        sideEl.className = `value ${totalPNL >= 0 ? 'text-long' : 'text-short'}`;
    }
}

// ─── Research Mode ─────────────────────────────────────────
function renderResearchMode() {
    renderResearchRegime();
    renderTopSignals();
    renderBrainPanel();
    const te = document.getElementById('regime-update-time');
    if (te) te.textContent = `Live · ${new Date().toLocaleTimeString()}`;
}

function renderResearchRegime() {
    const container = document.getElementById('regime-detail-content');
    if (!container) return;
    try {
        const r  = API.getMarketRegime();
        const fc = r.fearGreed > 70 ? 'var(--short)' : r.fearGreed < 30 ? 'var(--long)' : 'var(--warn)';
        container.innerHTML = `
        <div class="regime-detail-row">
            <div style="flex:1">
                <div class="regime-detail-label">Fear &amp; Greed</div>
                <div class="regime-detail-bar"><div class="regime-detail-bar-fill" style="width:${r.fearGreed}%;background:${fc}"></div></div>
            </div>
            <div class="regime-detail-val" style="color:${fc};margin-left:12px">${r.fearGreed}</div>
        </div>
        <div class="regime-detail-row"><span class="regime-detail-label">BTC Dominance</span><span class="regime-detail-val">${r.btcDominance}%</span></div>
        <div class="regime-detail-row"><span class="regime-detail-label">DXY Index</span><span class="regime-detail-val">${r.dxy}</span></div>
        <div class="regime-detail-row"><span class="regime-detail-label">Moon Phase</span><span class="regime-detail-val">${r.moonPhase}</span></div>
        <div class="regime-detail-row">
            <span class="regime-detail-label">Regime Bias</span>
            <span class="regime-detail-val ${r.regimeBias >= 0 ? 'text-long' : 'text-short'}">${r.regimeBias >= 0 ? '▲ Bullish' : '▼ Bearish'}</span>
        </div>`;
    } catch(e) { console.warn('[QOS] researchRegime:', e.message); }
}

function renderTopSignals() {
    const container = document.getElementById('list-research');
    const countEl   = document.getElementById('count-research');
    if (!container) return;
    const top = [...S.analyzedPairs]
        .sort((a,b) => Math.abs(parseFloat(b.score)-5) - Math.abs(parseFloat(a.score)-5))
        .slice(0, 15);
    if (countEl) countEl.textContent = top.length;
    container.innerHTML = top.length
        ? top.map(p => rowHTML(p, p.direction === 'LONG' ? 'long' : 'short')).join('')
        : '<div class="empty-state">No data loaded yet.</div>';
}

// ─── Regime Sidebar ────────────────────────────────────────
function renderRegimeSidebar() {
    if (!el.regimeData) return;
    try {
        const r  = API.getMarketRegime();
        const fc = r.fearGreed > 70 ? 'text-short' : r.fearGreed < 30 ? 'text-long' : '';
        el.regimeData.innerHTML = `
        <div class="regime-item"><span class="regime-label" title="Fear & Greed">F&amp;G</span><span class="regime-val ${fc}">${r.fearGreed}</span></div>
        <div class="regime-item"><span class="regime-label" title="BTC Dominance">BTC.D</span><span class="regime-val">${r.btcDominance}%</span></div>
        <div class="regime-item"><span class="regime-label" title="DXY">DXY</span><span class="regime-val">${r.dxy}</span></div>
        <div class="regime-item"><span class="regime-label" title="Moon">Moon</span><span class="regime-val" style="font-size:0.7rem">${r.moonPhase}</span></div>`;
    } catch(e) { console.warn('[QOS] sidebar:', e.message); }
}

// ─── CRUD — with toast feedback ────────────────────────────
window.addLocked = function(symbol) {
    if (S.locked.find(l => l.symbol === symbol)) {
        showToast(`${symbol} already locked`, 'warn'); return;
    }
    const pair = findPair(symbol);
    if (!pair) return;
    S.locked.push({ ...pair, lockedAt: Date.now(), health: 'Neutral' });
    saveState(); renderTrackingLists();
    showToast(`${symbol} locked`, 'ok');
};
window.removeLocked = function(symbol) {
    S.locked = S.locked.filter(l => l.symbol !== symbol);
    saveState(); renderTrackingLists();
    showToast(`${symbol} removed`);
};
window.addJournal = function(symbol) {
    const pair = findPair(symbol);
    if (!pair || S.journal.some(j => j.symbol === symbol && j.status === 'open')) {
        showToast(`${symbol} already in journal`, 'warn'); return;
    }
    S.journal.unshift({
        symbol:         pair.symbol,
        direction:      pair.direction ?? 'LONG',
        entry:          pair.tradeStructure?.entry ?? String(pair.price ?? 0),
        leverage:       20, margin: 100,
        timestamp:      Date.now(), status: 'open', exitPrice: null,
        tradeStructure: pair.tradeStructure ?? {},
    });
    saveState(); renderTrackingLists();
    showToast(`${symbol} added to journal`, 'ok');
};
window.closeTrade = function(i) {
    const j = S.journal[i]; if (!j) return;
    const live = S.marketData.find(m => m.symbol === j.symbol);
    j.exitPrice = String(live ? live.price : safeN(j.entry));
    j.status    = 'closed';
    saveState(); renderTrackingLists();
    showToast(`${j.symbol} trade closed`);
};
window.removeJournal = function(i) {
    const sym = S.journal[i]?.symbol ?? '';
    S.journal.splice(i, 1);
    saveState(); renderTrackingLists();
    showToast(`${sym} entry deleted`);
};

function findPair(symbol) {
    return S.analyzedPairs.find(p => p.symbol === symbol)
        || S.locked.find(p => p.symbol === symbol)
        || null;
}
function saveState() {
    try {
        localStorage.setItem('quant_locked',  JSON.stringify(S.locked));
        localStorage.setItem('quant_journal', JSON.stringify(S.journal));
        localStorage.setItem('quant_user',    JSON.stringify(S.userProfile));
    } catch(e) { console.warn('[QOS] save:', e.message); }
}


// ─── Modal ─────────────────────────────────────────────────
window.openModal = function(symbol, isReanalyze = false, silent = false) {
    try {
        let pair = findPair(symbol);
        if (!pair) return;
        if (isReanalyze) {
            const live  = S.marketData.find(m => m.symbol === symbol);
            const fresh = API.simulateIndicators(pair.symbol,
                live ? live.price : pair.price, live ? live.change24h : pair.change24h, true);
            pair = { ...pair, ...fresh };
            const ai = S.analyzedPairs.findIndex(p => p.symbol === symbol);
            if (ai > -1) S.analyzedPairs[ai] = pair;
            const li = S.locked.findIndex(p => p.symbol === symbol);
            if (li > -1) S.locked[li] = { ...S.locked[li], currentScore: pair.score, biasHint: pair.biasHint };
        }
        S.activeModalPair = pair;
        setText('modal-symbol',    pair.symbol);
        setText('modal-bias-hint', pair.biasHint ?? 'System aligned.');
        const ts = pair.tradeStructure ?? {};
        setText('modal-entry', ts.entry ?? '—');
        setText('modal-sl',    ts.sl    ?? '—');
        setText('modal-tp',    ts.tp    ?? '—');
        setText('modal-rr',    calcRR(ts.entry, ts.sl, ts.tp));
        const dirEl = document.getElementById('modal-direction');
        if (dirEl) { dirEl.textContent = pair.direction||'—'; dirEl.className = `badge ${(pair.direction||'').toLowerCase()}`; }
        const scoreEl = document.getElementById('modal-score');
        if (scoreEl) { scoreEl.textContent = pair.score ?? '—'; scoreEl.className = `score-value ${pair.direction==='LONG'?'text-long':'text-short'}`; }
        if (el.quantCard) el.quantCard.setAttribute('data-bias', (pair.direction||'').toLowerCase());
        const pb = document.getElementById('modal-power-bar');
        if (pb) pb.style.width = `${ts.powerRatio ?? 50}%`;
        const lockRef  = S.locked.find(l => l.symbol === pair.symbol);
        const healthEl = document.getElementById('modal-health');
        if (healthEl) {
            if (lockRef?.health) {
                healthEl.textContent = `Health: ${lockRef.health}`;
                healthEl.className   = `health-badge ${lockRef.health==='Strong'?'text-long':lockRef.health==='At Risk'?'text-short':'text-warn'}`;
                healthEl.classList.remove('hidden');
            } else healthEl.classList.add('hidden');
        }
        const mtfEl = document.getElementById('modal-mtf');
        if (mtfEl && pair.mtf) {
            mtfEl.innerHTML = Object.entries(pair.mtf).map(([tf,bias]) =>
                `<li><span>${escapeHTML(tf)}</span>
                     <span class="${bias==='Bullish'?'text-long':bias==='Bearish'?'text-short':''}">${escapeHTML(bias)}</span></li>`
            ).join('');
        }
        const indEl = document.getElementById('modal-indicators');
        if (indEl && pair.indicators) {
            indEl.innerHTML = Object.entries(pair.indicators).map(([k,v]) =>
                `<li><span>${escapeHTML(k)}</span><span>${escapeHTML(String(v))}</span></li>`
            ).join('');
        }
        renderInsight(pair);
        renderBrain(pair);
        const of = pair.orderFlow || {};
        const setOF = (id, val, bull) => {
            const e = document.getElementById(id); if (!e) return;
            e.textContent = val ?? '—';
            e.className = `of-value${bull===true?' bull':bull===false?' bear':''}`;
        };
        setOF('of-delta',     of.delta,     of.ofScore > 0 ? true : of.ofScore < 0 ? false : null);
        setOF('of-cvd',       of.cvd,       of.cvd==='Rising' ? true : of.cvd==='Falling' ? false : null);
        setOF('of-imbalance', of.imbalance, parseFloat(of.imbalance) < 1 ? true : parseFloat(of.imbalance) > 1 ? false : null);
        setOF('of-footprint', of.footprint, of.bullish ?? null);
        const editBtn = document.getElementById('btn-edit-journal');
        if (editBtn) editBtn.style.display = S.journal.some(j => j.symbol === symbol && j.status === 'open') ? '' : 'none';
        if (!silent) { el.quantModal?.classList.remove('hidden'); el.quantCard?.focus(); }
    } catch(e) { console.error('[QOS] openModal:', e.message); }
};

function closeModal() { el.quantModal?.classList.add('hidden'); S.activeModalPair = null; }

function renderInsight(pair) {
    try {
        const ins = API.generateInsight(pair);
        const cvEl = document.getElementById('modal-conviction');
        const rvEl = document.getElementById('modal-riskenv');
        if (cvEl) { cvEl.textContent = ins.conviction; cvEl.className = `conviction-badge ${ins.conviction.toLowerCase()}`; }
        if (rvEl) { rvEl.textContent = ins.riskEnv;    rvEl.className = `riskenv-badge ${ins.riskEnv.replace(/\s/g,'').toLowerCase()}`; }
        setText('modal-insight-line',   ins.insightLine);
        setText('modal-insight-detail', ins.insightDetail);
    } catch(e) { console.warn('[QOS] insight:', e.message); }
}

function renderBrain(pair) {
    try {
        const b = pair.brain ?? Brain.analyze(pair, computeJournalStats());
        const badge = document.getElementById('brain-type-badge');
        if (badge) { badge.textContent = b.type; badge.className = `brain-type-badge ${b.type}`; }
        setText('brain-summary',  b.summary);
        setText('brain-stop',     b.stopStyle);
        setText('brain-tp-style', b.tpStyle);
        const hintsEl = document.getElementById('brain-hints');
        if (hintsEl) hintsEl.innerHTML = (b.hints ?? []).map(h => `<li>${escapeHTML(h)}</li>`).join('');
    } catch(e) { console.warn('[QOS] renderBrain:', e.message); }
}

function renderBrainPanel() {
    try {
        const session = Brain.sessionSummary(S.analyzedPairs, computeJournalStats());
        const tagEl   = document.getElementById('brain-regime-tag');
        if (tagEl) tagEl.textContent = session.regime;
        const focusEl = document.getElementById('brain-focus-list');
        if (focusEl) {
            focusEl.innerHTML = session.focuses.length
                ? session.focuses.map(p => rowHTML(p, p.direction === 'LONG' ? 'long' : 'short')).join('')
                : '<div class="empty-state" style="padding:8px">No high-conviction setups yet.</div>';
        }
        const avoidEl = document.getElementById('brain-avoid-list');
        if (avoidEl) {
            avoidEl.innerHTML = session.avoids.length
                ? session.avoids.map(p => rowHTML(p, p.direction === 'LONG' ? 'long' : 'short')).join('')
                : '<div class="empty-state" style="padding:8px">No avoid signals.</div>';
        }
    } catch(e) { console.warn('[QOS] renderBrainPanel:', e.message); }
}

// ─── Journal Edit Modal ────────────────────────────────────
let _editIdx = -1;
window.openJournalEdit = function(i) {
    const j = S.journal[i]; if (!j) return;
    _editIdx = i;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v ?? ''; };
    set('jedit-entry',    j.entry);
    set('jedit-sl',       j.tradeStructure?.sl  ?? '');
    set('jedit-tp',       j.tradeStructure?.tp  ?? '');
    set('jedit-leverage', j.leverage ?? 20);
    set('jedit-margin',   j.margin   ?? 100);
    set('jedit-notes',    j.notes    ?? '');
    updateRRPreview();
    el.journalEditModal?.classList.remove('hidden');
};
function closeJournalEdit() { el.journalEditModal?.classList.add('hidden'); _editIdx = -1; }
function saveJournalEdit() {
    if (_editIdx < 0) return;
    const j = S.journal[_editIdx]; if (!j) return;
    const get = id => { const e = document.getElementById(id); return e ? e.value : ''; };
    j.entry    = get('jedit-entry')    || j.entry;
    j.leverage = parseFloat(get('jedit-leverage')) || j.leverage || 20;
    j.margin   = parseFloat(get('jedit-margin'))   || j.margin   || 100;
    j.notes    = get('jedit-notes');
    if (!j.tradeStructure) j.tradeStructure = {};
    const sl = get('jedit-sl'); if (sl) j.tradeStructure.sl = sl;
    const tp = get('jedit-tp'); if (tp) j.tradeStructure.tp = tp;
    saveState(); renderTrackingLists(); closeJournalEdit();
    showToast(`${j.symbol} saved`, 'ok');
}
function updateRRPreview() {
    const previewEl = document.getElementById('jedit-rr-preview');
    if (!previewEl) return;
    const e  = document.getElementById('jedit-entry')?.value;
    const sl = document.getElementById('jedit-sl')?.value;
    const tp = document.getElementById('jedit-tp')?.value;
    previewEl.textContent = (e && sl && tp) ? `R:R = ${calcRR(e,sl,tp)}` : 'R:R — (fill entry, SL, TP)';
}

// ─── Search ────────────────────────────────────────────────
async function handleSearch(query) {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return;
    const local = S.analyzedPairs.filter(p => {
        const sym  = (p.symbol ?? '').toLowerCase();
        const name = (p.name   ?? '').toLowerCase();
        return sym.includes(q) || sym.replace('usdt','').includes(q) || name.includes(q);
    }).slice(0, 8);
    if (local.length) renderSearchResults(local);
    if (el.globalSearch) el.globalSearch.setAttribute('aria-expanded','true');
    try {
        const dex = await API.searchPairs(query);
        if (!dex.length && !local.length) {
            if (el.searchResults) {
                el.searchResults.innerHTML = `<div class="search-item text-muted">No pairs found.</div>`;
                el.searchResults.classList.remove('hidden');
            }
            return;
        }
        const enriched = dex.map(r => {
            try { return { ...r, ...API.simulateIndicators(r.symbol, r.price, r.change24h) }; } catch { return r; }
        });
        enriched.forEach(m => { if (!S.analyzedPairs.find(p => p.symbol === m.symbol)) S.analyzedPairs.push(m); });
        const seen = new Set(local.map(p => p.symbol));
        renderSearchResults([...local, ...enriched.filter(p => !seen.has(p.symbol))].slice(0, 10));
    } catch(err) {
        console.warn('[QOS] search DEX:', err.message);
        if (!local.length && el.searchResults) {
            el.searchResults.innerHTML = `<div class="search-item text-muted">Search unavailable.</div>`;
            el.searchResults.classList.remove('hidden');
        }
    }
}
function renderSearchResults(results) {
    if (!el.searchResults) return;
    el.searchResults.innerHTML = results.map(m => {
        const sym = escapeHTML(m.symbol);
        const cls = m.direction === 'LONG' ? 'text-long' : 'text-short';
        return `<div class="search-item" role="option" tabindex="0"
                onclick="openSearchModal('${sym}')" onkeypress="if(event.key==='Enter')openSearchModal('${sym}')">
            <span>${sym}</span>
            <span style="font-family:var(--font-mono);font-size:0.78rem">${fmtPrice(m.price)} <span class="${cls}">${escapeHTML(m.direction||'?')}</span></span>
        </div>`;
    }).join('');
    el.searchResults.classList.remove('hidden');
}
window.openSearchModal = function(symbol) {
    el.searchResults?.classList.add('hidden');
    if (el.globalSearch) { el.globalSearch.value = ''; el.globalSearch.setAttribute('aria-expanded','false'); }
    openModal(symbol);
};

// ─── Profile ───────────────────────────────────────────────
function updateUserProfileUI() {
    if (el.userName) el.userName.value = S.userProfile.name || 'Quant User';
    if (el.userAvatar) {
        if (S.userProfile.avatarBase64) {
            el.userAvatar.textContent = '';
            el.userAvatar.style.backgroundImage = `url(${S.userProfile.avatarBase64})`;
        } else {
            el.userAvatar.textContent = S.userProfile.avatar || 'Q';
            el.userAvatar.style.backgroundImage = '';
        }
    }
}

// ─── Event Binding ─────────────────────────────────────────
function bindEvents() {
    el.toggleSidebar?.addEventListener('click', toggleSidebar);
    el.sidebarFab?.addEventListener('click',    toggleSidebar);
    el.sidebarOverlay?.addEventListener('click', closeSidebar);
    el.userName?.addEventListener('change', e => {
        S.userProfile.name = e.target.value.trim() || 'Quant User'; saveState();
    });
    el.userAvatar?.addEventListener('click',    () => el.avatarUpload?.click());
    el.userAvatar?.addEventListener('keypress', e => { if (e.key === 'Enter') el.avatarUpload?.click(); });
    el.avatarUpload?.addEventListener('change', e => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload  = ev => { S.userProfile.avatarBase64 = ev.target.result; saveState(); updateUserProfileUI(); };
        reader.onerror = () => console.warn('[QOS] avatar failed');
        reader.readAsDataURL(file);
        e.target.value = '';
    });
    el.themeToggle?.addEventListener('click', toggleTheme);
    el.langToggle?.addEventListener('click',  toggleLang);
    document.querySelectorAll('.mode-btn,.mob-mode-btn').forEach(b =>
        b.addEventListener('click', () => setMode(b.dataset.mode)));
    document.querySelectorAll('.filter-btn').forEach(b =>
        b.addEventListener('click', () => {
            S.activeFilter = b.dataset.filter || 'all';
            document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            renderScanners();
        }));
    document.getElementById('close-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-reanalyze')?.addEventListener('click', () => {
        if (S.activeModalPair) openModal(S.activeModalPair.symbol, true);
    });
    document.getElementById('btn-lock')?.addEventListener('click', () => {
        if (S.activeModalPair) addLocked(S.activeModalPair.symbol);
    });
    document.getElementById('btn-journal')?.addEventListener('click', () => {
        if (S.activeModalPair) addJournal(S.activeModalPair.symbol);
    });
    document.getElementById('btn-edit-journal')?.addEventListener('click', () => {
        const sym = S.activeModalPair?.symbol; if (!sym) return;
        const idx = S.journal.findIndex(j => j.symbol === sym && j.status === 'open');
        if (idx > -1) openJournalEdit(idx);
    });
    el.quantModal?.addEventListener('click',       e => { if (e.target === el.quantModal) closeModal(); });
    el.journalEditModal?.addEventListener('click', e => { if (e.target === el.journalEditModal) closeJournalEdit(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeModal(); closeJournalEdit(); }
    });
    let searchTimer;
    el.globalSearch?.addEventListener('input', e => {
        clearTimeout(searchTimer);
        const q = e.target.value.trim();
        if (!q) { el.searchResults?.classList.add('hidden'); el.globalSearch.setAttribute('aria-expanded','false'); return; }
        searchTimer = setTimeout(() => handleSearch(q), 300);
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.search-container')) {
            el.searchResults?.classList.add('hidden');
            el.globalSearch?.setAttribute('aria-expanded','false');
        }
    });
    document.getElementById('jedit-close')?.addEventListener('click',  closeJournalEdit);
    document.getElementById('jedit-cancel')?.addEventListener('click', closeJournalEdit);
    document.getElementById('jedit-save')?.addEventListener('click',   saveJournalEdit);
    ['jedit-entry','jedit-sl','jedit-tp'].forEach(id =>
        document.getElementById(id)?.addEventListener('input', updateRRPreview));
}

// ─── Bootstrap ─────────────────────────────────────────────
cacheEls();
bindLogin();
