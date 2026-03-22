import { MarketSimulator } from './simulator';
import { ORBStrategy } from './strategies/orb';
import { SupportResistanceStrategy } from './strategies/suppRes';
import { VWAPStrategy } from './strategies/vwapReversion';
import { BollingerBandStrategy } from './strategies/bbBreakout';
import { ThreeDucksStrategy } from './strategies/threeDucks';
import { GridTradingStrategy } from './strategies/gridTrading';
import { NeverStoppedOutStrategy } from './strategies/neverStoppedOut';
import { GoldDxyMismatchStrategy } from './strategies/goldDxyMismatch';
import { BaseStrategy, Signal, IntelStrategyContext } from './types';
import { IntelAdapter } from '../intel/adapter';

export class EngineManager {
    private strategies: BaseStrategy[] = [];
    private simulator: MarketSimulator;
    private onSignal: (signal: Signal) => void;

    constructor(onSignal: (signal: Signal) => void) {
        this.onSignal = onSignal;
        this.simulator = new MarketSimulator('BTC/USD', 94000);

        // === CRYPTO SCALP STRATEGIES ===
        this.strategies.push(new ORBStrategy({
            id: 'orb_15m',
            name: 'BTC ORB 15m',
            isActive: true,
            params: { startHour: 9, startMinute: 30, duration: 15 },
            category: 'CRYPTO'
        }));

        this.strategies.push(new NeverStoppedOutStrategy({
            id: 'never_stopped_out',
            name: 'NeverStoppedOut Halo',
            isActive: true, // Enabled for Altcoin Al
            params: {
                sessionStartHour: 9,
                sessionStartMinute: 30,
                orbDuration: 15,
                wideRangeThreshold: 400,
                cooldownMinutes: 15,
                htfBias: 'NEUTRAL'
            },
            category: 'CRYPTO'
        }));

        // === CRYPTO SWING STRATEGIES ===
        this.strategies.push(new SupportResistanceStrategy({
            id: 'supp_res',
            name: 'S&R Rejection',
            isActive: true,
            params: { sensitivity: 0.1, zones: 10 },
            category: 'CRYPTO',
            categories: ['CRYPTO']
        }));

        this.strategies.push(new VWAPStrategy({
            id: 'vwap_reversion',
            name: 'VWAP Reversion',
            isActive: false,
            params: { threshold: 1.5 },
            category: 'CRYPTO'
        }));

        this.strategies.push(new BollingerBandStrategy({
            id: 'bb_breakout',
            name: 'BB Squeeze',
            isActive: true, // Activated for Bitcoin Bob
            params: { period: 20, squeezeThreshold: 0.05 },
            category: 'CRYPTO',
            categories: ['CRYPTO']
        }));

        this.strategies.push(new GridTradingStrategy({
            id: 'grid_trading',
            name: 'Grid Trading',
            isActive: false,
            params: { gridSize: 0.5 },
            category: 'CRYPTO',
            categories: ['CRYPTO']
        }));

        // === TREND STRATEGIES ===
        this.strategies.push(new ThreeDucksStrategy({
            id: 'three_ducks',
            name: 'Three Ducks Trend',
            isActive: false,
            params: {},
            category: 'CRYPTO'
        }));

        // === FOREX/COMMODITIES CORRELATION STRATEGIES ===
        this.strategies.push(new GoldDxyMismatchStrategy({
            id: 'gold_dxy_mismatch',
            name: 'Gold-DXY Mismatch',
            isActive: true, // Enabled for Gold trading
            params: {
                dxyPushThreshold: 1.5,
                goldSidewaysThreshold: 0.5,
                retracementMin: 0.20,
                retracementMax: 0.50,
                correlationThreshold: -0.30,
                lookbackPeriod: 20,
                maxMismatchBars: 48
            },
            category: 'FOREX',
            categories: ['FOREX', 'FUTURES']
        }));
    }

    start() {
        console.log("⚔️ [Engine] Starting Continuous Crypto Trading Mode...");
        console.log("📊 [Market] Feed: BTC/USD (Simulated Live Ticks)");
        console.log("🤖 [Agents] Satoshi Sprinter, Bitcoin Bob, Altcoin Al awaiting signals...");

        // Intel adapter for the primary trading symbol
        const intelAdapter = IntelAdapter.forSymbol('BTCUSD');

        // Simulation Tick Loop
        // In a real scenario, this would be replaced by a WebSocket connection to Binance/Coinbase
        setInterval(() => {
            const tick = this.simulator.generateTick();

            // Convert tick to candle (Simplified for simulation: Close = Price)
            const mockCandle: any = {
                timestamp: tick.timestamp,
                open: tick.price,
                high: tick.price * 1.0005, // Slight volatility
                low: tick.price * 0.9995,
                close: tick.price,
                volume: 50 + Math.random() * 200
            };

            // ── Inject Intel Context into all strategies ──────────────
            // This runs once per tick (cached for 30s in IntelAdapter)
            try {
                const ctx = intelAdapter.getContext();
                const adaptations = intelAdapter.getAdaptations();

                const intelCtx: IntelStrategyContext = {
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

                for (const strat of this.strategies) {
                    strat.setIntelContext(intelCtx);
                }
            } catch (err) {
                // Intel injection should never crash the strategy loop
                // Strategies fall back to default params when intelContext is null
            }

            // Strategy Loop
            for (const strat of this.strategies) {
                if (!strat.config.isActive) continue;

                // Pass the new candle to the strategy
                const signal = strat.onCandle(mockCandle);

                if (signal) {
                    // Enrich signal with live market data
                    signal.symbol = tick.symbol;
                    signal.timestamp = Date.now().toString(); // Ensure real-time timestamp

                    console.log(`⚡ [Signal] ${strat.name} trigger on ${tick.symbol}: ${signal.action}`);
                    this.onSignal(signal);
                }
            }
        }, 3000); // 3-second heartbeat for demo "liveness"
    }

    getHistory() {
        return this.simulator.generateHistory(100);
    }

    // Get all strategies
    getStrategies(): BaseStrategy[] {
        return this.strategies;
    }

    // Get strategies filtered by category
    getStrategiesByCategory(category: string): BaseStrategy[] {
        return this.strategies.filter(s =>
            s.config.category === category ||
            s.config.categories?.includes(category as any)
        );
    }
}
