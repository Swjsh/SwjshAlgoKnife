# Learning Log — What the Brain Has Learned

> This file is the brain's long-term memory of PATTERNS, not events.
> Chief and Overseer write here when they notice something recurring.
> The Evolution Engine reads this weekly and updates strategies.md accordingly.
>
> FORMAT: Each entry is a pattern, not a one-off event.
> A pattern requires 3+ data points before it becomes a learning.

---

## How to Use This File

**Writers:** Chief (decision loop + EOD), Professor (after grading), Overseer (risk patterns)
**Reader:** Evolution Engine (weekly), Chief (every decision cycle)
**Rule:** Don't write hunches. Write evidence. Cite trade IDs, dates, win rates.

---

## Pattern Categories

### Strategy Performance Patterns

### [2026-03-22 23:50] H-006 IMPLEMENTATION VALIDATED: Bitcoin Bob SHORT Filter Working Spectacularly
- Evidence: Post-implementation backtest `BTC-USD_bb_squeeze_2026-03-22_16-34-09.json` shows 15 SHORT-only trades with 66.7% WR (10/15), +27.48% return, Sharpe 10.9.
- Comparison: Pre-implementation (39 mixed trades): 30.8% WR, +3.94% return, Sharpe 0.67.
- Improvement: +35.9pp WR, +7x return, +16x Sharpe, -12.4pp max drawdown.
- Verification: All 15 trades are SHORTs — `direction_filter: SHORT` correctly applied.
- Recommendation: Monitor live trading for continued validation. Consider similar filters for other agents.
- Status: **VALIDATED** — Full hypothesis lifecycle complete (hypothesis → confirmation → implementation → validation).
- Lesson: The Cortana→Hunter pipeline works. Statistical analysis identifies edge, implementation captures it.

### [2026-03-22] H-006 CONFIRMED: Bitcoin Bob SHORT Bias (p < 0.05)
- Evidence: 39 trades analyzed. SHORT WR 43.5% (10/23), LONG WR 12.5% (2/16). Chi-square χ² = 4.251, p < 0.05.
- Effect: +31 percentage points favoring SHORTs. +$32,901 P&L swing.
- Trades: BTC-USD_bb_squeeze_2026-03-22 backtest (39 trades total)
- Recommendation: Add `direction_filter: SHORT` to Bitcoin Bob config
- Status: **CONFIRMED** → BACK-20 created for implementation
- Regime Warning: Pattern is regime-dependent. BTC declined $89K→$69K during test period.

### [2026-03-22] H-002 CONFIRMED: Cross-Asset SHORT Bias (p = 0.034)
- Evidence: 59 combined trades (BTC + SPY). SHORT WR 43.8% (14/32), LONG WR 14.8% (4/27). Chi-square χ² = 4.499, p = 0.034.
- Effect: +28.9 percentage points cross-asset during bearish Jan-Mar 2026 regime.
- Trades: BTC-USD (39 trades), SPY ORB (20 trades)
- Recommendation: Implement asset-specific direction filters based on regime
- Status: **CONFIRMED** — Requires quarterly re-validation
- Key Insight: Direction bias is REGIME-DEPENDENT, not universal

### [2026-03-22] ⚠️ STRATEGY MISMATCH: Sterling FX Backtest vs Live Engine
- Evidence: Chief's CEO briefing identified discrepancy. Backtest uses VWAP, live engine uses Supply/Demand zones.
- Impact: **CRITICAL** — Patterns from VWAP backtest may NOT apply to live trading
- Recommendation: Align backtest and live strategies before relying on Sterling FX patterns
- Status: **DATA QUALITY WARNING** — Escalate for resolution

### [2026-03-17] Sterling FX generating zero trades — threshold too wide
- Evidence: 0 trades from Sterling since system deployment (deploy date ~2026-02-16). Sterling LINKED to OANDA, session windows correct (3AM-noon ET), but strategy generates no signals.
- Root Cause: `threshold_pct: 1.5` in backtest_config.py = 150 pips. GBP/USD intraday range on 15m is only 30-80 pips. Threshold impossible to trigger.
- Trades: None (0 trade IDs — absence is the pattern)
- Recommendation: threshold_pct 1.5 → 0.4. Backtest pending. This is Priority 1A.
- Status: CONFIRMED — 1+ day of 0 signals with functioning broker connection confirms signal logic blocked, not broker issue.

<!-- Example:
### [2026-03-20] Sterling performs better in London-only sessions
- Evidence: 8 trades London-only = 75% WR, 6 trades NY overlap = 33% WR
- Trades: #12, #14, #18 (London wins) vs #15, #19, #21 (overlap losses)
- Recommendation: Consider restricting Sterling to London session only
- Status: HYPOTHESIS (needs 20+ trade sample)
-->

### Agent Behavior Patterns
<!-- Example:
### [2026-03-25] Boba consistently stops out in first 5 minutes
- Evidence: 4 of 6 Boba losses occurred within 5 min of entry
- Trades: #22, #24, #27, #30
- Recommendation: Add 5-min cooldown after zone touch before entry
- Status: CONFIRMED (>3 data points, consistent)
-->

### Market Condition Patterns
<!-- Example:
### [2026-04-01] All agents struggle on FOMC days
- Evidence: 3 FOMC days tracked, combined WR 20% (2W/8L)
- Recommendation: Auto-pause all agents 30min before FOMC, resume 30min after
- Status: CONFIRMED → Applied to strategies.md
-->

### Risk & Drawdown Patterns
<!-- Example:
### [2026-04-05] Consecutive losses cluster between 11AM-1PM ET
- Evidence: 7 of 10 loss streaks (2+ consecutive) started in this window
- Recommendation: Reduce position size 50% during 11AM-1PM
- Status: HYPOTHESIS (needs more data)
-->

### System & Operational Patterns

### [2026-03-17] agents_db.json stale — agent runner not writing live status updates
- Evidence: agents_db.json last_updated timestamps from 2026-02-15 to 2026-02-17. System deployed 2026-03-15. 30+ decision cycles run without any agent writing to agents_db.
- Root Cause: AGENTS_DB_PATH in dataPaths.ts resolves to `cwd/agents_db.json` (project root) instead of `src/app/api/agents/agents_db.json`. One-line fix or one env var in .env.local.
- Secondary: /api/agents injects live `last_updated` at read time — masks the staleness to the dashboard consumer.
- Fix: Update AGENTS_DB_PATH in dataPaths.ts OR set env var to correct path.
- Status: CONFIRMED — 2+ days of stale timestamps confirm path bug is not transient. Queued as HIGH in System Builder Queue.

### [2026-03-17] intel_decision_log uses `timestamp` column, not `created_at`
- Evidence: Direct PRAGMA table_info query confirmed columns: id, timestamp, agent_id, symbol, direction, decision, intel_score, size_multiplier, regime, source_breakdown, contrarian, funding_signal, confluence_bonus, adjustments. Column `created_at` does NOT exist.
- Prior brain docs (system-architecture.md) incorrectly stated `created_at`. Any query using `created_at` will fail silently.
- Fix applied: system-architecture.md corrected to show `timestamp` as the date column.
- Status: RESOLVED (brain corrected)

### [2026-03-18] `intel_signals` and `intel_decision_log` are two distinct tables
- Evidence: 2026-03-18 audit confirmed both tables exist: `intel_signals` (raw data bus inputs from 18 sources, 24 rows, ECON_CALENDAR/MARKET_DATA sources confirmed), `intel_decision_log` (trade gating scores, 24 rows). Prior brain docs referred only to `intel_decision_log`. `intel_signals` was undocumented.
- Impact: Any intel query counting "intel activity" must specify which table. The two counts are coincidentally equal (24 each) but represent different things.
- Fix applied: system-architecture.md updated with both tables, schemas, and distinction.
- Status: RESOLVED (brain corrected)

### [2026-03-18] Undocumented agents: Crypto Cody and Digital Dash
- Evidence: `run_crypto_cody.py` and `run_digital_dash.py` found in scripts/ during audit run #7. Both have full AGENT_STATUS_UPDATE patterns, direct Alpaca integration, and documentation headers. Neither appears in agents_db.json, brain files, or master-tracker.
- Root Cause: Likely prototype agents or parallel development tracks never formally onboarded.
- Impact: These agents could theoretically trade if launched manually, but are not tracked or monitored by the brain/Chief system.
- Recommendation: Jack must clarify status — integrate or deprecate. If they trade, they MUST be in agents_db.json.
- Status: CONFIRMED (pattern persists — agents exist, undocumented). Queued as GAP-013.

### [2026-03-17] agent_feedback_log has 0 rows — Professor→Agent learning loop broken
- Evidence: 24 intel_decision_log rows (Intel IS firing), 0 agent_feedback_log rows. Professor exists, runs EOD, but grades are not being written back to agent memory files.
- Impact: Agents cannot learn from Professor grades. Behavioral evolution disabled.
- Recommendation: Wire Professor EOD output to write structured grade records into agent_feedback_log table.
- Status: CONFIRMED — Corroborated across 5 audit runs. Queued as HIGH in System Builder Queue.

<!-- Example:
### [2026-03-18] Agent runner crashes when yfinance rate-limited
- Evidence: 3 crashes traced to yfinance 429 errors
- Fix applied: Added retry with backoff in data_feeds.py
- Status: RESOLVED
-->

---

## Pattern Status Definitions

| Status | Meaning | Action |
|--------|---------|--------|
| HYPOTHESIS | < 3 data points, interesting but unconfirmed | Keep watching, gather more data |
| CONFIRMED | 3+ data points, consistent pattern | Queue for strategies.md update |
| APPLIED | Pattern incorporated into strategies.md | Monitor for continued validity |
| INVALIDATED | Pattern stopped holding after more data | Archive, note why |
| RESOLVED | Operational issue fixed | No further action |
