// ═══════════════════════════════════════════════════════════════
// PROFIT IMPROVEMENT TESTS
// TDD: RED → GREEN → REFACTOR
//
// Tests for money-making intel improvements:
//   1. Contrarian signals at sentiment extremes
//   2. Funding rate mean reversion signals
//   3. Multi-source confluence scoring
//   4. Trade decision logging
//   5. Real data fetching (not stubs)
// ═══════════════════════════════════════════════════════════════

import { describe, test, expect, beforeEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// CORE Phase — Money-making feature tests
// ═══════════════════════════════════════════════════════════════

describe('Profit Improvements - CORE Phase', () => {
    describe('Contrarian Signal Generation', () => {
        test('generates BEARISH signal when Fear & Greed > 80 (extreme greed)', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            const signal = generateContrarianSignal({
                fearGreed: 85,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeDefined();
            expect(signal.direction).toBe('BEARISH');
            expect(signal.source).toBe('CONTRARIAN');
            expect(signal.confidence).toBeGreaterThan(0.6);
            expect(signal.summary).toContain('Extreme Greed');
        });

        test('generates BULLISH signal when Fear & Greed < 20 (extreme fear)', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            const signal = generateContrarianSignal({
                fearGreed: 15,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeDefined();
            expect(signal.direction).toBe('BULLISH');
            expect(signal.source).toBe('CONTRARIAN');
            expect(signal.confidence).toBeGreaterThan(0.6);
            expect(signal.summary).toContain('Extreme Fear');
        });

        test('returns null when sentiment is neutral (20-80 range)', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            const signal = generateContrarianSignal({
                fearGreed: 50,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeNull();
        });

        test('confidence scales with extremity (95 F&G > 82 F&G)', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            const extremeSignal = generateContrarianSignal({
                fearGreed: 95,
                symbol: 'BTCUSD',
            });

            const moderateSignal = generateContrarianSignal({
                fearGreed: 82,
                symbol: 'BTCUSD',
            });

            expect(extremeSignal!.confidence).toBeGreaterThan(moderateSignal!.confidence);
        });
    });

    describe('Funding Rate Mean Reversion', () => {
        test('generates BEARISH signal when funding rate > 0.05%', async () => {
            const { generateFundingReversion } = await import('../signals/funding-reversion');

            const signal = generateFundingReversion({
                fundingRate: 0.08, // 8 basis points
                symbol: 'BTCUSD',
            });

            expect(signal).toBeDefined();
            expect(signal.direction).toBe('BEARISH');
            expect(signal.source).toBe('FUNDING_REVERSION');
            expect(signal.summary).toContain('overheated');
        });

        test('generates BULLISH signal when funding rate < -0.05%', async () => {
            const { generateFundingReversion } = await import('../signals/funding-reversion');

            const signal = generateFundingReversion({
                fundingRate: -0.07,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeDefined();
            expect(signal.direction).toBe('BULLISH');
            expect(signal.source).toBe('FUNDING_REVERSION');
            expect(signal.summary).toContain('oversold');
        });

        test('returns null when funding is neutral', async () => {
            const { generateFundingReversion } = await import('../signals/funding-reversion');

            const signal = generateFundingReversion({
                fundingRate: 0.01,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeNull();
        });
    });

    describe('Multi-Source Confluence Scoring', () => {
        test('confluenceScore returns higher score when multiple sources agree', async () => {
            const { calculateConfluence } = await import('../signals/confluence');

            const signals = [
                { source: 'ORDER_FLOW', direction: 'BULLISH', confidence: 0.8 },
                { source: 'WHALE_FLOW', direction: 'BULLISH', confidence: 0.7 },
                { source: 'SENTIMENT', direction: 'BULLISH', confidence: 0.6 },
                { source: 'FUNDING_OI', direction: 'BULLISH', confidence: 0.75 },
            ];

            const confluence = calculateConfluence(signals as any[]);

            expect(confluence.score).toBeGreaterThan(0.6);
            expect(confluence.direction).toBe('BULLISH');
            expect(confluence.sourceCount).toBe(4);
            expect(confluence.agreement).toBeGreaterThan(0.8);
        });

        test('confluenceScore returns mixed when sources disagree', async () => {
            const { calculateConfluence } = await import('../signals/confluence');

            const signals = [
                { source: 'ORDER_FLOW', direction: 'BULLISH', confidence: 0.8 },
                { source: 'WHALE_FLOW', direction: 'BEARISH', confidence: 0.7 },
                { source: 'SENTIMENT', direction: 'NEUTRAL', confidence: 0.5 },
            ];

            const confluence = calculateConfluence(signals as any[]);

            expect(confluence.direction).toBe('MIXED');
            expect(confluence.agreement).toBeLessThan(0.5);
        });

        test('confluenceBonus increases size multiplier when high agreement', async () => {
            const { getConfluenceBonus } = await import('../signals/confluence');

            const highAgreement = getConfluenceBonus({ agreement: 0.9, sourceCount: 5 });
            const lowAgreement = getConfluenceBonus({ agreement: 0.3, sourceCount: 4 }); // Need 3+ for penalty

            expect(highAgreement).toBeGreaterThan(1.0); // Bonus multiplier
            expect(lowAgreement).toBeLessThan(1.0); // Penalty multiplier
        });
    });

    describe('Trade Decision Logging', () => {
        test('logPreflightDecision stores decision with trade context', async () => {
            const { logPreflightDecision, getRecentDecisions } = await import('../logging/preflight-log');

            const decision = {
                agentId: 'pivot_pete',
                symbol: 'BTCUSD',
                direction: 'LONG' as const,
                decision: 'GO' as const,
                intelScore: 0.45,
                sizeMultiplier: 1.0,
                regime: 'TRENDING_BULL',
                sourceBreakdown: {
                    ORDER_FLOW: { direction: 'BULLISH', confidence: 0.8 },
                    WHALE_FLOW: { direction: 'BULLISH', confidence: 0.7 },
                },
            };

            const id = logPreflightDecision(decision);
            expect(id).toBeGreaterThan(0);

            const recent = getRecentDecisions('pivot_pete', 10);
            expect(recent.length).toBeGreaterThan(0);
            expect(recent[0].decision).toBe('GO');
        });

        test('decision log includes all intel context for analysis', async () => {
            const { logPreflightDecision, getDecisionById } = await import('../logging/preflight-log');

            const decision = {
                agentId: 'bitcoin_bob',
                symbol: 'ETHUSD',
                direction: 'SHORT' as const,
                decision: 'REDUCED' as const,
                intelScore: -0.15,
                sizeMultiplier: 0.5,
                regime: 'HIGH_VOL',
                sourceBreakdown: {
                    FEAR_GREED: { direction: 'BEARISH', confidence: 0.9 },
                },
                contrarian: true,
                fundingSignal: 'OVERHEATED',
            };

            const id = logPreflightDecision(decision);
            const retrieved = getDecisionById(id);

            expect(retrieved).toBeDefined();
            expect(retrieved.contrarian).toBe(true);
            expect(retrieved.fundingSignal).toBe('OVERHEATED');
            expect(retrieved.sizeMultiplier).toBe(0.5);
        });
    });

    describe('Enhanced Preflight with Contrarian Logic', () => {
        test('preflight applies contrarian reduction in extreme greed', async () => {
            const intelBus = (await import('../bus')).default;
            const { enhancedPreflight } = await import('../preflight/enhanced');

            const testSymbol = `PREFLIGHT_CONTRA_${Date.now()}`;

            // Publish extreme greed signal
            intelBus.publish({
                source: 'FEAR_GREED' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.85,
                summary: 'Extreme Greed at 88',
                payload: { value: 88 },
            });

            const result = await enhancedPreflight({
                agentId: 'test',
                symbol: testSymbol,
                direction: 'LONG',
            });

            // LONG in extreme greed should be reduced (contrarian)
            expect(result.sizeMultiplier).toBeLessThan(1.0);
            expect(result.adjustments).toContain('contrarian_reduction');
        });

        test('preflight applies funding reversion reduction', async () => {
            const intelBus = (await import('../bus')).default;
            const { enhancedPreflight } = await import('../preflight/enhanced');

            const testSymbol = `PREFLIGHT_FUND_${Date.now()}`;

            // Publish high funding rate (0.08 = 8% which is extreme)
            intelBus.publish({
                source: 'FUNDING_OI' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.7,
                summary: 'Funding extreme',
                payload: { fundingRate: 0.08 }, // 8% funding rate (extreme)
            });

            const result = await enhancedPreflight({
                agentId: 'test',
                symbol: testSymbol,
                direction: 'LONG',
            });

            // LONG with high funding should warn about overheated market
            expect(result.adjustments).toContain('funding_reversion_warning');
        });

        test('preflight boosts size when multiple sources confirm', async () => {
            const intelBus = (await import('../bus')).default;
            const { enhancedPreflight } = await import('../preflight/enhanced');

            const testSymbol = `PREFLIGHT_CONF_${Date.now()}`;

            // Publish multiple confirming signals
            intelBus.publish({
                source: 'ORDER_FLOW' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.85,
                summary: 'Strong buy flow',
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

            intelBus.publish({
                source: 'FUNDING_OI' as const,
                symbol: testSymbol,
                direction: 'BULLISH' as const,
                confidence: 0.70,
                summary: 'Low funding (room to run)',
                payload: { fundingRate: 0.0001 },
            });

            const result = await enhancedPreflight({
                agentId: 'test',
                symbol: testSymbol,
                direction: 'LONG',
            });

            // High confluence should boost confidence
            expect(result.decision).toBe('GO');
            expect(result.confluenceBonus).toBeGreaterThan(0);
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// EDGE Phase — Boundary conditions
// ═══════════════════════════════════════════════════════════════

describe('Profit Improvements - EDGE Phase', () => {
    describe('Contrarian Edge Cases', () => {
        test('handles exactly 80 F&G (boundary)', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            const signal = generateContrarianSignal({
                fearGreed: 80,
                symbol: 'BTCUSD',
            });

            // At boundary, no contrarian signal (need > 80)
            expect(signal).toBeNull();
        });

        test('handles exactly 20 F&G (boundary)', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            const signal = generateContrarianSignal({
                fearGreed: 20,
                symbol: 'BTCUSD',
            });

            // At boundary, no contrarian signal (need < 20)
            expect(signal).toBeNull();
        });

        test('handles 0 F&G (maximum fear)', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            const signal = generateContrarianSignal({
                fearGreed: 0,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeDefined();
            expect(signal.direction).toBe('BULLISH');
            expect(signal.confidence).toBeGreaterThan(0.9); // Maximum contrarian confidence
        });

        test('handles 100 F&G (maximum greed)', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            const signal = generateContrarianSignal({
                fearGreed: 100,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeDefined();
            expect(signal.direction).toBe('BEARISH');
            expect(signal.confidence).toBeGreaterThan(0.9);
        });
    });

    describe('Funding Rate Edge Cases', () => {
        test('handles exactly 0.05% funding (boundary)', async () => {
            const { generateFundingReversion } = await import('../signals/funding-reversion');

            const signal = generateFundingReversion({
                fundingRate: 0.05,
                symbol: 'BTCUSD',
            });

            // At boundary, no signal
            expect(signal).toBeNull();
        });

        test('handles extreme positive funding (1%+)', async () => {
            const { generateFundingReversion } = await import('../signals/funding-reversion');

            const signal = generateFundingReversion({
                fundingRate: 1.5, // 1.5% funding is extreme
                symbol: 'BTCUSD',
            });

            expect(signal).toBeDefined();
            expect(signal.direction).toBe('BEARISH');
            expect(signal.confidence).toBeGreaterThan(0.9);
            expect(signal.summary.toLowerCase()).toContain('extreme'); // Case-insensitive check
        });

        test('handles extreme negative funding (-1%+)', async () => {
            const { generateFundingReversion } = await import('../signals/funding-reversion');

            const signal = generateFundingReversion({
                fundingRate: -1.2,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeDefined();
            expect(signal.direction).toBe('BULLISH');
            expect(signal.confidence).toBeGreaterThan(0.9);
        });
    });

    describe('Confluence Edge Cases', () => {
        test('handles single source (no confluence)', async () => {
            const { calculateConfluence } = await import('../signals/confluence');

            const signals = [
                { source: 'ORDER_FLOW', direction: 'BULLISH', confidence: 0.8 },
            ];

            const confluence = calculateConfluence(signals as any[]);

            expect(confluence.sourceCount).toBe(1);
            expect(confluence.agreement).toBe(1.0); // Single source = 100% agreement with itself
        });

        test('handles empty signals array', async () => {
            const { calculateConfluence } = await import('../signals/confluence');

            const confluence = calculateConfluence([]);

            expect(confluence.sourceCount).toBe(0);
            expect(confluence.direction).toBe('NEUTRAL');
            expect(confluence.score).toBe(0);
        });

        test('handles all NEUTRAL signals', async () => {
            const { calculateConfluence } = await import('../signals/confluence');

            const signals = [
                { source: 'ORDER_FLOW', direction: 'NEUTRAL', confidence: 0.5 },
                { source: 'WHALE_FLOW', direction: 'NEUTRAL', confidence: 0.5 },
                { source: 'SENTIMENT', direction: 'NEUTRAL', confidence: 0.5 },
            ];

            const confluence = calculateConfluence(signals as any[]);

            expect(confluence.direction).toBe('NEUTRAL');
            expect(confluence.agreement).toBe(1.0); // All agree on neutral
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// SECURITY Phase — Input validation
// ═══════════════════════════════════════════════════════════════

describe('Profit Improvements - SECURITY Phase', () => {
    describe('Input Validation', () => {
        test('contrarian rejects invalid fearGreed values', async () => {
            const { generateContrarianSignal } = await import('../signals/contrarian');

            // Should handle gracefully (return null or throw)
            expect(() => generateContrarianSignal({
                fearGreed: -10,
                symbol: 'BTCUSD',
            })).not.toThrow();

            expect(() => generateContrarianSignal({
                fearGreed: 150,
                symbol: 'BTCUSD',
            })).not.toThrow();
        });

        test('funding reversion handles NaN', async () => {
            const { generateFundingReversion } = await import('../signals/funding-reversion');

            const signal = generateFundingReversion({
                fundingRate: NaN,
                symbol: 'BTCUSD',
            });

            expect(signal).toBeNull();
        });

        test('confluence handles malformed signals', async () => {
            const { calculateConfluence } = await import('../signals/confluence');

            const signals = [
                { source: 'ORDER_FLOW' }, // Missing direction and confidence
                { direction: 'BULLISH', confidence: 0.8 }, // Missing source
                null, // Null entry
            ] as any[];

            // Should not crash
            expect(() => calculateConfluence(signals)).not.toThrow();
        });
    });

    describe('Logging Security', () => {
        test('decision log sanitizes agentId', async () => {
            const { logPreflightDecision, getDecisionById } = await import('../logging/preflight-log');

            const decision = {
                agentId: "'; DROP TABLE intel_preflight_log; --", // SQL injection attempt
                symbol: 'BTCUSD',
                direction: 'LONG' as const,
                decision: 'GO' as const,
                intelScore: 0.5,
                sizeMultiplier: 1.0,
                regime: 'UNKNOWN',
                sourceBreakdown: {},
            };

            // Should not throw and should safely store
            const id = logPreflightDecision(decision);
            expect(id).toBeGreaterThan(0);

            const retrieved = getDecisionById(id);
            expect(retrieved).toBeDefined();
            // The malicious agentId should be stored as-is (escaped by parameterized query)
        });
    });
});

// ═══════════════════════════════════════════════════════════════
// PERFORMANCE Phase — Speed requirements
// ═══════════════════════════════════════════════════════════════

describe('Profit Improvements - PERFORMANCE Phase', () => {
    test('contrarian signal generation < 1ms', async () => {
        const { generateContrarianSignal } = await import('../signals/contrarian');

        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
            generateContrarianSignal({ fearGreed: i % 100, symbol: 'BTCUSD' });
        }
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(100); // < 0.1ms per call
    });

    test('confluence calculation < 5ms for 20 signals', async () => {
        const { calculateConfluence } = await import('../signals/confluence');

        const signals = Array.from({ length: 20 }, (_, i) => ({
            source: `SOURCE_${i}`,
            direction: ['BULLISH', 'BEARISH', 'NEUTRAL'][i % 3],
            confidence: 0.5 + (i % 5) * 0.1,
        }));

        const start = performance.now();
        calculateConfluence(signals as any[]);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(5);
    });

    test('enhanced preflight < 20ms total', async () => {
        const { enhancedPreflight } = await import('../preflight/enhanced');

        const start = performance.now();
        await enhancedPreflight({
            agentId: 'perf_test',
            symbol: 'BTCUSD',
            direction: 'LONG',
        });
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(20);
    });
});

// ═══════════════════════════════════════════════════════════════
// SIMPLICITY Phase — Code organization
// ═══════════════════════════════════════════════════════════════

describe('Profit Improvements - SIMPLICITY Phase', () => {
    test('all profit signals export from single module', async () => {
        const signals = await import('../signals');

        expect(signals.generateContrarianSignal).toBeDefined();
        expect(signals.generateFundingReversion).toBeDefined();
        expect(signals.calculateConfluence).toBeDefined();
        expect(signals.getConfluenceBonus).toBeDefined();
    });

    test('enhanced preflight is drop-in replacement', async () => {
        const { enhancedPreflight } = await import('../preflight/enhanced');

        // Should have same interface as original preflight
        const result = await enhancedPreflight({
            agentId: 'test',
            symbol: 'BTCUSD',
            direction: 'LONG',
        });

        // Must include standard preflight fields
        expect(result).toHaveProperty('decision');
        expect(result).toHaveProperty('sizeMultiplier');
        expect(result).toHaveProperty('intelScore');
        expect(result).toHaveProperty('regime');
        expect(result).toHaveProperty('reasons');

        // Plus new enhancement fields
        expect(result).toHaveProperty('adjustments');
        expect(result).toHaveProperty('confluenceBonus');
    });
});
