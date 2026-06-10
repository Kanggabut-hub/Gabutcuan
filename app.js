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
            triggerTerminalBootSequence();
        } else {
            errorMsg.textContent = "⚠ Access denied — incorrect encryption authorization token.";
            input.classList.add("error");
            input.value = "";
            setTimeout(() => input.classList.remove("error"), 400);
        }
    }

    btn.addEventListener("click", attemptUnlock);
    input.addEventListener("keydown", e => { if (e.key === "Enter") attemptUnlock(); });
    setTimeout(() => { if(input) input.focus(); }, 100);
}

function restorePasswordGate() {
    const gate  = document.getElementById("password-gate");
    const input = document.getElementById("pw-input");
    const err   = document.getElementById("pw-error");
    if (!gate) return;
    if (input) input.value = "";
    if (err) err.textContent = "";
    gate.style.opacity   = "1";
    gate.style.display   = "flex";
    gate.style.transition = "none";
    
    const main = document.getElementById("main-terminal-content");
    if (main) { main.classList.add("hidden"); main.style.opacity = "0"; }
    const landing = document.getElementById("landing-screen");
    if (landing) { landing.classList.remove("opacity-0", "pointer-events-none"); }
    setTimeout(() => { if(input) input.focus(); }, 150);
}

function startAutoRefreshTimer() {
    setInterval(() => {
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
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === "beep") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(1000, now);
            osc.frequency.setValueAtTime(1300, now + 0.04);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === "crunch") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.setValueAtTime(300, now + 0.02);
            gain.gain.setValueAtTime(0.02, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
            osc.start(now); osc.stop(now + 0.04);
        } else if (type === "boot") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(50, now);
            osc.frequency.linearRampToValueAtTime(500, now + 1.0);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 1.2);
            osc.start(now); osc.stop(now + 1.2);
        }
    } catch (e) { console.log(e); }
}

function toggleMuteState() {
    systemAudioMuted = !systemAudioMuted;
    const btn = document.getElementById("sound-toggle-btn");
    if (!btn) return;
    if (systemAudioMuted) {
        btn.innerText = "🔇 AUDIO: MUTED";
        btn.className = "text-[10px] border border-red-900 px-2.5 py-1 text-red-500 bg-gray-900 rounded-lg";
    } else {
        btn.innerText = "🔊 AUDIO: ACTIVE";
        btn.className = "text-[10px] border border-gray-800 px-2.5 py-1 text-gundam-gold bg-gray-900/60 hover:border-[#d4af37] transition rounded-lg";
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
        "Allocating memory registries...",
        "Synchronizing remote quantitative metrics...",
        "Establishing data pipeline contexts...",
        "Validating neural risk indicators...",
        "Systems integrated successfully."
    ];

    const interval = setInterval(() => {
        pct += Math.floor(Math.random() * 14) + 10;
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
                    renderLunarCrushPanel();
                    fetchAllExternalAPIPipelines();
                }, 50);
            }
        }
        if (bar)        bar.style.width  = pct + "%";
        if (pctText)    pctText.innerText = pct + "%";
        if (statusText) statusText.innerText = logs[Math.floor((pct / 100) * logs.length)] || logs[logs.length - 1];
        if (pct % 20 === 0) playSound("crunch");
    }, 40);
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function togglePlengerSidebar(open) {
    const sidebar = document.getElementById("plenger-sidebar");
    if (!sidebar) return;
    if (open) sidebar.classList.remove("-translate-x-full");
    else      sidebar.classList.add("-translate-x-full");
}

// ── LunarCrush Panel Renderer ─────────────────────────────────────────────────
let lunarPanelRefreshTimer = null;

async function renderLunarCrushPanel() {
    const container = document.getElementById("lunarcrush-panel-body");
    if (!container) return;

    container.innerHTML = buildLunarSkeletons(10);

    try {
        const coins = await fetchLunarCrushData();
        container.innerHTML = "";

        if (!coins || coins.length === 0) {
            container.innerHTML = `<div class="lc-error-msg">⚠ No real-time social metrics discovered.</div>`;
            return;
        }

        coins.forEach(coin => {
            const card = buildLunarCoinCard(coin);
            container.appendChild(card);
        });

        const tsEl = document.getElementById("lc-last-refresh");
        if (tsEl) tsEl.innerText = new Date().toLocaleTimeString();
    } catch (err) {
        container.innerHTML = `<div class="lc-error-msg">⚠ Social data processing timeout anomaly.</div>`;
        console.warn("[LunarCrush] Render error:", err);
    }

    clearTimeout(lunarPanelRefreshTimer);
    lunarPanelRefreshTimer = setTimeout(renderLunarCrushPanel, 60000);
}

function buildLunarSkeletons(count) {
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `<div class="lc-coin-card p-3 border border-gray-800/40 rounded-xl bg-gray-900/10 mb-2">
            <div class="lc-skeleton h-3 w-1/3 mb-2 rounded-full"></div>
            <div class="lc-skeleton h-1.5 w-full mb-2 rounded-full"></div>
            <div class="lc-skeleton h-2 w-2/3 rounded-full"></div>
        </div>`;
    }
    return html;
}

function buildLunarCoinCard(coin) {
    const card = document.createElement("div");
    card.className = "lc-coin-card transition hover:bg-gray-900/40 border border-gray-800/40 p-3 rounded-xl mb-2 relative overflow-hidden";
    if (coin.anomaly === "PUMP") card.classList.add("anomaly-pump", "border-emerald-900/40", "bg-emerald-950/5");
    if (coin.anomaly === "DUMP") card.classList.add("anomaly-dump", "border-rose-900/40", "bg-rose-950/5");

    const sentColor   = coin.sentiment >= 65 ? "text-emerald-400" : (coin.sentiment >= 45 ? "text-amber-400" : "text-rose-400");
    const scoreColor  = coin.galaxyScore >= 60 ? "text-cyan-400" : (coin.galaxyScore >= 40 ? "text-amber-400" : "text-gray-500");
    const socialFill  = Math.min(100, (coin.socialVolume / 200000) * 100);
    const volumeStr   = formatSocialVolume(coin.socialVolume);
    const pcColor     = coin.priceChange >= 0 ? "text-emerald-400" : "text-rose-400";
    const pcSign      = coin.priceChange >= 0 ? "+" : "";

    const anomalyHTML = coin.anomaly === "PUMP"
        ? `<span class="inline-block text-[8px] border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-1 rounded-md font-bold ml-1">🚀 SOCIAL SPIKE</span>`
        : coin.anomaly === "DUMP"
        ? `<span class="inline-block text-[8px] border border-rose-500/30 bg-rose-500/10 text-rose-400 px-1 rounded-md font-bold ml-1">⚠ MASS PANIC</span>`
        : ``;

    card.innerHTML = `
        <div class="flex justify-between items-center mb-1 font-mono-tech">
            <div class="flex items-center gap-1.5">
                <span class="text-[9px] text-gray-500 bg-gray-950 px-1.5 py-0.2 rounded border border-gray-800 font-bold">#${coin.rank}</span>
                <span class="text-white font-bold text-xs tracking-tight">${coin.ticker}</span>
                ${anomalyHTML}
            </div>
            <div class="text-[10px] ${pcColor} font-bold">${pcSign}${coin.priceChange.toFixed(1)}%</div>
        </div>
        <div class="w-full h-1 bg-gray-950 rounded-full overflow-hidden mb-2">
            <div class="h-full bg-gradient-to-r from-amber-500 to-cyan-400 rounded-full" style="width:${socialFill}%"></div>
        </div>
        <div class="grid grid-cols-3 gap-1 text-[9px] text-gray-400 font-mono-tech border-t border-gray-900 pt-1.5">
            <div>Sent: <span class="${sentColor} font-semibold">${coin.sentiment}%</span></div>
            <div class="text-center">Vol: <span class="text-gray-300 font-semibold">${volumeStr}</span></div>
            <div class="text-right">Glx: <span class="${scoreColor} font-semibold">${coin.galaxyScore}</span></div>
        </div>
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
        }, 600);
    } else {
        compileActiveFilterSorting();
    }
}

function clearGlobalSearchQuery() {
    const input = document.getElementById("global-token-search-input");
    if (input) input.value = "";
    activeQueryText = "";
    const clearBtn = document.getElementById("clear-search-btn");
    if (clearBtn) clearBtn.classList.add("hidden");
    compileActiveFilterSorting();
}

// ── Filter Controls ────────────────────────────────────────────────────────────
function applyCapFilterRange(rangeType) {
    selectedFilterRange = rangeType;
    signalRecommendationFilter = "none";
    coreSliderPointer = 0;
    resetSidebarButtonStyles();
    
    const el = document.getElementById("f-" + rangeType);
    if (el) el.className = "w-full text-left bg-gradient-to-r from-amber-500/10 to-transparent border border-[#d4af37]/40 text-[#d4af37] p-2 rounded-lg text-xs font-semibold transition flex items-center justify-between";
    compileActiveFilterSorting();
}

function applySignalFilter(signalType) {
    signalRecommendationFilter = signalType;
    selectedFilterRange = "all";
    coreSliderPointer = 0;
    resetSidebarButtonStyles();
    
    if (signalType === "LONG") {
        const el = document.getElementById("f-rec-long");
        if (el) el.className = "w-full text-left bg-emerald-500/10 border border-emerald-500 text-emerald-400 p-2 rounded-lg text-xs font-bold tracking-wide transition flex items-center justify-between";
    } else {
        const el = document.getElementById("f-rec-short");
        if (el) el.className = "w-full text-left bg-rose-500/10 border border-rose-500 text-rose-400 p-2 rounded-lg text-xs font-bold tracking-wide transition flex items-center justify-between";
    }
    compileActiveFilterSorting();
}

function resetSidebarButtonStyles() {
    const brackets = ["all", "mega", "mid", "low", "micro"];
    brackets.forEach(b => {
        const el = document.getElementById("f-" + b);
        if (el) {
            let badge = b === "mega" ? '<span class="text-[10px] text-blue-400">&gt;$10B</span>'
                      : b === "mid" ? '<span class="text-[10px] text-purple-400">$1B – $10B</span>'
                      : b === "low" ? '<span class="text-[10px] text-amber-500">$100M – $1B</span>'
                      : b === "micro" ? '<span class="text-[10px] text-rose-400">&lt;$100M</span>'
                      : '<span class="text-[10px] text-gray-500 font-normal">Global Pool</span>';
            el.className = "w-full text-left bg-gray-900/40 border border-gray-800/60 hover:border-gundam-gold text-white p-2 rounded-lg text-xs font-medium transition flex items-center justify-between";
            el.innerHTML = `<span>${b.toUpperCase()}${b === "all" ? " CAPITALIZATIONS" : b === "low" ? " CAP PRESTIGE" : b === "micro" ? " CAP GEMS" : " CAP"}</span> ${badge}`;
        }
    });

    const rl = document.getElementById("f-rec-long");
    if (rl) rl.className = "w-full text-left bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 p-2 rounded-lg text-xs font-bold tracking-wide transition flex items-center justify-between";
    const rs = document.getElementById("f-rec-short");
    if (rs) rs.className = "w-full text-left bg-rose-950/20 border border-rose-900/40 text-rose-400 p-2 rounded-lg text-xs font-bold tracking-wide transition flex items-center justify-between";
}

// ── Sorting Pipeline & DOM Painter ──────────────────────────────────────────
function compileActiveFilterSorting() {
    let pool = [...coreMemoryCache];

    if (activeQueryText !== "") {
        pool = pool.filter(item => item.ticker.toLowerCase().includes(activeQueryText) || item.source.toLowerCase().includes(activeQueryText));
    }

    pool.forEach(item => {
        if (!lockedTradingSetupsCache[item.uid]) {
            const adv = getOrComputeAdvancedIndicators(item.uid, item);
            const seedHash = Math.abs(item.uid.split("").reduce((a,c)=>a+c.charCodeAt(0),0));
            const setupTrend = adv.rsi.value < 45 ? "LONG" : (adv.rsi.value > 55 ? "SHORT" : (seedHash % 2 === 0 ? "LONG" : "SHORT"));
            const score      = adv.confluenceScore;
            const statuses   = ["MONITORING RE-ENTRY", "TAKE PROFIT MATRIX MET", "STOP LOSS ACCELERATED", "ACTIVE ACCUMULATION"];
            
            lockedTradingSetupsCache[item.uid] = {
                uid: item.uid,
                trend: setupTrend,
                entry: item.price,
                tp1: setupTrend === "LONG" ? item.price * 1.02 : item.price * 0.98,
                tp2: setupTrend === "LONG" ? item.price * 1.04 : item.price * 0.96,
                tp3: setupTrend === "LONG" ? item.price * 1.06 : item.price * 0.94,
                sl:  setupTrend === "LONG" ? item.price * 0.975 : item.price * 1.025,
                confluence: score,
                volatility: score > 80 ? "HIGH" : (score > 65 ? "MED" : "LOW"),
                status: statuses[seedHash % statuses.length]
            };
        }
    });

    if (signalRecommendationFilter !== "none") {
        pool = pool.filter(item => {
            const s = lockedTradingSetupsCache[item.uid];
            return s && s.trend === signalRecommendationFilter;
        });
        pool.sort((a,b) => lockedTradingSetupsCache[b.uid].confluence - lockedTradingSetupsCache[a.uid].confluence);
    } else {
        if (selectedFilterRange === "mega")        pool = pool.filter(x => x.volume24h > 150000000);
        else if (selectedFilterRange === "mid")   pool = pool.filter(x => x.volume24h <= 150000000 && x.volume24h > 30000000);
        else if (selectedFilterRange === "low")   pool = pool.filter(x => x.volume24h <= 30000000 && x.volume24h > 2000000);
        else if (selectedFilterRange === "micro") pool = pool.filter(x => x.volume24h <= 2000000);

        pool.sort((a, b) => b.calculatedWeight - a.calculatedWeight);
    }

    filteredWorkspacePool = pool;

    const totalFiltered = filteredWorkspacePool.length;
    const elCount = document.getElementById("stats-filtered-count");
    if (elCount) elCount.innerText = `${totalFiltered} Units`;

    if (coreSliderPointer >= totalFiltered && totalFiltered > 0) {
        coreSliderPointer = Math.max(0, totalFiltered - strictRowMaxItems);
    }

    const upperCap = Math.min(coreSliderPointer + strictRowMaxItems, totalFiltered);
    const pagEl = document.getElementById("pagination-indicator-text");
    if (pagEl) {
        pagEl.innerText = totalFiltered > 0 
            ? `SHOWING ${coreSliderPointer + 1} – ${upperCap} OF ${totalFiltered} TARGETS`
            : "NO PROTOCOLS COMPLIANT WITH CURRENT FILTERS";
    }

    const pageSlice = filteredWorkspacePool.slice(coreSliderPointer, upperCap);
    paintMatrixGridInterface(pageSlice);
}

function shiftPagingIndexPointer(direction) {
    const total = filteredWorkspacePool.length;
    if (total === 0) return;
    coreSliderPointer += (direction * strictRowMaxItems);
    if (coreSliderPointer >= total) coreSliderPointer = 0;
    if (coreSliderPointer < 0) {
        const Rem = total % strictRowMaxItems;
        coreSliderPointer = Rem === 0 ? total - strictRowMaxItems : total - Rem;
        if (coreSliderPointer < 0) coreSliderPointer = 0;
    }
    compileActiveFilterSorting();
}

function paintMatrixGridInterface(slice) {
    const grid = document.getElementById("trading-setup-matrix-grid");
    if (!grid) return;
    grid.innerHTML = "";

    if (slice.length === 0) {
        grid.innerHTML = `<div class="col-span-full border border-dashed border-gray-800 p-8 text-center text-gray-500 font-mono-tech rounded-xl">
            ⚠ NO COMPLIANT STRATEGY OVERLAYS DISCOVERED FOR FILTER SELECTION
        </div>`;
        return;
    }

    slice.forEach(pairNode => {
        const setup = lockedTradingSetupsCache[pairNode.uid];
        const adv   = getOrComputeAdvancedIndicators(pairNode.uid, pairNode);
        const livePrice = pairNode.price;
        const dPoints   = livePrice > 500 ? 2 : (livePrice > 2 ? 4 : 6);

        const badgeColor = setup.trend === "LONG" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border-rose-500/30";
        const statusColor = setup.status.includes("TAKE") ? "text-emerald-400 font-bold" : (setup.status.includes("STOP") ? "text-rose-400 font-bold" : "text-cyan-400");
        const progressPct = calculateTradeProgressPercentage(setup.trend, livePrice, setup.entry, setup.tp1);

        const cardBox = document.createElement("div");
        cardBox.className = "bloomberg-card p-4 flex flex-col justify-between font-mono-tech border border-gray-800/80 rounded-xl bg-[#080d16] hover:bg-gray-900/20 transition shadow-sm relative";
        cardBox.innerHTML = `
            <div class="space-y-3">
                <div onclick="openSpecsModalWindow('${pairNode.uid}'); playSound('beep');" class="cursor-pointer flex justify-between items-start border-b border-gray-800 pb-2">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-white font-bold text-sm tracking-tight">${pairNode.ticker}</span>
                            <span class="text-[9px] text-gray-500 px-1 rounded bg-gray-950 border border-gray-900">${pairNode.source.split(" ")[0]}</span>
                        </div>
                        <p class="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">${pairNode.source}</p>
                    </div>
                    <span class="text-[10px] border px-1.5 py-0.2 font-bold rounded-md ${badgeColor}">${setup.trend}</span>
                </div>

                <div class="flex justify-between items-baseline">
                    <span class="text-gray-500 text-[10px]">LAST VALUE:</span>
                    <span class="text-white text-base font-bold tracking-tight">$${livePrice.toFixed(dPoints)}</span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-[10px] border-t border-b border-gray-900 py-2 bg-gray-950/20 px-1 rounded-lg">
                    <div><span class="text-gray-500 block text-[9px]">24H CHANGE</span> <span class="font-bold ${pairNode.change24h >= 0 ? "text-emerald-400" : "text-rose-400"}">${pairNode.change24h >= 0 ? "+" : ""}${pairNode.change24h.toFixed(2)}%</span></div>
                    <div class="text-right"><span class="text-gray-500 block text-[9px]">CONFLUENCE</span> <span class="text-gundam-gold font-bold">${setup.confluence}% ACC</span></div>
                </div>

                <div class="space-y-1 text-[10px]">
                    <div class="flex justify-between"><span class="text-gray-500">Entry target:</span><span class="text-gray-300 font-medium">$${setup.entry.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Take Profit 1:</span><span class="text-emerald-400 font-medium">$${setup.tp1.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-500">Stop Loss core:</span><span class="text-rose-400 font-medium">$${setup.sl.toFixed(dPoints)}</span></div>
                </div>
            </div>

            <div class="mt-4 pt-2 border-t border-gray-900 flex flex-col gap-1.5">
                <div class="flex justify-between items-center text-[9px]">
                    <span class="text-gray-500 uppercase font-semibold">SIGNAL TELEMETRY:</span>
                    <span class="${statusColor} truncate max-w-[70%] text-right font-medium">${setup.status}</span>
                </div>
                <div class="w-full h-1 bg-gray-950 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-amber-500 to-cyan-400 rounded-full" style="width: ${progressPct}%"></div>
                </div>
            </div>
        `;
        grid.appendChild(cardBox);
    });
}

function calculateTradeProgressPercentage(trend, current, entry, tp1) {
    if (trend === "LONG") {
        if (current <= entry) return 5;
        if (current >= tp1) return 100;
        return ((current - entry) / (tp1 - entry)) * 100;
    } else {
        if (current >= entry) return 5;
        if (current <= tp1) return 100;
        return ((entry - current) / (entry - tp1)) * 100;
    }
}

// ── Specs Modal Window Management ──────────────────────────────────────────────
function openSpecsModalWindow(uid) {
    const pairNode = coreMemoryCache.find(x => x.uid === uid);
    if (!pairNode) return;
    const setup = lockedTradingSetupsCache[uid];
    const adv   = getOrComputeAdvancedIndicators(uid, pairNode);
    const dPoints = pairNode.price > 500 ? 2 : (pairNode.price > 2 ? 4 : 6);

    const modal = document.getElementById("specs-modal");
    const content = document.getElementById("modal-content-area");
    if (!modal || !content) return;

    modal.classList.remove("hidden");
    setTimeout(() => {
        modal.classList.remove("opacity-0", "pointer-events-none");
    }, 10);

    content.innerHTML = `
        <div class="border-b border-gray-800 pb-3 mb-4">
            <h2 class="text-base font-bold text-white uppercase tracking-tight">${pairNode.ticker} — COMPREHENSIVE INTELLIGENCE</h2>
            <p class="text-[10px] text-psycho-cyan uppercase tracking-widest mt-0.5">${pairNode.source} // SECTOR CALCULATION MATRIX</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="border border-gray-800 p-3 bg-gray-950/40 rounded-xl">
                <p class="text-gray-500 text-[9px] font-bold uppercase mb-1">MARKET DATA MATRIX</p>
                <div class="space-y-1 text-xs">
                    <div class="flex justify-between"><span class="text-gray-400">Live Price:</span><span class="text-white font-bold">$${pairNode.price.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">24h High:</span><span class="text-gray-300 font-medium">$${pairNode.high24h.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">24h Low:</span><span class="text-gray-300 font-medium">$${pairNode.low24h.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">24h Vol Weight:</span><span class="text-gundam-gold font-bold">${formatSocialVolume(pairNode.volume24h)}</span></div>
                </div>
            </div>

            <div class="border border-gray-800 p-3 bg-gray-950/40 rounded-xl">
                <p class="text-gray-500 text-[9px] font-bold uppercase mb-1">STRATEGIC ESCALATION TARGETS</p>
                <div class="space-y-1 text-xs">
                    <div class="flex justify-between"><span class="text-gray-400">Entry Reference:</span><span class="text-white font-medium">$${setup.entry.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-emerald-400">Take Profit 1:</span><span class="text-emerald-400 font-bold">$${setup.tp1.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-emerald-400">Take Profit 2:</span><span class="text-emerald-400 font-bold">$${setup.tp2.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-emerald-400">Take Profit 3:</span><span class="text-emerald-400 font-bold">$${setup.tp3.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-rose-400">Stop Loss Level:</span><span class="text-rose-400 font-bold">$${setup.sl.toFixed(dPoints)}</span></div>
                </div>
            </div>

            <div class="border border-gray-800 p-3 bg-gray-950/40 rounded-xl">
                <p class="text-gray-500 text-[9px] font-bold uppercase mb-1">ADVANCED QUANT OSCILLATORS</p>
                <div class="space-y-1 text-xs">
                    <div class="flex justify-between"><span class="text-gray-400">SMC Structure:</span><span class="text-purple-400 font-bold text-right truncate max-w-[60%]">${adv.smc.structural.split(" ")[0]}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Vol Delta:</span><span class="text-emerald-400 font-bold">${adv.volTech.delta > 0 ? "+" : ""}${adv.volTech.delta}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Inst. VWAP:</span><span class="text-gundam-gold font-bold">$${adv.volTech.vwap.toFixed(dPoints)}</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">Momentum RSI:</span><span class="text-white font-bold">${adv.rsi.value} (${adv.rsi.slope.slice(0,5)})</span></div>
                    <div class="flex justify-between"><span class="text-gray-400">MACD Hist:</span><span class="text-amber-400 font-bold">${adv.macd.histogram}</span></div>
                </div>
            </div>
        </div>

        <div class="border border-gray-800 p-3 bg-gray-950/40 rounded-xl mb-4">
            <p class="text-gray-500 text-[9px] font-bold uppercase mb-2">⚡ CONFLUENCE LAYER CONSTRAINTS CONFIRMED</p>
            <ul class="space-y-1 text-[11px] text-gray-300 list-disc list-inside">
                ${adv.confluenceFactors.map(f => `<li class="truncate"><span class="text-gundam-gold font-bold">✓</span> ${f}</li>`).join("")}
            </ul>
        </div>

        <div class="border border-gray-800 p-3 bg-gray-950/40 rounded-xl mb-4">
            <p class="text-gundam-gold font-bold text-[10px] uppercase mb-2">🧮 SIMULATED RISK LEVERAGE ESTIMATOR</p>
            <div class="space-y-3 text-xs">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[9px] text-gray-500 font-bold block mb-1">LEVERAGE MULTIPLIER</label>
                        <input type="number" id="modal-calc-lev" value="10" min="1" max="125" oninput="recalculateSimulationPnLMatrix('${uid}')" class="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white font-bold outline-none text-center focus:border-gundam-gold transition">
                    </div>
                    <div>
                        <label class="text-[9px] text-gray-500 font-bold block mb-1">MARGIN PRINCIPAL (USDT)</label>
                        <input type="number" id="modal-calc-margin" value="500" min="10" step="50" oninput="recalculateSimulationPnLMatrix('${uid}')" class="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white font-bold outline-none text-center focus:border-gundam-gold transition">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 bg-gray-950/60 p-2.5 rounded-xl border border-gray-900 text-center">
                    <div>
                        <div class="text-[9px] text-gray-500 font-bold">ESTIMATED PROJECTION P&L</div>
                        <div id="modal-calc-res-pnl" class="text-emerald-400 font-bold text-sm mt-0.5">+$100.00 USDT</div>
                    </div>
                    <div>
                        <div class="text-[9px] text-gray-500 font-bold">RETURN ON INVESTMENT (ROI)</div>
                        <div id="modal-calc-res-roi" class="text-emerald-400 font-bold text-sm mt-0.5">+20.00%</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    recalculateSimulationPnLMatrix(uid);
}

function recalculateSimulationPnLMatrix(uid) {
    const pairNode = coreMemoryCache.find(x => x.uid === uid);
    const setup    = lockedTradingSetupsCache[uid];
    if (!pairNode || !setup) return;

    const levInput    = document.getElementById("modal-calc-lev");
    const marginInput = document.getElementById("modal-calc-margin");
    const pnlEl       = document.getElementById("modal-calc-res-pnl");
    const roiEl       = document.getElementById("modal-calc-res-roi");

    if (!levInput || !marginInput) return;

    const leverage = Math.max(1, parseFloat(levInput.value) || 1);
    const margin   = Math.max(0, parseFloat(marginInput.value) || 0);

    const livePrice  = pairNode.price;
    const entryPrice = setup.entry;

    let priceDeltaPct = entryPrice ? ((livePrice - entryPrice) / entryPrice) : 0;
    if (setup.trend === "SHORT") {
        priceDeltaPct = entryPrice ? ((entryPrice - livePrice) / entryPrice) : 0;
    }

    const outputROI = priceDeltaPct * 100 * leverage;
    const outputPnL = margin * (outputROI / 100);

    if (outputPnL >= 0) {
        if (pnlEl) { pnlEl.innerText = `+$${outputPnL.toFixed(2)} USDT`; pnlEl.className = "text-emerald-400 text-sm font-bold"; }
        if (roiEl) { roiEl.innerText = `+${outputROI.toFixed(2)}%`;       roiEl.className = "text-emerald-400 text-sm font-bold"; }
    } else {
        if (pnlEl) { pnlEl.innerText = `$${outputPnL.toFixed(2)} USDT`;  pnlEl.className = "text-rose-400 text-sm font-bold"; }
        if (roiEl) { roiEl.innerText = `${outputROI.toFixed(2)}%`;        roiEl.className = "text-rose-400 text-sm font-bold"; }
    }
}

function closeSpecsModalWindow() {
    const modal = document.getElementById("specs-modal");
    if (!modal) return;
    modal.classList.add("opacity-0", "pointer-events-none");
    setTimeout(() => modal.classList.add("hidden"), 300);
}

// ── Clock ──────────────────────────────────────────────────────────────────────
function clockEngineUpdate() {
    const elements = document.querySelectorAll("#clock-24h");
    const timeStr = new Date().toTimeString().split(" ")[0];
    elements.forEach(el => {
        if (el) el.innerText = timeStr;
    });
}

// ── DOMContentLoaded Bootstrap ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    clockEngineUpdate();
    setInterval(clockEngineUpdate, 1000);
    initPasswordGate();
    startAutoRefreshTimer();
});
