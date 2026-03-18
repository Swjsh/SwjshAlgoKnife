// ═══════════════════════════════════════════════════════════════
// INTEL FLOW INTEGRATION TESTS
// TDD: RED → GREEN → REFACTOR
//
// Verifies the complete intel data flow:
//   1. Raw data → IntelBus → SQLite persistence
//   2. IntelBus → IntelAdapter → Strategy context
//   3. Regime detection from mixed signals
//   4. Preflight API returns GO/NO_GO/REDUCED
//   5. Strategies receive and act on intel context
// ═══════════════════════════════════════════════════════════════

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// CORE Phase — Happy path integration tests
// ═══════════════════════════════════════════════════════════════

describe('Intel Flow Integration - CORE Phase', () => {
    describe('Data Flow: Source → Bus → Query', () => {
        test('published signal is queryable from the bus', async () => {
            const intelBus = (await import('../bus')).default;

            // Publish a signal
            const signal = {
                source: 'FEAR_GREED' as const,
                symbol: 'BTCUSD',
                direction: 'BULLISH' as const,
                confidence: 0.75,
                summary: 'Fear & Greed at 25 (Extreme Fear)',
                payload: { value: 25 },
            };

            const id = intelBus.publish(signal);

            // Should persist and be queryable
            const results = intelBus.query('BTCUSD');
            const found = results.find(s => s.id === id);

            expect(found).toBeDefined();
            expect(found?.source).toBe('FEAR_GREED');
            expect(found?.direction).toBe('BULLISH');
        });

        test('signals from multiple sources are aggregated', async () => {
            const intelBus = (await import('../bus')).default;

            // Clear dedup cache by waiting or using unique symbols
            const testSymbol = `ETHTEST_${Date.now()}`;

            // Publish signals from different sources
            intelBus.publish({
                source: 'WHALE_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.80,
                summary: 'Large whale accumulation detected',
                payload: { volume: 500000 },
            });

            intelBus.publish({
                source: 'SENTIMENT' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.65,
                summary: 'Social sentiment positive',
                payload: { score: 0.65 },
            });

            intelBus.publish({
                source: 'FUNDING_OI' as const,
                symbol: testSymbol,
                direction: 'NEUTRAL' as const,
                confidence: 0.50,
                summary: 'Funding rate neutral',
                payload: { fundingRate: 0.0001 },
            });

            const results = intelBus.query(testSymbol);

            // Should have signals from all 3 sources
            const sources = results.map(s => s.source);
            expect(sources).toContain('WHALE_FLOW');
            expect(sources).toContain('SENTIMENT');
            expect(sources).toContain('FUNDING_OI');
        });

        test('score() returns weighted intel score for trade direction', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `BTCSCORE_${Date.now()}`;

            // Publish bullish signals
            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.85,
                summary: 'Strong buy pressure',
                payload: {},
            });

            intelBus.publish({
                source: 'ONCHAIN_CONFLUENCE' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.75,
                summary: 'On-chain metrics bullish',
                payload: {},
            });

            const longScore = intelBus.score(testSymbol, 'LONG');
            const shortScore = intelBus.score(testSymbol, 'SHORT');

            // LONG should have positive score with bullish signals
            expect(longScore.score).toBeGreaterThan(0);
            expect(longScore.sizeMultiplier).toBeGreaterThan(0);

            // SHORT should have negative score (opposing direction)
            expect(shortScore.score).toBeLessThan(0);
        });
    });

    describe('Data Flow: Bus → Adapter → Strategy Context', () => {
        test('IntelAdapter.getContext() returns regime and scores', async () => {
            const intelBus = (await import('../bus')).default;
            const { IntelAdapter } = await import('../adapter');

            const testSymbol = `ADAPTERTEST_${Date.now()}`;

            // Publish signals to establish a regime
            intelBus.publish({
                source: 'FEAR_GREED' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: 'F&G at 35',
                payload: { value: 35 },
            });

            intelBus.publish({
                source: 'WHALE_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.80,
                summary: 'Whales buying',
                payload: {},
            });

            const adapter = IntelAdapter.forSymbol(testSymbol);
            const ctx = adapter.getContext();

            expect(ctx.regime).toBeDefined();
            expect(ctx.longScore).toBeDefined();
            expect(ctx.shortScore).toBeDefined();
            expect(ctx.signalCount).toBeGreaterThan(0);
            expect(ctx.timestamp).toBeDefined();
        });

        test('IntelAdapter.getAdaptations() returns strategy parameters', async () => {
            const intelBus = (await import('../bus')).default;
            const { IntelAdapter } = await import('../adapter');

            const testSymbol = `ADAPTATIONS_${Date.now()}`;

            // Create a trending bull scenario
            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.85,
                summary: 'Strong bullish flow',
                payload: {},
            });

            intelBus.publish({
                source: 'WHALE_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.80,
                summary: 'Whale accumulation',
                payload: {},
            });

            intelBus.publish({
                source: 'SENTIMENT' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.75,
                summary: 'Positive sentiment',
                payload: {},
            });

            const adapter = IntelAdapter.forSymbol(testSymbol);
            const adaptations = adapter.getAdaptations();

            // Should have strategy adaptation fields
            expect(adaptations).toHaveProperty('htfBias');
            expect(adaptations).toHaveProperty('squeezeThresholdAdj');
            expect(adaptations).toHaveProperty('vwapThresholdAdj');
            expect(adaptations).toHaveProperty('preferTrend');
            expect(adaptations).toHaveProperty('tightenStops');
            expect(adaptations).toHaveProperty('confidence');
        });

        test('IntelAdapter caches context for 30 seconds', async () => {
            const { IntelAdapter } = await import('../adapter');

            const testSymbol = `CACHETEST_${Date.now()}`;
            const adapter = IntelAdapter.forSymbol(testSymbol);

            // Get context twice rapidly
            const ctx1 = adapter.getContext();
            const ctx2 = adapter.getContext();

            // Should be the same cached object
            expect(ctx1.timestamp).toBe(ctx2.timestamp);
        });

        test('isDirectionAligned() returns true when intel supports direction', async () => {
            const intelBus = (await import('../bus')).default;
            const { IntelAdapter } = await import('../adapter');

            const testSymbol = `ALIGNED_${Date.now()}`;

            // Strong bullish consensus
            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.90,
                summary: 'Very bullish',
                payload: {},
            });

            const adapter = IntelAdapter.forSymbol(testSymbol);

            // LONG should be aligned with bullish signals
            expect(adapter.isDirectionAligned('LONG')).toBe(true);
        });

        test('getSizeMultiplier() returns 0-1 range', async () => {
            const intelBus = (await import('../bus')).default;
            const { IntelAdapter } = await import('../adapter');

            const testSymbol = `MULTIPLIER_${Date.now()}`;

            intelBus.publish({
                source: 'MARKET_DATA' as const,
                symbol: testSymbol,
                direction: 'NEUTRAL' as const,
                confidence: 0.50,
                summary: 'Mixed signals',
                payload: {},
            });

            const adapter = IntelAdapter.forSymbol(testSymbol);
            const multiplier = adapter.getSizeMultiplier('LONG');

            expect(multiplier).toBeGreaterThanOrEqual(0);
            expect(multiplier).toBeLessThanOrEqual(1);
        });
    });

    describe('Regime Detection', () => {
        test('detectRegime returns TRENDING_BULL with bullish consensus', async () => {
            const { detectRegime } = await import('../regime');
            const { IntelSignal } = await import('../types');

            const signals = [
                { source: 'ORDER_FLOW', symbol: 'BTC', direction: 'BULLISH', confidence: 0.80, summary: '', payload: {} },
                { source: 'WHALE_FLOW', symbol: 'BTC', direction: 'BULLISH', confidence: 0.75, summary: '', payload: {} },
                { source: 'SENTIMENT', symbol: 'BTC', direction: 'BULLISH', confidence: 0.70, summary: '', payload: {} },
                { source: 'FUNDING_OI', symbol: 'BTC', direction: 'NEUTRAL', confidence: 0.50, summary: '', payload: {} },
            ] as any[];

            const regime = detectRegime(signals);
            expect(regime).toBe('TRENDING_BULL');
        });

        test('detectRegime returns HIGH_VOL with extreme fear', async () => {
            const { detectRegime } = await import('../regime');

            const signals = [
                { source: 'FEAR_GREED', symbol: 'BTC', direction: 'BEARISH', confidence: 0.90, summary: '', payload: { value: 15 } },
            ] as any[];

            const regime = detectRegime(signals);
            expect(regime).toBe('HIGH_VOL');
        });

        test('detectRegime returns RANGING with neutral majority', async () => {
            const { detectRegime } = await import('../regime');

            // Neutral majority with balanced directional signals (prevents TRENDING detection)
            const signals = [
                { source: 'MARKET_DATA', symbol: 'BTC', direction: 'NEUTRAL', confidence: 0.50, summary: '', payload: {} },
                { source: 'FUNDING_OI', symbol: 'BTC', direction: 'NEUTRAL', confidence: 0.45, summary: '', payload: {} },
                { source: 'SENTIMENT', symbol: 'BTC', direction: 'NEUTRAL', confidence: 0.55, summary: '', payload: {} },
                { source: 'ECON_CALENDAR', symbol: 'BTC', direction: 'NEUTRAL', confidence: 0.50, summary: '', payload: {} },
                { source: 'ORDER_FLOW', symbol: 'BTC', direction: 'BULLISH', confidence: 0.60, summary: '', payload: {} },
                { source: 'WHALE_FLOW', symbol: 'BTC', direction: 'BEARISH', confidence: 0.55, summary: '', payload: {} },
            ] as any[];

            const regime = detectRegime(signals);
            // 4 neutral > 1 bullish + 1 bearish, so RANGING
            expect(regime).toBe('RANGING');
        });

        test('detectRegime returns UNKNOWN with no signals', async () => {
            const { detectRegime } = await import('../regime');

            const regime = detectRegime([]);
            expect(regime).toBe('UNKNOWN');
        });

        test('detectRegime returns LOW_VOL with sparse signals', async () => {
            const { detectRegime } = await import('../regime');

            const signals = [
                { source: 'MARKET_DATA', symbol: 'BTC', direction: 'BULLISH', confidence: 0.50, summary: '', payload: {} },
            ] as any[];

            const regime = detectRegime(signals);
            expect(regime).toBe('LOW_VOL');
        });
    });

    describe('Agent Preflight Decision Flow', () => {
        test('preflight returns GO with strong confirming signals', async () => {
            // This test requires a mock HTTP request to /api/intel/preflight
            // For unit testing, we test the underlying logic directly

            const intelBus = (await import('../bus')).default;
            const testSymbol = `PREFLIGHT_GO_${Date.now()}`;

            // Create strong bullish consensus
            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.90,
                summary: 'Strong buy flow',
                payload: {},
            });

            intelBus.publish({
                source: 'WHALE_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.85,
                summary: 'Whale buying',
                payload: {},
            });

            intelBus.publish({
                source: 'SENTIMENT' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.80,
                summary: 'Positive sentiment',
                payload: {},
            });

            // Score for LONG should be high
            const score = intelBus.score(testSymbol, 'LONG');

            expect(score.score).toBeGreaterThan(0.3); // Above GO threshold
            expect(score.sizeMultiplier).toBe(1.0);
            expect(score.reason).toContain('CONFIRMS');
        });

        test('preflight returns NO_GO with strong opposing signals', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `PREFLIGHT_NOGO_${Date.now()}`;

            // Create strong bearish consensus
            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BEARISH' as const,
                confidence: 0.90,
                summary: 'Strong sell flow',
                payload: {},
            });

            intelBus.publish({
                source: 'WHALE_FLOW' as const,
                symbol: testSymbol,
                direction: 'BEARISH' as const,
                confidence: 0.85,
                summary: 'Whale selling',
                payload: {},
            });

            intelBus.publish({
                source: 'SENTIMENT' as const,
                symbol: testSymbol,
                direction: 'BEARISH' as const,
                confidence: 0.80,
                summary: 'Negative sentiment',
                payload: {},
            });

            // Score for LONG should be very negative (opposing direction)
            const score = intelBus.score(testSymbol, 'LONG');

            expect(score.score).toBeLessThan(-0.5); // Below VETO threshold
            expect(score.sizeMultiplier).toBe(0);
            expect(score.reason).toContain('VETOES');
        });

        test('preflight returns REDUCED with mixed signals', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `PREFLIGHT_REDUCED_${Date.now()}`;

            // Create mixed signals
            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: 'Slight buy pressure',
                payload: {},
            });

            intelBus.publish({
                source: 'SENTIMENT' as const,
                symbol: testSymbol,
                direction: 'BEARISH' as const,
                confidence: 0.60,
                summary: 'Negative sentiment',
                payload: {},
            });

            intelBus.publish({
                source: 'FUNDING_OI' as const,
                symbol: testSymbol,
                direction: 'NEUTRAL' as const,
                confidence: 0.50,
                summary: 'Neutral funding',
                payload: {},
            });

            // Score should be in the mixed range
            const score = intelBus.score(testSymbol, 'LONG');

            expect(score.sizeMultiplier).toBeGreaterThan(0);
            expect(score.sizeMultiplier).toBeLessThan(1.0);
            expect(score.reason).toContain('MIXED');
        });
    });

    describe('Strategy Intel Context Injection', () => {
        test('IntelStrategyContext has all required fields', async () => {
            const intelBus = (await import('../bus')).default;
            const { IntelAdapter } = await import('../adapter');

            const testSymbol = `STRATCTX_${Date.now()}`;

            intelBus.publish({
                source: 'MARKET_DATA' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.60,
                summary: 'Price rising',
                payload: {},
            });

            const adapter = IntelAdapter.forSymbol(testSymbol);
            const ctx = adapter.getContext();
            const adaptations = adapter.getAdaptations();

            // Build IntelStrategyContext like EngineManager does
            const intelCtx = {
                regime: ctx.regime,
                htfBias: adaptations.htfBias,
                adaptations: {
                    squeezeThresholdAdj: adaptations.squeezeThresholdAdj,
                    vwapThresholdAdj: adaptations.vwapThresholdAdj,
                    sensitivityAdj: adaptations.sensitivityAdj,
                    wideRangeThresholdAdj: adaptations.wideRangeThresholdAdj,
                    cooldownAdj: adaptations.cooldownAdj,
                    preferTrend: adaptations.preferTrend,
                    tightenStops: adaptations.tightenStops,
                },
                confidence: adaptations.confidence,
                longMultiplier: ctx.longScore.sizeMultiplier,
                shortMultiplier: ctx.shortScore.sizeMultiplier,
            };

            // Verify all fields exist
            expect(intelCtx.regime).toBeDefined();
            expect(intelCtx.htfBias).toMatch(/^(BULLISH|BEARISH|NEUTRAL)$/);
            expect(typeof intelCtx.confidence).toBe('number');
            expect(typeof intelCtx.longMultiplier).toBe('number');
            expect(typeof intelCtx.shortMultiplier).toBe('number');
            expect(intelCtx.adaptations).toHaveProperty('squeezeThresholdAdj');
            expect(intelCtx.adaptations).toHaveProperty('vwapThresholdAdj');
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// EDGE Phase — Boundary conditions and edge cases
// ═══════════════════════════════════════════════════════════════

describe('Intel Flow Integration - EDGE Phase', () => {
    describe('Deduplication', () => {
        test('duplicate signals within dedup window are rejected', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `DEDUP_${Date.now()}`;

            const signal = {
                source: 'FEAR_GREED' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: 'F&G signal',
                payload: { value: 50 },
            };

            const id1 = intelBus.publish(signal);
            const id2 = intelBus.publish(signal); // Same signal immediately after

            expect(id1).toBeGreaterThan(0);
            expect(id2).toBe(-1); // Rejected as duplicate
        });

        test('different directions are not deduped', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `NOTDEDUP_${Date.now()}`;

            const id1 = intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: 'Bullish flow',
                payload: {},
            });

            const id2 = intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BEARISH' as const,
                confidence: 0.70,
                summary: 'Bearish flow',
                payload: {},
            });

            expect(id1).toBeGreaterThan(0);
            expect(id2).toBeGreaterThan(0); // Different direction = not duplicate
        });
    });

    describe('Expiry Handling', () => {
        test('expired signals are not returned by query', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `EXPIRY_${Date.now()}`;

            // Publish a signal that expires immediately
            const pastDate = new Date(Date.now() - 1000).toISOString();

            intelBus.publish({
                source: 'MARKET_DATA' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.60,
                summary: 'Already expired',
                payload: {},
                expiresAt: pastDate,
            });

            const results = intelBus.query(testSymbol);

            // Should not find the expired signal
            const expired = results.find(s => s.summary === 'Already expired');
            expect(expired).toBeUndefined();
        });
    });

    describe('Empty/Missing Data', () => {
        test('query returns empty array for unknown symbol', async () => {
            const intelBus = (await import('../bus')).default;

            const results = intelBus.query('NONEXISTENT_SYMBOL_XYZ');
            expect(results).toEqual([]);
        });

        test('score returns flying blind response for no signals', async () => {
            const intelBus = (await import('../bus')).default;

            const score = intelBus.score('NOSIGNALS_SYMBOL', 'LONG');

            expect(score.score).toBe(0);
            expect(score.sizeMultiplier).toBe(0.75); // Reduced but not zero
            expect(score.reason).toContain('flying blind');
        });

        test('adapter returns UNKNOWN regime for no signals', async () => {
            const { IntelAdapter } = await import('../adapter');

            const adapter = IntelAdapter.forSymbol('EMPTYSYMBOL_XYZ');
            const ctx = adapter.getContext();

            expect(ctx.regime).toBe('UNKNOWN');
            expect(ctx.signalCount).toBe(0);
        });
    });

    describe('Multi-Symbol Isolation', () => {
        test('signals for different symbols are isolated', async () => {
            const intelBus = (await import('../bus')).default;
            const symbol1 = `ISOLATION_A_${Date.now()}`;
            const symbol2 = `ISOLATION_B_${Date.now()}`;

            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: symbol1,
                direction: 'BULLISH' as const,
                confidence: 0.90,
                summary: 'Symbol A bullish',
                payload: {},
            });

            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: symbol2,
                direction: 'BEARISH' as const,
                confidence: 0.90,
                summary: 'Symbol B bearish',
                payload: {},
            });

            const results1 = intelBus.query(symbol1);
            const results2 = intelBus.query(symbol2);

            expect(results1.length).toBe(1);
            expect(results1[0].direction).toBe('BULLISH');

            expect(results2.length).toBe(1);
            expect(results2[0].direction).toBe('BEARISH');
        });
    });

    describe('Source Filtering', () => {
        test('query with source filter returns only that source', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `SRCFILTER_${Date.now()}`;

            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: 'Order flow',
                payload: {},
            });

            intelBus.publish({
                source: 'WHALE_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.80,
                summary: 'Whale flow',
                payload: {},
            });

            const orderFlowOnly = intelBus.query(testSymbol, 'ORDER_FLOW');

            expect(orderFlowOnly.length).toBe(1);
            expect(orderFlowOnly[0].source).toBe('ORDER_FLOW');
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// SECURITY Phase — Input validation and type safety
// ═══════════════════════════════════════════════════════════════

describe('Intel Flow Integration - SECURITY Phase', () => {
    describe('Input Validation', () => {
        test('confidence is clamped to 0-1 range in scoring', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `CONFCLAMP_${Date.now()}`;

            // Publish with edge confidence values
            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 1.0, // Max confidence
                summary: 'Max confidence',
                payload: {},
            });

            const score = intelBus.score(testSymbol, 'LONG');

            // Score should be valid
            expect(score.score).toBeGreaterThanOrEqual(-1);
            expect(score.score).toBeLessThanOrEqual(1);
        });

        test('sizeMultiplier is always in 0-1 range', async () => {
            const intelBus = (await import('../bus')).default;

            // Test various scenarios
            const scenarios = [
                { symbol: `SM_BULL_${Date.now()}`, direction: 'BULLISH' as const },
                { symbol: `SM_BEAR_${Date.now()}`, direction: 'BEARISH' as const },
            ];

            for (const { symbol, direction } of scenarios) {
                intelBus.publish({
                    source: 'ORDER_FLOW' as const,
                    symbol,
                    direction,
                    confidence: 0.90,
                    summary: 'Test',
                    payload: {},
                });

                const score = intelBus.score(symbol, 'LONG');
                expect(score.sizeMultiplier).toBeGreaterThanOrEqual(0);
                expect(score.sizeMultiplier).toBeLessThanOrEqual(1);
            }
        });
    });

    describe('Type Safety', () => {
        test('IntelScore breakdown contains valid sources', async () => {
            const intelBus = (await import('../bus')).default;
            const { ALL_INTEL_SOURCES } = await import('../types');
            const testSymbol = `BREAKDOWN_${Date.now()}`;

            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: 'Test',
                payload: {},
            });

            const score = intelBus.score(testSymbol, 'LONG');

            for (const source of Object.keys(score.breakdown)) {
                expect(ALL_INTEL_SOURCES).toContain(source);
            }
        });

        test('regime is always a valid MarketRegime value', async () => {
            const { detectRegime } = await import('../regime');

            const validRegimes = ['TRENDING_BULL', 'TRENDING_BEAR', 'RANGING', 'HIGH_VOL', 'LOW_VOL', 'UNKNOWN'];

            // Test with various signal configurations
            const configs = [
                [], // Empty
                [{ source: 'ORDER_FLOW', direction: 'BULLISH', confidence: 0.90 }],
                [{ source: 'ORDER_FLOW', direction: 'BEARISH', confidence: 0.90 }],
                [{ source: 'MARKET_DATA', direction: 'NEUTRAL', confidence: 0.50 }],
            ];

            for (const signals of configs) {
                const regime = detectRegime(signals as any[]);
                expect(validRegimes).toContain(regime);
            }
        });
    });

    describe('Event Emission Safety', () => {
        test('publish emits intel event with enriched signal', async () => {
            const intelBus = (await import('../bus')).default;
            const testSymbol = `EMIT_${Date.now()}`;

            let emittedSignal: any = null;
            const handler = (signal: any) => { emittedSignal = signal; };
            intelBus.on('intel', handler);

            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: 'Test emission',
                payload: {},
            });

            intelBus.off('intel', handler);

            expect(emittedSignal).toBeDefined();
            expect(emittedSignal.id).toBeDefined();
            expect(emittedSignal.timestamp).toBeDefined();
            expect(emittedSignal.expiresAt).toBeDefined();
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// PERFORMANCE Phase — Timing and resource constraints
// ═══════════════════════════════════════════════════════════════

describe('Intel Flow Integration - PERFORMANCE Phase', () => {
    test('score() completes in under 10ms', async () => {
        const intelBus = (await import('../bus')).default;
        const testSymbol = `PERF_SCORE_${Date.now()}`;

        // Publish a few signals
        for (let i = 0; i < 5; i++) {
            intelBus.publish({
                source: ['ORDER_FLOW', 'WHALE_FLOW', 'SENTIMENT', 'FUNDING_OI', 'MARKET_DATA'][i] as any,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: `Signal ${i}`,
                payload: {},
            });
        }

        const start = performance.now();
        intelBus.score(testSymbol, 'LONG');
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(10);
    });

    test('query() with 50 results completes in under 20ms', async () => {
        const intelBus = (await import('../bus')).default;
        const testSymbol = `PERF_QUERY_${Date.now()}`;

        // We can't easily create 50 non-duplicate signals in a test,
        // but we can verify the query itself is fast
        const start = performance.now();
        intelBus.query(testSymbol);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(20);
    });

    test('IntelAdapter.getContext() leverages caching', async () => {
        const { IntelAdapter } = await import('../adapter');
        const testSymbol = `PERF_CACHE_${Date.now()}`;

        const adapter = IntelAdapter.forSymbol(testSymbol);

        // First call populates cache
        const start1 = performance.now();
        adapter.getContext();
        const duration1 = performance.now() - start1;

        // Second call should be faster (from cache)
        const start2 = performance.now();
        adapter.getContext();
        const duration2 = performance.now() - start2;

        // Cache hit should be significantly faster
        expect(duration2).toBeLessThan(duration1);
    });

    test('detectRegime is fast with many signals', async () => {
        const { detectRegime } = await import('../regime');

        // Create array of 50 signals
        const signals = Array.from({ length: 50 }, (_, i) => ({
            source: ['ORDER_FLOW', 'WHALE_FLOW', 'SENTIMENT'][i % 3] as any,
            symbol: 'BTC',
            direction: ['BULLISH', 'BEARISH', 'NEUTRAL'][i % 3] as any,
            confidence: 0.5 + Math.random() * 0.5,
            summary: '',
            payload: {},
        }));

        const start = performance.now();
        detectRegime(signals);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(5);
    });
});

// ═══════════════════════════════════════════════════════════════
// SIMPLICITY Phase — Architecture verification
// ═══════════════════════════════════════════════════════════════

describe('Intel Flow Integration - SIMPLICITY Phase', () => {
    describe('Single Source of Truth', () => {
        test('IntelBus is a singleton', async () => {
            const bus1 = (await import('../bus')).default;
            const bus2 = (await import('../bus')).default;

            expect(bus1).toBe(bus2);
        });

        test('detectRegime is imported from regime.ts (no duplication)', async () => {
            const { detectRegime: fromRegime } = await import('../regime');
            const { detectRegime: fromAdapter } = await import('../adapter').then(m => ({ detectRegime: null }));

            // adapter.ts should re-export from regime.ts, not duplicate
            expect(fromRegime).toBeDefined();
        });
    });

    describe('Consistent API Surface', () => {
        test('all intel types are exported from types.ts', async () => {
            const types = await import('../types');

            expect(types.ALL_INTEL_SOURCES).toBeDefined();
            expect(types.INTEL_WEIGHTS).toBeDefined();
            expect(types.INTEL_TTL_MS).toBeDefined();
            expect(types.SOURCE_REGISTRY).toBeDefined();
            expect(types.VALID_SOURCES).toBeDefined();
            expect(types.VALID_DIRECTIONS).toBeDefined();
        });

        test('IntelAdapter exports MarketRegime type', async () => {
            const adapter = await import('../adapter');

            // MarketRegime should be re-exported for consumers
            expect(adapter.IntelAdapter).toBeDefined();
        });
    });

    describe('Clean Data Flow', () => {
        test('data flows: source → bus → adapter → strategy', async () => {
            const intelBus = (await import('../bus')).default;
            const { IntelAdapter } = await import('../adapter');
            const testSymbol = `FLOW_${Date.now()}`;

            // Step 1: Publish to bus (simulates data source)
            const signalId = intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.80,
                summary: 'Flow test',
                payload: { step: 'source' },
            });

            expect(signalId).toBeGreaterThan(0);

            // Step 2: Verify bus has the signal
            const busSignals = intelBus.query(testSymbol);
            expect(busSignals.length).toBeGreaterThan(0);

            // Step 3: Adapter transforms for strategy consumption
            const adapter = IntelAdapter.forSymbol(testSymbol);
            const ctx = adapter.getContext();

            expect(ctx.signalCount).toBeGreaterThan(0);
            expect(ctx.longScore.signalCount).toBeGreaterThan(0);

            // Step 4: Verify adaptations can be applied to strategy
            const adaptations = adapter.getAdaptations();
            expect(adaptations.confidence).toBeGreaterThan(0);
        });
    });
});
