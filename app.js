/**
 * app.js — Quant OS Controller v2
 * All original features preserved + stabilized:
 *   - Workspace modes (Scan / Journal / Research)
 *   - Light/Dark auto-theme
 *   - Quick filters (Long / Short / All)
 *   - Research mode, Regime sidebar
 *   - Trading Journal + Locked Signals + PNL
 *   - Re-Analyze Engine + Multi-timeframe
 *   - Auto-refresh + background autonomous tick
 *   - Debounced search + DEX search merge
 *   - Mobile: sidebar overlay dismiss, mobile-mode-nav
 *   - Zero console errors, no UI freeze
 */

'use strict';

// ─── Helpers ───────────────────────────────────────────────
function safeParseJSON(str, fallback) {
    try { return str ? JSON.parse(str) : fallback; }
    catch { return fallback; }
}

function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(text ?? '');
}
function setClass(id, cls) {
    const el = document.getElementById(id);
    if (el) el.className = cls;
}
function setCount(id, n) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(n);
}
function safePrice(p) {
    const n = parseFloat(p);
    return isFinite(n) ? n : 0;
}
function fmtPrice(p) {
    const n = safePrice(p);
    return `$${n.toFixed(n >= 10 ? 2 : 4)}`;
}

// ─── App State ─────────────────────────────────────────────
const AppState = {
    marketData:      [],
    analyzedPairs:   [],
    journal:         safeParseJSON(localStorage.getItem('quant_journal'), []),
    locked:          safeParseJSON(localStorage.getItem('quant_locked'),  []),
    userProfile:     safeParseJSON(localStorage.getItem('quant_user'), {
                         name: 'Quant User', avatar: 'Q', avatarBase64: null
                     }),
    activeModalPair: null,
    currentMode:     'scan',
    activeFilter:    'all',
    dataStatus:      'ok',
    lastRefresh:     null,
    isFetching:      false,   // prevent race conditions
    timers: { master: null, autonomous: null, regime: null },
};

// ─── DOM Cache ─────────────────────────────────────────────
const els = {};
function cacheEls() {
    const ids = [
        'login-btn','login-password','login-error','login-gate','app-container',
        'sidebar','sidebar-overlay','toggle-sidebar',
        'avatar-upload','user-avatar','user-name',
        'quant-modal','global-search','search-results',
        'status-data','status-refresh','status-mode','status-pairs',
        'footer-mode','footer-refresh','footer-status',
        'theme-toggle','regime-data',
    ];
    ids.forEach(id => {
        const key = id.replace(/-([a-z])/g, (_,c) => c.toUpperCase());
        els[key] = document.getElementById(id);
    });
    els.quantCard = document.querySelector('.quant-card');
}

// ─── Login ─────────────────────────────────────────────────
function bindLogin() {
    const doLogin = () => {
        if (els.loginPassword.value === 'kitabisa') {
            els.loginGate.classList.add('hidden');
            els.appContainer.classList.remove('hidden');
            initTerminal();
        } else {
            els.loginError.classList.remove('hidden');
            els.loginPassword.value = '';
            els.loginPassword.focus();
        }
    };
    els.loginBtn.addEventListener('click', doLogin);
    els.loginPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
}

// ─── Init ──────────────────────────────────────────────────
async function initTerminal() {
    applyThemePreference();
    bindEvents();
    updateUserProfileUI();
    renderRegimeSidebar();
    setMode('scan');

    await fetchAndProcessMarketData();
    renderTrackingLists();

    // Timers (non-blocking intervals)
    AppState.timers.master     = setInterval(fetchAndProcessMarketData, 15 * 60 * 1000);
    AppState.timers.autonomous = setInterval(runAutonomousEngine,       60 * 1000);
    AppState.timers.regime     = setInterval(() => {
        renderRegimeSidebar();
        if (AppState.currentMode === 'research') renderResearchRegime();
    }, 5 * 60 * 1000);
}

// ─── Theme ─────────────────────────────────────────────────
function applyThemePreference() {
    const saved = localStorage.getItem('quant_theme');
    const theme = saved || ((new Date().getHours() >= 20 || new Date().getHours() < 7) ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon();
    // Sync meta theme-color
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.content = theme === 'dark' ? '#0b0e14' : '#f0f2f7';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('quant_theme', next);
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.content = next === 'dark' ? '#0b0e14' : '#f0f2f7';
    updateThemeIcon();
}

function updateThemeIcon() {
    if (!els.themeToggle) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    els.themeToggle.textContent = isDark ? '☀' : '◑';
    els.themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

// ─── Workspace Mode ────────────────────────────────────────
function setMode(mode) {
    AppState.currentMode = mode;
    document.documentElement.setAttribute('data-mode', mode);

    document.querySelectorAll('.mode-panels').forEach(el => {
        el.classList.toggle('hidden', el.dataset.forMode !== mode);
    });
    // Desktop mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        const active = btn.dataset.mode === mode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active);
    });
    // Mobile mode buttons
    document.querySelectorAll('.mob-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const label = mode.charAt(0).toUpperCase() + mode.slice(1);
    setText('status-mode', label);
    setText('footer-mode', label.toUpperCase());

    if (mode === 'research') renderResearchMode();
}

// ─── Sidebar ───────────────────────────────────────────────
function openSidebar() {
    els.sidebar.classList.remove('collapsed');
    if (els.sidebarOverlay) {
        els.sidebarOverlay.classList.remove('hidden');
        if (els.toggleSidebar) els.toggleSidebar.setAttribute('aria-expanded', 'true');
    }
}
function closeSidebar() {
    els.sidebar.classList.add('collapsed');
    if (els.sidebarOverlay) {
        els.sidebarOverlay.classList.add('hidden');
        if (els.toggleSidebar) els.toggleSidebar.setAttribute('aria-expanded', 'false');
    }
}
function toggleSidebar() {
    if (els.sidebar.classList.contains('collapsed')) openSidebar();
    else closeSidebar();
}

// ─── Data Fetching ─────────────────────────────────────────
async function fetchAndProcessMarketData() {
    if (AppState.isFetching) return; // prevent race
    AppState.isFetching = true;
    setDataStatus('ok', 'Fetching…');

    try {
        const rawData = await API.fetchMarketData();
        if (!Array.isArray(rawData) || rawData.length === 0) throw new Error('Empty dataset');

        AppState.marketData  = rawData;
        AppState.lastRefresh = new Date();

        // Analyze all pairs (fail-safe per pair)
        AppState.analyzedPairs = rawData.map(pair => {
            try {
                const analysis = API.simulateIndicators(pair.symbol, pair.price, pair.change24h);
                return { ...pair, ...analysis };
            } catch (e) {
                console.warn(`[QOS] indicator fail for ${pair.symbol}:`, e.message);
                return { ...pair, ...API._emptyIndicators() };
            }
        });

        setDataStatus('ok', 'Data: OK');
        updateRefreshTime();
        updateStatusPairs();
        renderScanners();
        if (AppState.currentMode === 'research') renderResearchMode();
    } catch (err) {
        console.error('[QOS] fetchAndProcessMarketData:', err.message);
        setDataStatus('warn', 'Data: Degraded');
        if (AppState.analyzedPairs.length > 0) renderScanners(); // use stale
    } finally {
        AppState.isFetching = false;
    }
}

// ─── Autonomous Engine (background, non-blocking) ──────────
async function runAutonomousEngine() {
    try {
        const rawData = await API.fetchMarketData();
        if (!Array.isArray(rawData) || rawData.length === 0) return;

        AppState.marketData = rawData;

        // Re-analyze locked signals
        AppState.locked = AppState.locked.map(signal => {
            try {
                const live = rawData.find(d => d.symbol === signal.symbol);
                if (!live) return signal;
                const fresh  = API.simulateIndicators(signal.symbol, live.price, live.change24h, true);
                const health = computeSignalHealth(signal, live.price, fresh.score);
                return { ...signal, currentPrice: live.price, currentScore: fresh.score, health, biasHint: fresh.biasHint };
            } catch (e) {
                console.warn('[QOS] locked re-analyze:', e.message);
                return signal;
            }
        });

        // Silent modal update
        if (AppState.activeModalPair && !els.quantModal.classList.contains('hidden')) {
            openModal(AppState.activeModalPair.symbol, true, true);
        }

        saveState();
        renderTrackingLists();
        const lockedTime = document.getElementById('locked-update-time');
        if (lockedTime) lockedTime.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        updateRefreshTime();
        setDataStatus('ok', 'Data: OK');
    } catch (err) {
        console.warn('[QOS] autonomous tick (non-fatal):', err.message);
        setDataStatus('warn', 'Data: Stale');
    }
}

// ─── Status Helpers ────────────────────────────────────────
function setDataStatus(level, text) {
    AppState.dataStatus = level;
    if (els.statusData) { els.statusData.textContent = text; els.statusData.className = level; }
    if (els.footerStatus) els.footerStatus.textContent = level.toUpperCase();
    const dot = document.querySelector('#status-bar .pulse-dot');
    if (dot) dot.className = `pulse-dot${level !== 'ok' ? ' ' + level : ''}`;
}

function updateRefreshTime() {
    const t = AppState.lastRefresh;
    if (!t) return;
    const str = t.toLocaleTimeString();
    if (els.statusRefresh) els.statusRefresh.textContent = `Refresh: ${str}`;
    if (els.footerRefresh) els.footerRefresh.textContent = str;
}

function updateStatusPairs() {
    const longs  = AppState.analyzedPairs.filter(p => parseFloat(p.score) > 7).length;
    const shorts = AppState.analyzedPairs.filter(p => parseFloat(p.score) < 4).length;
    setText('status-pairs', `Pairs: ${AppState.analyzedPairs.length} · ↑${longs} ↓${shorts}`);
}

// ─── Signal Health ─────────────────────────────────────────
function computeSignalHealth(signal, currentPrice, newScore) {
    try {
        const entry    = safePrice(signal?.tradeStructure?.entry ?? signal?.entry);
        const sl       = safePrice(signal?.tradeStructure?.sl);
        const scoreNum = safePrice(newScore);
        if (entry === 0) return 'Neutral';

        const distToSL = sl > 0 ? Math.abs(currentPrice - sl) / entry : 1;
        if (distToSL < 0.005) return 'At Risk';

        const isLong = signal.direction === 'LONG';
        if (isLong) {
            if (scoreNum > 7 && currentPrice > entry) return 'Strong';
            if (scoreNum < 4) return 'Weak';
        } else {
            if (scoreNum < 4 && currentPrice < entry) return 'Strong';
            if (scoreNum > 7) return 'Weak';
        }
    } catch (e) {
        console.warn('[QOS] computeSignalHealth:', e.message);
    }
    return 'Neutral';
}

// ─── Scanners ──────────────────────────────────────────────
function renderScanners() {
    const filter = AppState.activeFilter;
    let longs  = AppState.analyzedPairs.filter(p => parseFloat(p.score) > 7)
                     .sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
    let shorts = AppState.analyzedPairs.filter(p => parseFloat(p.score) < 4)
                     .sort((a, b) => parseFloat(a.score) - parseFloat(b.score));

    if (filter === 'long')  shorts = [];
    if (filter === 'short') longs  = [];

    setCount('count-longs',  longs.length);
    setCount('count-shorts', shorts.length);

    setHTML('list-longs',  longs.map(p  => rowHTML(p, 'long')).join('')
        || '<div class="empty-state">No long setups match current filters.</div>');
    setHTML('list-shorts', shorts.map(p => rowHTML(p, 'short')).join('')
        || '<div class="empty-state">No short setups match current filters.</div>');
}

function rowHTML(pair, type) {
    const cls  = type === 'long' ? 'text-long' : 'text-short';
    const sym  = escapeHTML(pair.symbol);
    const px   = fmtPrice(pair.price);
    return `
    <div class="data-row" onclick="openModal('${sym}')" role="row" tabindex="0"
         onkeypress="if(event.key==='Enter')openModal('${sym}')">
        <span class="symbol">${sym}</span>
        <span class="score-cell ${cls}">${pair.score ?? '—'}</span>
        <span class="price-cell">${px}</span>
        <div class="actions-cell">
            <button class="row-btn" type="button"
                    onclick="event.stopPropagation();addLocked('${sym}')"
                    title="Lock signal">Lock</button>
        </div>
    </div>`;
}

// ─── Tracking Lists ────────────────────────────────────────
function renderTrackingLists() {
    renderLockedList();
    renderJournalList();
}

function renderLockedList() {
    const html = AppState.locked.map(p => {
        const hCls  = p.health === 'Strong' ? 'strong' : (p.health === 'At Risk' || p.health === 'Weak') ? 'risk' : '';
        const dCls  = p.direction === 'LONG' ? 'text-long' : 'text-short';
        const sym   = escapeHTML(p.symbol);
        return `
        <div class="data-row" onclick="openModal('${sym}')" role="row" tabindex="0">
            <div><span class="symbol">${sym}</span>
                 <span class="micro-badge ${hCls}">${p.health || 'Calibrating'}</span></div>
            <span class="${dCls}">${p.direction || '—'}</span>
            <span class="score-cell">${p.currentScore ?? p.score ?? '—'}</span>
            <div class="actions-cell">
                <button class="row-btn btn-danger" type="button"
                        onclick="event.stopPropagation();removeLocked('${sym}')"
                        title="Remove signal">Drop</button>
            </div>
        </div>`;
    }).join('') || '<div class="empty-state">No locked signals yet.</div>';
    setHTML('list-locked', html);
}

function renderJournalList() {
    let unrealPNL = 0, realPNL = 0, wins = 0, losses = 0;

    const html = AppState.journal.map((j, i) => {
        const isClosed   = j.status === 'closed';
        const entryPrice = safePrice(j.entry);
        const liveData   = AppState.marketData.find(m => m.symbol === j.symbol);
        const curPrice   = isClosed
            ? safePrice(j.exitPrice ?? j.entry)
            : (liveData ? liveData.price : entryPrice);

        const diff     = curPrice - entryPrice;
        const leverage = j.leverage ?? 1;
        const pct      = entryPrice > 0 ? (diff / entryPrice) * 100 * leverage : 0;
        const finalPct = j.direction === 'LONG' ? pct : -pct;
        const dollar   = isFinite(finalPct) ? 100 * (finalPct / 100) : 0;

        if (isClosed) { realPNL += dollar; finalPct > 0 ? wins++ : losses++; }
        else           { unrealPNL += dollar; }

        const pnlCls = finalPct >= 0 ? 'text-long' : 'text-short';
        const sym    = escapeHTML(j.symbol);
        const pnlStr = `${finalPct > 0 ? '+' : ''}${(isFinite(finalPct) ? finalPct : 0).toFixed(2)}%`;

        return `
        <div class="data-row" style="opacity:${isClosed ? '0.55' : '1'}">
            <span class="symbol">${sym}</span>
            <span class="${pnlCls}">${pnlStr}</span>
            <span class="price-cell">×${leverage}</span>
            <div class="actions-cell">
                ${!isClosed
                    ? `<button class="row-btn" type="button" onclick="closeTrade(${i})" title="Mark closed">Close</button>`
                    : `<button class="row-btn btn-danger" type="button" onclick="removeJournal(${i})" title="Delete entry">Del</button>`
                }
            </div>
        </div>`;
    }).join('') || '<div class="empty-state">No journal entries yet.</div>';

    setHTML('list-journal', html);

    const totalPNL = realPNL + unrealPNL;

    setText('stat-realized',    `$${realPNL.toFixed(2)}`);
    setClass('stat-realized',   realPNL   >= 0 ? 'text-long' : 'text-short');
    setText('stat-unrealized',  `$${unrealPNL.toFixed(2)}`);
    setClass('stat-unrealized', unrealPNL  >= 0 ? 'text-long' : 'text-short');
    setText('stat-wl', `${wins}/${losses}`);

    const sideEl = document.getElementById('sidebar-total-pnl');
    if (sideEl) {
        sideEl.textContent = `${totalPNL >= 0 ? '+' : ''}$${totalPNL.toFixed(2)}`;
        sideEl.className   = `value ${totalPNL >= 0 ? 'text-long' : 'text-short'}`;
    }
}

// ─── Research Mode ─────────────────────────────────────────
function renderResearchMode() {
    renderResearchRegime();
    renderTopSignals();
    const t = document.getElementById('regime-update-time');
    if (t) t.textContent = `Live · ${new Date().toLocaleTimeString()}`;
}

function renderResearchRegime() {
    const el = document.getElementById('regime-detail-content');
    if (!el) return;
    try {
        const r = API.getMarketRegime();
        const fearColor = r.fearGreed > 70 ? 'var(--short)' : r.fearGreed < 30 ? 'var(--long)' : 'var(--warn)';
        el.innerHTML = `
        <div class="regime-detail-row">
            <div>
                <div class="regime-detail-label">Fear &amp; Greed Index</div>
                <div class="regime-detail-bar">
                    <div class="regime-detail-bar-fill" style="width:${r.fearGreed}%;background:${fearColor}"></div>
                </div>
            </div>
            <div class="regime-detail-val" style="color:${fearColor}">${r.fearGreed}</div>
        </div>
        <div class="regime-detail-row">
            <span class="regime-detail-label">BTC Dominance</span>
            <span class="regime-detail-val">${r.btcDominance}%</span>
        </div>
        <div class="regime-detail-row">
            <span class="regime-detail-label">DXY Index</span>
            <span class="regime-detail-val">${r.dxy}</span>
        </div>
        <div class="regime-detail-row">
            <span class="regime-detail-label">Moon Phase</span>
            <span class="regime-detail-val">${r.moonPhase}</span>
        </div>
        <div class="regime-detail-row">
            <span class="regime-detail-label">Regime Bias</span>
            <span class="regime-detail-val ${r.regimeBias >= 0 ? 'text-long' : 'text-short'}">
                ${r.regimeBias >= 0 ? '▲ Bullish' : '▼ Bearish'}
            </span>
        </div>`;
    } catch (e) { console.warn('[QOS] renderResearchRegime:', e.message); }
}

function renderTopSignals() {
    const el = document.getElementById('list-research');
    const countEl = document.getElementById('count-research');
    if (!el) return;

    const top = [...AppState.analyzedPairs]
        .sort((a, b) => Math.abs(parseFloat(b.score) - 5) - Math.abs(parseFloat(a.score) - 5))
        .slice(0, 15);

    if (countEl) countEl.textContent = top.length;

    el.innerHTML = top.length > 0
        ? top.map(p => rowHTML(p, p.direction === 'LONG' ? 'long' : 'short')).join('')
        : '<div class="empty-state">No data loaded yet.</div>';
}

// ─── Regime Sidebar ────────────────────────────────────────
function renderRegimeSidebar() {
    if (!els.regimeData) return;
    try {
        const r = API.getMarketRegime();
        const fgCls = r.fearGreed > 70 ? 'text-short' : r.fearGreed < 30 ? 'text-long' : '';
        els.regimeData.innerHTML = `
        <div class="regime-item">
            <span class="regime-label" title="Fear & Greed">F&amp;G</span>
            <span class="regime-val ${fgCls}">${r.fearGreed}</span>
        </div>
        <div class="regime-item">
            <span class="regime-label" title="BTC Dominance">BTC.D</span>
            <span class="regime-val">${r.btcDominance}%</span>
        </div>
        <div class="regime-item">
            <span class="regime-label" title="DXY Index">DXY</span>
            <span class="regime-val">${r.dxy}</span>
        </div>
        <div class="regime-item">
            <span class="regime-label" title="Moon Phase">Phase</span>
            <span class="regime-val">${r.moonPhase}</span>
        </div>`;
    } catch (e) { console.warn('[QOS] renderRegimeSidebar:', e.message); }
}

// ─── CRUD ──────────────────────────────────────────────────
window.addLocked = function(symbol) {
    if (AppState.locked.find(l => l.symbol === symbol)) return;
    const pair = findPair(symbol);
    if (!pair) return;
    AppState.locked.push({ ...pair, lockedAt: Date.now(), health: 'Neutral' });
    saveState();
    renderTrackingLists();
};

window.removeLocked = function(symbol) {
    AppState.locked = AppState.locked.filter(l => l.symbol !== symbol);
    saveState();
    renderTrackingLists();
};

window.addJournal = function(symbol) {
    const pair = findPair(symbol);
    if (!pair) return;
    // Prevent exact duplicate open trades
    const isDupe = AppState.journal.some(j => j.symbol === symbol && j.status === 'open');
    if (isDupe) return;
    AppState.journal.unshift({
        symbol:    pair.symbol,
        direction: pair.direction ?? 'LONG',
        entry:     pair.tradeStructure?.entry ?? String(pair.price ?? 0),
        leverage:  20,
        timestamp: Date.now(),
        status:    'open',
        exitPrice: null,
    });
    saveState();
    renderTrackingLists();
};

window.closeTrade = function(index) {
    const trade = AppState.journal[index];
    if (!trade) return;
    const live      = AppState.marketData.find(m => m.symbol === trade.symbol);
    trade.exitPrice = String(live ? live.price : safePrice(trade.entry));
    trade.status    = 'closed';
    saveState();
    renderTrackingLists();
};

window.removeJournal = function(index) {
    AppState.journal.splice(index, 1);
    saveState();
    renderTrackingLists();
};

function findPair(symbol) {
    return AppState.analyzedPairs.find(p => p.symbol === symbol)
        || AppState.locked.find(p => p.symbol === symbol)
        || null;
}

function saveState() {
    try {
        localStorage.setItem('quant_locked',  JSON.stringify(AppState.locked));
        localStorage.setItem('quant_journal', JSON.stringify(AppState.journal));
        localStorage.setItem('quant_user',    JSON.stringify(AppState.userProfile));
    } catch (e) { console.warn('[QOS] saveState (storage full?):', e.message); }
}

// ─── Modal Engine ──────────────────────────────────────────
window.openModal = function(symbol, isReanalyze = false, silent = false) {
    try {
        let pair = findPair(symbol);
        if (!pair) return;

        if (isReanalyze) {
            const live   = AppState.marketData.find(m => m.symbol === symbol);
            const price  = live ? live.price   : pair.price;
            const change = live ? live.change24h : pair.change24h;
            const fresh  = API.simulateIndicators(pair.symbol, price, change, true);
            pair         = { ...pair, ...fresh };

            const aIdx = AppState.analyzedPairs.findIndex(p => p.symbol === symbol);
            if (aIdx > -1) AppState.analyzedPairs[aIdx] = pair;
            const lIdx = AppState.locked.findIndex(p => p.symbol === symbol);
            if (lIdx > -1) {
                AppState.locked[lIdx] = {
                    ...AppState.locked[lIdx],
                    currentScore: pair.score,
                    biasHint:     pair.biasHint,
                };
            }
        }

        AppState.activeModalPair = pair;

        // Populate DOM
        setText('modal-symbol',    pair.symbol);
        setText('modal-score',     pair.score ?? '—');
        setText('modal-bias-hint', pair.biasHint ?? 'System aligned.');
        setText('modal-entry',     pair.tradeStructure?.entry ?? '—');
        setText('modal-sl',        pair.tradeStructure?.sl    ?? '—');
        setText('modal-tp',        pair.tradeStructure?.tp    ?? '—');

        const dirEl = document.getElementById('modal-direction');
        if (dirEl) {
            dirEl.textContent = pair.direction || '—';
            dirEl.className   = `badge ${(pair.direction || '').toLowerCase()}`;
        }

        const scoreEl = document.getElementById('modal-score');
        if (scoreEl) scoreEl.className = `score-value ${pair.direction === 'LONG' ? 'text-long' : 'text-short'}`;

        if (els.quantCard) {
            els.quantCard.setAttribute('data-bias', (pair.direction || '').toLowerCase());
        }

        const powerBar = document.getElementById('modal-power-bar');
        if (powerBar) powerBar.style.width = `${pair.tradeStructure?.powerRatio ?? 50}%`;

        // Health badge
        const lockRef  = AppState.locked.find(l => l.symbol === pair.symbol);
        const healthEl = document.getElementById('modal-health');
        if (healthEl) {
            if (lockRef?.health) {
                healthEl.textContent = `Health: ${lockRef.health}`;
                healthEl.className   = `health-badge ${
                    lockRef.health === 'Strong'  ? 'text-long'  :
                    lockRef.health === 'At Risk' ? 'text-short' : 'text-warn'
                }`;
                healthEl.classList.remove('hidden');
            } else {
                healthEl.classList.add('hidden');
            }
        }

        // MTF list
        const mtfEl = document.getElementById('modal-mtf');
        if (mtfEl && pair.mtf) {
            mtfEl.innerHTML = Object.entries(pair.mtf).map(([tf, bias]) =>
                `<li><span>${escapeHTML(tf)}</span>
                     <span class="${bias === 'Bullish' ? 'text-long' : bias === 'Bearish' ? 'text-short' : ''}">${escapeHTML(bias)}</span></li>`
            ).join('');
        }

        // Indicators list
        const indEl = document.getElementById('modal-indicators');
        if (indEl && pair.indicators) {
            indEl.innerHTML = Object.entries(pair.indicators).map(([k, v]) =>
                `<li><span>${escapeHTML(k.toUpperCase())}</span><span>${escapeHTML(String(v))}</span></li>`
            ).join('');
        }

        if (!silent) {
            els.quantModal.classList.remove('hidden');
            els.quantCard?.focus();
        }
    } catch (e) { console.error('[QOS] openModal:', e.message); }
};

function closeModal() {
    if (els.quantModal) els.quantModal.classList.add('hidden');
    AppState.activeModalPair = null;
}

// ─── Bind Events ───────────────────────────────────────────
function bindEvents() {
    // Sidebar toggle
    if (els.toggleSidebar) els.toggleSidebar.addEventListener('click', toggleSidebar);
    // Overlay closes sidebar on mobile
    if (els.sidebarOverlay) els.sidebarOverlay.addEventListener('click', closeSidebar);

    // User name
    if (els.userName) {
        els.userName.addEventListener('change', (e) => {
            AppState.userProfile.name = e.target.value.trim() || 'Quant User';
            saveState();
        });
    }

    // Avatar
    if (els.userAvatar) {
        els.userAvatar.addEventListener('click', () => els.avatarUpload?.click());
        els.userAvatar.addEventListener('keypress', (e) => { if (e.key === 'Enter') els.avatarUpload?.click(); });
    }
    if (els.avatarUpload) {
        els.avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                AppState.userProfile.avatarBase64 = ev.target.result;
                saveState();
                updateUserProfileUI();
            };
            reader.onerror = () => console.warn('[QOS] Avatar read failed');
            reader.readAsDataURL(file);
            // Reset so same file can be selected again
            e.target.value = '';
        });
    }

    // Theme toggle
    if (els.themeToggle) els.themeToggle.addEventListener('click', toggleTheme);

    // Desktop mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Mobile mode buttons
    document.querySelectorAll('.mob-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            AppState.activeFilter = btn.dataset.filter || 'all';
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderScanners();
        });
    });

    // Modal buttons
    const closeBtn     = document.getElementById('close-modal');
    const reanalyzeBtn = document.getElementById('btn-reanalyze');
    const lockBtn      = document.getElementById('btn-lock');
    const journalBtn   = document.getElementById('btn-journal');

    if (closeBtn)     closeBtn.addEventListener('click', closeModal);
    if (reanalyzeBtn) reanalyzeBtn.addEventListener('click', () => {
        if (AppState.activeModalPair) openModal(AppState.activeModalPair.symbol, true);
    });
    if (lockBtn)      lockBtn.addEventListener('click', () => {
        if (AppState.activeModalPair) addLocked(AppState.activeModalPair.symbol);
    });
    if (journalBtn)   journalBtn.addEventListener('click', () => {
        if (AppState.activeModalPair) addJournal(AppState.activeModalPair.symbol);
    });

    // Modal close on overlay click and Escape
    if (els.quantModal) {
        els.quantModal.addEventListener('click', (e) => { if (e.target === els.quantModal) closeModal(); });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // Search (debounced 300ms)
    if (els.globalSearch) {
        let searchTimer;
        els.globalSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            const query = e.target.value.trim();
            if (!query) { els.searchResults.classList.add('hidden'); return; }
            searchTimer = setTimeout(() => handleSearch(query), 300);
        });
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                els.searchResults.classList.add('hidden');
            }
        });
    }
}

// ─── Search ────────────────────────────────────────────────
async function handleSearch(query) {
    const q = query.toUpperCase();

    // First: match locally (instant)
    const local = AppState.analyzedPairs.filter(p =>
        p.symbol.includes(q) || p.symbol.replace('USDT', '').includes(q)
    ).slice(0, 8);

    if (local.length > 0) {
        renderSearchResults(local);
    }

    // Then: DEX search for low-cap / unlisted
    try {
        const dex = await API.searchPairs(query);
        if (dex.length === 0 && local.length === 0) {
            els.searchResults.innerHTML = '<div class="search-item text-muted">No pairs found.</div>';
            els.searchResults.classList.remove('hidden');
            return;
        }
        // Analyze DEX results and merge
        const enriched = dex.map(r => {
            try {
                return { ...r, ...API.simulateIndicators(r.symbol, r.price, r.change24h) };
            } catch { return r; }
        });
        enriched.forEach(m => {
            if (!AppState.analyzedPairs.find(p => p.symbol === m.symbol)) {
                AppState.analyzedPairs.push(m);
            }
        });
        // Combine: local first, then DEX extras
        const seen    = new Set(local.map(p => p.symbol));
        const allRes  = [...local, ...enriched.filter(p => !seen.has(p.symbol))].slice(0, 10);
        renderSearchResults(allRes);
    } catch (err) {
        console.warn('[QOS] handleSearch DEX:', err.message);
        if (local.length === 0) {
            els.searchResults.innerHTML = '<div class="search-item text-muted">Search unavailable.</div>';
            els.searchResults.classList.remove('hidden');
        }
    }
}

function renderSearchResults(results) {
    if (!els.searchResults) return;
    els.searchResults.innerHTML = results.map(m => {
        const sym    = escapeHTML(m.symbol);
        const dirCls = m.direction === 'LONG' ? 'text-long' : 'text-short';
        const px     = fmtPrice(m.price);
        return `<div class="search-item" onclick="openSearchModal('${sym}')" role="option" tabindex="0">
            ${sym} — ${px}
            <span class="${dirCls}">[${escapeHTML(m.direction || '?')}]</span>
        </div>`;
    }).join('');
    els.searchResults.classList.remove('hidden');
}

window.openSearchModal = function(symbol) {
    if (els.searchResults) els.searchResults.classList.add('hidden');
    if (els.globalSearch)  els.globalSearch.value = '';
    openModal(symbol);
};

// ─── Profile UI ────────────────────────────────────────────
function updateUserProfileUI() {
    if (els.userName) els.userName.value = AppState.userProfile.name || 'Quant User';
    if (els.userAvatar) {
        if (AppState.userProfile.avatarBase64) {
            els.userAvatar.textContent = '';
            els.userAvatar.style.backgroundImage = `url(${AppState.userProfile.avatarBase64})`;
        } else {
            els.userAvatar.textContent = AppState.userProfile.avatar || 'Q';
            els.userAvatar.style.backgroundImage = '';
        }
    }
}

// ─── Bootstrap ─────────────────────────────────────────────
cacheEls();
bindLogin();
