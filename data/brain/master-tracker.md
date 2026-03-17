# Master Tracker — SwjshAK Autonomous Operations

> **This file is the Chief's source of truth.** Updated by Chief after decisions,
> synced from Obsidian vault via `scripts/sync-brain.sh`, or manually by Jack.

---

## Current Phase: GCP Autonomous Operations

**Status:** DEPLOYING
**Mode:** Paper Trading (Alpaca Paper + OANDA Practice)
**Account:** $10,000 paper | Risk: 1% per trade | Max daily loss: 10%

---

## Active Priorities (Chief reads these)

### Priority 1: Validate Agent Loop on GCP
- [ ] All 5 trading agents reporting status to agents_db.json
- [ ] Watchdog running and posting to Discord
- [ ] Chief cron jobs firing on schedule
- [ ] Control API responding at localhost:3000/api/control
- [ ] Kill switch tested and confirmed working

### Priority 2: Build Paper Trading Track Record
- [ ] Sterling: 20 FX trades with set-and-forget discipline
- [ ] Bitcoin Bob: 10 BTC impulse zone trades
- [ ] Pivot Pete: 10 ES futures pivot trades
- [ ] Boba: 5 SPY options trades (9:30-11AM only)
- [ ] SPX Sniper: 5 0DTE trades (post 10:30AM gate)

### Priority 3: Performance Analysis
- [ ] 50+ total trades across all agents
- [ ] Professor grades reviewed, patterns identified
- [ ] Win rate > 45% across all agents combined
- [ ] Max drawdown stayed under 5% in any single day
- [ ] Friction costs < 10% of gross P&L

---

## Agent Directives (Chief enforces these)

| Agent | Directive | Kill Switch |
|-------|-----------|-------------|
| Sterling | Set & Forget only. No market orders. 1:3 R:R min. Close by noon ET. | 3 consecutive losses |
| Bitcoin Bob | 2.5x ATR impulse zones only. Fresh zones. BTC/ETH only. | 3 consecutive losses |
| Pivot Pete | Daily pivots + VWAP. ES only for now. RTH 9:30-4PM. | 2 consecutive losses |
| Boba | 15m S&D zones. SPY only. 9:30-11AM. ONE trade/day max. | 2 consecutive losses |
| SPX Sniper | VWAP+EMA9+RSI. Entry after 10:30. 45min max. Never past 3:30. | 2 consecutive losses |

---

## Safety Guardrails (IMMUTABLE — Chief cannot override)

1. **Paper trading ONLY** — No live trading until Jack explicitly approves
2. **Max daily loss: $1,000 (10%)** — Kill switch halts ALL agents
3. **Max per-trade risk: $100 (1%)** — Position sizing enforced
4. **Max concurrent trades: 3** — Across all agents combined
5. **Max correlated exposure: 2** — Same correlation group
6. **Kill switch requires manual override** — Chief cannot auto-resume after halt
7. **No strategy changes without brain update** — Chief logs all decisions

---

## What Chief Should Work On Next

Read this section at the start of every decision cycle.

**Current focus:** Deploy to GCP and validate the autonomous loop. Push all new
brain files, configs, and supervisord changes. Start all 4 processes. Verify:
1. Dashboard + Control API responding (nextjs)
2. All trading agents spawning and writing to agents_db.json (runner)
3. Watchdog posting health checks to Discord (watchdog)
4. Chief cron jobs firing — morning brief, decision loop, EOD brain update (openclaw)
5. Brain files being read and written correctly by Chief

**After validation (48h stable):** Let the learning system accumulate data. Don't
force optimizations. Let the brain fill up with trade data, Professor grades, and
patterns. The Evolution Engine will propose its first mutations after enough data.

**After first Evolution Engine run:** Review mutations. Are they sensible? Is the
brain learning real patterns or noise? Adjust trigger thresholds if needed.

---

## Brain Architecture (18 files)

### Core Operations (data/brain/)

| File | Role | Updated By | When |
|------|------|------------|------|
| master-tracker.md | Priorities, directives, guardrails — THE source of truth | Jack + Chief | Jack sets direction. Chief updates progress weekly. |
| strategies.md | Global strategy rules + adjustment triggers | Evolution Engine | Weekly — defensive mutations only |
| decisions-log.md | Every decision Chief makes, with reasoning | Chief | Every decision cycle (30 min market hours) |
| daily-log.md | Daily narrative summaries — Chief's short-term memory | Chief | EOD 4:45 PM ET |
| learning-log.md | Pattern detection: HYPOTHESIS → CONFIRMED → APPLIED | Chief + Evolution Engine | EOD (detect), weekly (promote/invalidate) |
| performance-memory.md | Cumulative stats + evolution trigger thresholds | Chief | EOD (daily stats), weekly (full evaluation) |
| self-healing.md | Known issues playbook + auto-fixes + remediation log | Chief + Jack | On incidents. Jack adds fixes after resolving. |

### System Knowledge (data/brain/)

| File | Role | Updated By | When |
|------|------|------------|------|
| system-architecture.md | How all components connect, data flow, APIs, DB schema, Discord map | Jack + Chief | When infrastructure changes |
| environment.md | Env vars, credentials (presence only), GCP details, deployment commands | Jack | When deployment config changes |
| roadmap.md | Where the project is headed (5 phases, exit criteria) | Jack + Chief | Chief suggests items. Jack approves direction. |

### Per-Agent Memory Files (data/brain/agents/)

Each agent reads its memory before every session. Professor writes feedback after grading.
Evolution Engine adjusts parameters. Every agent learns from its own history.

| File | Agent | What's Inside |
|------|-------|---------------|
| agents/sterling.md | Sterling (FX) | Params (zone width, R:R, pairs, session window), Professor feedback, behavioral patterns, mutation history |
| agents/bitcoin-bob.md | Bitcoin Bob (Crypto) | Params (ATR multiplier, freshness, pairs), Professor feedback, patterns, performance |
| agents/pivot-pete.md | Pivot Pete (Futures) | Params (pivot type, VWAP confluence, VIX thresholds), Professor feedback, patterns |
| agents/boba.md | Boba (Options) | Params (zone TF, scale-out rules, max trades), Professor feedback, patterns |
| agents/spx-sniper.md | SPX Sniper (0DTE) | Params (entry gate, indicators, hold time), Professor feedback, patterns |
| agents/professor.md | The Professor | Grading rubric + weights, self-calibration (grade→outcome correlation), feedback themes |
| agents/overseer.md | The Overseer | Risk parameters, escalation history, risk model calibration, kill switch patterns |
| agents/auditor.md | The Auditor | Verification method, audit stats, dispute patterns, calibration data |

---

## Three Learning Loops

### Loop 1: Professor → Agent Feedback (daily)
Professor grades every trade at EOD → writes grade + lesson to the agent's memory file →
agent reads its memory next session → applies the lesson. Professor also self-calibrates:
tracks whether its grades predict future outcomes. If correlation breaks → adjust rubric weights.

### Loop 2: Pattern Detection → Strategy Evolution (weekly)
Chief detects patterns daily (loss clustering, time-of-day effects, news-day performance) →
writes HYPOTHESIS entries with trade IDs as evidence → Evolution Engine runs Sunday evening →
promotes HYPOTHESIS with 3+ data points to CONFIRMED → applies defensive mutations to
strategies.md and agent parameter files → logs every mutation with rollback plan.
Aggressive mutations (increasing risk) require Jack's approval.

### Loop 3: Self-Healing (on-demand)
Watchdog detects issue → wakes Chief → Chief reads self-healing.md playbook →
if known issue → applies auto-fix, logs to Remediation Log →
if unknown issue → logs to New Issues Queue, posts to Discord, escalates to Jack →
after Jack fixes it → fix gets added to playbook → brain never forgets a failure.

---

## Session Log — 2026-03-15

### Phase 1: Autonomous Loop (Brain → Chief → Agents → Watchdog)
- Created core brain files: master-tracker, strategies, decisions-log, daily-log
- Created sync-brain.sh for Obsidian vault → data/brain/ deployment
- Created GCP-ready OpenClaw config (openclaw-gcp.json) with Linux paths
- Created 13 cron jobs including 30-min Chief decision loop + EOD brain update
- Updated SOUL.md with full brain architecture + autonomy levels
- Updated supervisord to 4 processes (nextjs, runner, watchdog, openclaw)
- Fixed watchdog.py paths to use environment variables

### Phase 2: Self-Learning Layer
- Created learning-log.md — pattern detection (HYPOTHESIS → CONFIRMED → APPLIED)
- Created performance-memory.md — cumulative stats + 9 evolution triggers
- Upgraded EOD cron to detect patterns + accumulate stats
- Created Evolution Engine weekly cron (Sunday 6 PM) — promotes patterns, mutates strategies
- Updated 30-min decision loop to read and enforce learned patterns

### Phase 3: Full-Stack Agent Learning + Self-Healing
- Created 6 per-agent memory files with tunable parameters, Professor feedback queues, behavioral patterns, mutation history
- Created professor.md with self-calibrating rubric (grade-to-outcome correlation tracking)
- Created self-healing.md playbook with 8 known issues + auto-fixes + remediation log
- Rewired Professor EOD cron to write grades directly into agent memory files
- Rewired all agent crons (Sterling, Bob) to read their memory before acting
- Updated watchdog wake_chief() to include self-healing protocol reference
- Result: 13 brain files, 3 learning loops, every component evolves

### Phase 4: Complete Brain Documentation
- Created overseer.md — risk parameter tracking, escalation history, risk model calibration
- Created auditor.md — verification method, dispute patterns, audit statistics
- Created system-architecture.md — full component map, data flow, DB schema, API reference, Discord channel map
- Created environment.md — all env vars, credentials checklist, GCP details, deployment commands
- Created roadmap.md — 5-phase plan from paper trading to scaled live, with exit criteria per phase
- Updated master-tracker brain architecture table: 18 files total (7 core + 3 system knowledge + 8 agent memory)
- Result: Brain is now the complete source of truth. Any Chief session can understand the full system from brain files alone.
