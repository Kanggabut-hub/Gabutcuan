"use strict";

const CORRECT_PASSWORD = "Bismillah";
const AUTO_REFRESH_INTERVAL = 15 * 60 * 1000;

function initPasswordGate() {
    const gate = document.getElementById("password-gate"), input = document.getElementById("pw-input"), btn = document.getElementById("pw-submit"), errorMsg = document.getElementById("pw-error");
    if (!gate) return;
    
    function attemptUnlock() {
        if ((input.value || "").trim() === CORRECT_PASSWORD) {
            errorMsg.textContent = ""; gate.style.opacity = "0";
            setTimeout(() => { gate.style.display = "none"; }, 500);
            triggerTerminalBootSequence();
        } else {
            errorMsg.textContent = "⚠ Access Denied."; input.value = "";
            input.classList.add("border-rose-500");
            setTimeout(() => input.classList.remove("border-rose-500"), 400);
        }
    }
    btn.addEventListener("click", attemptUnlock);
    input.addEventListener("keydown", e => { if (e.key === "Enter") attemptUnlock(); });
    setTimeout(() => input.focus(), 100);
}

function restorePasswordGate() {
    const gate = document.getElementById("password-gate"), input = document.getElementById("pw-input");
    if (!gate) return;
    input.value = ""; gate.style.opacity = "1"; gate.style.display = "flex";
    document.getElementById("main-terminal-content")?.classList.add("hidden");
    document.getElementById("landing-screen")?.classList.remove("opacity-0", "pointer-events-none");
}

setInterval(restorePasswordGate, AUTO_REFRESH_INTERVAL);

let systemAudioMuted = false, synthAudioContext = null;
function playSound(type) {
    if (systemAudioMuted) return;
    try {
        if (!synthAudioContext) synthAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const osc = synthAudioContext.createOscillator(), gain = synthAudioContext.createGain(), now = synthAudioContext.currentTime;
        osc.connect(gain); gain.connect(synthAudioContext.destination);
        if (type === "click") { osc.type = "sine"; osc.frequency.setValueAtTime(800, now); gain.gain.setValueAtTime(0.02, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
        else if (type === "beep") { osc.type = "sine"; osc.frequency.setValueAtTime(1000, now); gain.gain.setValueAtTime(0.02, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15); osc.start(now); osc.stop(now + 0.15); }
    } catch (e) {}
}

function toggleMuteState() {
    systemAudioMuted = !systemAudioMuted;
    const btn = document.getElementById("sound-toggle-btn");
    if (btn) btn.innerText = systemAudioMuted ? "🔇 MUTED" : "🔊 ON";
    if (!systemAudioMuted) playSound('click');
}

function switchVisualTheme(mode) { document.body.classList.toggle("light-theme", mode === "light"); }
function toggleAntiEyeStrain() { document.body.classList.toggle("eye-strain-mode"); }

function triggerTerminalBootSequence() {
    playSound("beep");
    document.getElementById("launch-btn")?.classList.add("hidden");
    const bootBox = document.getElementById("boot-progress-container");
    if (bootBox) bootBox.classList.remove("hidden");
    
    let pct = 0;
    const bar = document.getElementById("boot-progress-bar"), pctText = document.getElementById("boot-percent-text");
    const interval = setInterval(() => {
        pct += Math.floor(Math.random() * 15) + 10;
        if (pct >= 100) {
            pct = 100; clearInterval(interval);
            document.getElementById("landing-screen")?.classList.add("opacity-0", "pointer-events-none");
            const main = document.getElementById("main-terminal-content");
            if (main) {
                main.classList.remove("hidden");
                setTimeout(() => { main.style.opacity = "1"; renderLunarCrushPanel(); fetchAllExternalAPIPipelines(); }, 100);
            }
        }
        if (bar) bar.style.width = pct + "%";
        if (pctText) pctText.innerText = pct + "%";
    }, 40);
}

function togglePlengerSidebar(open) {
    const s = document.getElementById("plenger-sidebar");
    if (s) s.classList.toggle("-translate-x-full", !open);
}

let lunarPanelRefreshTimer = null;
async function renderLunarCrushPanel() {
    const container = document.getElementById("lunarcrush-panel-body");
    if (!container) return;
    container.innerHTML = `<div class="animate-pulse space-y-2">${Array(8).fill('<div class="h-16 bg-gray-900/50 rounded-lg"></div>').join('')}</div>`;
    
    try {
        const coins = await fetchLunarCrushData();
        container.innerHTML = "";
        coins.forEach(c => {
            const el = document.createElement("div");
            el.className = `p-3 rounded-lg border transition cursor-default ${c.anomaly==='PUMP'?'bg-emerald-950/20 border-emerald-900/50 hover:bg-emerald-950/40':(c.anomaly==='DUMP'?'bg-rose-950/20 border-rose-900/50 hover:bg-rose-950/40':'bg-gray-900/30 border-gray-800 hover:bg-gray-900/50')}`;
            el.innerHTML = `
                <div class="flex justify-between items-center mb-1.5">
                    <div class="flex items-center gap-2">
                        <span class="text-[9px] text-gray-500 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800 font-bold">#${c.rank}</span>
                        <span class="text-white font-bold text-xs">${c.ticker}</span>
                    </div>
                    <span class="text-[10px] font-bold ${c.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${c.priceChange >= 0 ? '+' : ''}${c.priceChange.toFixed(1)}%</span>
                </div>
                <div class="w-full h-1 bg-gray-950 rounded-full overflow-hidden mb-2">
                    <div class="h-full bg-gradient-to-r from-amber-500 to-[#00f3ff]" style="width:${Math.min(100, (c.socialVolume/200000)*100)}%"></div>
                </div>
                <div class="flex justify-between text-[9px] text-gray-500">
                    <span>Sent: <b class="text-gray-300">${c.sentiment}%</b></span>
                    <span>Vol: <b class="text-gray-300">${c.socialVolume >= 1000 ? (c.socialVolume/1000).toFixed(1)+'K' : c.socialVolume}</b></span>
                    <span>Glx: <b class="text-gray-300">${c.galaxyScore}</b></span>
                </div>
            `;
            container.appendChild(el);
        });
        const ts = document.getElementById("lc-last-refresh");
        if (ts) ts.innerText = new Date().toLocaleTimeString();
    } catch (e) { container.innerHTML = `<div class="text-center text-[10px] text-gray-500 p-4">API Timeout</div>`; }
    clearTimeout(lunarPanelRefreshTimer);
    lunarPanelRefreshTimer = setTimeout(renderLunarCrushPanel, 60000);
}

let searchTimeoutDebounce = null;
function executeInstantGlobalSearch(val) {
    activeQueryText = val.trim().toLowerCase();
    const btn = document.getElementById("clear-search-btn");
    if (btn) btn.classList.toggle("hidden", activeQueryText === "");
    coreSliderPointer = 0;
    clearTimeout(searchTimeoutDebounce);
    if (activeQueryText.length >= 2) searchTimeoutDebounce = setTimeout(() => searchOnChainTokensViaDexScreener(activeQueryText), 400);
    else compileActiveFilterSorting();
}

function clearGlobalSearchQuery() {
    const input = document.getElementById("global-token-search-input");
    if (input) input.value = "";
    executeInstantGlobalSearch("");
}

function applyCapFilterRange(type) {
    selectedFilterRange = type; signalRecommendationFilter = "none"; coreSliderPointer = 0;
    resetSidebarButtonStyles();
    document.getElementById("f-" + type).className = "w-full text-left bg-gradient-to-r from-amber-500/10 to-transparent border border-[#d4af37]/40 text-[#d4af37] p-2.5 rounded-lg text-xs font-semibold transition flex justify-between items-center";
    compileActiveFilterSorting();
}

function applySignalFilter(type) {
    signalRecommendationFilter = type; selectedFilterRange = "all"; coreSliderPointer = 0;
    resetSidebarButtonStyles();
    document.getElementById(type === "LONG" ? "f-rec-long" : "f-rec-short").classList.add(type === "LONG" ? "border-emerald-500" : "border-rose-500");
    compileActiveFilterSorting();
}

function resetSidebarButtonStyles() {
    ["all","mega","mid","low","micro"].forEach(id => {
        const el = document.getElementById("f-"+id);
        if(el) el.className = "w-full text-left bg-gray-900/30 border border-gray-800 hover:border-gray-600 text-gray-300 p-2.5 rounded-lg text-xs transition flex justify-between items-center";
    });
    const rl = document.getElementById("f-rec-long"); if(rl) rl.className = "w-full text-left bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 p-2.5 rounded-lg text-xs font-bold transition flex justify-between items-center hover:bg-emerald-950/40";
    const rs = document.getElementById("f-rec-short"); if(rs) rs.className = "w-full text-left bg-rose-950/20 border border-rose-900/40 text-rose-400 p-2.5 rounded-lg text-xs font-bold transition flex justify-between items-center hover:bg-rose-950/40";
}

function compileActiveFilterSorting() {
    let pool = coreMemoryCache.filter(item => !/^(USDC|FDUSD|TUSD|BUSD|EUR|TRY)$/.test(item.ticker));
    
    if (activeQueryText !== "") pool = pool.filter(i => i.ticker.toLowerCase().includes(activeQueryText));
    else {
        if (selectedFilterRange === "mega") pool = pool.filter(i => i.volume24h >= 500000000);
        else if (selectedFilterRange === "mid") pool = pool.filter(i => i.volume24h >= 15000000 && i.volume24h < 500000000);
        else if (selectedFilterRange === "low") pool = pool.filter(i => i.volume24h < 15000000 && i.volume24h > 1000000);
        else if (selectedFilterRange === "micro") pool = pool.filter(i => i.volume24h <= 1000000);
    }

    pool.forEach(node => {
        if (!lockedTradingSetupsCache[node.uid]) {
            const adv = getOrComputeAdvancedIndicators(node.uid, node.price, node.change24h);
            const trend = node.change24h >= 0 ? "LONG" : "SHORT";
            lockedTradingSetupsCache[node.uid] = {
                trend, entry: node.price,
                tp1: trend === "LONG" ? node.price * 1.02 : node.price * 0.98,
                sl: trend === "LONG" ? node.price * 0.975 : node.price * 1.025,
                confluence: adv.totalProConfluence,
                status: "ACTIVE TRACKING"
            };
        }
    });

    if (signalRecommendationFilter !== "none") {
        pool = pool.filter(i => lockedTradingSetupsCache[i.uid]?.trend === signalRecommendationFilter);
        pool.sort((a,b) => lockedTradingSetupsCache[b.uid].confluence - lockedTradingSetupsCache[a.uid].confluence);
    } else pool.sort((a,b) => b.calculatedWeight - a.calculatedWeight);

    filteredWorkspacePool = pool;
    
    const countEl = document.getElementById("stats-filtered-count");
    if (countEl) countEl.innerText = pool.length + " Units";
    
    paintMatrixGridInterface();
}

function shiftPagingIndexPointer(dir) {
    const max = filteredWorkspacePool.length;
    if (max === 0) return;
    coreSliderPointer += (dir * strictRowMaxItems);
    if (coreSliderPointer >= max) coreSliderPointer = 0;
    if (coreSliderPointer < 0) coreSliderPointer = Math.max(0, max - strictRowMaxItems);
    paintMatrixGridInterface();
}

function paintMatrixGridInterface() {
    const grid = document.getElementById("trading-setup-matrix-grid"), pag = document.getElementById("pagination-indicator-text");
    if (!grid) return;
    grid.innerHTML = "";
    
    const slice = filteredWorkspacePool.slice(coreSliderPointer, coreSliderPointer + strictRowMaxItems);
    if (pag) pag.innerText = filteredWorkspacePool.length > 0 ? `VIEWING ${coreSliderPointer + 1}-${Math.min(coreSliderPointer + strictRowMaxItems, filteredWorkspacePool.length)} OF ${filteredWorkspacePool.length}` : "0 RESULTS";
    
    if (slice.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-gray-500 border border-dashed border-gray-800 rounded-xl">⚠ NO COMPLIANT TARGETS FOUND</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    slice.forEach(node => {
        const setup = lockedTradingSetupsCache[node.uid], dP = node.price < 0.01 ? 6 : (node.price < 1 ? 4 : 2);
        const card = document.createElement("div");
        card.className = "bg-[#080d16] border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition shadow-sm flex flex-col justify-between";
        card.innerHTML = `
            <div class="cursor-pointer" onclick="openSpecsModalWindow('${node.uid}'); playSound('beep');">
                <div class="flex justify-between items-start mb-3 border-b border-gray-800 pb-2">
                    <div>
                        <div class="flex items-center gap-1.5"><span class="text-white font-bold text-sm">${node.ticker}</span><span class="text-[9px] text-gray-500 bg-gray-900 border border-gray-800 px-1 rounded">${node.source.split(" ")[0]}</span></div>
                        <div class="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">${node.source}</div>
                    </div>
                    <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${setup.trend === 'LONG' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-rose-950/50 text-rose-400'}">${setup.trend}</span>
                </div>
                <div class="flex justify-between items-baseline mb-3">
                    <span class="text-gray-500 text-[10px]">LAST PRICE</span>
                    <span class="text-white text-base font-bold tracking-tight">$${node.price.toFixed(dP)}</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[10px] bg-gray-900/40 p-2 rounded-lg mb-3">
                    <div><span class="text-gray-500 block">24H CHANGE</span><span class="${node.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold">${node.change24h >= 0 ? '+' : ''}${node.change24h.toFixed(2)}%</span></div>
                    <div class="text-right"><span class="text-gray-500 block">CONFLUENCE</span><span class="text-[#d4af37] font-bold">${setup.confluence}% ACC</span></div>
                </div>
                <div class="flex justify-between text-[10px] border-t border-gray-800 pt-3">
                    <span class="text-gray-500">Target TP1: <span class="text-emerald-400 font-medium">$${setup.tp1.toFixed(dP)}</span></span>
                    <span class="text-gray-500">Stop SL: <span class="text-rose-400 font-medium">$${setup.sl.toFixed(dP)}</span></span>
                </div>
            </div>
        `;
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);
}

function openSpecsModalWindow(uid) {
    const node = coreMemoryCache.find(x => x.uid === uid);
    if (!node) return;
    const setup = lockedTradingSetupsCache[uid], adv = getOrComputeAdvancedIndicators(uid, node.price, node.change24h), dP = node.price < 0.01 ? 6 : (node.price < 1 ? 4 : 2);
    
    const m = document.getElementById("specs-modal"), c = document.getElementById("modal-content-area");
    m.classList.remove("hidden"); setTimeout(() => m.classList.remove("opacity-0", "pointer-events-none"), 10);
    
    c.innerHTML = `
        <div class="border-b border-gray-800 pb-3 mb-4">
            <h2 class="text-base font-bold text-white uppercase">${node.ticker} — STRATEGIC MATRIX</h2>
            <p class="text-[10px] text-[#00f3ff] uppercase tracking-widest mt-1">${node.source}</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
            <div class="bg-gray-900/40 p-4 border border-gray-800 rounded-xl">
                <p class="text-gray-500 text-[9px] font-bold uppercase mb-2">PRICE DISCOVERY</p>
                <div class="space-y-1.5"><div class="flex justify-between"><span class="text-gray-400">Current:</span><span class="text-white font-bold">$${node.price.toFixed(dP)}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">24H High:</span><span class="text-gray-300">$${node.high24h.toFixed(dP)}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">24H Low:</span><span class="text-gray-300">$${node.low24h.toFixed(dP)}</span></div></div>
            </div>
            <div class="bg-gray-900/40 p-4 border border-gray-800 rounded-xl">
                <p class="text-gray-500 text-[9px] font-bold uppercase mb-2">SMC OSCILLATORS</p>
                <div class="space-y-1.5"><div class="flex justify-between"><span class="text-gray-400">Trend:</span><span class="text-purple-400 font-bold">${adv.smc.structural.split(" ")[0]}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">Volume:</span><span class="text-emerald-400">${adv.volTech.delta}</span></div>
                <div class="flex justify-between"><span class="text-gray-400">RSI:</span><span class="text-white">${adv.rsi.value} (${adv.rsi.slope})</span></div></div>
            </div>
        </div>
        <div class="bg-gray-900/40 p-4 border border-gray-800 rounded-xl mb-4">
            <p class="text-gray-500 text-[9px] font-bold uppercase mb-2">CONFLUENCE FACTORS</p>
            <ul class="text-[10px] text-gray-300 space-y-1">${adv.factorMatrix.map(f => `<li><span class="text-[#d4af37]">✓</span> ${f}</li>`).join("")}</ul>
        </div>
    `;
}

function closeSpecsModalWindow() {
    const m = document.getElementById("specs-modal");
    if(m) { m.classList.add("opacity-0", "pointer-events-none"); setTimeout(() => m.classList.add("hidden"), 300); }
}

function clockEngineUpdate() {
    const els = [document.getElementById("clock-24h"), document.getElementById("clock-24h-mobile")];
    const time = new Date().toTimeString().split(" ")[0];
    els.forEach(el => { if(el) el.innerText = time; });
}

window.addEventListener("DOMContentLoaded", () => {
    clockEngineUpdate(); setInterval(clockEngineUpdate, 1000);
    initPasswordGate();
});
