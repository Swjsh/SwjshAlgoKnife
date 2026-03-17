# Handoff Prompts for Claude CLI

> Generated: March 16, 2026
> Context: System audit identified items requiring local execution, Python testing, or env access.
> Usage: Follow the "WHERE TO RUN" instruction above each prompt block.

---

## 0. ~~GCP Discovery & Consolidation~~ — RESOLVED

> RESOLVED: Both GCP VMs stopped. Migrated to Contabo VPS 10 NVMe.
> Server: root@209.145.55.101 (St. Louis, 4 vCPU, 8GB RAM, 75GB NVMe)
> Full setup guide: CONTABO_SERVER_SETUP.md
> Old GCP VMs (swjsh-server + swjsh-trading) can be deleted after Contabo is confirmed working.

**WHERE TO RUN:**
```powershell
# Step 1: Open PowerShell on your Windows machine
# Step 2: cd into your project:
cd C:\Users\jackw\Desktop\SwjshAlgoKnife
# Step 3: Run the discovery script:
.\CHECK_GCP.ps1
# Step 4: Note which VM exists (A, B, or both), then paste the consolidation prompt into Claude CLI
```

**The two configs in your codebase:**
```
Config A (used by PUSH_TO_GCP.ps1, PUSH_TO_GCP_V2.ps1, deploy-to-gcp.sh, DEPLOY_GCP.md, DEPLOY_HANDOFF.md):
  Project:  swjsh-algo-knife
  Instance: swjsh-server
  Zone:     us-central1-a
  Machine:  e2-micro (free tier)
  SSH:      gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife

Config B (used by openclaw-setup/GCP-DEPLOY-PLAN.md, data/brain/environment.md, AUTONOMOUS-LOOP.md, scripts/sync-brain.sh):
  Project:  swjsh-trading (may not exist)
  Instance: swjsh-trading
  Zone:     us-east4-c
  Machine:  e2-small
  SSH:      gcloud compute ssh swjsh-trading --zone=us-east4-c
```

**After running CHECK_GCP.ps1, paste this into Claude CLI:**
```
Role: DevOps Engineer. You are in C:\Users\jackw\Desktop\SwjshAlgoKnife on Windows.

My codebase has two conflicting GCP server configurations. I just ran CHECK_GCP.ps1 and
the REAL server is: [TELL CLAUDE WHICH ONE — A or B or BOTH]

The correct values are:
  Project:  [FILL IN]
  Instance: [FILL IN]
  Zone:     [FILL IN]

Task: Find and fix EVERY file that references the WRONG config. Here's what needs checking:

Files referencing Config A (swjsh-server / us-central1-a / swjsh-algo-knife):
  - PUSH_TO_GCP.ps1 (line 17)
  - PUSH_TO_GCP_V2.ps1 (lines 23-25)
  - deploy-to-gcp.sh (lines 8-11)
  - DEPLOY_GCP.md (lines 83, 129, 168-170, and many more)
  - DEPLOY_HANDOFF.md (lines 5, 54, 65, 74, 86, 117-121, and many more)
  - scripts/gcp-status.ps1 (line 26)
  - scripts/gcp-command.ps1 (line 35)
  - HANDOFF_PROMPTS.md (lines 19, 194, 215)

Files referencing Config B (swjsh-trading / us-east4-c):
  - openclaw-setup/GCP-DEPLOY-PLAN.md (lines 12, 55, 66, 95, 151, 309-330, 468-472)
  - data/brain/environment.md (lines 10, 92, 95, 98)
  - AUTONOMOUS-LOOP.md (line 309)
  - scripts/sync-brain.sh (line 48)
  - openclaw-setup/workspace-gcp/MEMORY.md (line 4)
  - .claude/settings.local.json (lines 45-51)

Update ALL wrong references to match the correct config. Use find-and-replace where possible.
Do NOT touch .claude/settings.local.json (it's auto-generated).
After fixing, run: grep -r "swjsh-trading" --include="*.md" --include="*.ps1" --include="*.sh" --include="*.json" . | grep -v node_modules | grep -v .claude
That should return 0 results (or only the correct ones if Config B is the real one).

Acceptance: Every deploy-related file references the same project/instance/zone. Zero conflicting configs.
```

---

## 1. Deploy OpenClaw to GCP Server (CRITICAL — must run on GCP)

> **PREREQUISITE:** Run prompt #0 first to confirm your real server details.
> **NOTE:** `openclaw-gcp.json` already has correct Linux paths (`/home/jackw/.openclaw/`).
> A full 17-step GCP deployment guide exists at `openclaw-setup/GCP-DEPLOY-PLAN.md`.

**WHERE TO RUN:**
```powershell
# Step 1: Open PowerShell on your Windows machine
# Step 2: SSH into your GCP server (use whichever command worked from CHECK_GCP.ps1):
#
#   If Config A is real:
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife
#
#   If Config B is real:
#   gcloud compute ssh swjsh-trading --zone=us-east4-c
#
# Step 3: Once inside the GCP VM, start Claude CLI:
claude
# Step 4: Paste the prompt below into Claude CLI
```

```
Role: Senior DevOps Engineer. You are on a GCP VM (Ubuntu).

The SwjshAlgoKnife project has a GCP-ready OpenClaw config at ~/SwjshAlgoKnife/openclaw-setup/openclaw-gcp.json
that already uses Linux paths. Your job is to deploy it and verify it works.

Task:
1. Read ~/SwjshAlgoKnife/openclaw-setup/GCP-DEPLOY-PLAN.md — this is the master deployment guide
2. If OpenClaw is not yet installed on this VM, follow Steps 5-6 (install Node, OpenClaw)
3. Create the OpenClaw directory structure:
   mkdir -p ~/.openclaw/{workspace,cron,agents/{overseer,professor,auditor,sterling,bitcoin-bob,pivot-pete,boba,spx-sniper}}
4. Copy the GCP config into place:
   cp ~/SwjshAlgoKnife/openclaw-setup/openclaw-gcp.json ~/.openclaw/openclaw.json
5. Copy cron jobs:
   cp ~/SwjshAlgoKnife/openclaw-setup/cron-jobs-gcp.json ~/.openclaw/cron/jobs.json
   (If cron-jobs-gcp.json doesn't exist, use cron-jobs.json and fix any Windows paths with:
   sed -i 's|C:\\\\Users\\\\jackw\\\\Desktop\\\\SwjshAlgoKnife|/home/jackw/SwjshAlgoKnife|g' ~/.openclaw/cron/jobs.json)
6. Copy workspace files: SOUL.md, USER.md, AGENTS.md, TOOLS.md, MEMORY.md, HEARTBEAT.md
   from ~/SwjshAlgoKnife/openclaw-setup/workspace/ to ~/.openclaw/workspace/
   Then fix any Windows paths inside them:
   sed -i 's|C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife|/home/jackw/SwjshAlgoKnife|g' ~/.openclaw/workspace/*.md
7. Copy all 8 agent SOUL.md files from ~/SwjshAlgoKnife/openclaw-setup/agents/*/SOUL.md to ~/.openclaw/agents/*/SOUL.md
8. Create ~/.openclaw/.env with ANTHROPIC_API_KEY, DISCORD_BOT_TOKEN, OPENCLAW_GATEWAY_TOKEN
   (ASK ME for each value — do not invent them)
9. Verify the deployed config:
   - cat ~/.openclaw/openclaw.json | python3 -m json.tool  (valid JSON)
   - grep -c 'C:\\' ~/.openclaw/openclaw.json  (should return 0 — no Windows paths)
   - grep '"mode": "local"' ~/.openclaw/openclaw.json  (should match — gateway mode set)
   - grep "inputTypes" ~/.openclaw/openclaw.json  (should return nothing — not a valid field)
10. Start the gateway: openclaw gateway start
11. Verify: openclaw gateway status && openclaw cron list && openclaw agents list

Files: ~/SwjshAlgoKnife/openclaw-setup/openclaw-gcp.json, ~/SwjshAlgoKnife/openclaw-setup/GCP-DEPLOY-PLAN.md
Acceptance: openclaw gateway status shows running, openclaw agents list shows 9 agents, openclaw cron list shows all cron jobs
```

---

## 2. Fix Sterling FX Threshold & Run Backtest (Priority 1A)

**WHERE TO RUN:**
```powershell
# Step 1: Open PowerShell on your Windows machine
# Step 2: cd into your project:
cd C:\Users\jackw\Desktop\SwjshAlgoKnife
# Step 3: Start Claude CLI:
claude
# Step 4: Paste the prompt below into Claude CLI
```

```
Role: Quantitative Developer. You are in the SwjshAlgoKnife project directory on Windows.

Sterling FX generates 0 trades because threshold_pct is set to 1.5% (= 150 pips), but GBP/USD only moves 30-80 pips intraday on 15-minute candles.

Task:
1. Read scripts/backtest_config.py — find the Sterling FX config section
2. Change threshold_pct from 1.5 to 0.4
3. Run the backtest: python scripts/universal_backtest.py --agent sterling_fx
4. Review results — target: >20 trades, >35% win rate
5. If results are poor, try threshold values of 0.3 and 0.5 as well
6. Save the best result report to data/backtests/
7. Update the Master Tracker backtest iteration table in C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\🎯 Master Tracker.md with results

Files: scripts/backtest_config.py, scripts/sterling_fx_engine.py
Acceptance: Sterling FX produces >20 trades with >35% win rate in backtest
```

---

## 3. Optimize Boba Trades Parameters (Priority 1B)

**WHERE TO RUN:**
```powershell
# Step 1: Open PowerShell on your Windows machine
# Step 2: cd into your project:
cd C:\Users\jackw\Desktop\SwjshAlgoKnife
# Step 3: Start Claude CLI:
claude
# Step 4: Paste the prompt below into Claude CLI
```

```
Role: Quantitative Developer. You are in the SwjshAlgoKnife project directory on Windows.

Boba Trades is marginally profitable (+0.73%) but needs optimization to +5%.

Root cause analysis (from March 15 session):
- min_touches: 2 too low (winning trades had 20-44 touches, losses had 2-7)
- zone_tolerance_pct: 0.3 too wide ($2 zone on SPY = fuzzy entries)
- rr: 2.0 unrealistic (13hr avg duration, targets rarely hit)
- Stop loss formula too tight (risk * 0.5) 11/11 recent losses were stop-outs

Task:
1. Read scripts/boba_trades_engine.py and scripts/backtest_config.py
2. Apply these parameter changes:
   - min_touches: 2 to 3
   - zone_tolerance_pct: 0.3 to 0.15
   - rr: 2.0 to 1.5
   - Stop loss: risk * 0.5 to risk * 1.0
3. Run backtest: python scripts/universal_backtest.py --agent boba_trades
4. Compare against baseline (39.1% WR, +0.73% return, 0.06 Sharpe)
5. Target: >40% WR, >5% return, Sharpe >0.5
6. If first pass doesn't hit targets, try intermediate values
7. CRITICAL: There's a strategy mismatch — live engine uses impulse-based zones (15m), backtest uses touch-counting (5m). Document which approach the optimized params are tuned for.
8. Update Master Tracker backtest iteration table in C:\Users\jackw\Documents\ObsidianVaults\SwjshAK-Brain\🎯 Master Tracker.md

Files: scripts/boba_trades_engine.py, scripts/backtest_config.py
Acceptance: >40% WR, >5% return, Sharpe >0.5, max drawdown <15%
```

---

## 4. Environment Variable Cleanup (Blocker for Paper Trading)

**WHERE TO RUN:**
```powershell
# Step 1: Open PowerShell on your Windows machine
# Step 2: cd into your project:
cd C:\Users\jackw\Desktop\SwjshAlgoKnife
# Step 3: Start Claude CLI:
claude
# Step 4: Paste the prompt below into Claude CLI
```

```
Role: DevOps Engineer. You are in C:\Users\jackw\Desktop\SwjshAlgoKnife on Windows.

There are 7+ .env files with inconsistent variable names. This blocks paper trading.

Task:
1. List all .env* files: Get-ChildItem -Recurse -Filter ".env*" -Exclude node_modules
2. Read each one and catalog every variable
3. Resolve naming conflicts:
   - Standardize OANDA_API_KEY to OANDA_API_TOKEN everywhere
   - Check for any remaining hardcoded WEBHOOK_SECRET in scripts/*_engine.py (6 were fixed, verify the remaining 2)
4. Create a single definitive .env.example with ALL required variables, grouped by:
   - Core (NODE_ENV, PORT, WEBHOOK_SECRET)
   - Alpaca (APCA_API_KEY_ID, APCA_API_SECRET_KEY, APCA_API_BASE_URL)
   - OANDA (OANDA_API_TOKEN, OANDA_ACCOUNT_ID)
   - Firebase (FIREBASE_*, NEXT_PUBLIC_FIREBASE_*)
   - Discord (DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID)
   - OpenClaw (OPENCLAW_GATEWAY, ANTHROPIC_API_KEY)
   - Trading (ACCOUNT_BALANCE, RISK_PER_TRADE)
5. Delete redundant files: .env.integration, .env.template (keep .env.local and .env.example)
6. Test that each Python agent can import its env vars:
   python -c "import os; from dotenv import load_dotenv; load_dotenv('.env.local'); print(os.getenv('APCA_API_KEY_ID'))"
7. Update the "Environment Variables" section in CLAUDE.md

Files: All .env* files, scripts/*_engine.py, CLAUDE.md
Acceptance: Single .env.example with all vars, all agents load correctly, no redundant .env files
```

---

## 5. Deploy Cron Jobs to GCP

> **PREREQUISITE:** Run prompt #0 first to confirm your real server details.

**WHERE TO RUN — TWO STEPS:**
```powershell
# PART A: Update the push script (run locally on Windows)
cd C:\Users\jackw\Desktop\SwjshAlgoKnife
claude
# Paste PART A below

# PART B: Verify on GCP (run on server)
#   If Config A is real:
gcloud compute ssh swjsh-server --zone=us-central1-a --project=swjsh-algo-knife
#   If Config B is real:
#   gcloud compute ssh swjsh-trading --zone=us-east4-c
claude
# Paste PART B below
```

**PART A — Paste into Claude CLI locally:**
```
Role: DevOps Engineer. You are in C:\Users\jackw\Desktop\SwjshAlgoKnife on Windows.

The Master Tracker references 13 cron jobs for autonomous operations but they are only defined locally and never deployed to GCP.

Task:
1. Find all cron job definitions — check:
   - openclaw-setup/cron-jobs.json
   - openclaw-setup/cron-jobs-gcp.json
   - openclaw-setup/cron-jobs-autonomous.json
   - supervisord.conf for scheduled tasks
   - AUTONOMOUS-LOOP.md for documented cron specs
2. Ensure cron-jobs-gcp.json exists with Linux-compatible paths. If it doesn't, create it from cron-jobs.json with paths fixed.
3. Read PUSH_TO_GCP_V2.ps1 and add a step that uploads cron jobs after the existing deploy steps.
   The GCP connection details are at the top of that file ($GCP_PROJECT, $GCP_INSTANCE, $GCP_ZONE).
   Add: gcloud compute scp openclaw-setup/cron-jobs-gcp.json ${GCP_INSTANCE}:~/.openclaw/cron/jobs.json --zone=$GCP_ZONE --project=$GCP_PROJECT
4. Update docker-entrypoint.sh to copy cron jobs into place when running in Docker
5. Document all cron jobs in a comment block inside cron-jobs-gcp.json

Files: PUSH_TO_GCP_V2.ps1, docker-entrypoint.sh, openclaw-setup/cron-jobs*.json
Acceptance: PUSH_TO_GCP_V2.ps1 includes cron job upload step, cron-jobs-gcp.json has Linux paths
```

**PART B — Paste into Claude CLI on GCP:**
```
Role: DevOps Engineer. You are SSH'd into the GCP VM.

Verify cron jobs are deployed and running.

Task:
1. Check if ~/.openclaw/cron/jobs.json exists and has valid JSON: cat ~/.openclaw/cron/jobs.json | python3 -m json.tool
2. Verify no Windows paths: grep -c 'C:\\' ~/.openclaw/cron/jobs.json (should be 0)
3. If OpenClaw gateway is running: openclaw cron list (should show all jobs)
4. If not running: openclaw gateway start && sleep 5 && openclaw cron list

Acceptance: openclaw cron list shows all scheduled jobs with correct times
```

---

## 6. Consolidate Root Markdown Sprawl

**WHERE TO RUN:**
```powershell
# Step 1: Open PowerShell on your Windows machine
# Step 2: cd into your project:
cd C:\Users\jackw\Desktop\SwjshAlgoKnife
# Step 3: Start Claude CLI:
claude
# Step 4: Paste the prompt below into Claude CLI
```

```
Role: Technical Writer. You are in C:\Users\jackw\Desktop\SwjshAlgoKnife on Windows.

There are 21 .md files at the project root causing information sprawl and conflicting instructions.

Task:
1. Create a docs/ directory with subdirectories: architecture/, deployment/, testing/, archive/
2. Move files to appropriate locations:
   - docs/architecture/: ARCHITECTURE.md
   - docs/deployment/: DEPLOY.md, DEPLOY_GCP.md, DEPLOY_HANDOFF.md, DEPLOY_ORACLE.md
   - docs/testing/: TESTING_GUIDE.md, KILLSWITCH_TEST_QUICKSTART.md
   - docs/archive/: AUDIT_RESPONSE.md, END_TO_END_REVIEW_SUMMARY.md, WATCHDOG_TEST_REPORT.md, TEST_SUMMARY.md, ONBOARDING_COMPLETE.md, IMPLEMENTATION_SUMMARY.txt, BROKER_ERROR_RECOVERY_FIX.md, DIRECT_ALPACA_INTEGRATION.md, MIGRATION_PLAN.md, PLAN.md
3. Keep at root (essential): README.md, CLAUDE.md, QUICK_START.md, SETUP_GUIDE.md
4. Merge QUICK_START.md and SETUP_GUIDE.md if they overlap significantly
5. Update any cross-references between moved files
6. Update CLAUDE.md file references if any point to moved files
7. git add and commit with descriptive message

Files: All 21 root .md files
Acceptance: Root has <=5 .md files, docs/ is organized, no broken cross-references
```

---

## 7. Add Retry Logic to Python Agents

**WHERE TO RUN:**
```powershell
# Step 1: Open PowerShell on your Windows machine
# Step 2: cd into your project:
cd C:\Users\jackw\Desktop\SwjshAlgoKnife
# Step 3: Start Claude CLI:
claude
# Step 4: Paste the prompt below into Claude CLI
```

```
Role: Python Developer. You are in C:\Users\jackw\Desktop\SwjshAlgoKnife on Windows.

All Python trading agents (scripts/*_engine.py) have zero retry logic. API failures, rate limits, and transient errors all follow the same path: log and continue. This causes silent data loss (e.g., zone data cleared on failed scans).

Task:
1. Create a shared utility at scripts/utils/retry.py with:
   - Exponential backoff decorator: @retry(max_retries=3, base_delay=1.0, max_delay=60.0)
   - Distinguish recoverable (network timeout, rate limit) vs permanent (auth failure) errors
   - Log each retry attempt with delay info
2. Create scripts/utils/__init__.py if it doesn't exist
3. Apply to all yfinance/API calls in:
   - scripts/bitcoin_bob_engine.py (yfinance data fetching)
   - scripts/boba_trades_engine.py (yfinance data fetching)
   - scripts/spx_sniper_engine.py (market data)
   - scripts/pivot_pete_engine.py (OANDA/Alpaca data)
   - scripts/sterling_fx_engine.py (forex data)
4. Fix the zone data clearing bug: when a scan fails, do NOT clear existing zones. Only update zones on successful scans.
5. Add rate limit detection for yfinance (HTTP 429 or empty DataFrame after rapid calls)
6. Run each agent in dry-run mode to verify retry logic doesn't break startup:
   python scripts/bitcoin_bob_engine.py --dry-run  (or equivalent — check each agent's CLI args)

Files: scripts/utils/retry.py (new), scripts/utils/__init__.py (new if needed), scripts/*_engine.py
Acceptance: Agents retry transient failures 3x with backoff, never clear valid data on failed scans
```
