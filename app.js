/* ============================================================================
   KANGGABUT LABS | INSTITUTIONAL TRADING DESK — app.js
   UI Interactions, Performance Computations, & Rendering Layer Architecture
   ============================================================================ */

"use strict";

const SYSTEM_ACCESS_KEY      = "Bismillah";
const DECRYPTION_LOCK_TIMER  = 15 * 60 * 1000; // 15-minute standard session cycle

/**
 * Access Control Authentication Engine
 */
function initPasswordGate() {
    const gatewayOverlay = document.getElementById("password-gate");
    const inputField     = document.getElementById("pw-input");
    const labelError     = document.getElementById("pw-error");
    const buttonSubmit   = document.getElementById("pw-submit");

    if (!gatewayOverlay) return;
    gatewayOverlay.style.display = "flex";

    function processAuthenticationRequest() {
        const submittedKey = (inputField.value || "").trim();
        if (submittedKey === SYSTEM_ACCESS_KEY) {
            labelError.textContent = "";
            gatewayOverlay.style.opacity = "0";
            gatewayOverlay.style.transition = "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
            
            setTimeout(() => { 
                gatewayOverlay.style.display = "none"; 
            }, 400);

            // Audio acknowledgment trigger
            executeSyntheticFrequencyTone("unlock");
            
            // Unveil institutional workspace
            bootTradingDeskWorkspace();
        } else {
            labelError.textContent = "ACCESS DENIED: Invalidation of authorization sequence.";
            inputField.classList.add("shake-error");
            inputField.value = "";
            executeSyntheticFrequencyTone("error");
            setTimeout(() => inputField.classList.remove("shake-error"), 400);
        }
    }

    buttonSubmit.addEventListener("click", processAuthenticationRequest);
    inputField.addEventListener("keydown", (e) => {
        if (e.key === "Enter") processAuthenticationRequest();
    });
}

/**
 * Instantiates the workspace layout matrix post-authentication
 */
function bootTradingDeskWorkspace() {
    const mainWorkspace = document.getElementById("main-interface");
    if (mainWorkspace) {
        mainWorkspace.classList.remove("opacity-0");
        mainWorkspace.classList.add("opacity-100");
    }

    // Trigger immediate data ingestion pipelines
    if (typeof fetchAllExternalAPIPipelines === "function") {
        fetchAllExternalAPIPipelines();
    }

    // Attach immediate event hooks for live text query monitoring
    const searchBar = document.getElementById("workspace-search-input");
    if (searchBar) {
        searchBar.addEventListener("input", (e) => {
            activeQueryText = e.target.value;
            if (typeof executeWorkspaceFilteringPipeline === "function") {
                executeWorkspaceFilteringPipeline();
            }
        });
    }
}

/**
 * Core Data Rendering Grid Module
 */
function renderCoreMatrixGridInterface() {
    const currentTableBody = document.getElementById("core-trading-matrix-body");
    if (!currentTableBody) return;

    if (filteredWorkspacePool.length === 0) {
        currentTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="py-8 text-center text-slate-500 font-mono uppercase tracking-wider">
                    Tidak ada aset yang memenuhi kriteria filter saat ini.
                </td>
            </tr>`;
        return;
    }

    // Slice display rows based on maximum limits
    const viewableSubset = filteredWorkspacePool.slice(0, strictRowMaxItems);
    let cumulativeSocialVolume = 0;
    
    let htmlOutputAccumulator = "";

    viewableSubset.forEach((coin) => {
        cumulativeSocialVolume += coin.socialEngagement || 0;
        const metricsSet = generateAdvancedIndicators(coin.symbol, coin.price, coin.change24h);

        // Render clean custom style badges for signaling tags
        let signalClassMarkup = "bg-slate-950 text-slate-400 border border-slate-800";
        if (metricsSet.signalRecommendation === "STRONG BUY") {
            signalClassMarkup = "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-extrabold";
        } else if (metricsSet.signalRecommendation === "BUY") {
            signalClassMarkup = "bg-emerald-950/20 text-emerald-400 border border-emerald-800/40";
        } else if (metricsSet.signalRecommendation === "STRONG SELL") {
            signalClassMarkup = "bg-rose-950/60 text-rose-400 border border-rose-500/30 font-extrabold";
        } else if (metricsSet.signalRecommendation === "SELL") {
            signalClassMarkup = "bg-rose-950/20 text-rose-400 border border-rose-800/40";
        }

        const calculatedPriceFormatting = coin.price < 1.0 ? coin.price.toFixed(6) : coin.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        const validationTrendMarkup = coin.change24h >= 0 
            ? `<span class="text-emerald-400 font-bold font-mono">+$${coin.change24h.toFixed(2)}%</span>` 
            : `<span class="text-rose-400 font-bold font-mono">$${coin.change24h.toFixed(2)}%</span>`;

        // Micro-tags rendering for radar detections
        const lowCapRadarMarker = coin.isLowCap 
            ? `<span class="text-[9px] font-sans font-bold bg-cyan-950 text-cyan-400 border border-cyan-500/30 px-1 rounded ml-1.5 uppercase tracking-wide">Micro-Cap</span>` 
            : "";
        
        const abnormalSpikeMarker = coin.abnormalSpike
            ? `<span class="text-[9px] font-sans font-bold bg-amber-950 text-amber-400 border border-amber-500/30 px-1 rounded ml-1 uppercase tracking-wide">Spike</span>`
            : "";

        htmlOutputAccumulator += `
            <tr onclick="loadDetailedAssetConfluenceWindow('${coin.symbol}')" class="hover:bg-slate-900/60 transition-colors cursor-pointer border-b border-slate-900 group">
                <td class="py-3 px-4 font-bold text-white group-hover:text-amber-400 transition-colors">
                    <div class="flex items-center">
                        <span class="text-slate-400 font-mono tracking-tight text-xs">${coin.symbol}</span>
                        ${lowCapRadarMarker}
                        ${abnormalSpikeMarker}
                    </div>
                </td>
                <td class="py-3 px-3 text-slate-200 font-mono font-medium">$${calculatedPriceFormatting}</td>
                <td class="py-3 px-3">${validationTrendMarkup}</td>
                <td class="py-3 px-3 text-amber-400 font-mono font-bold">${coin.galaxyScore} <span class="text-[9px] text-slate-600 font-normal">/100</span></td>
                <td class="py-3 px-3 text-slate-300 font-mono">#${coin.altRank}</td>
                <td class="py-3 px-3 text-cyan-400 font-mono font-medium">${coin.socialDominance.toFixed(2)}%</td>
                <td class="py-3 px-3">
                    <div class="w-full bg-slate-950 rounded-sm h-2 border border-slate-800 relative" title="Pump Probability Score: ${coin.pumpProbability}%">
                        <div class="bg-gradient-to-r from-cyan-500 to-amber-500 h-full rounded-sm" style="width: ${coin.pumpProbability}%"></div>
                    </div>
                </td>
                <td class="py-3 px-3 text-slate-400 text-[11px] max-w-[150px] truncate" title="${metricsSet.smc.structural}">${metricsSet.smc.structural}</td>
                <td class="py-3 px-4 text-right">
                    <span class="px-2.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider ${signalClassMarkup}">
                        ${metricsSet.signalRecommendation}
                    </span>
                </td>
            </tr>
        `;
    });

    currentTableBody.innerHTML = htmlOutputAccumulator;

    // Refresh telemetry displays
    const volDisplay = document.getElementById("global-social-volume-display");
    if (volDisplay && cumulativeSocialVolume > 0) {
        volDisplay.innerHTML = `${cumulativeSocialVolume.toLocaleString()} <span class="text-xs font-normal text-slate-500">Keterlibatan Kripto Aktif</span>`;
    }
}

// Bind to window to allow api.js visibility
window.renderCoreMatrixGridInterface = renderCoreMatrixGridInterface;

/**
 * Detailed Modal Structural Renderer for Intersected Pairs
 */
function loadDetailedAssetConfluenceWindow(assetSymbol) {
    executeSyntheticFrequencyTone("click");
    
    const contextCoin = coreMemoryCache.find(c => c.symbol === assetSymbol);
    if (!contextCoin) return;

    const technicalMetrics = generateAdvancedIndicators(contextCoin.symbol, contextCoin.price, contextCoin.change24h);
    const contentArea = document.getElementById("modal-content-area");
    if (!contentArea) return;

    // Set dynamic structural metrics
    contentArea.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-800 pb-4">
            <div>
                <span class="text-slate-500 text-[10px] block uppercase font-mono font-bold">Aset Terpilih</span>
                <h3 class="text-xl font-black text-amber-400 font-mono tracking-tight">${contextCoin.symbol}</h3>
                <p class="text-[11px] text-slate-400 font-mono uppercase mt-0.5">${contextCoin.source} Feed Connection</p>
            </div>
            <div class="bg-slate-950 p-2.5 rounded border border-slate-800/60">
                <span class="text-slate-500 text-[9px] block uppercase font-mono">Skor Komposit Sosial</span>
                <div class="flex justify-between items-center mt-1">
                    <span class="text-xs font-mono font-bold text-white">Pump Probability:</span>
                    <span class="text-xs font-mono font-bold text-cyan-400">${contextCoin.pumpProbability}%</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-xs font-mono font-bold text-white">Social Momentum:</span>
                    <span class="text-xs font-mono font-bold text-amber-400">${contextCoin.socialMomentum}/100</span>
                </div>
            </div>
            <div class="bg-slate-950 p-2.5 rounded border border-slate-800/60 flex flex-col justify-between">
                <span class="text-slate-500 text-[9px] block uppercase font-mono">Detektor Lonjakan Abnormal</span>
                <span class="text-xs font-mono font-bold ${contextCoin.abnormalSpike ? 'text-amber-400 animate-pulse' : 'text-slate-400'}">
                    ${contextCoin.abnormalSpike ? '⚠️ VOLATILITAS SOSIAL SEGERA MELEDAK' : 'NORMAL / PROTOKOL STABIL'}
                </span>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-slate-950 border border-slate-800/80 p-3 rounded space-y-2">
                <h5 class="text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800 pb-1 font-bold text-cyan-400">Osilator &amp; Struktur SMA</h5>
                <div class="text-[11px] font-mono space-y-1 text-slate-300">
                    <div>RSI Value: <span class="text-white font-bold">${technicalMetrics.rsi.value}</span></div>
                    <div class="text-[10px] text-slate-400">${technicalMetrics.rsi.divergence}</div>
                    <div>Kemiringan RSI: <span class="text-white">${technicalMetrics.rsi.slope}</span></div>
                </div>
            </div>

            <div class="bg-slate-950 border border-slate-800/80 p-3 rounded space-y-2">
                <h5 class="text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800 pb-1 font-bold text-cyan-400">Analisis MACD Momentum</h5>
                <div class="text-[11px] font-mono space-y-1 text-slate-300">
                    <div>MACD Line: <span class="text-white font-bold">${technicalMetrics.macd.line.toFixed(4)}</span></div>
                    <div>Signal Line: <span class="text-white">${technicalMetrics.macd.signal.toFixed(4)}</span></div>
                    <div>Histogram: <span class="${technicalMetrics.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold">${technicalMetrics.macd.histogram.toFixed(4)}</span></div>
                </div>
            </div>

            <div class="bg-slate-950 border border-slate-800/80 p-3 rounded space-y-2">
                <h5 class="text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800 pb-1 font-bold text-cyan-400">Smart Money Structural</h5>
                <div class="text-[11px] font-mono space-y-1 text-slate-300">
                    <div>SMC Sinyal: <span class="text-amber-400 font-bold">${technicalMetrics.smc.structural}</span></div>
                    <div>Swing High: <span class="text-white">$${technicalMetrics.smc.sHigh.toFixed(4)}</span></div>
                    <div>Swing Low: <span class="text-white">$${technicalMetrics.smc.sLow.toFixed(4)}</span></div>
                </div>
            </div>

            <div class="bg-slate-950 border border-slate-800/80 p-3 rounded space-y-2">
                <h5 class="text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800 pb-1 font-bold text-cyan-400">Saringan Intelijen Komunitas</h5>
                <div class="text-[11px] font-mono space-y-1 text-slate-300">
                    <div>Kontributor Unik: <span class="text-white font-bold">${contextCoin.socialContributors.toLocaleString()}</span></div>
                    <div>Total Keterlibatan: <span class="text-white">${contextCoin.socialEngagement.toLocaleString()}</span></div>
                    <div>Tingkat Kebisingan Spam: <span class="text-rose-400">${contextCoin.spamScore.toFixed(2)}%</span></div>
                </div>
            </div>
        </div>

        <div class="bg-slate-950 border border-slate-800 p-3 rounded">
            <h5 class="text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800 pb-1.5 font-bold text-amber-400 mb-2">Multi-Timeframe Social Momentum Analysis</h5>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center font-mono text-xs">
                <div class="p-2 border border-slate-800 bg-slate-900 rounded">
                    <span class="text-[9px] block text-slate-500 uppercase">Interval 5M</span>
                    <span class="font-bold text-white text-[11px]">${contextCoin.timeframes.tf5m}</span>
                </div>
                <div class="p-2 border border-slate-800 bg-slate-900 rounded">
                    <span class="text-[9px] block text-slate-500 uppercase">Interval 15M</span>
                    <span class="font-bold text-cyan-400 text-[11px]">${contextCoin.timeframes.tf15m}</span>
                </div>
                <div class="p-2 border border-slate-800 bg-slate-900 rounded">
                    <span class="text-[9px] block text-slate-500 uppercase">Interval 1H</span>
                    <span class="font-bold text-white text-[11px]">${contextCoin.timeframes.tf1h}</span>
                </div>
                <div class="p-2 border border-slate-800 bg-slate-900 rounded">
                    <span class="text-[9px] block text-slate-500 uppercase">Interval 4H</span>
                    <span class="font-bold text-amber-400 text-[11px]">${contextCoin.timeframes.tf4h}</span>
                </div>
            </div>
        </div>

        <div class="bg-slate-950 border border-slate-800 p-3 rounded space-y-2">
            <h5 class="text-slate-400 font-mono text-[10px] uppercase font-bold text-slate-200">Konfluensi Konfirmasi Algoritmik</h5>
            <ul class="text-[11px] font-mono list-disc list-inside text-slate-400 space-y-1">
                ${technicalMetrics.confluences.map(c => `<li class="text-slate-300">${c}</li>`).join('')}
                <li class="text-amber-400 font-bold">Skor Konfluensi Terhitung: ${technicalMetrics.confluenceScore}% Kredibilitas Pembalikan.</li>
            </ul>
        </div>
    `;

    document.getElementById("specs-modal").classList.remove("hidden");
}

window.loadDetailedAssetConfluenceWindow = loadDetailedAssetConfluenceWindow;

function closeSpecsModalWindow() {
    document.getElementById("specs-modal").classList.add("hidden");
}

window.closeSpecsModalWindow = closeSpecsModalWindow;

/**
 * Simulates portfolio value and running P&L modifications
 */
function runPortfolioMathEngine() {
    const portfolioBaseVal = 84152.00;
    const deviationRandom   = (Math.sin(Date.now() / 50000) * 450) + (Math.cos(Date.now() / 20000) * 120);
    const updatedGrossValue = portfolioBaseVal + deviationRandom;
    const computedNetPnL    = 1450.25 + deviationRandom;
    const computedROI       = (computedNetPnL / portfolioBaseVal) * 100;

    const pGross = document.getElementById("portfolio-gross-value");
    const pPnl   = document.getElementById("pnl-output-value");
    const pRoi   = document.getElementById("roi-output-value");

    if (pGross) pGross.innerHTML = `$${updatedGrossValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="text-xs font-normal text-slate-500">USDT</span>`;
    
    if (computedNetPnL >= 0) {
        if (pPnl) { pPnl.innerText = `+$${computedNetPnL.toFixed(2)} USDT`; pPnl.className = "text-emerald-400 font-bold font-mono"; }
        if (pRoi) { pRoi.innerText = `+${computedROI.toFixed(2)}%`; pRoi.className = "text-emerald-400 font-bold font-mono"; }
    } else {
        if (pPnl) { pPnl.innerText = `$${computedNetPnL.toFixed(2)} USDT`; pPnl.className = "text-rose-400 font-bold font-mono"; }
        if (pRoi) { pRoi.innerText = `${computedROI.toFixed(2)}%`; pRoi.className = "text-rose-400 font-bold font-mono"; }
    }
}

/**
 * High-performance 24-hour clock updating module
 */
function runClockEngineUpdate() {
    const clockContainer = document.getElementById("clock-24h");
    if (clockContainer) {
        clockContainer.innerText = new Date().toTimeString().split(" ")[0];
    }
}

/**
 * Custom Audio Synthesizer Framework (Bypasses dependency issues)
 */
function executeSyntheticFrequencyTone(contextType) {
    try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxClass) return;
        const ctx = new AudioCtxClass();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        if (contextType === "unlock") {
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        } else if (contextType === "click") {
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        } else if (contextType === "error") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(130, ctx.currentTime);
            gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        }
    } catch (e) {
        // Suppress audio constraints gracefully
    }
}

/**
 * Modular Theme Configurator Switching Module
 */
function toggleChassisTheme() {
    document.body.classList.toggle("light-theme");
}

window.toggleChassisTheme = toggleChassisTheme;

/**
 * Initialization Event Bootstrapper Hook
 */
window.addEventListener("DOMContentLoaded", () => {
    runClockEngineUpdate();
    setInterval(runClockEngineUpdate, 1000);
    setInterval(runPortfolioMathEngine, 3500);

    // Initialize security system layers
    initPasswordGate();

    // Session security refresh timeout setup
    setTimeout(() => {
        console.warn("[SESSION DECRYPTION EXPIRATION] Re-locking terminal security gates.");
        window.location.reload();
    }, DECRYPTION_LOCK_TIMER);
});
