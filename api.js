/**
 * api.js — Quant OS Data Pipeline v2
 * - Binance primary → Bybit fallback → deterministic fallback
 * - AbortSignal.timeout polyfill for older browsers
 * - Retry logic with exponential backoff
 * - Normalized data schema, NaN-safe everywhere
 * - DexScreener search with query normalization
 */

'use strict';

const API = {
    BINANCE_URL:     'https://api.binance.com/api/v3/ticker/24hr',
    BYBIT_URL:       'https://api.bybit.com/v5/market/tickers?category=linear',
    DEXSCREENER_URL: 'https://api.dexscreener.com/latest/dex/search?q=',

    MIN_VOLUME: 10_000_000, // lowered to include more pairs incl. low-cap

    // ── AbortSignal polyfill ───────────────────────────────
    _timeout(ms) {
        if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), ms);
        return ctrl.signal;
    },

    // ── Generic fetch with retry ──────────────────────────
    async _fetch(url, ms = 7000, retries = 1) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const res = await fetch(url, {
                    signal: this._timeout(ms),
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch (err) {
                if (attempt === retries) throw err;
                // brief back-off before retry
                await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
            }
        }
    },

    // ── Primary: Binance ──────────────────────────────────
    async _fetchBinance() {
        const data = await this._fetch(this.BINANCE_URL, 7000, 1);
        if (!Array.isArray(data)) throw new Error('Binance: unexpected payload');

        const pairs = data
            .filter(d =>
                d && typeof d.symbol === 'string' &&
                d.symbol.endsWith('USDT') &&
                this._n(d.quoteVolume) >= this.MIN_VOLUME
            )
            .map(d => this._normalizeBinance(d));

        if (pairs.length === 0) throw new Error('Binance: no pairs passed filter');
        return pairs;
    },

    _normalizeBinance(d) {
        return {
            symbol:    d.symbol,
            price:     this._n(d.lastPrice),
            change24h: this._n(d.priceChangePercent),
            volume:    this._n(d.quoteVolume),
            source:    'binance',
        };
    },

    // ── Secondary: Bybit ─────────────────────────────────
    async _fetchBybit() {
        const data = await this._fetch(this.BYBIT_URL, 7000, 1);
        const list = data?.result?.list;
        if (!Array.isArray(list)) throw new Error('Bybit: unexpected payload');

        const pairs = list
            .filter(d =>
                d && typeof d.symbol === 'string' &&
                d.symbol.endsWith('USDT') &&
                this._n(d.turnover24h) >= this.MIN_VOLUME
            )
            .map(d => ({
                symbol:    d.symbol,
                price:     this._n(d.lastPrice),
                change24h: this._n(d.price24hPcnt) * 100,
                volume:    this._n(d.turnover24h),
                source:    'bybit',
            }));

        if (pairs.length === 0) throw new Error('Bybit: no pairs passed filter');
        return pairs;
    },

    // ── Merge deduplicated pairs (Binance takes priority) ─
    _mergePairs(primary, secondary) {
        const seen = new Set(primary.map(p => p.symbol));
        const extra = secondary.filter(p => !seen.has(p.symbol));
        return [...primary, ...extra];
    },

    // ── Public: fetch market data ─────────────────────────
    async fetchMarketData() {
        // Try Binance
        try {
            const binance = await this._fetchBinance();
            // Also try Bybit in background to enrich coverage
            try {
                const bybit = await this._fetchBybit();
                return this._mergePairs(binance, bybit);
            } catch {
                return binance; // Bybit failed but Binance ok
            }
        } catch (binanceErr) {
            console.warn('[API] Binance failed — trying Bybit.', binanceErr.message);
            try {
                return await this._fetchBybit();
            } catch (bybitErr) {
                console.warn('[API] Bybit failed — using fallback.', bybitErr.message);
                return this.getFallbackData();
            }
        }
    },

    // ── DEX search ────────────────────────────────────────
    async searchPairs(query) {
        if (!query || typeof query !== 'string') return [];
        const q = query.trim().toUpperCase();
        if (!q) return [];
        try {
            const data = await this._fetch(
                `${this.DEXSCREENER_URL}${encodeURIComponent(q)}`,
                5000, 0
            );
            if (!data || !Array.isArray(data.pairs)) return [];

            return data.pairs.slice(0, 8).map(p => ({
                symbol:    `${p?.baseToken?.symbol ?? '?'}/${p?.quoteToken?.symbol ?? '?'}`,
                price:     this._n(p?.priceUsd),
                change24h: this._n(p?.priceChange?.h24),
                volume:    this._n(p?.volume?.h24),
                source:    'dex',
            })).filter(p => p.price > 0 || p.volume > 0);
        } catch (e) {
            console.warn('[API] searchPairs failed:', e.message);
            return [];
        }
    },

    // ── Market Regime (deterministic, day-stable) ─────────
    getMarketRegime() {
        const t = Date.now() / 86_400_000;
        const s1 = Math.sin(t), s2 = Math.sin(t / 2), s3 = Math.sin(t / 3);
        const fearGreed    = Math.round(50 + s1 * 30);
        const btcDominance = (52.5 + s2 * 2).toFixed(1);
        const dxy          = (103.5 - s3 * 1.5).toFixed(2);
        const moonPhase    = s1 > 0.5 ? 'Full Moon' : s1 < -0.5 ? 'New Moon' : 'Waxing';
        const regimeBias   = parseFloat(s1.toFixed(3));

        return {
            fearGreed:    this._clamp(fearGreed, 0, 100),
            btcDominance,
            dxy,
            moonPhase,
            regimeBias,   // always a valid float
        };
    },

    // ── Indicator Simulation ─────────────────────────────
    simulateIndicators(symbol, price, baseChange, isReanalyze = false) {
        if (!symbol || typeof symbol !== 'string') return this._emptyIndicators();

        const safePrice  = this._n(price);
        const safeChange = this._n(baseChange);

        const regime = this.getMarketRegime();

        // Deterministic integer hash from symbol
        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = (symbol.charCodeAt(i) + ((hash << 5) - hash)) | 0;
        }
        if (isReanalyze) hash = (hash + Math.floor(Date.now() / 60_000)) | 0;

        // Seeded pseudo-random [0,1)
        const rand = (seed) => {
            const x = Math.sin(hash + seed) * 10_000;
            return x - Math.floor(x);
        };

        const baseBias = safeChange >= 0 ? 1 : -1;

        const mtf = {
            M15: rand(1) > 0.50 ? 'Bullish' : 'Bearish',
            H1:  rand(2) > 0.40 ? 'Bullish' : 'Bearish',
            H4:  baseBias > 0   ? 'Bullish' : 'Bearish',
            D1:  baseBias > 0   ? 'Bullish' : 'Bearish',
        };

        const indicators = {
            liquiditySweep: rand(3) > 0.70 ? 'Detected' : 'None',
            smc:            rand(4) > 0.50 ? 'CHoCH'    : 'BOS',
            delta:          `${(rand(5) * 100).toFixed(1)}M`,
            ema:            baseBias > 0   ? 'Price > EMA200' : 'Price < EMA200',
            fib:            rand(6) > 0.50 ? '0.618 Pocket'   : '0.382 Retrace',
        };

        // Score — always valid float [0,10]
        let score = 5 + regime.regimeBias * 1.5;
        if (mtf.H1 === mtf.H4) score += mtf.H4 === 'Bullish' ?  1.5 : -1.5;
        if (mtf.H4 === mtf.D1) score += mtf.D1 === 'Bullish' ?  1.0 : -1.0;
        if (indicators.liquiditySweep === 'Detected') score += baseBias > 0 ? 1 : -1;
        score += safeChange / 5;
        score += rand(7) * 1.5 - 0.75;
        score  = this._clamp(score, 0, 10);
        if (!isFinite(score)) score = 5; // final NaN guard

        const direction = score >= 5 ? 'LONG' : 'SHORT';

        let biasHint;
        if      (regime.fearGreed > 75) biasHint = 'Caution: Extreme Greed regime. Expect pullbacks.';
        else if (regime.fearGreed < 25) biasHint = 'Accumulation phase. Macro favors Long setups.';
        else if (score > 8)             biasHint = 'Strong momentum alignment across MTF.';
        else if (score < 2)             biasHint = 'Heavy distribution detected. Favor Shorts.';
        else                            biasHint = 'Mixed signals. Wait for structural confirmation.';

        const dec = safePrice > 10 ? 2 : 5;
        const fmt = (n) => isFinite(n) ? n.toFixed(dec) : '0';

        return {
            score:     score.toFixed(1),
            direction,
            biasHint,
            mtf,
            indicators,
            tradeStructure: {
                entry:      fmt(safePrice),
                sl:         fmt(direction === 'LONG' ? safePrice * 0.98 : safePrice * 1.02),
                tp:         fmt(direction === 'LONG' ? safePrice * 1.05 : safePrice * 0.95),
                powerRatio: Math.floor(rand(8) * 30) + 70,
            },
        };
    },

    // ── Safe empty indicators ─────────────────────────────
    _emptyIndicators() {
        return {
            score: '5.0', direction: 'LONG', biasHint: 'Insufficient data.',
            mtf: { M15: 'Neutral', H1: 'Neutral', H4: 'Neutral', D1: 'Neutral' },
            indicators: { liquiditySweep: 'None', smc: 'BOS', delta: '0M', ema: '—', fib: '—' },
            tradeStructure: { entry: '0', sl: '0', tp: '0', powerRatio: 50 },
        };
    },

    // ── Fallback dataset ──────────────────────────────────
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

    // ── Numeric safe parse ────────────────────────────────
    _n(v) {
        const n = parseFloat(v);
        return isFinite(n) ? n : 0;
    },

    // ── Clamp ─────────────────────────────────────────────
    _clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    },
};
