# Implementation Plan: Gold-DXY Mismatch Retracement Strategy

## Summary

This plan implements a trading strategy based on the **inverse correlation between Gold (XAUUSD) and DXY (US Dollar Index)**. The core thesis is:

> When DXY makes a large move but Gold barely reacts (volume mismatch), a small DXY retracement will trigger a large Gold move in the opposite direction.

## Research Validation

### ✅ Core Thesis Confirmed

1. **Historical Correlation**: Research confirms a **-0.7 correlation coefficient** between Gold and DXY over the past decade ([Bloomberg/Federal Reserve](https://www.forexgdp.com/analysis/xauusd/gold-dxy-correlation/))

2. **Correlation Holds 73-95% of Time**: Gold and DXY are negatively correlated 73% of the time on 3-month intervals and up to 95% on 10-year intervals ([forex.com](https://www.forex.com/ie/market-analysis/latest-research/gold-and-dxy-are-negatively-correlated/))

3. **2025-2026 Context**: DXY fell ~12.5% in 2025 while Gold hit record highs above $3,500. Analysts project $3,800-$4,000 Gold if DXY falls to 91 ([acy.com](https://acy.com/en/market-news/education/gold-strategy-using-vix-yields-dxy-2025-l-s-162409/))

4. **Volume Divergence Validity**: When prices make higher highs but volume shows lower highs, this signals reduced buyer confidence and potential reversal ([luxalgo.com](https://www.luxalgo.com/blog/volume-divergence-in-bullish-trends-key-signals/))

### ⚠️ Caveats to Handle

1. **Both Can Rise Together**: During extreme risk-off events (COVID, geopolitical crises), both Gold and DXY can rise as safe havens ([TradingView analysis](https://www.tradingview.com/chart/XAUUSD/DmiZ6zpy-Why-both-Gold-U-S-Dollar-Index-are-rising-IMPORTANT/))

2. **Correlation is Dynamic**: The 60-day rolling correlation ranges from -0.72 to above 0 - must track it dynamically ([etrade](https://us.etrade.com/knowledge/library/perspectives/daily-insights/gold-dollar-correlation))

3. **DXY is a Ratio**: DXY measures USD against a basket of currencies. If USD weakens but EUR/JPY weaken faster, DXY rises even while Gold rises ([GoldBroker](https://goldbroker.com/news/fallacy-inverse-relationship-between-gold-dollar-index-dxy-3363))

---

## Task Type

- [x] Backend (→ TypeScript strategy engine + Python agent)
- [ ] Frontend (no UI changes needed)
- [ ] Fullstack

---

## Technical Solution

### Architecture Decision

**Dual Implementation**:
1. **TypeScript Strategy** (`GoldDxyMismatchStrategy`) - For integration with the real-time engine manager
2. **Python Agent** (`gold_dxy_mismatch_engine.py`) - For standalone execution like Pivot Pete

### Core Logic

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIGNAL GENERATION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. FETCH DATA (every 5 minutes)                                │
│     ├── DXY: Yahoo Finance (DX-Y.NYB) or OANDA (USD_IDX)        │
│     └── Gold: OANDA (XAU_USD) or Alpaca (GLD proxy)             │
│                                                                  │
│  2. CALCULATE Z-SCORES (rolling 20-period normalization)        │
│     ├── dxy_zscore = (dxy_change - mean) / stddev               │
│     └── gold_zscore = (gold_change - mean) / stddev             │
│                                                                  │
│  3. DETECT MISMATCH                                              │
│     ├── "Big DXY Push" = |dxy_zscore| > 1.5                     │
│     ├── "Gold Sideways" = |gold_zscore| < 0.5                   │
│     └── Mismatch = Big DXY Push AND Gold Sideways               │
│                                                                  │
│  4. CONFIRM RETRACEMENT                                          │
│     ├── DXY must retrace 20-50% of the big move                 │
│     └── Use Fibonacci levels: 0.236, 0.382, 0.5                 │
│                                                                  │
│  5. GENERATE SIGNAL                                              │
│     ├── If DXY was BULLISH → Gold LONG signal                   │
│     └── If DXY was BEARISH → Gold SHORT signal                  │
│                                                                  │
│  6. CONFIRMATION FILTERS                                         │
│     ├── Rolling correlation < -0.5 (strong inverse)             │
│     ├── Volume confirmation (1.3x average)                       │
│     ├── HTF bias alignment (daily/4H trend)                     │
│     └── VIX filter (optional: VIX > 20 = caution mode)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Parameters (Configurable)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `dxyPushThreshold` | 1.5 | Z-score threshold for "big DXY move" |
| `goldSidewaysThreshold` | 0.5 | Z-score threshold for "Gold sideways" |
| `retracementMin` | 0.20 | Minimum DXY retracement (20%) |
| `retracementMax` | 0.50 | Maximum DXY retracement (50%) |
| `correlationThreshold` | -0.50 | Minimum inverse correlation to trade |
| `lookbackPeriod` | 20 | Bars for Z-score calculation |
| `volumeMultiplier` | 1.3 | Volume confirmation threshold |

---

## Implementation Steps

### Phase 1: Data Infrastructure

**Step 1.1**: Extend YahooFinance.ts to fetch DXY
- Add `{ yahoo: 'DX-Y.NYB', normalized: 'DXY' }` to symbols array
- Verify data availability via Yahoo Finance API
- **File**: `src/lib/engine/local_runner/YahooFinance.ts`
- **Deliverable**: DXY price ticks emitted alongside FX pairs

**Step 1.2**: Create CorrelationCalculator utility
- Implement rolling Pearson correlation coefficient
- Support configurable lookback period (default 20)
- Include Z-score normalization helpers
- **File**: `src/lib/engine/utils/correlation.ts` (new)
- **Deliverable**: Reusable correlation/z-score functions

### Phase 2: TypeScript Strategy Implementation

**Step 2.1**: Create GoldDxyMismatchStrategy class
- Extend BaseStrategy
- Implement state tracking for DXY moves and mismatch detection
- Calculate z-scores for both instruments
- Generate signals on confirmed retracement
- **File**: `src/lib/engine/strategies/goldDxyMismatch.ts` (new)
- **Deliverable**: Strategy class with onCandle() logic

**Step 2.2**: Register strategy in EngineManager
- Import GoldDxyMismatchStrategy
- Configure default params
- Set category: 'FOREX' (Gold is traded via XAU_USD)
- **File**: `src/lib/engine/manager.ts`
- **Deliverable**: Strategy available in engine

**Step 2.3**: Add DXY data feed to MarketData
- Subscribe to DXY alongside other forex pairs
- Emit DXY prices to strategy loop
- **File**: `src/lib/engine/local_runner/MarketData.ts`
- **Deliverable**: DXY prices flowing through system

### Phase 3: Python Agent Implementation

**Step 3.1**: Create GoldDxyMismatchEngine class
- Port logic to Python
- Use yfinance for historical data (DX-Y.NYB, GC=F)
- Use OANDA for live prices (XAU_USD, USD_IDX proxy)
- Implement same z-score/mismatch logic
- **File**: `scripts/gold_dxy_mismatch_engine.py` (new)
- **Deliverable**: Standalone Python agent

**Step 3.2**: Add correlation dashboard data
- Calculate and emit correlation status
- Track mismatch history
- Include in AGENT_STATUS_UPDATE JSON
- **Deliverable**: Correlation data in agent status

### Phase 4: Risk Management

**Step 4.1**: Integrate with Intel system
- Use intelContext.regime to adjust thresholds
- Skip signals during HIGH_VOL regime if correlation breaks
- Respect direction vetoes
- **File**: `src/lib/engine/strategies/goldDxyMismatch.ts`
- **Deliverable**: Intel-aware signal generation

**Step 4.2**: Add correlation health check
- If rolling correlation > -0.3, pause trading
- Log warning: "Correlation breakdown detected"
- **Deliverable**: Safety filter for correlation breaks

### Phase 5: Testing

**Step 5.1**: Unit tests for correlation calculator
- Test z-score accuracy
- Test rolling correlation calculation
- Edge cases: empty data, constant prices
- **File**: `src/lib/engine/utils/correlation.test.ts` (new)
- **Deliverable**: 100% coverage on utility

**Step 5.2**: Strategy unit tests
- Test mismatch detection logic
- Test retracement confirmation
- Test signal generation
- **File**: `src/lib/engine/strategies/goldDxyMismatch.test.ts` (new)
- **Deliverable**: Strategy test coverage

### Phase 6: Integration

**Step 6.1**: Add to agent_runner.ts
- Register gold_dxy_mismatch_engine.py as spawnable agent
- Configure restart policy
- **File**: `scripts/agent_runner.ts`
- **Deliverable**: Agent managed by runner

**Step 6.2**: Update CLAUDE.md documentation
- Document new strategy in strategy table
- Add configuration parameters
- **File**: `CLAUDE.md`
- **Deliverable**: Documentation updated

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/lib/engine/utils/correlation.ts` | Create | Z-score + correlation utilities |
| `src/lib/engine/strategies/goldDxyMismatch.ts` | Create | TypeScript strategy implementation |
| `scripts/gold_dxy_mismatch_engine.py` | Create | Python standalone agent |
| `src/lib/engine/local_runner/YahooFinance.ts` | Modify | Add DXY to symbol list |
| `src/lib/engine/local_runner/MarketData.ts` | Modify | Ensure DXY flows through |
| `src/lib/engine/manager.ts` | Modify | Register new strategy |
| `scripts/agent_runner.ts` | Modify | Add Python agent spawn |
| `src/lib/engine/utils/correlation.test.ts` | Create | Unit tests |
| `src/lib/engine/strategies/goldDxyMismatch.test.ts` | Create | Strategy tests |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| **Correlation breakdown during crises** | Add VIX filter: if VIX > 25, require stronger confirmation. Add correlation health check that pauses trading if correlation > -0.3 |
| **DXY data unavailability** | Yahoo Finance has DX-Y.NYB; fallback to calculating synthetic DXY from EUR/USD (57.6% weight) |
| **False mismatch signals** | Require 3+ consecutive bars of mismatch, not just single bar. Add volume confirmation. |
| **Intel veto conflicts** | Strategy respects isDirectionVetoed() - if intel says no longs, we skip gold longs even with valid mismatch |
| **Execution latency** | Use webhook fire_signal() immediately on confirmation, don't wait for next tick |

---

## Pseudo-Code: Core Logic

```typescript
class GoldDxyMismatchStrategy extends BaseStrategy {
    private dxyHistory: number[] = [];
    private goldHistory: number[] = [];
    private mismatchState: {
        detected: boolean;
        dxyDirection: 'BULLISH' | 'BEARISH';
        dxyPeakPrice: number;
        dxyMoveSize: number;
        timestamp: string;
    } | null = null;

    onCandle(candle: Candle): Signal | null {
        // 1. Update histories
        this.updateHistories(candle);

        // 2. Calculate z-scores
        const dxyZScore = this.calculateZScore(this.dxyHistory);
        const goldZScore = this.calculateZScore(this.goldHistory);

        // 3. Calculate rolling correlation
        const correlation = this.calculateCorrelation();

        // 4. Correlation health check
        if (correlation > -0.3) {
            this.log('Correlation breakdown - skipping');
            return null;
        }

        // 5. Detect new mismatch
        if (!this.mismatchState) {
            const isBigDxyPush = Math.abs(dxyZScore) > 1.5;
            const isGoldSideways = Math.abs(goldZScore) < 0.5;

            if (isBigDxyPush && isGoldSideways) {
                this.mismatchState = {
                    detected: true,
                    dxyDirection: dxyZScore > 0 ? 'BULLISH' : 'BEARISH',
                    dxyPeakPrice: this.getCurrentDxyPrice(),
                    dxyMoveSize: dxyZScore,
                    timestamp: candle.timestamp
                };
                this.log(`Mismatch detected: DXY ${this.mismatchState.dxyDirection}`);
            }
            return null;
        }

        // 6. Check for retracement
        const retracement = this.calculateRetracement();
        if (retracement >= 0.20 && retracement <= 0.50) {
            // 7. Generate signal
            const direction = this.mismatchState.dxyDirection === 'BULLISH'
                ? 'LONG'   // DXY was bullish, now retracing → Gold goes up
                : 'SHORT'; // DXY was bearish, now retracing → Gold goes down

            // 8. Check intel veto
            if (this.isDirectionVetoed(direction)) {
                this.mismatchState = null;
                return null;
            }

            // 9. Fire signal
            const signal = {
                timestamp: candle.timestamp,
                symbol: 'XAUUSD',
                action: direction === 'LONG' ? 'BUY' : 'SELL',
                price: candle.close,
                strategy: this.name,
                notes: `DXY mismatch + ${(retracement*100).toFixed(0)}% retrace. Corr: ${correlation.toFixed(2)}`,
                stopLoss: this.calculateStop(candle.close, direction),
                takeProfit: this.calculateTP(candle.close, direction)
            };

            this.mismatchState = null;
            return signal;
        }

        // 10. Expire stale mismatch (>4 hours)
        if (this.isStale(this.mismatchState.timestamp)) {
            this.mismatchState = null;
        }

        return null;
    }
}
```

---

## SESSION_ID (for /ccg:execute use)

- CODEX_SESSION: (not used - no external model calls for this plan)
- GEMINI_SESSION: (not used - no external model calls for this plan)

---

## Sources

- [ForexGDP: Gold-DXY Correlation](https://www.forexgdp.com/analysis/xauusd/gold-dxy-correlation/)
- [Forex.com: Gold and DXY Negative Correlation](https://www.forex.com/ie/market-analysis/latest-research/gold-and-dxy-are-negatively-correlated/)
- [ACY: Gold Strategy Using VIX, Yields, DXY 2025](https://acy.com/en/market-news/education/gold-strategy-using-vix-yields-dxy-2025-l-s-162409/)
- [TradingView: DXY-GOLD Mismatch Indicator](https://www.tradingview.com/script/H5PIb8SQ-DXY-GOLD-Mismatch-Retrace-Advanced/)
- [Myfxbook: XAUUSD Correlations](https://www.myfxbook.com/forex-market/correlation/XAUUSD)
- [CME Group: Gold and USD Evolving Relationship](https://www.cmegroup.com/openmarkets/metals/2025/Gold-and-the-US-Dollar-An-Evolving-Relationship.html)
- [LuxAlgo: Volume Divergence Signals](https://www.luxalgo.com/blog/volume-divergence-in-bullish-trends-key-signals/)
