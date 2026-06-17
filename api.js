/**
 * api.js — Quant OS Data Pipeline V-DEWA PREMIUM
 * Bug fixes only: no logic changes.
 * Fix: body::after z-index moved to CSS (z-index:-1 instead of 0).
 * All scoring/regime/OF/brain logic preserved exactly.
 */
'use strict';

const DATA_STATUS = Object.freeze({ OK: 'ok', DEGRADED: 'warn', ERROR: 'err' });

const API = {
    BINANCE_URL:     'https://api.binance.com/api/v3/ticker/24hr',
    BYBIT_URL:       'https://api.bybit.com/v5/market/tickers?category=linear',
    DEXSCREENER_URL: 'https://api.dexscreener.com/latest/dex/search?q=',
    MIN_VOLUME:      10_000_000,

    _timeout(ms) {
        if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(ms);
        const c = new AbortController();
        setTimeout(() => c.abort(), ms);
        return c.signal;
    },

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

    async _fetchBinance() {
        const data = await this._fetch(this.BINANCE_URL, 7000, 1);
        if (!Array.isArray(data)) throw new Error('Binance: bad payload');
        const pairs = data
            .filter(d => d?.symbol?.endsWith('USDT') && this._n(d.quoteVolume) >= this.MIN_VOLUME)
            .map(d => ({
                symbol:    String(d.symbol),
                price:     this._n(d.lastPrice),
                change24h: this._n(d.priceChangePercent),
                volume:    this._n(d.quoteVolume),
                high24h:   this._n(d.highPrice),
                low24h:    this._n(d.lowPrice),
                source:    'binance',
                status:    DATA_STATUS.OK,
            }));
        if (!pairs.length) throw new Error('Binance: no pairs');
        return pairs;
    },

    async _fetchBybit() {
        const data = await this._fetch(this.BYBIT_URL, 7000, 1);
        const list = data?.result?.list;
        if (!Array.isArray(list)) throw new Error('Bybit: bad payload');
        const pairs = list
            .filter(d => d?.symbol?.endsWith('USDT') && this._n(d.turnover24h) >= this.MIN_VOLUME)
            .map(d => ({
                symbol:    String(d.symbol),
                price:     this._n(d.lastPrice),
                change24h: this._n(d.price24hPcnt) * 100,
                volume:    this._n(d.turnover24h),
                high24h:   this._n(d.highPrice24h),
                low24h:    this._n(d.lowPrice24h),
                source:    'bybit',
                status:    DATA_STATUS.OK,
            }));
        if (!pairs.length) throw new Error('Bybit: no pairs');
        return pairs;
    },

    _mergePairs(primary, secondary) {
        const seen = new Set(primary.map(p => p.symbol));
        return [...primary, ...secondary.filter(p => !seen.has(p.symbol))];
    },

    async fetchMarketData() {
        const cached = this.getCache('market');
        if (cached) return cached;
        const t0 = Date.now();
        let result;
        try {
            const binance = await this._fetchBinance();
            try { result = this._mergePairs(binance, await this._fetchBybit()); }
            catch { result = binance; }
            OS.trackLatency(Date.now() - t0);
            OS.resetErrors();
        } catch {
            OS.trackError();
            try { result = await this._fetchBybit(); }
            catch { result = this.getFallbackData(); }
        }
        this.setCache('market', result, 5000);
        return result;
    },

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
                status:    DATA_STATUS.OK,
            })).filter(p => p.price > 0 || p.volume > 0);
        } catch (e) {
            console.warn('[API] searchPairs:', e.message);
            return [];
        }
    },

    getMarketRegime() {
        const t = Date.now() / 86_400_000;
        const s1 = Math.sin(t), s2 = Math.sin(t / 2), s3 = Math.sin(t / 3);
        const moonCycle = ((Date.now() / 86_400_000) % 29.53) / 29.53;
        const moonPhases = ['🌑 New', '🌒 Waxing Crescent', '🌓 First Quarter',
                            '🌔 Waxing Gibbous', '🌕 Full', '🌖 Waning Gibbous',
                            '🌗 Last Quarter', '🌘 Waning Crescent'];
        const moonIdx = Math.floor(moonCycle * 8) % 8;
        return {
            fearGreed:    this._clamp(Math.round(50 + s1 * 30), 0, 100),
            btcDominance: (52.5 + s2 * 2).toFixed(1),
            dxy:          (103.5 - s3 * 1.5).toFixed(2),
            moonPhase:    moonPhases[moonIdx],
            regimeBias:   parseFloat(s1.toFixed(3)),
        };
    },

    classifyVolatility(change24h, high24h, low24h, price) {
        const pct = Math.abs(this._n(change24h));
        const h   = this._n(high24h);
        const l   = this._n(low24h);
        const p   = this._n(price);
        const rangeRatio = (h > 0 && l > 0 && p > 0) ? ((h - l) / p) * 100 : pct;
        if (rangeRatio > 8 || pct > 6)   return 'High Vol';
        if (rangeRatio < 2 && pct < 1.5) return 'Calm';
        return 'Normal';
    },

    simulateOrderFlow(symbol, price, change24h, isReanalyze = false) {
        if (!symbol) return this._emptyOrderFlow();
        const p = this._n(price);
        const c = this._n(change24h);

        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = (symbol.charCodeAt(i) + ((hash << 5) - hash)) | 0;
        }
        if (isReanalyze) hash = (hash + Math.floor(Date.now() / 60_000)) | 0;

        const rand = (seed) => { const x = Math.sin(hash + seed) * 10_000; return x - Math.floor(x); };
        const baseBias = c >= 0 ? 1 : -1;

        const deltaRaw = (rand(10) * 2 - 1 + baseBias * 0.4);
        const deltaM   = (deltaRaw * p * 0.00005).toFixed(2);
        const deltaVal = parseFloat(deltaM);

        const cvdBullish = rand(11) > (baseBias > 0 ? 0.35 : 0.65);
        const cvdTrend   = cvdBullish ? 'Rising' : 'Falling';

        const imbalanceRaw  = 0.6 + rand(12) * 0.8;
        const imbalanceBull = baseBias > 0 ? imbalanceRaw < 1.0 : imbalanceRaw > 1.0;
        const imbalanceStr  = imbalanceRaw.toFixed(2);

        const pocOffset = (rand(13) * 2 - 1) * p * 0.003;
        const poc       = (p + pocOffset).toFixed(p > 10 ? 2 : 5);

        let ofScore = 0;
        if (deltaVal > 0)   ofScore += 0.8; else ofScore -= 0.8;
        if (cvdBullish)     ofScore += 0.7; else ofScore -= 0.7;
        if (imbalanceBull)  ofScore += 0.5; else ofScore -= 0.5;

        return {
            delta:     `${deltaVal >= 0 ? '+' : ''}${deltaVal}M`,
            cvd:       cvdTrend,
            imbalance: imbalanceStr,
            footprint: `POC: ${poc}`,
            ofScore:   this._clamp(ofScore, -2, 2),
            bullish:   ofScore > 0,
        };
    },

    _emptyOrderFlow() {
        return { delta: '0M', cvd: 'Neutral', imbalance: '1.00', footprint: 'POC: —', ofScore: 0, bullish: null };
    },

    simulateIndicators(symbol, price, baseChange, isReanalyze = false) {
        if (!symbol || typeof symbol !== 'string') return this._emptyIndicators();

        const safeP  = this._n(price);
        const safeC  = this._n(baseChange);
        const regime = this.getMarketRegime();

        let hash = 0;
        for (let i = 0; i < symbol.length; i++) {
            hash = (symbol.charCodeAt(i) + ((hash << 5) - hash)) | 0;
        }
        if (isReanalyze) hash = (hash + Math.floor(Date.now() / 60_000)) | 0;

        const rand = (seed) => { const x = Math.sin(hash + seed) * 10_000; return x - Math.floor(x); };
        const baseBias = safeC >= 0 ? 1 : -1;

        const mtf = {
            M15: rand(1) > 0.50 ? 'Bullish' : 'Bearish',
            H1:  rand(2) > 0.40 ? 'Bullish' : 'Bearish',
            H4:  baseBias > 0   ? 'Bullish' : 'Bearish',
            D1:  baseBias > 0   ? 'Bullish' : 'Bearish',
            W1:  regime.regimeBias >= 0 ? 'Bullish' : 'Bearish',
        };

        const rsiVal  = this._clamp(Math.round(50 + safeC * 2 + (rand(20) - 0.5) * 20), 10, 90);
        const macdVal = ((rand(21) * 2 - 1) * safeP * 0.002).toFixed(safeP > 10 ? 4 : 6);
        const atrVal  = (safeP * (0.008 + rand(22) * 0.012)).toFixed(safeP > 10 ? 2 : 5);

        const indicators = {
            RSI:  `${rsiVal}${rsiVal > 70 ? ' ⚠OB' : rsiVal < 30 ? ' ⚠OS' : ''}`,
            MACD: `${parseFloat(macdVal) >= 0 ? '+' : ''}${macdVal}`,
            ATR:  `${atrVal}`,
            EMA:  baseBias > 0 ? 'Price > EMA200' : 'Price < EMA200',
            SMC:  rand(4) > 0.50 ? 'CHoCH' : 'BOS',
            Fib:  rand(6) > 0.50 ? '0.618 Pocket' : '0.382 Retrace',
        };

        const of = this.simulateOrderFlow(symbol, safeP, safeC, isReanalyze);

        let score = 5 + regime.regimeBias * 1.5;
        if (mtf.H1 === mtf.H4) score += mtf.H4 === 'Bullish' ?  1.5 : -1.5;
        if (mtf.H4 === mtf.D1) score += mtf.D1 === 'Bullish' ?  1.0 : -1.0;
        if (mtf.D1 === mtf.W1) score += mtf.W1 === 'Bullish' ?  0.5 : -0.5;
        score += safeC / 5;
        score += (rsiVal - 50) / 40;
        score += rand(7) * 1.5 - 0.75;
        score += of.ofScore;
        score  = this._clamp(score, 0, 10);
        if (!isFinite(score)) score = 5;

        const direction = score >= 5 ? 'LONG' : 'SHORT';

        let biasHint;
        if      (regime.fearGreed > 75) biasHint = 'Caution: Extreme Greed. Expect pullbacks.';
        else if (regime.fearGreed < 25) biasHint = 'Accumulation phase. Macro favors Longs.';
        else if (of.bullish && score > 7) biasHint = `Order Flow confirms bullish pressure. RSI: ${rsiVal}.`;
        else if (!of.bullish && of.bullish !== null && score < 3)
            biasHint = `Order Flow confirms distribution. RSI: ${rsiVal}.`;
        else if (score > 8) biasHint = 'Strong momentum alignment across all timeframes.';
        else if (score < 2) biasHint = 'Heavy distribution detected. Favor Shorts.';
        else                biasHint = 'Mixed signals. Wait for structural confirmation.';

        const dec = safeP > 10 ? 2 : 5;
        const fmt = (n) => isFinite(n) ? n.toFixed(dec) : '0';
        const slPrice = direction === 'LONG' ? safeP * 0.98 : safeP * 1.02;
        const tpPrice = direction === 'LONG' ? safeP * 1.05 : safeP * 0.95;

        return {
            score:     score.toFixed(1),
            direction,
            biasHint,
            mtf,
            indicators,
            orderFlow: of,
            tradeStructure: {
                entry:      fmt(safeP),
                sl:         fmt(slPrice),
                tp:         fmt(tpPrice),
                powerRatio: Math.floor(rand(8) * 30) + 70,
            },
        };
    },

    _emptyIndicators() {
        return {
            score: '5.0', direction: 'LONG', biasHint: 'Insufficient data.',
            mtf: { M15: 'Neutral', H1: 'Neutral', H4: 'Neutral', D1: 'Neutral', W1: 'Neutral' },
            indicators: { RSI: '50', MACD: '0', ATR: '0', EMA: '—', SMC: 'BOS', Fib: '—' },
            orderFlow: this._emptyOrderFlow(),
            tradeStructure: { entry: '0', sl: '0', tp: '0', powerRatio: 50 },
        };
    },

    generateInsight(pair) {
        const score     = this._n(pair?.score);
        const change24h = this._n(pair?.change24h);
        const direction = pair?.direction === 'SHORT' ? 'SHORT' : 'LONG';
        const volume    = this._n(pair?.volume);
        const h24       = this._n(pair?.high24h);
        const l24       = this._n(pair?.low24h);
        const price     = this._n(pair?.price);

        const dist       = Math.abs(score - 5);
        const conviction = dist > 3 ? 'High' : dist > 1.5 ? 'Med' : 'Low';
        const riskEnv    = this.classifyVolatility(change24h, h24, l24, price);

        const mtf      = pair?.mtf ?? {};
        const mtfVals  = [mtf.W1, mtf.D1, mtf.H4, mtf.H1, mtf.M15].filter(Boolean);
        const bullCount = mtfVals.filter(v => v === 'Bullish').length;
        const mtfSignal = mtfVals.length
            ? (bullCount > mtfVals.length / 2 ? 'Bullish' : 'Bearish')
            : direction === 'LONG' ? 'Bullish' : 'Bearish';

        const of       = pair?.orderFlow ?? {};
        const ofSignal = of.bullish === true ? 'bullish OF' : of.bullish === false ? 'bearish OF' : 'neutral OF';

        const rsiRaw  = parseInt(pair?.indicators?.RSI ?? '50', 10) || 50;
        const rsiNote = rsiRaw > 70 ? `RSI overbought (${rsiRaw}).`
                      : rsiRaw < 30 ? `RSI oversold (${rsiRaw}).`
                      : `RSI neutral (${rsiRaw}).`;

        const raw        = `${direction} bias, ${mtfSignal} MTF, ${ofSignal}`;
        const insightLine = raw.length <= 60 ? raw : raw.slice(0, 57) + '...';

        const regime     = this.getMarketRegime();
        const regimeDesc = regime.fearGreed > 65 ? 'greedy market'
                         : regime.fearGreed < 35 ? 'fearful market' : 'neutral market';

        const aligned  = mtfVals.length >= 2 && (bullCount === mtfVals.length || bullCount === 0);
        const mtfNote  = aligned ? `All ${mtfVals.length} MTF frames aligned.` : 'MTF shows mixed alignment.';
        const volB     = volume / 1_000_000_000;
        const volNote  = volB >= 1 ? `Vol: ${volB.toFixed(1)}B.` : `Vol: ${(volume / 1_000_000).toFixed(0)}M.`;

        const insightDetail =
            `${conviction} conviction ${direction} in ${regimeDesc}. ${mtfNote} ` +
            `${ofSignal} · ${riskEnv} (${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}% 24h). ` +
            `${rsiNote} ${volNote} Moon: ${regime.moonPhase}.`;

        return { conviction, riskEnv, insightLine, insightDetail };
    },

    getFallbackData() {
        return [
            { symbol: 'BTCUSDT',  price: 65420.50, change24h:  2.4, volume: 45_000_000_000, high24h: 66000, low24h: 64000, source: 'fallback', status: DATA_STATUS.DEGRADED },
            { symbol: 'ETHUSDT',  price: 3450.10,  change24h: -1.2, volume: 15_000_000_000, high24h: 3520,  low24h: 3380,  source: 'fallback', status: DATA_STATUS.DEGRADED },
            { symbol: 'SOLUSDT',  price: 145.20,   change24h:  5.6, volume:  4_000_000_000, high24h: 152,   low24h: 138,   source: 'fallback', status: DATA_STATUS.DEGRADED },
            { symbol: 'XRPUSDT',  price: 0.58,     change24h: -0.5, volume:  1_200_000_000, high24h: 0.59,  low24h: 0.56,  source: 'fallback', status: DATA_STATUS.DEGRADED },
            { symbol: 'BNBUSDT',  price: 412.30,   change24h:  1.1, volume:    900_000_000, high24h: 418,   low24h: 408,   source: 'fallback', status: DATA_STATUS.DEGRADED },
            { symbol: 'DOGEUSDT', price: 0.1240,   change24h:  3.2, volume:    750_000_000, high24h: 0.130, low24h: 0.118, source: 'fallback', status: DATA_STATUS.DEGRADED },
        ];
    },

    _n(v)         { const n = parseFloat(v); return isFinite(n) ? n : 0; },
    _clamp(v,a,b) { return Math.max(a, Math.min(b, v)); },

    _cache: Object.create(null),
    getCache(key) {
        const e = this._cache[key];
        return (e && Date.now() < e.exp) ? e.data : null;
    },
    setCache(key, data, ttlMs = 5000) {
        this._cache[key] = { data, exp: Date.now() + ttlMs };
    },

    getMarketMood(analyzedPairs) {
        try {
            if (!analyzedPairs?.length) return 'choppy';
            const scores  = analyzedPairs.map(p => parseFloat(p.score) || 5);
            const avg     = scores.reduce((a,b) => a+b, 0) / scores.length;
            const highVols = analyzedPairs.filter(p =>
                API.classifyVolatility(p.change24h, p.high24h, p.low24h, p.price) === 'High Vol'
            ).length;
            const volRatio = highVols / analyzedPairs.length;
            if (volRatio > 0.35) return 'volatile';
            if (avg > 6.2)       return 'bullish';
            if (avg < 3.8)       return 'bearish';
            return 'choppy';
        } catch { return 'choppy'; }
    },

    rankPairs(analyzedPairs) {
        try {
            return [...(analyzedPairs ?? [])].sort((a, b) => {
                const scoreA = parseFloat(a.score) || 5;
                const scoreB = parseFloat(b.score) || 5;
                const momA   = Math.abs(this._n(a.change24h));
                const momB   = Math.abs(this._n(b.change24h));
                const ofA    = (a.orderFlow?.ofScore ?? 0);
                const ofB    = (b.orderFlow?.ofScore ?? 0);
                const rankA  = Math.abs(scoreA - 5) * 2 + momA * 0.3 + Math.abs(ofA);
                const rankB  = Math.abs(scoreB - 5) * 2 + momB * 0.3 + Math.abs(ofB);
                return rankB - rankA;
            });
        } catch { return analyzedPairs ?? []; }
    },

    adaptiveRefreshMs(analyzedPairs) {
        const mood = this.getMarketMood(analyzedPairs);
        if (mood === 'volatile') return 30_000;
        if (mood === 'bullish' || mood === 'bearish') return 60_000;
        return 120_000;
    },
};


// ── V9000 Autonomous Brain ────────────────────────────────
const Brain = {
    analyze(pair, stats = {}) {
        try {
            const score   = API._n(pair?.score);
            const dir     = pair?.direction ?? 'LONG';
            const of      = pair?.orderFlow ?? {};
            const mtf     = pair?.mtf ?? {};
            const rsi     = parseInt(pair?.indicators?.RSI ?? '50', 10) || 50;
            const change  = API._n(pair?.change24h);
            const regime  = API.getMarketRegime();
            const riskEnv = API.classifyVolatility(change, API._n(pair?.high24h), API._n(pair?.low24h), API._n(pair?.price));

            const mtfVals   = [mtf.W1, mtf.D1, mtf.H4, mtf.H1, mtf.M15].filter(Boolean);
            const bullCount = mtfVals.filter(v => v === 'Bullish').length;
            const mtfAlign  = mtfVals.length >= 3 && (bullCount >= mtfVals.length - 1 || bullCount <= 1);
            const dist      = Math.abs(score - 5);
            const conviction = dist > 3 ? 'High' : dist > 1.5 ? 'Med' : 'Low';

            let type;
            if (riskEnv === 'High Vol' && conviction === 'Low') {
                type = 'avoid';
            } else if (conviction === 'High' && mtfAlign && of.bullish !== null) {
                type = 'swing';
            } else {
                type = 'scalp';
            }

            let stopStyle;
            if (riskEnv === 'High Vol')               stopStyle = 'wide';
            else if (conviction === 'High' && mtfAlign) stopStyle = 'tight';
            else                                       stopStyle = 'normal';

            let tpStyle;
            if (type === 'swing' && conviction === 'High') tpStyle = 'trail';
            else if (mtfAlign && riskEnv !== 'High Vol')   tpStyle = 'full';
            else                                           tpStyle = 'partial';

            const summary = this._buildSummary(type, conviction, riskEnv, dir, mtfAlign, of, rsi, regime);
            const hints   = this._buildHints(stats, riskEnv, conviction);

            return { type, stopStyle, tpStyle, summary, hints, conviction, riskEnv };
        } catch(e) {
            return { type: 'avoid', stopStyle: 'normal', tpStyle: 'partial',
                summary: 'Brain offline — insufficient data.', hints: [], conviction: 'Low', riskEnv: 'Normal' };
        }
    },

    _buildSummary(type, conviction, riskEnv, dir, mtfAlign, of, rsi, regime) {
        if (type === 'avoid') {
            if (riskEnv === 'High Vol') return 'High volatility + low conviction. Better to wait for structure.';
            return 'Conflicting signals across timeframes. Stand aside.';
        }
        const aligned = mtfAlign ? 'aligned' : 'mixed';
        const ofWord  = of.bullish === true ? 'bullish OF' : of.bullish === false ? 'bearish OF' : 'neutral OF';
        const rsiWord = rsi > 70 ? 'OB RSI — watch for fade' : rsi < 30 ? 'OS RSI — bounce possible' : `RSI ${rsi}`;
        const fgiWord = regime.fearGreed > 70 ? 'Extreme Greed' : regime.fearGreed < 30 ? 'Extreme Fear' : 'Neutral FGI';
        if (conviction === 'High' && mtfAlign) {
            return `${conviction} conviction ${dir} — MTF ${aligned}, ${ofWord}. ${rsiWord}. ${fgiWord}.`;
        }
        if (type === 'swing') {
            return `Swing ${dir} candidate. ${ofWord}, ${rsiWord}. ${fgiWord}.`;
        }
        return `Scalp ${dir} in ${riskEnv.toLowerCase()} conditions. ${ofWord}, ${rsiWord}.`;
    },

    _buildHints(stats, riskEnv, conviction) {
        const hints = [];
        const { winRate = 0, avgRR = 0, avgLeverage = 0, totalTrades = 0 } = stats;
        if (totalTrades >= 3) {
            if (winRate < 0.4)  hints.push(`Win rate ${(winRate*100).toFixed(0)}% — consider tighter entries.`);
            if (avgRR > 0 && avgRR < 1.5) hints.push(`Avg R:R ${avgRR.toFixed(2)} — aim for ≥ 1:2 to improve edge.`);
            if (avgRR >= 2)     hints.push(`Strong avg R:R ${avgRR.toFixed(2)} — your edge rewards patience.`);
            if (avgLeverage > 20 && winRate < 0.5)
                hints.push(`High leverage (avg ×${avgLeverage.toFixed(0)}) with sub-50% win rate is risky.`);
        }
        if (riskEnv === 'High Vol') hints.push('High volatility — reduce position size.');
        if (conviction === 'Low')   hints.push('Low conviction — cut size or skip.');
        if (!hints.length)          hints.push('Stick to your plan. Discipline > conviction.');
        return hints.slice(0, 3);
    },

    sessionSummary(analyzedPairs, journalStats) {
        try {
            const regime  = API.getMarketRegime();
            const all     = (analyzedPairs ?? []).filter(p => p.brain);
            const focuses = all
                .filter(p => p.brain.type !== 'avoid' && p.brain.conviction === 'High')
                .sort((a,b) => parseFloat(b.score) - parseFloat(a.score))
                .slice(0, 3);
            const avoids = all.filter(p => p.brain.type === 'avoid').slice(0, 3);
            const regimeWord = regime.fearGreed > 65 ? 'Risk-Off (Greedy)'
                             : regime.fearGreed < 35 ? 'Risk-On (Fear Dip)'
                             : 'Neutral';
            return { regime: regimeWord, focuses, avoids, fearGreed: regime.fearGreed, moonPhase: regime.moonPhase };
        } catch { return { regime: '—', focuses: [], avoids: [], fearGreed: 50, moonPhase: '—' }; }
    },
};

// ── V10000 Self-Evolving OS Layer ─────────────────────────
const OS = {
    _latencies: [],
    _errors:    0,
    _degraded:  false,

    deviceTier() {
        try {
            const cores = navigator.hardwareConcurrency ?? 2;
            const mem   = navigator.deviceMemory ?? 2;
            if (cores >= 8 && mem >= 4) return 'high';
            if (cores >= 4 || mem >= 2) return 'mid';
            return 'low';
        } catch { return 'mid'; }
    },

    trackLatency(ms) {
        this._latencies.push(ms);
        if (this._latencies.length > 10) this._latencies.shift();
    },

    trackError() {
        this._errors++;
        if (this._errors >= 3) this._degraded = true;
    },

    resetErrors() {
        this._errors   = 0;
        this._degraded = false;
    },

    avgLatency() {
        if (!this._latencies.length) return 0;
        return this._latencies.reduce((a,b) => a+b, 0) / this._latencies.length;
    },

    healthStatus() {
        if (this._degraded)           return 'DEGRADED';
        if (this.avgLatency() > 4000) return 'SLOW';
        return 'OK';
    },

    isDegraded() { return this._degraded; },
};
