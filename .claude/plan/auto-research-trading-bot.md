# Auto-Research Trading Bot — Subagent Delegation Plan

> **Source**: [Auto Trade Theory](../../auto%20trade%20theory.md)
> **Created**: 2026-03-22
> **Updated**: 2026-03-22 (Subagent Delegation)
> **Target**: Full integration into SwjshAlgoKnife Research Lab
> **Convention**: Karpathy AutoResearch Pattern (prepare.py → strategy.py → eval loop)

---

## Execution Strategy: Parallel Subagent Delegation

All 5 phases are broken into **independent work packages** that can run in parallel via Claude Code's Task tool. This maximizes throughput while respecting dependencies.

---

## Phase Dependency Graph

```
Phase 1A ─┐
Phase 1B ─┼──→ Phase 2 ──→ Phase 3 ──→ Phase 5
Phase 1C ─┤         ↓
Phase 1D ─┘    Phase 4A ─┐
               Phase 4B ─┼──→ Phase 4C (Final Integration)
               Phase 4C ─┘
```

**Parallelism Opportunities**:
- Phase 1: All 4 subagents run in parallel (no dependencies)
- Phase 2: Single agent (depends on Phase 1)
- Phase 3: Single agent (depends on Phase 2)
- Phase 4: 4A/4B run in parallel, 4C depends on both
- Phase 5: Single agent (depends on Phase 2)

---

## SUBAGENT DELEGATION TABLE

| Phase | Subagent ID | Type | Task | Dependencies | Est. Time |
|-------|-------------|------|------|--------------|-----------|
| 1A | `general-purpose` | Write | Create `program.md` constraints file | None | 10 min |
| 1B | `general-purpose` | Write | Create `candidate_strategy.py` template | None | 15 min |
| 1C | `general-purpose` | Write | Create `anti_cheat.py` detection | None | 10 min |
| 1D | `general-purpose` | Write | Create `fee_model.py` commission model | None | 10 min |
| 2 | `general-purpose` | Write | Create `auto_research_loop.py` orchestrator | 1A, 1B, 1C, 1D | 25 min |
| 3 | `general-purpose` | Write | Add walk-forward validation to loop | 2 | 15 min |
| 4A | `typescript-reviewer` | Write | Create `autoResearchDb.ts` DB interface | None | 10 min |
| 4B | `general-purpose` | Write | Create `/api/research/autoresearch` route | 4A | 15 min |
| 4C | `general-purpose` | Write | Create `AutoResearchPanel.tsx` UI | 4A, 4B | 20 min |
| 5 | `general-purpose` | Modify | Integrate kill switch + drawdown limits | 2 | 10 min |
| REV | `code-reviewer` | Review | Final code review all changes | All | 10 min |

**Total Estimated Time**: ~60 minutes (with parallelism) vs ~2.5 hours (sequential)

---

## PHASE 1: CORE INFRASTRUCTURE (PARALLEL x4)

### Subagent 1A: Create `program.md`
```yaml
Agent: general-purpose
Task: Create scripts/auto_research/program.md
Input: |
  Create the Claude prompt constraints file for strategy generation.

  CRITICAL RULES TO INCLUDE:
  1. No look-ahead bias (only use data up to current candle)
  2. Position sizing max 5% per trade
  3. Must include fee calculation in all P&L
  4. Optimize for Sharpe ratio (primary), win rate (secondary)
  5. Forbidden patterns: future price access, hardcoded dates, perfect entries

  FORMAT: Markdown prompt file with clear sections

Output: scripts/auto_research/program.md
```

### Subagent 1B: Create `candidate_strategy.py`
```yaml
Agent: general-purpose
Task: Create scripts/auto_research/candidate_strategy.py
Input: |
  Create the AI-editable strategy template.

  REQUIREMENTS:
  1. Extend from a simple base class (define inline)
  2. Expose backtest(df: pd.DataFrame) -> dict method
  3. Return: sharpe, pnl, return_pct, win_rate, trade_count, total_fees, max_drawdown
  4. Use indicators: SMA, EMA, RSI, MACD, Bollinger Bands, VWAP
  5. Include default strategy (VWAP mean reversion)
  6. Add type hints throughout

  INTEGRATION: Must work with universal_backtest.py patterns

Output: scripts/auto_research/candidate_strategy.py
```

### Subagent 1C: Create `anti_cheat.py`
```yaml
Agent: general-purpose
Task: Create scripts/auto_research/anti_cheat.py
Input: |
  Create look-ahead bias and suspicious results detector.

  REJECTION RULES:
  1. PnL > 500% → REJECT (suspiciously perfect)
  2. Sharpe > 5.0 → REJECT (unrealistic)
  3. Win rate > 90% → REJECT (likely cheating)
  4. Trade count > 5000 → REJECT (fee-blind overtrading)
  5. Max drawdown = 0% → REJECT (impossible)
  6. All trades profitable → REJECT (look-ahead bias)

  FUNCTIONS:
  - validate_results(results: dict) -> tuple[bool, str | None]
  - detect_look_ahead_bias(strategy_code: str) -> list[str]

Output: scripts/auto_research/anti_cheat.py
```

### Subagent 1D: Create `fee_model.py`
```yaml
Agent: general-purpose
Task: Create scripts/auto_research/fee_model.py
Input: |
  Create realistic commission and slippage model.

  VIDEO LESSON: Bot bled $115 in fees over 814 trades ($500 → $0)

  FEE STRUCTURE BY ASSET:
  - Crypto (BTC, ETH, SOL): 0.1% commission + 0.05% slippage
  - Equities (SPY, QQQ): 0.01% commission + 0.02% slippage
  - Futures (ES, NQ): 0.005% commission + 0.01% slippage
  - Forex (EUR/USD): 0.002% commission + 0.01% slippage

  FUNCTIONS:
  - get_fees(symbol: str) -> dict[str, float]
  - calculate_trade_cost(symbol: str, price: float, qty: float) -> float
  - apply_slippage(price: float, side: str, symbol: str) -> float

Output: scripts/auto_research/fee_model.py
```

---

## PHASE 2: AUTO-RESEARCH LOOP (SEQUENTIAL)

### Subagent 2: Create `auto_research_loop.py`
```yaml
Agent: general-purpose
Task: Create scripts/auto_research_loop.py
Dependencies: Phase 1A, 1B, 1C, 1D complete
Input: |
  Create the main auto-research orchestrator.

  LOOP STRUCTURE:
  1. Load current best strategy from SQLite
  2. Call Claude API to generate new strategy variation
  3. Write new strategy to candidate_strategy.py
  4. Run backtest against cached data (via prepare.py + universal_backtest.py)
  5. Apply anti_cheat.py validation
  6. Apply fee_model.py costs
  7. Compare Sharpe to current best
  8. If better → promote and save to DB
  9. Log generation to results.tsv
  10. Emit AGENT_STATUS_UPDATE for dashboard
  11. Sleep 5 seconds, repeat

  CLAUDE API INTEGRATION:
  - Use anthropic SDK directly (ANTHROPIC_API_KEY from env)
  - Fallback to OpenRouter if Anthropic fails
  - Load program.md as system prompt

  STATUS EMISSION:
  - Print AGENT_STATUS_UPDATE:{json} to stdout
  - JSON includes: generation, sharpe, status, is_best, elapsed_time

  CLI:
  - python scripts/auto_research_loop.py --symbol BTC-USD --timeframe 15m
  - python scripts/auto_research_loop.py --symbol SPY --timeframe 5m --max-generations 100

Output: scripts/auto_research_loop.py
```

---

## PHASE 3: WALK-FORWARD VALIDATION (SEQUENTIAL)

### Subagent 3: Add Validation Gate
```yaml
Agent: general-purpose
Task: Modify scripts/auto_research_loop.py to add walk-forward validation
Dependencies: Phase 2 complete
Input: |
  Add walk-forward validation before promoting any strategy.

  DATA SPLITS:
  - Training: 2024-01-01 to 2024-12-31
  - Validation: 2025-01-01 to 2025-06-30
  - Test (out-of-sample): 2025-07-01 to 2026-03-01

  PROMOTION RULES:
  1. Strategy must pass anti_cheat on ALL three periods
  2. Validation Sharpe must be >= 50% of Training Sharpe (prevent overfit)
  3. Test Sharpe must be > 0 (out-of-sample profitability)

  ADD CLASS:
  class WalkForwardValidator:
      def validate(self, strategy_code: str, symbol: str) -> WalkForwardResult

  INTEGRATION:
  - Call validator before promoting to "best"
  - Log validation results to DB

Output: scripts/auto_research_loop.py (modified)
```

---

## PHASE 4: DASHBOARD INTEGRATION (PARALLEL → SEQUENTIAL)

### Subagent 4A: Create `autoResearchDb.ts`
```yaml
Agent: typescript-reviewer
Task: Create src/lib/autoResearchDb.ts
Dependencies: None
Input: |
  Create TypeScript database interface for auto-research.

  TABLE SCHEMA:
  autoresearch_generations (
    id INTEGER PRIMARY KEY,
    generation INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    strategy_hash TEXT,
    strategy_code TEXT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    sharpe REAL,
    return_pct REAL,
    win_rate REAL,
    trade_count INTEGER,
    total_fees REAL,
    max_drawdown REAL,
    status TEXT CHECK(status IN ('keep', 'discard', 'rejected')),
    rejection_reason TEXT,
    is_current_best BOOLEAN DEFAULT FALSE,
    train_sharpe REAL,
    val_sharpe REAL,
    test_sharpe REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )

  EXPORTS:
  - ensureAutoResearchTable(): void
  - saveGeneration(gen: AutoResearchGeneration): number
  - getLeaderboard(limit?: number): AutoResearchGeneration[]
  - getCurrentBest(symbol: string): AutoResearchGeneration | null
  - getGenerationHistory(sessionId: string): AutoResearchGeneration[]
  - updateBestStrategy(id: number): void

Output: src/lib/autoResearchDb.ts
```

### Subagent 4B: Create API Route
```yaml
Agent: general-purpose
Task: Create src/app/api/research/autoresearch/route.ts
Dependencies: Subagent 4A complete
Input: |
  Create REST API for auto-research dashboard.

  ENDPOINTS:
  GET /api/research/autoresearch
    → { running: bool, sessionId: string, currentBest: Generation, leaderboard: Generation[] }

  GET /api/research/autoresearch/leaderboard?limit=20&symbol=BTC-USD
    → Generation[]

  POST /api/research/autoresearch
    action: 'start' → Start loop for symbol/timeframe
    action: 'stop' → Stop loop
    action: 'deploy' → Deploy generation to paper trading

  INTEGRATION:
  - Import from autoResearchDb.ts
  - Check control_commands.json for killswitch
  - Spawn loop via child_process (similar to overnight route)

Output: src/app/api/research/autoresearch/route.ts
```

### Subagent 4C: Create Dashboard Panel
```yaml
Agent: general-purpose
Task: Create src/components/ResearchLab/AutoResearchPanel.tsx
Dependencies: Subagent 4A, 4B complete
Input: |
  Create React dashboard component for auto-research.

  UI SECTIONS:
  1. HEADER: Current Best Strategy
     - Symbol, Sharpe, Return %, Win Rate, Trade Count
     - "Deploy to Paper" button

  2. LIVE STATUS:
     - Generation counter (e.g., "Generation 133 running...")
     - Current strategy being tested
     - Progress bar for backtest
     - ETA

  3. LEADERBOARD TABLE:
     - Columns: Gen, Sharpe, Return, Win Rate, Trades, Fees, Status, Time
     - Sortable by any column
     - Color-coded status (green=keep, red=rejected)

  4. CONTROLS:
     - Symbol selector dropdown
     - Timeframe selector
     - Start/Stop buttons
     - Max generations input

  POLLING:
  - Fetch /api/research/autoresearch every 5 seconds

  STYLES:
  - Create AutoResearchPanel.module.css
  - Match existing cyber-industrial dark theme

Output:
  - src/components/ResearchLab/AutoResearchPanel.tsx
  - src/components/ResearchLab/AutoResearchPanel.module.css
```

---

## PHASE 5: KILL SWITCH & DRAWDOWN LIMITS (SEQUENTIAL)

### Subagent 5: Integrate Safety Systems
```yaml
Agent: general-purpose
Task: Modify scripts/auto_research_loop.py for safety
Dependencies: Phase 2 complete
Input: |
  Add kill switch and drawdown limit integration.

  KILL SWITCH:
  - Check data/control_commands.json every loop iteration
  - If killswitch=true → log and exit gracefully
  - If pause=true → sleep until resumed

  DRAWDOWN LIMITS:
  - Track peak equity for live-deployed strategies
  - If drawdown > 10% from peak → auto-pause live trading
  - Trigger Discord webhook alert
  - Start new research cycle automatically

  MAX GENERATION LIMIT:
  - Default max_generations=10000
  - Auto-stop after limit reached
  - Option to continue via --no-limit flag

  ERROR HANDLING:
  - Catch Claude API errors → retry 3 times with backoff
  - Catch backtest errors → log and continue to next generation
  - Save partial progress on any exception

Output: scripts/auto_research_loop.py (modified)
```

---

## FINAL REVIEW SUBAGENT

### Subagent REV: Code Review
```yaml
Agent: code-reviewer
Task: Review all new files
Dependencies: All phases complete
Input: |
  Review all new auto-research files:
  - scripts/auto_research/program.md
  - scripts/auto_research/candidate_strategy.py
  - scripts/auto_research/anti_cheat.py
  - scripts/auto_research/fee_model.py
  - scripts/auto_research_loop.py
  - src/lib/autoResearchDb.ts
  - src/app/api/research/autoresearch/route.ts
  - src/components/ResearchLab/AutoResearchPanel.tsx

  CHECK FOR:
  1. Security issues (API key exposure, injection)
  2. Type safety (TypeScript strict mode)
  3. Error handling completeness
  4. Code style consistency
  5. Integration correctness

Output: Review report with fixes
```

---

## EXECUTION COMMANDS

### Wave 1: Phase 1 (Parallel x4)
```bash
# Launch all 4 Phase 1 subagents in parallel
Task --subagent-type general-purpose --prompt "Phase 1A: Create program.md" &
Task --subagent-type general-purpose --prompt "Phase 1B: Create candidate_strategy.py" &
Task --subagent-type general-purpose --prompt "Phase 1C: Create anti_cheat.py" &
Task --subagent-type general-purpose --prompt "Phase 1D: Create fee_model.py" &
wait
```

### Wave 2: Phase 2 + Phase 4A (Parallel x2)
```bash
# Phase 2 depends on Phase 1
# Phase 4A is independent
Task --subagent-type general-purpose --prompt "Phase 2: Create auto_research_loop.py" &
Task --subagent-type typescript-reviewer --prompt "Phase 4A: Create autoResearchDb.ts" &
wait
```

### Wave 3: Phase 3 + Phase 4B + Phase 5 (Parallel x3)
```bash
# Phase 3 depends on Phase 2
# Phase 4B depends on Phase 4A
# Phase 5 depends on Phase 2
Task --subagent-type general-purpose --prompt "Phase 3: Add walk-forward validation" &
Task --subagent-type general-purpose --prompt "Phase 4B: Create API route" &
Task --subagent-type general-purpose --prompt "Phase 5: Add kill switch integration" &
wait
```

### Wave 4: Phase 4C (Sequential)
```bash
# Phase 4C depends on Phase 4A and 4B
Task --subagent-type general-purpose --prompt "Phase 4C: Create AutoResearchPanel.tsx"
```

### Wave 5: Review (Sequential)
```bash
# Final review after all phases
Task --subagent-type code-reviewer --prompt "Review all auto-research files"
```

---

## KEY FILES SUMMARY

| File | Operation | Phase | Description |
|------|-----------|-------|-------------|
| `scripts/auto_research/__init__.py` | Create | 1A | Package init |
| `scripts/auto_research/program.md` | Create | 1A | Claude prompt constraints |
| `scripts/auto_research/candidate_strategy.py` | Create | 1B | AI-editable strategy template |
| `scripts/auto_research/anti_cheat.py` | Create | 1C | Look-ahead bias detection |
| `scripts/auto_research/fee_model.py` | Create | 1D | Commission/slippage modeling |
| `scripts/auto_research_loop.py` | Create | 2 | Main orchestrator loop |
| `scripts/auto_research_loop.py` | Modify | 3 | Add walk-forward validation |
| `scripts/auto_research_loop.py` | Modify | 5 | Add kill switch integration |
| `src/lib/autoResearchDb.ts` | Create | 4A | TypeScript DB interface |
| `src/app/api/research/autoresearch/route.ts` | Create | 4B | REST API |
| `src/components/ResearchLab/AutoResearchPanel.tsx` | Create | 4C | Dashboard UI |
| `src/components/ResearchLab/AutoResearchPanel.module.css` | Create | 4C | Component styles |
| `src/components/ResearchLab/index.ts` | Modify | 4C | Export new component |

---

## RISKS AND MITIGATION

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Look-ahead bias** | High | anti_cheat.py rejects >500% PnL strategies |
| **Fee blindness** | High | fee_model.py enforces realistic costs |
| **Overfitting** | High | Walk-forward validation requires 3-period pass |
| **API rate limits** | Medium | 5-second delay + retry with backoff |
| **Code injection** | Medium | Sandboxed exec() + no network/file access |
| **Runaway loop** | Low | max_generations limit + kill switch |

---

## ARBITER CONSTRAINTS

```python
ARBITER_CONSTRAINTS = {
    "min_sharpe": 0.5,
    "min_win_rate": 40.0,
    "max_drawdown": 15.0,
    "min_trades": 20,
    "max_trades_per_day": 10,
    "min_profit_factor": 1.2,
}
```

---

## SUCCESS METRICS

| Metric | Current | Target |
|--------|---------|--------|
| Generations per day | 0 | 500+ |
| Strategies promoted | 0 | 5-10/week |
| Best Sharpe found | N/A | > 1.0 |
| Paper trading candidates | 0 | 3+ |
| False positive rate | N/A | < 1% |

---

## SESSION_ID Handoff

- **CODEX_SESSION**: N/A (Python-heavy, no external model)
- **GEMINI_SESSION**: N/A (Python-heavy, no external model)

This implementation uses Claude Code's native Task tool with subagents.

---

*Plan generated by Claude Opus 4.5*
*Subagent delegation optimized for parallel execution*
*Full integration into SwjshAlgoKnife Research Lab*
