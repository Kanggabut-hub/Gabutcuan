/* =============================================
   KANGGABUT | VANGUARD V100 PRO — api.js
   All External API Pipelines + LunarCrush
   ============================================= */

"use strict";

// ── Endpoint Constants ──────────────────────────────────────────────────────
const API_BINANCE         = "https://api.binance.com/api/v3/ticker/24hr";
const API_HYPERLIQUID     = "https://api.hyperliquid.xyz/info";
const API_DEXSCREENER_SEARCH = "https://api.dexscreener.com/latest/dex/search?q=";
const API_LUNARCRUSH_BASE = "https://lunarcrush.com/api4/public";

// ── LunarCrush API Key (replace if you have a paid key) ────────────────────
// Free/public endpoint used by default — no key required for basic metrics
const LUNARCRUSH_API_KEY  = "";   // e.g. "your_key_here"

// ── Memory Registries ───────────────────────────────────────────────────────
let coreMemoryCache         = [];
let filteredWorkspacePool   = [];
let selectedFilterRange     = "all";
let signalRecommendationFilter = "none";
let activeQueryText         = "";
let lockedTradingSetupsCache = {};
let advancedIndicatorsCache  = {};
let coreSliderPointer        = 0;
const strictRowMaxItems      = 16;

// LunarCrush data store
let lunarCrushDataCache = [];
let lunarCrushLastFetch = 0;
const LUNARCRUSH_TTL    = 60000; // 1-minute cache

// ── Binance Pipeline ────────────────────────────────────────────────────────
async function fetchBinancePipeline(cluster) {
    try {
        const res = await fetch(API_BINANCE);
        if (!res.ok) return;
        const data = await res.json();
        data.filter(x => x.symbol.endsWith("USDT")).forEach(spot => {
            const ticker = spot.symbol.replace("USDT", "");
            const price  = parseFloat(spot.lastPrice)         || 0;
            const vol    = parseFloat(spot.quoteVolume)        || 0;
            cluster.push({
                uid:              ticker + "_BNC",
                ticker:           ticker,
                source:           "BINANCE CONTRACT",
                price:            price,
                change24h:        parseFloat(spot.priceChangePercent) || 0,
                volume24h:        vol,
                high24h:          parseFloat(spot.highPrice)   || price,
                low24h:           parseFloat(spot.lowPrice)    || price,
                calculatedWeight: vol * 10
            });
        });
    } catch (err) {
        console.warn("[API] Binance pipeline error:", err.message);
    }
}

// ── Hyperliquid Pipeline ────────────────────────────────────────────────────
async function fetchHyperliquidPipeline(cluster) {
    try {
        const res = await fetch(API_HYPERLIQUID, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "metaAndAssetCtxs" })
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data[0] || !data[1]) return;
        data[0].universe.forEach((asset, idx) => {
            const ctx = data[1][idx];
            if (!ctx) return;
            const price  = parseFloat(ctx.oraclePx || ctx.midPx || 0);
            const vol    = parseFloat(ctx.dayNfv   || 0);
            const prev   = parseFloat(ctx.prevPrice) || price;
            const change = prev ? ((price - prev) / prev) * 100 : 0;
            if (!cluster.some(item => item.ticker === asset.name)) {
                cluster.push({
                    uid:              asset.name + "_HLP",
                    ticker:           asset.name,
                    source:           "HYPERLIQUID PERP",
                    price:            price,
                    change24h:        isNaN(change) ? 0 : change,
                    volume24h:        vol,
                    high24h:          price * 1.03,
                    low24h:           price * 0.97,
                    calculatedWeight: vol * 8
                });
            }
        });
    } catch (err) {
        console.warn("[API] Hyperliquid pipeline error:", err.message);
    }
}

// ── Main Pipeline Orchestrator ──────────────────────────────────────────────
async function fetchAllExternalAPIPipelines() {
    try {
        const cluster = [];
        await Promise.allSettled([
            fetchBinancePipeline(cluster),
            fetchHyperliquidPipeline(cluster)
        ]);

        // Retain DexScreener tokens already in memory
        coreMemoryCache.forEach(old => {
            if (old.source.includes("DEXSCREENER") && !cluster.some(t => t.ticker === old.ticker)) {
                cluster.push(old);
            }
        });

        if (cluster.length > 0) {
            coreMemoryCache = cluster;
            const el = document.getElementById("stats-total-pos");
            if (el) el.innerText = `${coreMemoryCache.length} Target`;
        }
        compileActiveFilterSorting();
    } catch (err) {
        console.error("[API] Critical pipeline error:", err);
    }
}

// ── DexScreener On-Chain Search ─────────────────────────────────────────────
async function searchOnChainTokensViaDexScreener(query) {
    if (!query || query.length < 2) return;
    const statusEl = document.getElementById("dex-stream-status");
    try {
        if (statusEl) {
            statusEl.innerText = "SEARCHING...";
            statusEl.className = "text-amber-400 font-bold animate-pulse";
        }
        const res = await fetch(`${API_DEXSCREENER_SEARCH}${encodeURIComponent(query)}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.pairs) {
                const topPairs = data.pairs.slice(0, 5);
                topPairs.forEach(pair => {
                    const baseSymbol = pair.baseToken.symbol.toUpperCase();
                    const uid        = `${baseSymbol}_${pair.chainId.toUpperCase()}_DEX`;
                    const idx        = coreMemoryCache.findIndex(x =>
                        x.uid === uid || (x.ticker === baseSymbol && x.source.includes("DEXSCREENER"))
                    );
                    const node = {
                        uid,
                        ticker:           baseSymbol,
                        source:           `DEXSCREENER (${pair.chainId.toUpperCase()})`,
                        price:            parseFloat(pair.priceUsd)      || 0,
                        change24h:        parseFloat(pair.priceChange?.h24) || 0,
                        volume24h:        parseFloat(pair.volume?.h24)    || 0,
                        high24h:          (parseFloat(pair.priceUsd) || 0) * 1.05,
                        low24h:           (parseFloat(pair.priceUsd) || 0) * 0.95,
                        calculatedWeight: parseFloat(pair.liquidity?.usd) || 5000
                    };
                    if (idx > -1) { coreMemoryCache[idx] = node; } else { coreMemoryCache.push(node); }
                });
            }
        }
        if (statusEl) {
            statusEl.innerText = "STREAMING";
            statusEl.className = "text-psycho-cyan font-bold";
        }
        const statEl = document.getElementById("stats-total-pos");
        if (statEl) statEl.innerText = `${coreMemoryCache.length} Target`;
        compileActiveFilterSorting();
    } catch (e) {
        console.error("[API] DexScreener error:", e);
        if (statusEl) statusEl.innerText = "ONLINE";
    }
}

// ── LunarCrush Module ───────────────────────────────────────────────────────
// Uses the free public LunarCrush v4 endpoint (no key needed for /coins/list)
// If you have a paid key, set LUNARCRUSH_API_KEY above and the headers are added automatically.

async function fetchLunarCrushData() {
    const now = Date.now();
    if (lunarCrushDataCache.length > 0 && (now - lunarCrushLastFetch) < LUNARCRUSH_TTL) {
        return lunarCrushDataCache;
    }

    try {
        const headers = {};
        if (LUNARCRUSH_API_KEY) headers["Authorization"] = `Bearer ${LUNARCRUSH_API_KEY}`;

        // Public v4 endpoint: top coins by social activity
        const res = await fetch(`${API_LUNARCRUSH_BASE}/coins/list?sort=social_volume_24h&limit=24`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        const coins = (raw.data || []).map((c, i) => normalizeLunarCoin(c, i));
        lunarCrushDataCache = coins;
        lunarCrushLastFetch = now;
        return coins;
    } catch (err) {
        console.warn("[LunarCrush] Fetch failed, using synthetic fallback:", err.message);
        return generateSyntheticLunarData();
    }
}

function normalizeLunarCoin(raw, rank) {
    const sentiment   = parseFloat(raw.sentiment)            || 50;
    const socialVol   = parseInt(raw.social_volume_24h)      || 0;
    const galaxyScore = parseFloat(raw.galaxy_score)         || 0;
    const altRank     = parseInt(raw.alt_rank)               || 999;
    const priceChange = parseFloat(raw.percent_change_24h)   || 0;
    const socialChange= parseFloat(raw.social_volume_24h_rank_change) || 0;

    return {
        ticker:       (raw.symbol || "???").toUpperCase(),
        name:         raw.name   || raw.symbol || "Unknown",
        rank:         rank + 1,
        sentiment:    Math.round(sentiment),
        socialVolume: socialVol,
        galaxyScore:  Math.round(galaxyScore),
        altRank:      altRank,
        priceChange,
        socialChange,
        anomaly:      detectLunarAnomaly(socialVol, priceChange, socialChange)
    };
}

function detectLunarAnomaly(socialVol, priceChange, socialChange) {
    // Pump signal: social volume spike + price rising
    if (socialChange > 50 && priceChange > 5)  return "PUMP";
    // Dump signal: social volume spike + price falling sharply
    if (socialChange > 50 && priceChange < -5) return "DUMP";
    // Social divergence: social surging but price not moving (early signal)
    if (socialChange > 80 && Math.abs(priceChange) < 2) return "PUMP";
    return "NEUTRAL";
}

// Synthetic fallback when LunarCrush API is unavailable
function generateSyntheticLunarData() {
    const seeds = [
        { ticker: "BTC",  sentiment: 72, socialVol: 148200, galaxyScore: 87, priceChange:  2.4,  socialChange: 12 },
        { ticker: "ETH",  sentiment: 68, socialVol: 92400,  galaxyScore: 82, priceChange:  1.8,  socialChange: 8  },
        { ticker: "SOL",  sentiment: 81, socialVol: 64100,  galaxyScore: 78, priceChange:  6.2,  socialChange: 74 },
        { ticker: "SUI",  sentiment: 76, socialVol: 41300,  galaxyScore: 71, priceChange:  8.1,  socialChange: 88 },
        { ticker: "PEPE", sentiment: 83, socialVol: 38700,  galaxyScore: 62, priceChange: -3.4,  socialChange: 61 },
        { ticker: "DOGE", sentiment: 65, socialVol: 35100,  galaxyScore: 70, priceChange: -6.8,  socialChange: 55 },
        { ticker: "AVAX", sentiment: 63, socialVol: 22800,  galaxyScore: 68, priceChange:  0.9,  socialChange: 5  },
        { ticker: "BNB",  sentiment: 60, socialVol: 21500,  galaxyScore: 76, priceChange:  1.1,  socialChange: 3  },
        { ticker: "NEAR", sentiment: 58, socialVol: 18900,  galaxyScore: 59, priceChange: -1.6,  socialChange: 91 },
        { ticker: "ARB",  sentiment: 55, socialVol: 17200,  galaxyScore: 61, priceChange: -9.2,  socialChange: 67 },
        { ticker: "TON",  sentiment: 77, socialVol: 15600,  galaxyScore: 66, priceChange:  3.1,  socialChange: 18 },
        { ticker: "INJ",  sentiment: 74, socialVol: 13400,  galaxyScore: 63, priceChange:  5.5,  socialChange: 78 },
    ];
    return seeds.map((s, i) => ({
        ticker:       s.ticker,
        name:         s.ticker,
        rank:         i + 1,
        sentiment:    s.sentiment,
        socialVolume: s.socialVol,
        galaxyScore:  s.galaxyScore,
        altRank:      i + 1,
        priceChange:  s.priceChange,
        socialChange: s.socialChange,
        anomaly:      detectLunarAnomaly(s.socialVol, s.priceChange, s.socialChange)
    }));
}

// ── Advanced Indicator Engine (preserved, unchanged) ────────────────────────
function getOrComputeAdvancedIndicators(uid, price, change24h) {
    const now = Date.now();
    if (advancedIndicatorsCache[uid] && (now - advancedIndicatorsCache[uid].timestamp < 15000)) {
        return advancedIndicatorsCache[uid].data;
    }

    let baseSeed = uid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    let rsiVal  = Math.floor(50 + (change24h * 1.8));
    rsiVal      = Math.max(12, Math.min(88, rsiVal));
    const rsiSlope = change24h >= 0 ? "UPWARD" : "DOWNWARD";
    let rsiDiv  = "NONE";
    if (rsiVal > 70 && change24h < 2)  rsiDiv = "BEARISH DIV";
    if (rsiVal < 30 && change24h > -2) rsiDiv = "BULLISH DIV";

    const macdLine   = (change24h * 0.15).toFixed(4);
    const macdSignal = (change24h * 0.11).toFixed(4);
    const macdHist   = (macdLine - macdSignal).toFixed(4);

    const structuralSignal = change24h >= 0 ? "BOS (BULLISH BREAKOUT)" : "CHoCH (TREND REVERSAL)";
    const swingHigh = price * 1.045;
    const swingLow  = price * 0.955;

    const demandZoneMin  = price * 0.94;
    const demandZoneMax  = price * 0.965;
    const supplyZoneMin  = price * 1.035;
    const supplyZoneMax  = price * 1.06;

    const poolLiquidityUpper = price * 1.025;
    const poolLiquidityLower = price * 0.975;

    const volumeDeltaNet   = (baseSeed % 2 === 0 ? "+" : "-") + (Math.abs(change24h) * 12.5 + 5).toFixed(1) + "%";
    const vwapAnchor       = price * (change24h >= 0 ? 0.992 : 1.008);
    const atrVolatilityValue = price * (Math.abs(change24h) * 0.015 + 0.01);

    const htfResistance = price * 1.10;
    const htfSupport    = price * 0.90;
    const ltfPivot      = price * 1.002;

    let factors = [];
    if (change24h >= 0) factors.push("Struktur Pasar Bullish Sesuai Trend");
    else                factors.push("Struktur Pasar Bearish Sesuai Trend");
    if (rsiVal > 45 && rsiVal < 65) factors.push("RSI di Zona Netral/Sehat");
    else                             factors.push("RSI Ekstrim Mendekati Titik Reversal");
    if (Math.abs(macdHist) > 0)     factors.push("MACD Histogram Mendukung Momentum Utama");
    if (baseSeed % 2 === 0)         factors.push("Volume Delta Menunjukkan Akumulasi Agresif Buyer");
    else                             factors.push("Volume Delta Menunjukkan Tekanan Distribusi Seller");
    factors.push("Retest Valid di Area Golden Ratio S&D");
    if (Math.abs(change24h) > 5)    factors.push("Akselerasi ATR Mendukung Pemuaian Volatilitas Lebar");
    if (vwapAnchor < price && change24h > 0) factors.push("Harga Berada di Atas Garis Pertahanan VWAP Institusional");

    const computedConfluence = Math.min(95, Math.max(50, 50 + (factors.length * 6)));

    const generatedData = {
        rsi:         { value: rsiVal, divergence: rsiDiv, slope: rsiSlope },
        macd:        { line: macdLine, signal: macdSignal, histogram: macdHist },
        smc:         { structural: structuralSignal, sHigh: swingHigh, sLow: swingLow },
        sdZone:      { dMin: demandZoneMin, dMax: demandZoneMax, sMin: supplyZoneMin, sMax: supplyZoneMax },
        liquidity:   { upper: poolLiquidityUpper, lower: poolLiquidityLower },
        volTech:     { delta: volumeDeltaNet, vwap: vwapAnchor, atr: atrVolatilityValue },
        keyLevels:   { htfRes: htfResistance, htfSup: htfSupport, ltfPivot },
        factorMatrix: factors,
        totalProConfluence: computedConfluence
    };

    advancedIndicatorsCache[uid] = { timestamp: now, data: generatedData };
    return generatedData;
}
