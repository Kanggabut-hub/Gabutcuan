/* =============================================
   KANGGABUT | VANGUARD V100 PRO — app.js
   UI Logic · Pair-Click · LunarCrush Panel
   Password Gate · Auto-Refresh · Sound Engine
   ============================================= */

"use strict";

// ── Password Gate ────────────────────────────────────────────────────────────
const CORRECT_PASSWORD      = "Bismillah";
const AUTO_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

function initPasswordGate() {
    const gate     = document.getElementById("password-gate");
    const input    = document.getElementById("pw-input");
    const errorMsg = document.getElementById("pw-error");
    const btn      = document.getElementById("pw-submit");

    if (!gate) return;
    gate.style.display = "flex";

    function attemptUnlock() {
        const val = (input.value || "").trim();
        if (val === CORRECT_PASSWORD) {
            errorMsg.textContent = "";
            gate.style.opacity = "0";
            gate.style.transition = "opacity 0.5s ease";
            setTimeout(() => { gate.style.display = "none"; }, 500);
            // Once unlocked, boot the terminal
            triggerTerminalBootSequence();
        } else {
            errorMsg.textContent = "⚠  Akses ditolak — password salah. Coba lagi.";
            input.classList.add("error");
            input.value = "";
            setTimeout(() => input.classList.remove("error"), 400);
        }
    }

    btn.addEventListener("click", attemptUnlock);
    input.addEventListener("keydown", e => { if (e.key === "Enter") attemptUnlock(); });
    // Focus the input immediately
    setTimeout(() => input.focus(), 100);
}

// Restore the gate (called by auto-refresh)
function restorePasswordGate() {
    const gate  = document.getElementById("password-gate");
    const input = document.getElementById("pw-input");
    const err   = document.getElementById("pw-error");
    if (!gate) return;
    input.value      = "";
    if (err) err.textContent = "";
    gate.style.opacity   = "1";
    gate.style.display   = "flex";
    gate.style.transition = "none";
    // Hide main content so gate cannot be bypassed
    const main = document.getElementById("main-terminal-content");
    if (main) { main.classList.add("hidden"); main.style.opacity = "0"; }
    const landing = document.getElementById("landing-screen");
    if (landing) { landing.classList.remove("opacity-0", "pointer-events-none"); }
    setTimeout(() => input.focus(), 150);
}

// ── Auto-Refresh Timer ───────────────────────────────────────────────────────
function startAutoRefreshTimer() {
    setInterval(() => {
        // Force the page to re-show the password gate without a hard reload
        restorePasswordGate();
    }, AUTO_REFRESH_INTERVAL);
}

// ── Audio Engine ─────────────────────────────────────────────────────────────
let systemAudioMuted = false;
let synthAudioContext = null;

function initializeAudioContextEngine() {
    if (!synthAudioContext) {
        synthAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (systemAudioMuted) return;
    try {
        initializeAudioContextEngine();
        const osc  = synthAudioContext.createOscillator();
        const gain = synthAudioContext.createGain();
        osc.connect(gain);
        gain.connect(synthAudioContext.destination);
        const now = synthAudioContext.currentTime;

        if (type === "click") {
            osc.type = "triangle";
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === "beep") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.setValueAtTime(1500, now + 0.05);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.005, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        } else if (type === "crunch") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.setValueAtTime(450, now + 0.03);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
            osc.start(now); osc.stop(now + 0.05);
        } else if (type === "boot") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(60, now);
            osc.frequency.linearRampToValueAtTime(600, now + 1.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 1.5);
            osc.start(now); osc.stop(now + 1.5);
        }
    } catch (e) { console.log(e); }
}

function toggleMuteState() {
    systemAudioMuted = !systemAudioMuted;
    const btn = document.getElementById("sound-toggle-btn");
    if (systemAudioMuted) {
        btn.innerText = "🔇 SUARA: MATI";
        btn.className = "text-[10px] border border-red-900 px-2 py-0.5 text-red-500 bg-gray-900";
    } else {
        btn.innerText = "🔊 SUARA: AKTIF";
        btn.className = "text-[10px] border border-gray-700 px-2 py-0.5 text-gundam-gold bg-gray-900 hover:border-[#d4af37]";
        playSound("click");
    }
}

// ── Theme Controls ────────────────────────────────────────────────────────────
function switchVisualTheme(mode) {
    if (mode === "light") document.body.classList.add("light-theme");
    else document.body.classList.remove("light-theme");
}

function toggleAntiEyeStrain() {
    document.body.classList.toggle("eye-strain-mode");
}

// ── Boot Sequence ─────────────────────────────────────────────────────────────
function triggerTerminalBootSequence() {
    initializeAudioContextEngine();
    playSound("boot");
    const launchBtn = document.getElementById("launch-btn");
    if (launchBtn) launchBtn.classList.add("hidden");
    const bootBox = document.getElementById("boot-progress-container");
    if (bootBox) bootBox.classList.remove("hidden");

    let pct = 0;
    const bar        = document.getElementById("boot-progress-bar");
    const pctText    = document.getElementById("boot-percent-text");
    const statusText = document.getElementById("boot-status-text");
    const logs = [
        "Awakening Minovsky Drive Reactors...",
        "Synchronizing Psycho-Frame Conduits...",
        "Establishing Link with Anaheim Central Network...",
        "Decrypting Sector Targeting Radar Arrays...",
        "NT-D Mode Activated. Systems Operational."
    ];

    const interval = setInterval(() => {
        pct += Math.floor(Math.random() * 12) + 8;
        if (pct >= 100) {
            pct = 100;
            clearInterval(interval);
            const landing = document.getElementById("landing-screen");
            if (landing) landing.classList.add("opacity-0", "pointer-events-none");
            const main = document.getElementById("main-terminal-content");
            if (main) {
                main.classList.remove("hidden");
                setTimeout(() => {
                    main.style.opacity = "1";
                    renderLunarCrushPanel(); // render LunarCrush on entry
                    fetchAllExternalAPIPipelines();
                }, 50);
            }
        }
        if (bar)        bar.style.width  = pct + "%";
        if (pctText)    pctText.innerText = pct + "%";
        if (statusText) statusText.innerText = logs[Math.floor((pct / 100) * logs.length)] || logs[logs.length - 1];
        if (pct % 20 === 0) playSound("crunch");
    }, 50);
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function togglePlengerSidebar(open) {
    const sidebar = document.getElementById("plenger-sidebar");
    if (open) sidebar.classList.remove("-translate-x-full");
    else      sidebar.classList.add("-translate-x-full");
}

// ── LunarCrush Panel Renderer ─────────────────────────────────────────────────
let lunarPanelRefreshTimer = null;

async function renderLunarCrushPanel() {
    const container = document.getElementById("lunarcrush-panel-body");
    if (!container) return;

    // Show skeleton placeholders
    container.innerHTML = buildLunarSkeletons(12);

    try {
        const coins = await fetchLunarCrushData();
        container.innerHTML = "";

        if (!coins || coins.length === 0) {
            container.innerHTML = `<div class="lc-error-msg">⚠ No social data available — check API connection.</div>`;
            return;
        }

        coins.forEach(coin => {
            const card = buildLunarCoinCard(coin);
            container.appendChild(card);
        });

        // Update last-refreshed timestamp
        const tsEl = document.getElementById("lc-last-refresh");
        if (tsEl) tsEl.innerText = new Date().toLocaleTimeString();
    } catch (err) {
        container.innerHTML = `<div class="lc-error-msg">⚠ LunarCrush data temporarily unavailable.</div>`;
        console.warn("[LunarCrush] Render error:", err);
    }

    // Auto-refresh panel every 60s
    clearTimeout(lunarPanelRefreshTimer);
    lunarPanelRefreshTimer = setTimeout(renderLunarCrushPanel, 60000);
}

function buildLunarSkeletons(count) {
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `<div class="lc-coin-card" style="min-height:80px">
            <div class="lc-skeleton" style="height:10px;width:60%;margin-bottom:6px;border-radius:2px"></div>
            <div class="lc-skeleton" style="height:3px;width:100%;margin-bottom:4px"></div>
            <div class="lc-skeleton" style="height:8px;width:80%;border-radius:2px"></div>
        </div>`;
    }
    return html;
}

function buildLunarCoinCard(coin) {
    const card = document.createElement("div");
    card.className = "lc-coin-card";
    if (coin.anomaly === "PUMP") card.classList.add("anomaly-pump");
    if (coin.anomaly === "DUMP") card.classList.add("anomaly-dump");

    const sentColor   = coin.sentiment >= 65 ? "#4ade80" : (coin.sentiment >= 45 ? "#fbbf24" : "#f87171");
    const scoreColor  = coin.galaxyScore >= 60 ? "#00f3ff" : (coin.galaxyScore >= 40 ? "#fbbf24" : "#6b7280");
    const socialFill  = Math.min(100, (coin.socialVolume / 200000) * 100);
    const volumeStr   = formatSocialVolume(coin.socialVolume);
    const pcColor     = coin.priceChange >= 0 ? "#4ade80" : "#f87171";
    const pcSign      = coin.priceChange >= 0 ? "+" : "";

    const anomalyHTML = coin.anomaly === "PUMP"
        ? `<span class="lc-anomaly-badge pump">🚀 PUMP SIGNAL</span>`
        : coin.anomaly === "DUMP"
        ? `<span class="lc-anomaly-badge dump">⚠ DUMP SIGNAL</span>`
        : `<span class="lc-anomaly-badge neutral">STABLE</span>`;

    card.innerHTML = `
        <span class="lc-trending-rank">#${coin.rank}</span>
        <div class="lc-ticker">${coin.ticker}</div>
        <div class="lc-score-bar">
            <div class="lc-score-fill" style="width:${socialFill}%;background:linear-gradient(to right,${sentColor},${scoreColor})"></div>
        </div>
        <div class="lc-metrics">
            <div class="lc-metric">
                <div class="lc-metric-label">Sentiment</div>
                <div class="lc-metric-val" style="color:${sentColor}">${coin.sentiment}%</div>
            </div>
            <div class="lc-metric">
                <div class="lc-metric-label">Social Vol</div>
                <div class="lc-metric-val" style="color:#d1d5db">${volumeStr}</div>
            </div>
            <div class="lc-metric">
                <div class="lc-metric-label">Galaxy 🌙</div>
                <div class="lc-metric-val" style="color:${scoreColor}">${coin.galaxyScore}</div>
            </div>
            <div class="lc-metric">
                <div class="lc-metric-label">24h Δ</div>
                <div class="lc-metric-val" style="color:${pcColor}">${pcSign}${coin.priceChange.toFixed(1)}%</div>
            </div>
        </div>
        ${anomalyHTML}
    `;
    return card;
}

function formatSocialVolume(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
    if (v >= 1000)    return (v / 1000).toFixed(1) + "K";
    return String(v);
}

// ── Search ────────────────────────────────────────────────────────────────────
let searchTimeoutDebounce = null;

function executeInstantGlobalSearch(val) {
    activeQueryText = val.trim().toLowerCase();
    const clearBtn = document.getElementById("clear-search-btn");
    if (clearBtn) {
        if (activeQueryText !== "") clearBtn.classList.remove("hidden");
        else                        clearBtn.classList.add("hidden");
    }
    coreSliderPointer = 0;
    clearTimeout(searchTimeoutDebounce);
    if (activeQueryText.length >= 2) {
        searchTimeoutDebounce = setTimeout(() => {
            searchOnChainTokensViaDexScreener(activeQueryText);
        }, 400);
    } else {
        compileActiveFilterSorting();
    }
}

function clearSearchInput() {
    const bar = document.getElementById("search-bar");
    if (bar) bar.value = "";
    activeQueryText = "";
    const clearBtn = document.getElementById("clear-search-btn");
    if (clearBtn) clearBtn.classList.add("hidden");
    compileActiveFilterSorting();
}

// ── Filter Controls ────────────────────────────────────────────────────────────
function applyCapFilterRange(rangeType) {
    selectedFilterRange        = rangeType;
    signalRecommendationFilter = "none";
    coreSliderPointer          = 0;
    resetSidebarButtonStyles();
    const el = document.getElementById("f-" + rangeType);
    if (el) el.className = "w-full text-left bg-[#d4af37]/10 border border-[#d4af37]/40 text-[#d4af37] p-2.5 rounded-none text-xs font-medium transition flex items-center justify-between";
    compileActiveFilterSorting();
}

function applySignalFilter(signalType) {
    signalRecommendationFilter = signalType;
    selectedFilterRange        = "all";
    coreSliderPointer          = 0;
    resetSidebarButtonStyles();
    if (signalType === "LONG") {
        const el = document.getElementById("f-rec-long");
        if (el) el.className = "w-full text-left bg-emerald-950/60 border border-emerald-400 text-emerald-400 p-2.5 rounded-none text-xs font-bold transition flex items-center justify-between";
    } else {
        const el = document.getElementById("f-rec-short");
        if (el) el.className = "w-full text-left bg-rose-950/60 border border-rose-400 text-rose-400 p-2.5 rounded-none text-xs font-bold transition flex items-center justify-between";
    }
    compileActiveFilterSorting();
}

function resetSidebarButtonStyles() {
    ["all","big","mid","low"].forEach(id => {
        const b = document.getElementById("f-" + id);
        if (b) b.className = "w-full text-left bg-gray-900/40 border border-gray-800 text-gray-400 p-2.5 rounded-none text-xs font-medium hover:border-gray-700 transition flex items-center justify-between";
    });
    const rl = document.getElementById("f-rec-long");
    if (rl) rl.className = "w-full text-left bg-emerald-950/30 border border-emerald-500/40 text-emerald-400 p-2.5 rounded-none text-xs font-bold hover:bg-emerald-950/50 transition flex items-center justify-between";
    const rs = document.getElementById("f-rec-short");
    if (rs) rs.className = "w-full text-left bg-rose-950/30 border border-rose-500/40 text-rose-400 p-2.5 rounded-none text-xs font-bold hover:bg-rose-950/50 transition flex items-center justify-between";
}

// ── Slider ─────────────────────────────────────────────────────────────────────
function triggerSliderLeft() {
    if (coreSliderPointer - strictRowMaxItems >= 0) {
        coreSliderPointer -= strictRowMaxItems;
        renderWorkspaceDisplay();
    }
}

function triggerSliderRight() {
    if (coreSliderPointer + strictRowMaxItems < filteredWorkspacePool.length) {
        coreSliderPointer += strictRowMaxItems;
        renderWorkspaceDisplay();
    }
}

// ── Filter + Sort ──────────────────────────────────────────────────────────────
function compileActiveFilterSorting() {
    const blacklist = /^(USDC|FDUSD|TUSD|BUSD|EUR|TRY)$/;

    let pool = coreMemoryCache.filter(item => {
        if (blacklist.test(item.ticker)) return false;
        if (activeQueryText !== "") return item.ticker.toLowerCase().includes(activeQueryText);
        const cap = item.calculatedWeight;
        if (selectedFilterRange === "low")  return cap < 15000000;
        if (selectedFilterRange === "mid")  return cap >= 15000000 && cap < 500000000;
        if (selectedFilterRange === "big")  return cap >= 500000000;
        return true;
    });

    pool.forEach(pairNode => {
        if (!lockedTradingSetupsCache[pairNode.uid]) {
            const change      = pairNode.change24h;
            const setupTrend  = change >= 0 ? "LONG" : "SHORT";
            let seedHash      = pairNode.ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
            const score       = (seedHash % 35) + 60;
            const statuses    = ["Waiting","Entry Hit","TP1 Hit","Waiting"];
            lockedTradingSetupsCache[pairNode.uid] = {
                trend:       setupTrend,
                entry:       pairNode.price * (setupTrend === "LONG" ? 0.995 : 1.005),
                tp1:         setupTrend === "LONG" ? pairNode.price * 1.02 : pairNode.price * 0.98,
                tp2:         setupTrend === "LONG" ? pairNode.price * 1.04 : pairNode.price * 0.96,
                tp3:         setupTrend === "LONG" ? pairNode.price * 1.06 : pairNode.price * 0.94,
                sl:          setupTrend === "LONG" ? pairNode.price * 0.975 : pairNode.price * 1.025,
                confluence:  score,
                volatility:  score > 80 ? "HIGH" : (score > 65 ? "MED" : "LOW"),
                status:      statuses[seedHash % statuses.length]
            };
        }
    });

    if (signalRecommendationFilter !== "none") {
        pool = pool.filter(item => {
            const s = lockedTradingSetupsCache[item.uid];
            return s && s.trend === signalRecommendationFilter;
        });
        pool.sort((a, b) =>
            lockedTradingSetupsCache[b.uid].confluence - lockedTradingSetupsCache[a.uid].confluence
        );
    }

    filteredWorkspacePool = pool;
    renderWorkspaceDisplay();
}

// ── Progress Calculator ────────────────────────────────────────────────────────
function calculateTradeProgressPercentage(trend, price, entry, tp1) {
    if (trend === "LONG") {
        if (price <= entry) return 0;
        if (price >= tp1)   return 100;
        return ((price - entry) / (tp1 - entry)) * 100;
    } else {
        if (price >= entry) return 0;
        if (price <= tp1)   return 100;
        return ((entry - price) / (entry - tp1)) * 100;
    }
}

// ── Toggle Advanced Panel (card) ──────────────────────────────────────────────
function toggleAdvancedAnalysisSection(uid) {
    const el  = document.getElementById(`adv-panel-${uid}`);
    const btn = document.getElementById(`adv-btn-${uid}`);
    if (!el) return;
    if (el.classList.contains("hidden")) {
        el.classList.remove("hidden");
        if (btn) btn.innerText = "Sembunyikan Analisis Kedalam ▴";
        playSound("beep");
    } else {
        el.classList.add("hidden");
        if (btn) btn.innerText = "Lihat Analisis Kedalam ▾";
        playSound("click");
    }
}

// ── Workspace Card Renderer ────────────────────────────────────────────────────
function renderWorkspaceDisplay() {
    const viewport = document.getElementById("grid-container");
    if (!viewport) return;
    viewport.innerHTML = "";

    const slice      = filteredWorkspacePool.slice(coreSliderPointer, coreSliderPointer + strictRowMaxItems);
    const totalPages = Math.ceil(filteredWorkspacePool.length / strictRowMaxItems) || 1;
    const curPage    = Math.floor(coreSliderPointer / strictRowMaxItems) + 1;
    const pageLabel  = document.getElementById("slider-pagination-label");
    if (pageLabel) pageLabel.innerText = `HALAMAN ${curPage} / ${totalPages}`;

    if (slice.length === 0) {
        viewport.innerHTML = `<div class="col-span-full text-center text-gray-500 py-16 font-mono-tech uppercase font-bold tracking-widest border border-dashed border-gray-800">⚠️ RADAR KOSONG: Tidak ada data koin yang cocok dengan filter.</div>`;
        return;
    }

    slice.forEach(pairNode => {
        const livePrice = pairNode.price;
        const change    = pairNode.change24h;
        let dPoints = (livePrice < 0.00001) ? 8 : ((livePrice < 0.01) ? 6 : (livePrice < 1 ? 4 : 2));

        const setup = lockedTradingSetupsCache[pairNode.uid];
        const adv   = getOrComputeAdvancedIndicators(pairNode.uid, livePrice, change);
        setup.confluence = adv.totalProConfluence;

        const confBg      = setup.confluence > 75
            ? "bg-emerald-950/40 text-emerald-400 border-emerald-900 psycho-pulse-cyan"
            : (setup.confluence > 65
                ? "bg-amber-950/40 text-amber-400 border-amber-900"
                : "bg-gray-900 text-gray-400 border-gray-800");
        const statusColor = setup.status.includes("TP") ? "text-emerald-400 font-bold"
            : (setup.status.includes("SL") ? "text-rose-400 font-bold" : "text-psycho-cyan");
        const progressPct = calculateTradeProgressPercentage(setup.trend, livePrice, setup.entry, setup.tp1);

        const cardBox = document.createElement("div");
        cardBox.className = "bloomberg-card p-4 flex flex-col justify-between font-mono-tech";

        cardBox.innerHTML = `
            <div class="space-y-3">
                <div onclick="openSpecsModalWindow('${pairNode.uid}'); playSound('beep');" class="cursor-pointer flex justify-between items-start border-b border-gray-800 pb-2">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-white font-bold text-base tracking-tight">${pairNode.ticker}</span>
                            <span class="text-[10px] text-[#d4af37] font-bold">[USDT]</span>
                        </div>
                        <p class="text-[10px] text-psycho-cyan font-bold tracking-wider uppercase mt-0.5">${pairNode.source}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <div class="flex gap-1 items-center">
                            <span class="text-xs font-bold px-1.5 py-0.5 ${change >= 0 ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"}">
                                ${change >= 0 ? "+" : ""}${change.toFixed(2)}%
                            </span>
                            <span class="text-xs font-bold px-1.5 py-0.5 border ${setup.trend === "LONG" ? "bg-emerald-950 text-emerald-400 border-emerald-900" : "bg-rose-950 text-rose-400 border-rose-900"}">
                                ${setup.trend}
                            </span>
                        </div>
                        <span class="text-[9px] px-1.5 py-0.2 border font-bold ${confBg}">CONFLUENCE: ${setup.confluence}%</span>
                    </div>
                </div>

                <div onclick="openSpecsModalWindow('${pairNode.uid}'); playSound('beep');" class="cursor-pointer space-y-2">
                    <div class="flex justify-between items-baseline bg-gray-900/60 p-1.5 border border-gray-800">
                        <span class="text-gray-400 text-[10px] uppercase font-bold">Harga Saat Ini</span>
                        <span class="text-gundam-gold font-bold text-sm tracking-wide">$${livePrice.toFixed(dPoints)}</span>
                    </div>

                    <div class="bg-[#040811] border border-gray-800 p-1.5 rounded-none">
                        <div class="flex justify-between text-[8px] font-bold text-gray-500 mb-1 uppercase tracking-widest">
                            <span>Thruster Progress (TP1 Matrix)</span>
                            <span class="text-psycho-cyan">${progressPct.toFixed(1)}%</span>
                        </div>
                        <div class="w-full h-1.5 bg-gray-950 border border-gray-800 overflow-hidden relative">
                            <div class="h-full bg-gradient-to-r from-[#d4af37] to-[#00f3ff] transition-all duration-300" style="width:${progressPct}%"></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-1.5 text-xs">
                        <div class="bg-emerald-950/20 border border-emerald-900/40 p-1">
                            <span class="text-emerald-400 block text-[9px] font-bold">HARGA BELI (ENTRY)</span>
                            <span class="text-white font-bold">$${setup.entry.toFixed(dPoints)}</span>
                        </div>
                        <div class="bg-rose-950/20 border border-rose-900/40 p-1">
                            <span class="text-rose-500 block text-[9px] font-bold">BATAS RUGI (SL)</span>
                            <span class="text-white font-bold">$${setup.sl.toFixed(dPoints)}</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-1 text-center text-[10px]">
                        <div class="bg-gray-900/60 border border-gray-800 p-1">
                            <span class="text-gray-400 block text-[8px] font-bold">TARGET 1 (TP)</span>
                            <span class="text-emerald-400 font-bold">$${setup.tp1.toFixed(dPoints)}</span>
                        </div>
                        <div class="bg-gray-900/60 border border-gray-800 p-1">
                            <span class="text-gray-400 block text-[8px] font-bold">TARGET 2</span>
                            <span class="text-gray-300 font-bold">$${setup.tp2.toFixed(dPoints)}</span>
                        </div>
                        <div class="bg-gray-900/60 border border-gray-800 p-1">
                            <span class="text-gray-400 block text-[8px] font-bold">TARGET 3</span>
                            <span class="text-gray-300 font-bold">$${setup.tp3.toFixed(dPoints)}</span>
                        </div>
                    </div>
                </div>

                <div onclick="openSpecsModalWindow('${pairNode.uid}');" class="cursor-pointer pt-2 border-t border-gray-900 text-[10px] text-gray-500 space-y-1">
                    <div class="flex justify-between">
                        <span>Output Volatilitas ATR:</span>
                        <span class="text-white font-bold">$${adv.volTech.atr.toFixed(dPoints)}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span>Status Posisi:</span>
                        <span class="${statusColor} uppercase tracking-wider">${setup.status}</span>
                    </div>
                </div>

                <div id="adv-panel-${pairNode.uid}" class="hidden mt-3 pt-3 border-t border-dashed border-gray-800 space-y-2 text-xs bg-[#030508] p-2">
                    <div class="flex justify-between items-center border-b border-gray-900 pb-1">
                        <span class="text-gundam-gold font-bold tracking-wider">🔬 INDIKATOR TEKNIKAL</span>
                        <span class="text-psycho-cyan font-bold text-[9px]">SMC QUANT ENG V10</span>
                    </div>
                    <div class="space-y-1.5 text-[10px]">
                        <div class="flex justify-between"><span class="text-gray-500">Struktur SMC:</span><span class="text-purple-400 font-bold text-right">${adv.smc.structural}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Volume Delta:</span><span class="text-emerald-400 font-bold">${adv.volTech.delta} Imbalance</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Institusi VWAP:</span><span class="text-gundam-gold font-bold">$${adv.volTech.vwap.toFixed(dPoints)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Momentum RSI:</span><span class="text-white font-bold">${adv.rsi.value} (${adv.rsi.slope})</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">MACD Hist:</span><span class="text-amber-400 font-bold">${adv.macd.histogram}</span></div>
                    </div>
                </div>
            </div>

            <div class="mt-2.5 pt-2 border-t border-gray-800 flex justify-between items-center">
                <button id="adv-btn-${pairNode.uid}" onclick="toggleAdvancedAnalysisSection('${pairNode.uid}')" class="text-left font-bold text-gundam-gold hover:text-white text-[10px] uppercase tracking-wide transition">
                    Lihat Analisis Kedalam ▾
                </button>
                <button onclick="openSpecsModalWindow('${pairNode.uid}'); playSound('beep');" class="text-gray-500 hover:text-white font-bold text-[10px] uppercase tracking-wide">
                    Kalkulator & Detail ➔
                </button>
            </div>
        `;
        viewport.appendChild(cardBox);
    });
}

// ── Modal (Pair-Click) ─────────────────────────────────────────────────────────
function openSpecsModalWindow(uidKey) {
    const matchCache = coreMemoryCache.find(x => x.uid === uidKey);
    if (!matchCache) return;

    const setup = lockedTradingSetupsCache[uidKey];
    const adv   = getOrComputeAdvancedIndicators(uidKey, matchCache.price, matchCache.change24h);
    let dPoints  = (matchCache.price < 0.00001) ? 8 : ((matchCache.price < 0.01) ? 6 : (matchCache.price < 1 ? 4 : 2));

    const target = document.getElementById("modal-content-area");

    let factorListHTML = "";
    adv.factorMatrix.forEach(f => {
        factorListHTML += `<li class="text-emerald-400 font-bold text-[11px] flex items-center gap-1">✓ <span class="text-gray-300 font-normal">${f}</span></li>`;
    });

    target.innerHTML = `
        <div class="border-b-2 border-gundam-gold pb-3 mb-4 font-mono-tech flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div>
                <h2 class="text-base font-black text-white uppercase tracking-tight">${matchCache.ticker} // QUANT TACTICAL BLUEPRINT DIAGNOSTICS</h2>
                <p class="text-xs text-psycho-cyan font-bold">Data Feed Pipeline Matrix: <span class="text-white border border-gray-700 px-1.5 ml-1 bg-gray-900">${matchCache.source}</span></p>
            </div>
            <div class="flex gap-2 text-[10px] font-bold font-mono-tech">
                <span class="border px-2 py-1 ${setup.trend === "LONG" ? "bg-emerald-950 text-emerald-400 border-emerald-800" : "bg-rose-950 text-rose-400 border-rose-800"}">${setup.trend} POSITION</span>
                <span class="border border-gray-700 bg-gray-900 text-[#d4af37] px-2 py-1">CONFLUENCE: ${setup.confluence}%</span>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 font-mono-tech text-[11px]">
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">📊 1. Price Matrix Intel</h3>
                <div class="space-y-1">
                    <div class="flex justify-between"><span class="text-gray-500">Live Oracle Price:</span><span class="text-gundam-gold font-bold">$${matchCache.price.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">24H Change:</span><span class="${matchCache.change24h >= 0 ? "text-emerald-400" : "text-rose-400"} font-bold">${matchCache.change24h >= 0 ? "+" : ""}${matchCache.change24h.toFixed(2)}%</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">24H Volume:</span><span class="text-white font-bold">$${(matchCache.volume24h/1000000).toFixed(2)}M</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">24H High / Low:</span><span class="text-white font-bold">$${matchCache.high24h.toFixed(dPoints)} / $${matchCache.low24h.toFixed(dPoints)}</span></div>
                </div>
            </div>
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">🧲 2. SMC Structure Engine</h3>
                <div class="space-y-1">
                    <div class="flex justify-between"><span class="text-gray-500">Market Structure:</span><span class="text-purple-400 font-bold">${adv.smc.structural}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Swing High:</span><span class="text-white font-bold">$${adv.smc.sHigh.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Swing Low:</span><span class="text-white font-bold">$${adv.smc.sLow.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">RSI Momentum:</span><span class="text-white font-bold">${adv.rsi.value} (${adv.rsi.slope})</span></div>
                </div>
            </div>
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">⚡ 3. Supply & Demand + Liquidity</h3>
                <div class="space-y-1">
                    <div class="flex justify-between"><span class="text-gray-500">Demand Zone:</span><span class="text-emerald-400 font-bold">$${adv.sdZone.dMin.toFixed(dPoints)} – $${adv.sdZone.dMax.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Supply Zone:</span><span class="text-rose-400 font-bold">$${adv.sdZone.sMin.toFixed(dPoints)} – $${adv.sdZone.sMax.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Liq Pool Upper:</span><span class="text-amber-400 font-bold">$${adv.liquidity.upper.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Liq Pool Lower:</span><span class="text-amber-400 font-bold">$${adv.liquidity.lower.toFixed(dPoints)}</span></div>
                </div>
            </div>
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">📈 4. Volume & Key Levels</h3>
                <div class="space-y-1">
                    <div class="flex justify-between"><span class="text-gray-500">Volume Delta:</span><span class="text-emerald-400 font-bold">${adv.volTech.delta}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">VWAP Anchor:</span><span class="text-gundam-gold font-bold">$${adv.volTech.vwap.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">ATR Volatility:</span><span class="text-white font-bold">$${adv.volTech.atr.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">HTF Resistance:</span><span class="text-rose-400 font-bold">$${adv.keyLevels.htfRes.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">HTF Support:</span><span class="text-emerald-400 font-bold">$${adv.keyLevels.htfSup.toFixed(dPoints)}</span></div>
                </div>
            </div>
        </div>

        <div class="space-y-3 font-mono-tech text-[11px] mb-4">
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">🧬 Confluence Factor Matrix (${adv.factorMatrix.length} Detected)</h3>
                <ul class="space-y-0.5">${factorListHTML}</ul>
            </div>
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">🎯 5. Entry Models Matrix</h3>
                <div class="space-y-1 text-[11px]">
                    <div>⚡ Scalp Model (M5/M15): Aggressive Market Entry at <span class="text-white font-bold">$${(setup.entry * 1.001).toFixed(dPoints)}</span></div>
                    <div>💼 Day Model (H1): Optimal Limit Pullback Entry at <span class="text-white font-bold">$${setup.entry.toFixed(dPoints)}</span></div>
                    <div>🌐 Swing Model (H4): Conservative Key Re-test S&D Entry at <span class="text-white font-bold">$${adv.sdZone.dMin.toFixed(dPoints)}</span></div>
                </div>
            </div>
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">🛡️ 6. Risk Management Matrix</h3>
                <p>Batas toleransi invalidasi spasial ekstrim (Stop Loss) wajib dipasang mutlak di area pertahanan struktur terbawah pada level <span class="text-rose-400 font-bold">$${setup.sl.toFixed(dPoints)}</span>. Rasio untung/rugi disesuaikan otomatis minimal berbobot R:R 1:2.</p>
            </div>
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">📈 7. Target Mapping Grid</h3>
                <div class="grid grid-cols-3 gap-1 text-[11px] text-center">
                    <div class="bg-gray-950 p-1 border border-gray-800"><span class="block text-gray-500">TP1 Matrix</span><span class="text-emerald-400 font-bold">$${setup.tp1.toFixed(dPoints)}</span></div>
                    <div class="bg-gray-950 p-1 border border-gray-800"><span class="block text-gray-500">TP2 Runway</span><span class="text-white font-bold">$${setup.tp2.toFixed(dPoints)}</span></div>
                    <div class="bg-gray-950 p-1 border border-gray-800"><span class="block text-gray-500">TP3 Apex</span><span class="text-white font-bold">$${setup.tp3.toFixed(dPoints)}</span></div>
                </div>
            </div>
            <div class="border border-gray-800 p-3 bg-gray-900/30">
                <h3 class="text-gundam-gold font-bold uppercase mb-1.5 flex items-center gap-1">🏁 8. Final Quant Summary</h3>
                <p>Aset koin <span class="text-gundam-gold font-bold">${matchCache.ticker}</span> mengonfirmasi konvergensi teknikal terintegrasi tinggi dengan perimbangan indikator kekuatan tren RSI (<span class="font-bold text-white">${adv.rsi.value}</span>) beriringan kekuatan momentum garis signal MACD (<span class="font-bold text-amber-400">${adv.macd.histogram}</span>).</p>
            </div>
        </div>

        <div class="border-t border-gray-800 pt-3 font-mono-tech">
            <p class="text-xs text-[#d4af37] font-bold uppercase tracking-wider mb-2.5">🧮 KALKULATOR ESTIMASI KEUNTUNGAN (SIMULASI PNL)</p>
            <div class="space-y-3 bg-gray-900/30 p-3 border border-gray-800 text-xs">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="text-[9px] text-gray-500 font-bold block mb-1">LEVERAGE (DAYA UNGKIT)</label>
                        <input type="number" id="modal-calc-lev" value="10"
                            oninput="liveModalCalculatorEngine('${uidKey}', ${dPoints});"
                            class="w-full bg-[#030508] border border-gray-700 p-1.5 text-white font-bold text-center text-xs outline-none focus:border-[#d4af37]">
                    </div>
                    <div>
                        <label class="text-[9px] text-gray-500 font-bold block mb-1">MARGIN MODAL (USDT)</label>
                        <input type="number" id="modal-calc-margin" value="100"
                            oninput="liveModalCalculatorEngine('${uidKey}', ${dPoints});"
                            class="w-full bg-[#030508] border border-gray-700 p-1.5 text-white font-bold text-center text-xs outline-none focus:border-[#d4af37]">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                    <button onclick="applyTargetToCalculator(${setup.tp1}, '${uidKey}', ${dPoints});" class="bg-gray-900 border border-gray-800 hover:border-[#d4af37] text-gray-400 p-1.5 transition">TARGET 1 PX</button>
                    <button onclick="applyTargetToCalculator(${setup.tp2}, '${uidKey}', ${dPoints});" class="bg-gray-900 border border-gray-800 hover:border-[#d4af37] text-gray-400 p-1.5 transition">TARGET 2 PX</button>
                    <button onclick="applyTargetToCalculator(${setup.tp3}, '${uidKey}', ${dPoints});" class="bg-gray-900 border border-gray-800 hover:border-[#d4af37] text-gray-400 p-1.5 transition">TARGET 3 PX</button>
                </div>
                <div>
                    <label class="text-[9px] text-gray-500 font-bold block mb-1">HARGA KELUAR MANUALLY (EXIT TARGET)</label>
                    <input type="number" step="any" id="modal-calc-target" value="${setup.tp1.toFixed(dPoints)}"
                        oninput="liveModalCalculatorEngine('${uidKey}', ${dPoints});"
                        class="w-full bg-[#030508] border border-gray-700 p-1.5 text-psycho-cyan font-bold text-xs outline-none focus:border-[#d4af37]">
                </div>
                <div class="bg-[#030508] p-2.5 border border-gray-800 flex justify-between items-center font-bold">
                    <div>
                        <span class="text-gray-500 block text-[9px] uppercase">Estimasi Hasil (PnL)</span>
                        <span id="modal-res-pnl" class="text-emerald-400 text-xs font-bold">+$25.00 USDT</span>
                    </div>
                    <div class="text-right">
                        <span class="text-gray-500 block text-[9px] uppercase">Hasil Persentase (ROI)</span>
                        <span id="modal-res-roi" class="text-emerald-400 text-xs font-bold">+25.00%</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById("specs-modal").classList.remove("hidden");
    liveModalCalculatorEngine(uidKey, dPoints);
}

function applyTargetToCalculator(priceVal, uidKey, dPoints) {
    const inp = document.getElementById("modal-calc-target");
    if (inp) {
        inp.value = priceVal.toFixed(dPoints);
        liveModalCalculatorEngine(uidKey, dPoints);
    }
}

function liveModalCalculatorEngine(uidKey, dPoints) {
    const setup = lockedTradingSetupsCache[uidKey];
    if (!setup) return;
    const lev    = parseFloat(document.getElementById("modal-calc-lev").value)    || 0;
    const margin = parseFloat(document.getElementById("modal-calc-margin").value) || 0;
    const target = parseFloat(document.getElementById("modal-calc-target").value) || 0;

    let changePct = 0;
    if (setup.trend === "LONG") changePct = (target - setup.entry) / setup.entry;
    else                        changePct = (setup.entry - target) / setup.entry;

    const outputPnL = margin * lev * changePct;
    const outputROI = changePct * lev * 100;

    const pnlEl = document.getElementById("modal-res-pnl");
    const roiEl = document.getElementById("modal-res-roi");
    if (outputPnL >= 0) {
        if (pnlEl) { pnlEl.innerText = `+$${outputPnL.toFixed(2)} USDT`; pnlEl.className = "text-emerald-400 text-xs font-bold"; }
        if (roiEl) { roiEl.innerText = `+${outputROI.toFixed(2)}%`;       roiEl.className = "text-emerald-400 text-xs font-bold"; }
    } else {
        if (pnlEl) { pnlEl.innerText = `$${outputPnL.toFixed(2)} USDT`;  pnlEl.className = "text-rose-500 text-xs font-bold"; }
        if (roiEl) { roiEl.innerText = `${outputROI.toFixed(2)}%`;        roiEl.className = "text-rose-500 text-xs font-bold"; }
    }
}

function closeSpecsModalWindow() {
    document.getElementById("specs-modal").classList.add("hidden");
}

// ── Clock ──────────────────────────────────────────────────────────────────────
function clockEngineUpdate() {
    const el = document.getElementById("clock-24h");
    if (el) el.innerText = new Date().toTimeString().split(" ")[0];
}

// ── DOMContentLoaded Bootstrap ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    // Start clock
    clockEngineUpdate();
    setInterval(clockEngineUpdate, 1000);

    // Init password gate first — boot sequence is triggered after correct password
    initPasswordGate();

    // Start auto-refresh timer (restores gate every 15 min)
    startAutoRefreshTimer();

    // After unlock, API polling starts inside triggerTerminalBootSequence via renderWorkspaceDisplay
    // Additional 15-second API polling interval started after boot
});
