# SwjshAK — Autonomous Loop Architecture

> The complete Brain → Chief → Agents feedback loop running 24/7 on GCP.

---

## The Loop (Visual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        THE AUTONOMOUS LOOP                          │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │                    🧠 THE BRAIN                           │     │
│   │              data/brain/*.md                              │     │
│   │                                                          │     │
│   │  master-tracker.md  — Priorities, directives, guardrails │     │
│   │  strategies.md      — Rules, adjustment triggers         │     │
│   │  decisions-log.md   — Chief's decision history           │     │
│   │  daily-log.md       — Daily summaries, long-term memory  │     │
│   └──────────┬───────────────────────────────▲───────────────┘     │
│              │ READS                          │ WRITES              │
│              ▼                                │                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │                   🗡️ CHIEF (Sonnet 4.6)                  │     │
│   │              OpenClaw Gateway + Cron Jobs                 │     │
│   │                                                          │     │
│   │  Decision Loop (every 30 min market hours):              │     │
│   │    1. Read brain → priorities & rules                    │     │
│   │    2. Read system state → agents + trades + P&L          │     │
│   │    3. Evaluate → are directives being followed?          │     │
│   │    4. Act → pause, reduce risk, killswitch if needed     │     │
│   │    5. Log → write decision to brain                      │     │
│   │    6. Report → Discord only if action taken              │     │
│   │                                                          │     │
│   │  EOD: Write daily summary → brain daily-log.md           │     │
│   │  Weekly: Update master-tracker progress                  │     │
│   └──────────┬──────────────────────────────────────────────┘     │
│              │ COMMANDS via Control API                            │
│              ▼                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │              🎮 CONTROL API (localhost:3000)              │     │
│   │                                                          │     │
│   │  GET  /api/control  — System status snapshot             │     │
│   │  POST /api/control  — pause/resume/killswitch commands   │     │
│   └──────────┬───────────────────────────────────────────────┘     │
│              │                                                     │
│              ▼                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │           ⚙️ AGENT RUNNER (agent_runner.ts)               │     │
│   │                                                          │     │
│   │  Spawns & manages ALL trading agents as child processes: │     │
│   │    💷 Sterling      — FX Set & Forget (OANDA Practice)   │     │
│   │    ₿  Bitcoin Bob   — Crypto Impulse Zones (24/7)        │     │
│   │    📐 Pivot Pete    — Futures Pivots (ES RTH)            │     │
│   │    🧋 Boba          — Options S&D (SPY 9:30-11AM)        │     │
│   │    🎯 SPX Sniper    — 0DTE VWAP Scalps (after 10:30)    │     │
│   │    🎓 The Professor — Trade Grader (EOD)                 │     │
│   │    🔍 The Auditor   — Grade Verification                 │     │
│   └──────────┬───────────────────────────────────────────────┘     │
│              │ WRITES status to agents_db.json + journal.db        │
│              ▼                                                     │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │             👁️ WATCHDOG (Python — zero LLM cost)          │     │
│   │                                                          │     │
│   │  18 checks across 4 tiers, every 60 seconds:            │     │
│   │    Tier 1 (2-3 min): Agent health, P&L, kill switch     │     │
│   │    Tier 2 (5-10 min): Stale trades, duration, signals   │     │
│   │    Tier 3 (30 min): Win rates, friction, strategy P&L   │     │
│   │    Tier 4 (daily): Professor digest, EOD report          │     │
│   │                                                          │     │
│   │  ONLY wakes Chief when:                                  │     │
│   │    - Agent HALTED or DEAD                                │     │
│   │    - Daily P&L breaches kill switch threshold            │     │
│   │    - 3+ consecutive losses on any strategy               │     │
│   └──────────┬───────────────────────────────────────────────┘     │
│              │ wake_chief() via OpenClaw Gateway                   │
│              └───────────────────────▲───────────────────────      │
│                                      │                             │
│                    LOOP CLOSES → Chief processes alert             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Process Architecture (supervisord)

```
supervisord
├── [priority=1]  nextjs        — Next.js dashboard + API routes (port 3000)
├── [priority=10] runner        — Agent Runner (spawns all Python agents)
├── [priority=15] watchdog      — Python monitoring daemon (zero LLM cost)
└── [priority=20] openclaw      — Chief + 8 agents + Discord + cron (port 3001)
```

All 4 processes auto-restart. OpenClaw starts last because it needs the other services up.

---

## Cron Schedule (Chief's Daily Rhythm)

| Time (ET) | Job | Agent | Action |
|-----------|-----|-------|--------|
| 3:00 AM | London Open | Sterling | FX assessment → #forex |
| 8:00 AM | Morning Brief | Chief | Read brain + system status → #chief |
| 8:30 AM | NY Overlap | Sterling | FX update → #forex |
| 9:30 AM | Market Open | Chief | All-agents check → #chief |
| 9:30-4 PM | **Decision Loop** | **Chief** | **Every 30 min: Brain → Evaluate → Act → Log** |
| 12:00 PM | Midday Check | Chief | P&L + Sterling close → #chief |
| 12:00 PM | Session Close | Sterling | FX window wrap → #forex |
| 4:15 PM | EOD Grades | Professor | Grade all trades → #chief |
| 4:30 PM | EOD Risk | Overseer | Risk audit → #chief |
| 4:45 PM | **Brain Update** | **Chief** | **Write daily-log + update master-tracker** |
| Every 4h | BTC Watch | Bitcoin Bob | Crypto scan (silent unless setup) |
| Every 2h | FX Scan | Sterling | FX scan (silent unless new zone) |
| Sun 6 PM | Weekly Review | Chief | Full week analysis + brain update |

---

## Safety Guardrails (Immutable)

These are baked into the brain and CANNOT be overridden by Chief:

1. **Paper trading ONLY** — No live money until Jack approves
2. **Max daily loss: $1,000 (10%)** — Kill switch halts ALL agents
3. **Max per-trade risk: $100 (1%)** — Position sizing enforced
4. **Max concurrent trades: 3** — Across all agents
5. **Kill switch requires manual override** — Chief cannot auto-resume
6. **Chief cannot increase risk** — Can only reduce or maintain
7. **All decisions logged** — Full audit trail in decisions-log.md

---

## Self-Learning Architecture

The brain doesn't just store data — every component learns from outcomes and evolves.

### Three Learning Loops

```
LOOP 1: PROFESSOR → AGENT FEEDBACK (daily)
┌──────────┐     grades + lessons     ┌──────────────────┐
│ Professor │ ──────────────────────→ │ Agent Memory     │
│ (EOD)    │                          │ (sterling.md,    │
│          │                          │  bitcoin-bob.md, │
│          │  calibration data        │  etc.)           │
│          │ ←────────────────────── │                  │
└──────────┘  "are my grades          └──────────────────┘
               predictive?"            Agent reads memory
                                       before every session

LOOP 2: PATTERN DETECTION → STRATEGY EVOLUTION (weekly)
┌──────────────┐   daily patterns    ┌───────────────┐   mutations    ┌──────────────┐
│ learning-log │ ──────────────────→ │ Evolution     │ ────────────→ │ strategies   │
│ HYPOTHESIS   │                     │ Engine        │               │ .md          │
│ → CONFIRMED  │   performance data  │ (weekly cron) │  param changes│              │
│ → APPLIED    │ ←────────────────  │               │ ────────────→ │ agent/*.md   │
└──────────────┘                     └───────────────┘               └──────────────┘
                                      promotes patterns,
                                      mutates strategies,
                                      adjusts agent params

LOOP 3: SELF-HEALING (on-demand)
┌──────────┐   detects issue   ┌──────────┐   reads playbook   ┌───────────────┐
│ Watchdog │ ────────────────→ │ Chief    │ ────────────────→  │ self-healing  │
│          │                   │          │   applies fix       │ .md           │
│          │                   │          │ ←────────────────  │               │
│          │                   │          │   logs result       │ Remediation   │
│          │                   │          │ ────────────────→  │ Log           │
└──────────┘                   └──────────┘                    └───────────────┘
                                 if unknown → New Issues Queue → Jack reviews → brain learns
```

### Per-Agent Memory Files (data/brain/agents/)

Each trading agent has its own memory file containing:

| Section | What's In It | Who Writes | Who Reads |
|---------|-------------|------------|-----------|
| Current Parameters | Tunable strategy params (zone width, R:R, etc.) | Evolution Engine | Agent (every session) |
| Professor Feedback Queue | Grade + lesson for each trade | Professor (EOD) | Agent (next session) |
| Behavioral Patterns | "Rules I've learned from experience" | Evolution Engine | Agent (every session) |
| Performance Snapshot | Cumulative stats for this agent | Chief (EOD) | Evolution Engine |
| Mutation History | Every parameter change with evidence + rollback | Evolution Engine | Chief (audit) |

### Professor Self-Calibration

The Professor doesn't just grade — it tracks whether its grades actually predict outcomes:

- Tracks "Grade → Next Trade Outcome" correlation
- If A/B grades are followed by losses >40% of the time → rubric is rewarding wrong things → adjust weights
- If D/F grades are followed by wins >40% → rubric is penalizing wrong things → adjust weights
- Tracks "Common Feedback Patterns" — same critique 5+ times → systemic issue, not individual trades
- Systemic issues get written to learning-log.md for the Evolution Engine

### What Evolves and How

| Component | What Changes | How It Changes | Safety |
|-----------|-------------|---------------|---------|
| Agent parameters | Zone width, R:R, session windows, filters | Evolution Engine mutates after CONFIRMED pattern (3+ data points) | Defensive only. Aggressive needs Jack. |
| Strategy rules | Time filters, news blackouts, pair restrictions | Evolution Engine applies CONFIRMED patterns | Logged + reversible |
| Professor rubric | Grade weights (entry 25%, R:R 30%, etc.) | Self-calibration when grade-to-outcome correlation is low | Weights shift, scale stays same |
| Self-healing playbook | Known issues + auto-fixes | Chief adds new issues after encountering them | Max auto-retries enforced |

---

## Brain File Map (Complete)

```
data/brain/
├── master-tracker.md       — Priorities, directives, guardrails (Jack + Chief)
├── strategies.md           — Global strategy rules (Evolution Engine mutates)
├── decisions-log.md        — Every Chief decision (audit trail)
├── daily-log.md            — Daily narrative summaries (Chief EOD)
├── learning-log.md         — Pattern detection (HYPOTHESIS → CONFIRMED → APPLIED)
├── performance-memory.md   — Cumulative stats + evolution trigger thresholds
├── self-healing.md         — Known issues, auto-fixes, remediation log
└── agents/
    ├── sterling.md         — Sterling's memory, params, feedback, patterns
    ├── bitcoin-bob.md      — Bob's memory, params, feedback, patterns
    ├── pivot-pete.md       — Pete's memory, params, feedback, patterns
    ├── boba.md             — Boba's memory, params, feedback, patterns
    ├── spx-sniper.md       — Sniper's memory, params, feedback, patterns
    └── professor.md        — Professor's rubric, calibration, feedback themes
```

---

## Files Created/Modified

### New Files (Self-Learning Layer)
- `data/brain/learning-log.md` — Pattern detection (HYPOTHESIS → CONFIRMED → APPLIED)
- `data/brain/performance-memory.md` — Cumulative stats + evolution triggers
- `data/brain/self-healing.md` — Known issues playbook + auto-remediation
- `data/brain/agents/sterling.md` — Sterling's memory + tunable params
- `data/brain/agents/bitcoin-bob.md` — Bob's memory + tunable params
- `data/brain/agents/pivot-pete.md` — Pete's memory + tunable params
- `data/brain/agents/boba.md` — Boba's memory + tunable params
- `data/brain/agents/spx-sniper.md` — Sniper's memory + tunable params
- `data/brain/agents/professor.md` — Professor's rubric + self-calibration

### Core Brain Files
- `data/brain/master-tracker.md` — Chief's priorities and directives
- `data/brain/strategies.md` — Strategy rules and adjustment triggers
- `data/brain/decisions-log.md` — Chief's decision history
- `data/brain/daily-log.md` — Daily summaries (Chief writes EOD)

### Infrastructure
- `scripts/sync-brain.sh` — Syncs Obsidian vault → data/brain/
- `openclaw-setup/openclaw-gcp.json` — GCP-ready OpenClaw config (Linux paths)
- `openclaw-setup/cron-jobs-gcp.json` — GCP cron jobs with full feedback pipeline
- `openclaw-setup/workspace-gcp/SOUL.md` — Brain-aware Chief persona
- `openclaw-setup/workspace-gcp/TOOLS.md` — GCP file paths
- `openclaw-setup/workspace-gcp/MEMORY.md` — GCP memory file

### Modified Files
- `supervisord.conf` — 4 processes (nextjs, runner, watchdog, openclaw)
- `scripts/watchdog.py` — Env var paths + self-healing protocol in wake_chief()

---

## Deployment Checklist

### On GCP VM:

```bash
# 1. Ensure all 4 services are in supervisord.conf
cat /app/supervisord.conf | grep "\[program:"
# Should show: nextjs, runner, watchdog, openclaw

# 2. Deploy GCP OpenClaw config
cp openclaw-setup/openclaw-gcp.json ~/.openclaw/openclaw.json
cp openclaw-setup/cron-jobs-gcp.json ~/.openclaw/cron/jobs.json
cp -r openclaw-setup/workspace-gcp/* ~/.openclaw/workspace/

# 3. Set OpenClaw environment
cat > ~/.openclaw/.env << 'EOF'
ANTHROPIC_API_KEY=<your-key>
DISCORD_BOT_TOKEN=<your-token>
OPENCLAW_GATEWAY_TOKEN=<generate-32-hex>
EOF
chmod 600 ~/.openclaw/.env

# 4. Ensure brain directory exists with files
ls data/brain/
# Should show: master-tracker.md, strategies.md, decisions-log.md, daily-log.md

# 5. Start everything
supervisord -c supervisord.conf

# 6. Verify all 4 processes
supervisorctl status
# nextjs    RUNNING
# runner    RUNNING
# watchdog  RUNNING
# openclaw  RUNNING

# 7. Test the loop
curl -s http://localhost:3000/api/control | python3 -m json.tool | head -20
openclaw cron list
openclaw agents list
```

### From Windows (brain sync):
```powershell
# Sync Obsidian vault to GCP
bash scripts/sync-brain.sh
gcloud compute scp --recurse data/brain/ swjsh-trading:~/SwjshAlgoKnife/data/brain/ --zone=us-east4-c
```
