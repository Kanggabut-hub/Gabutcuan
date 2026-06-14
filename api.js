/**
 * api.js — Quant OS Data Pipeline v3
 * NEW: simulateOrderFlow() — Delta, CVD, Imbalance, Footprint
 *      OF integrated into confluence scoring
 *      DATA_STATUS enum: DATA_OK / DEGRADED / ERROR
 * Binance → Bybit → deterministic fallback chain
 */

'use strict';

// ── DATA STATUS ENUM ─────────────────────────────────────
const DATA_STATUS = Object.freeze({
    OK:       'ok',
    DEGRADED: 'warn',
    ERROR:    'err',
});

const API = {
    BINANCE_URL:     'https://api.binance.com/api/v3/ticker/24hr',
    BYBIT_URL:       'https://api.bybit.com/v5/market/tickers?category=linear',
    DEXSCREENER_URL: 'https://api.dexscreener.com/latest/dex/search?q=',
    MIN_VOLUME:      10_000_000,

    // ── AbortSignal polyfill ─────────────────────────────
    _timeout(ms) {
        if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
        const c = new AbortController();
        setTimeout(() => c.abort(), ms);
        return c.signal;
    },

    // ── Generic fetch with retry ─────────────────────────
    async _fetch(url, ms = 7000, retries = 1) {
        for (let i = 0; i <= retries; i++) {
            try {
                const res = await fetch(url, {
                    signal: this._timeout(ms),
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (err) {
                if (i === retries) throw err;
                await new Promise(r => setTimeout(r, 600 * (i + 1)));
            }
        }
    },

    // ── Binance ──────────────────────────────────────────
    async _fetchBinance() {
        const data = await this._fetch(this.BINANCE_URL, 7000, 1);
        if (!Array.isArray(data)) throw new Error('Binance: bad payload');
        const pairs = data
            .filter(d => d?.symbol?.endsWith('USDT') && this._n(d.quoteVolume) >= this.MIN_VOLUME)
            .map(d => ({
                symbol:    d.symbol,
                price:     this._n(d.lastPrice),
                change24h: this._n(d.priceChangePercent),
                volume:    this._n(d.quoteVolume),
                source:    'binance',
            }));
        if (!pairs.length) throw new Error('Binance: no pairs');
        return pairs;
    },

    // ── Bybit ────────────────────────────────────────────
    async _fetchBybit() {
        const data = await this._fetch(this.BYBIT_URL, 7000, 1);
        const list = data?.result?.list;
        if (!Array.isArray(list)) throw new Error('Bybit: bad payload');
        const pairs = list
            .filter(d => d?.symbol?.endsWith('USDT') && this._n(d.turnover24h) >= this.MIN_VOLUME)
            .map(d => ({
                symbol:    d.symbol,
                price:     this._n(d.lastPrice),
                change24h: this._n(d.price24hPcnt) * 100,
                volume:    this._n(d.turnover24h),
                source:    'bybit',
            }));
        if (!pairs.length) throw new Error('Bybit: no pairs');
        return pairs;
    },

    _mergePairs(primary, secondary) {
        const seen = new Set(primary.map(p => p.symbol));
        return [...primary, ...secondary.filter(p => !seen.has(p.symbol))];
    },

    // ── Public: fetchMarketData ──────────────────────────
    async fetchMarketData() {
        try {
            const binance = await this._fetchBinance();
            try {
                return this._mergePairs(binance, await this._fetchBybit());
            } catch { return binance; }
        } catch {
            try { return await this._fetchBybit(); }
            catch { return this.getFallbackData(); }
        }
    },

    // ── DEX Search ───────────────────────────────────────
    async searchPairs(query) {
        if (!query?.trim()) return [];
        try {
            const data = await this._fetch(
                `${this.DEXSCREENER_URL}${encodeURIComponent(query.trim().toUpperCase())}`,
                5000, 0
            );
            if (!Array.isArray(data?.pairs)) return [];
            return data.pairs.slice(0, 8).map(p => ({
                symbol:    `${p?.baseToken?.symbol ?? '?'}/${p?.quoteToken?.symbol ?? '?'}`,
                price:     this._n(p?.priceUsd),
                change24h: this._n(p?.priceChange?.h24),
                volume:    this._n(p?.volume?.h24),
                source:    'dex',
            })).filter(p => p.price > 0 || p.volume > 0);
        } catch (e) {
            console.warn('[API] searchPairs:', e.message);
            return [];
        }
    },

    // ── Market Regime ────────────────────────────────────
    getMarketRegime() {
        const t = Date.now() / 86_400_000;
        const s1 = Math.sin(t), s2 = Math.sin(t / 2), s3 = Math.sin(t / 3);
        return {
            fearGreed:    this._clamp(Math.round(50 + s1 * 30), 0, 100),
            btcDominance: (52.5 + s2 * 2).toFixed(1),
            dxy:          (103.5 - s3 * 1.5).toFixed(2),
            moonPhase:    s1 > 0.5 ? 'Full Moon' : s1 < -0.5 ? 'New Moon' : 'Waxing',
            regimeBias:   parseFloat(s1.toFixed(3)),
        };
    },

    // ── Order Flow Simulation ────────────────────────────
    /**
     * Returns Delta, CVD, Imbalance, Footprint for a pair.
     * Deterministic per symbol + minute bucket (changes on Re-Analyze).
     */
    simulateOrderFlow(symbol, price, change24h, isReanalyze = false) {
        if (!symbol) return this._emptyOrderFlow();
        const p = this._n(price);
        const c = this._n(change24h);

        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = (symbol.charCodeAt(i) + ((hash << 5) - hash)) | 0;
        }
        if (isReanalyze) hash = (hash + Math.floor(Date.now() / 60_000)) | 0;

        const rand = (seed) => {
            const x = Math.sin(hash + seed) * 10_000;
            return x - Math.floor(x);
        };

        const baseBias = c >= 0 ? 1 : -1;

        // Delta: net buy-sell volume (positive = buy pressure)
        const deltaRaw  = (rand(10) * 2 - 1 + baseBias * 0.4);   // -1.4 to 1.4
        const deltaM    = (deltaRaw * p * 0.00005).toFixed(2);     // scaled to price
        const deltaVal  = parseFloat(deltaM);

        // CVD: cumulative volume delta direction
        const cvdBullish = rand(11) > (baseBias > 0 ? 0.35 : 0.65);
        const cvdTrend   = cvdBullish ? 'Rising' : 'Falling';

        // Imbalance: ask/bid stack ratio (>1 = ask heavy = bearish, <1 = bid heavy = bullish)
        const imbalanceRaw  = 0.6 + rand(12) * 0.8; // 0.6 – 1.4
        const imbalanceBull = baseBias > 0 ? imbalanceRaw < 1.0 : imbalanceRaw > 1.0;
        const imbalanceStr  = imbalanceRaw.toFixed(2);

        // Footprint: dominant candle cluster (POC = Point of Control)
        const pocOffset = (rand(13) * 2 - 1) * p * 0.003; // ±0.3% from price
        const poc       = (p + pocOffset).toFixed(p > 10 ? 2 : 5);

        // OF score contribution [-2, +2]
        let ofScore = 0;
        if (deltaVal > 0)    ofScore += 0.8;
        else                 ofScore -= 0.8;
        if (cvdBullish)      ofScore += 0.7;
        else                 ofScore -= 0.7;
        if (imbalanceBull)   ofScore += 0.5;
        else                 ofScore -= 0.5;

        return {
            delta:      `${deltaVal >= 0 ? '+' : ''}${deltaVal}M`,
            cvd:        cvdTrend,
            imbalance:  imbalanceStr,
            footprint:  `POC: ${poc}`,
            ofScore:    this._clamp(ofScore, -2, 2),   // used in scoring
            bullish:    ofScore > 0,
        };
    },

    _emptyOrderFlow() {
        return { delta: '0M', cvd: 'Neutral', imbalance: '1.00', footprint: 'POC: —', ofScore: 0, bullish: null };
    },

    // ── Indicator Simulation (with OF integration) ───────
    simulateIndicators(symbol, price, baseChange, isReanalyze = false) {
        if (!symbol || typeof symbol !== 'string') return this._emptyIndicators();

        const safeP = this._n(price);
        const safeC = this._n(baseChange);
        const regime = this.getMarketRegime();

        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = (symbol.charCodeAt(i) + ((hash << 5) - hash)) | 0;
        }
        if (isReanalyze) hash = (hash + Math.floor(Date.now() / 60_000)) | 0;

        const rand = (seed) => {
            const x = Math.sin(hash + seed) * 10_000;
            return x - Math.floor(x);
        };

        const baseBias = safeC >= 0 ? 1 : -1;

        const mtf = {
            M15: rand(1) > 0.50 ? 'Bullish' : 'Bearish',
            H1:  rand(2) > 0.40 ? 'Bullish' : 'Bearish',
            H4:  baseBias > 0   ? 'Bullish' : 'Bearish',
            D1:  baseBias > 0   ? 'Bullish' : 'Bearish',
        };

        const indicators = {
            liquiditySweep: rand(3) > 0.70 ? 'Detected' : 'None',
            smc:            rand(4) > 0.50 ? 'CHoCH'    : 'BOS',
            ema:            baseBias > 0   ? 'Price > EMA200' : 'Price < EMA200',
            fib:            rand(6) > 0.50 ? '0.618 Pocket'   : '0.382 Retrace',
        };

        // Order Flow
        const of = this.simulateOrderFlow(symbol, safeP, safeC, isReanalyze);

        // Confluence score [0–10]
        let score = 5 + regime.regimeBias * 1.5;
        if (mtf.H1 === mtf.H4) score += mtf.H4 === 'Bullish' ?  1.5 : -1.5;
        if (mtf.H4 === mtf.D1) score += mtf.D1 === 'Bullish' ?  1.0 : -1.0;
        if (indicators.liquiditySweep === 'Detected') score += baseBias > 0 ? 1 : -1;
        score += safeC / 5;
        score += rand(7) * 1.5 - 0.75;
        score += of.ofScore;          // ← Order Flow contribution
        score  = this._clamp(score, 0, 10);
        if (!isFinite(score)) score = 5;

        const direction = score >= 5 ? 'LONG' : 'SHORT';

        let biasHint;
        if      (regime.fearGreed > 75) biasHint = 'Caution: Extreme Greed. Expect pullbacks.';
        else if (regime.fearGreed < 25) biasHint = 'Accumulation phase. Macro favors Longs.';
        else if (of.bullish === true  && score > 7) biasHint = 'Order Flow confirms bullish pressure.';
        else if (of.bullish === false && score < 3) biasHint = 'Order Flow confirms distribution.';
        else if (score > 8)             biasHint = 'Strong momentum alignment across MTF.';
        else if (score < 2)             biasHint = 'Heavy distribution detected. Favor Shorts.';
        else                            biasHint = 'Mixed signals. Wait for structural confirmation.';

        const dec = safeP > 10 ? 2 : 5;
        const fmt = (n) => isFinite(n) ? n.toFixed(dec) : '0';

        return {
            score:     score.toFixed(1),
            direction,
            biasHint,
            mtf,
            indicators,
            orderFlow: of,
            tradeStructure: {
                entry:      fmt(safeP),
                sl:         fmt(direction === 'LONG' ? safeP * 0.98 : safeP * 1.02),
                tp:         fmt(direction === 'LONG' ? safeP * 1.05 : safeP * 0.95),
                powerRatio: Math.floor(rand(8) * 30) + 70,
            },
        };
    },

    _emptyIndicators() {
        return {
            score: '5.0', direction: 'LONG', biasHint: 'Insufficient data.',
            mtf: { M15: 'Neutral', H1: 'Neutral', H4: 'Neutral', D1: 'Neutral' },
            indicators: { liquiditySweep: 'None', smc: 'BOS', ema: '—', fib: '—' },
            orderFlow: this._emptyOrderFlow(),
            tradeStructure: { entry: '0', sl: '0', tp: '0', powerRatio: 50 },
        };
    },

    getFallbackData() {
        return [
            { symbol: 'BTCUSDT',  price: 65420.50, change24h:  2.4, volume: 45_000_000_000, source: 'fallback' },
            { symbol: 'ETHUSDT',  price: 3450.10,  change24h: -1.2, volume: 15_000_000_000, source: 'fallback' },
            { symbol: 'SOLUSDT',  price: 145.20,   change24h:  5.6, volume:  4_000_000_000, source: 'fallback' },
            { symbol: 'XRPUSDT',  price: 0.58,     change24h: -0.5, volume:  1_200_000_000, source: 'fallback' },
            { symbol: 'BNBUSDT',  price: 412.30,   change24h:  1.1, volume:    900_000_000, source: 'fallback' },
            { symbol: 'DOGEUSDT', price: 0.1240,   change24h:  3.2, volume:    750_000_000, source: 'fallback' },
        ];
    },

    _n(v)          { const n = parseFloat(v); return isFinite(n) ? n : 0; },
    _clamp(v,a,b)  { return Math.max(a, Math.min(b, v)); },
};
