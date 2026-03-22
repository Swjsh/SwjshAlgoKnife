# Overnight Research: Trading Strategy Patterns

**Date**: 2026-03-22
**Researcher**: RESEARCHER Agent (Terminal 3)
**Session ID**: overnight-2026-03-22-162529

---

## Executive Summary

Research into external patterns for trading strategy optimization, walk-forward analysis, and anti-overfitting techniques yielded several high-quality implementations that could enhance SwjshAK's backtest and strategy systems.

---

## Finding 1: Pi-Autoresearch Extension Pattern

**Source**: https://github.com/davebcn87/pi-autoresearch
**Applicability**: HIGH
**Implementation Difficulty**: 2/5

### Key Patterns Identified

The pi-autoresearch extension implements a powerful autonomous optimization loop:

1. **Edit-Commit-Run Loop**: `edit → commit → run_experiment → log_experiment → keep or revert → repeat`
2. **Session Persistence**: Two files enable continuity across restarts:
   - `autoresearch.jsonl` - Append-only log of every run (metric, status, commit, description)
   - `autoresearch.md` - Captures objective, what's been tried, dead ends, key wins
3. **Generic Tools**: Three core tools abstract domain-specific behavior:
   - `init_experiment` - Initialize an experiment session
   - `run_experiment` - Execute a command, capture timing, detect pass/fail
   - `log_experiment` - Record results with session-persisted state

### Application to SwjshAK

Could implement this pattern for:
- **Strategy Parameter Optimization**: Loop through parameter combinations, auto-commit improvements
- **Backtest Iteration**: Run backtests, score by Sharpe/drawdown, auto-revert poor performers
- **TradingView Alert Tuning**: Optimize alert thresholds based on historical signal quality

### Code Snippet

```typescript
interface ExperimentResult {
  commit: string;
  metric: number;
  metrics: Record<string, number>;  // Secondary metrics
  status: "keep" | "discard" | "crash" | "checks_failed";
  description: string;
  timestamp: number;
  segment: number;  // Session segment index
  confidence: number | null;  // Statistical confidence
  asi?: Record<string, unknown>;  // Actionable Side Information
}
```

---

## Finding 2: Walk-Forward Analysis Engine

**Source**: https://github.com/nicetpad2/NICEGOLD
**Applicability**: HIGH
**Implementation Difficulty**: 3/5

### Key Patterns Identified

Production-grade walk-forward analysis implementation:

1. **Time-Based Fold Splitting**: Data split into rolling windows (e.g., 30-day folds)
2. **Parameter Grid Search**: Systematic exploration of parameter combinations
3. **Multi-Objective Scoring**: Combines return, win rate, drawdown, and trade count
4. **SHAP Integration**: Feature importance analysis per fold

### Core Algorithm

```python
def split_data_into_folds(df, date_col, fold_size_days=30):
    """Split dataframe into time-based folds."""
    folds = []
    while start_date < end_date:
        fold_end = start_date + timedelta(days=fold_size_days)
        fold = df[(df[date_col] >= start_date) & (df[date_col] < fold_end)]
        if not fold.empty:
            folds.append((start_date, fold_end, fold.copy()))
        start_date = fold_end
    return folds

def optimize_params(df):
    """Search best parameters using heuristic score."""
    best_score = -np.inf
    for params in param_grid():
        result = wfa(df.copy(), params)
        # Multi-objective score
        score = return_score + 0.5 * winrate_score - 1000 * dd_score + 0.1 * trade_count
        if score > best_score:
            best_score = score
            best_params = params
    return best_params
```

### Application to SwjshAK

- **Anti-Overfitting**: Train on in-sample, validate on out-of-sample per fold
- **Regime Detection**: Different parameter sets for different market regimes
- **Strategy Validation**: Required before deploying any new strategy to live trading

---

## Finding 3: Circuit Breaker Pattern for Trading

**Source**: https://github.com/0xvasanth/lighter-rs
**Applicability**: HIGH
**Implementation Difficulty**: 2/5

### Key Patterns Identified

Production-ready circuit breaker implementation for trading bots:

1. **Three States**: CLOSED (normal), OPEN (halted), HALF_OPEN (testing recovery)
2. **Failure Tracking**: Opens after N consecutive failures (default: 3)
3. **Automatic Recovery**: Timeout-based transition to HALF_OPEN for testing
4. **Atomic Operations**: Thread-safe state management

### State Machine

```
CLOSED ──[failures >= MAX]──> OPEN ──[timeout elapsed]──> HALF_OPEN
   ^                                                          │
   └─────────[success]────────────────────────────────────────┘
```

### Code Pattern (Rust, adaptable to TypeScript)

```typescript
const CIRCUIT_CLOSED = 0;
const CIRCUIT_OPEN = 1;
const CIRCUIT_HALF_OPEN = 2;
const MAX_FAILURES = 3;
const CIRCUIT_TIMEOUT_MS = 60_000;

interface CircuitBreaker {
  state: AtomicNumber;
  failureCount: AtomicNumber;
  lastFailureTime: number | null;

  recordSuccess(): void;   // Reset to CLOSED
  recordFailure(): void;   // Increment failures, may open circuit
  canExecute(): boolean;   // Check if trading allowed
  checkAndUpdate(): void;  // Time-based OPEN→HALF_OPEN transition
}
```

### Application to SwjshAK

- **Agent Kill-Switch**: Circuit breaker per trading agent
- **Broker Connection**: Open circuit on repeated connection failures
- **Order Execution**: Halt orders after consecutive rejections
- **Strategy Suspend**: Auto-suspend strategies with consecutive losing trades

---

## Finding 4: Health Monitoring for Trading Bots

**Source**: https://github.com/emrehaskilic/AI-Trading-Bot
**Applicability**: HIGH
**Implementation Difficulty**: 2/5

### Key Patterns Identified

Production health monitoring system with:

1. **Three-Level Status**: HEALTHY, DEGRADED, UNHEALTHY
2. **Readiness Checks**: WebSocket, risk system, kill switch, memory
3. **Data Freshness Tracking**: Age of last received market data
4. **Graceful Shutdown**: Ordered shutdown with handler chain

### Health Report Interface

```typescript
type HealthReport = {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: number;
  uptimeMs: number;
  details: {
    dataFresh: boolean;       // <10s since last data
    dataAgeMs: number;
    wsClients: number;
    wsConnected: boolean;
    dryRunActive: boolean;
    memoryUsagePercent: number;
    shuttingDown: boolean;
    shutdownReason: string | null;
  };
};

type ReadyReport = {
  status: 'READY' | 'DEGRADED' | 'NOT_READY';
  checks: {
    ws: boolean;
    risk: boolean;
    killSwitch: boolean;
    memory: boolean;
  };
};
```

### Application to SwjshAK

- **Activity Feed Enhancement**: Integrate health checks into agent status display
- **Auto-Restart Logic**: Use DEGRADED state to trigger agent restart
- **Alerting Thresholds**: Push notifications when UNHEALTHY

---

## Recommendations

### Immediate Actions (Week 1)

1. **Add Circuit Breaker to Agent Runner** (Difficulty: 2/5)
   - Implement circuit breaker per trading agent
   - Auto-halt after 3 consecutive execution failures
   - 60-second cooldown before retry

2. **Enhance Health API** (Difficulty: 2/5)
   - Add data freshness tracking to `/api/health`
   - Implement three-tier status (HEALTHY/DEGRADED/UNHEALTHY)
   - Add memory usage monitoring

### Short-Term (Month 1)

3. **Implement Walk-Forward Validation** (Difficulty: 3/5)
   - Create `scripts/walk_forward_engine.py`
   - Integrate with existing backtest infrastructure
   - Require WFA pass before strategy deployment

4. **Add Autoresearch Experiment Loop** (Difficulty: 3/5)
   - Create `.claude/autoresearch.jsonl` for experiment logging
   - Implement edit-commit-test cycle for strategy tuning

### Medium-Term (Quarter 1)

5. **Multi-Objective Strategy Optimizer** (Difficulty: 4/5)
   - Combine Sharpe, drawdown, win rate into unified score
   - Parameter grid search with anti-overfitting guards

---

## References

| Topic | Repo | Stars | Last Update |
|-------|------|-------|-------------|
| Autoresearch | davebcn87/pi-autoresearch | - | 2026 |
| Walk-Forward | nicetpad2/NICEGOLD | - | 2026 |
| Circuit Breaker | 0xvasanth/lighter-rs | - | 2026 |
| Health Monitor | emrehaskilic/AI-Trading-Bot | - | 2026 |
