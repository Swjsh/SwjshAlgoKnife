# SwjshAK Command Center Dashboard

> **Last Updated**: 2026-03-21 (Autonomous Jira Improvement Agents LIVE)
> **Branch**: `master`
> **Server**: Contabo VPS (4 vCPU, 8GB RAM, Ubuntu 22.04) - 209.145.55.101

---

## 🚦 System Status

| Component | Status | Notes |
|-----------|--------|-------|
| [[Frontend Dashboard]] | ✅ Running | Next.js on port 3000 |
| [[Agent Runner]] | ✅ Active | Master orchestrator managing all agents |
| [[n8n Automation]] | ✅ **DEPLOYED** | 18 workflows, 534 nodes |
| [[Jira Improvement Agents]] | ✅ **LIVE** | 6 autonomous agents (eval→ticket→fix→close) |
| [[Jira Projects]] | ✅ Active | 6 projects (MGMT, LEARN, GRADE, PULSE, INFRA, BACK) |
| [[Pivot Pete]] | 🔧 DEFERRED | -28.63% return, deferred to April |
| [[Boba Trades]] | ⚠️ OPTIMIZE | +0.73% return, needs tuning |
| [[Bitcoin Bob]] | ✅ **ACTIVE** | Scanning BTC/ETH/SOL, 4 pending zones |
| [[SPX Sniper]] | ✅ READY | +4.59% return, ready for paper |
| [[Sterling FX]] | ❌ BLOCKED | 0 trades (threshold 1.5% too high) |
| [[Database SQLite]] | ✅ Working | 10 tables operational |
| [[TradingView Webhooks]] | ✅ Working | Receiving signals |
| [[Intel Layer]] | ✅ EXPANDED | 18 sources (9 new pillars) |

---

## 🤖 Autonomous Improvement Agents (LIVE)

6 threaded Jira-connected agents running eval→identify→fix→ticket→learn cycles autonomously.

| Agent | Jira Project | Status | Purpose |
|-------|--------------|--------|---------|
| InfraAgent | INFRA | ✅ LIVE | Tech debt, code quality, dependencies |
| PulseAgent | PULSE | ✅ LIVE | Heartbeat, monitoring, alerting |
| LearnAgent | LEARN | ✅ LIVE | Brain freshness, learning loops |
| GradeAgent | GRADE | ✅ LIVE | Trade grading pipeline |
| BackAgent | BACK | ✅ LIVE | Backlog, new features |
| MgmtAgent | MGMT | ✅ LIVE | Cross-agent coordination |

**Start**: `.\START_JIRA_AGENTS.ps1` | **Key files**: `scripts/run_improvement_agents.py`, `scripts/improvement_agent_base.py`

See [[Jira Agent System]] and [[Management Agents]] for full documentation.

---

## 🔄 Automation Status (NEW)

| Category | Workflows | Nodes | Status |
|----------|-----------|-------|--------|
| Operational | 4 | 85 | ⚠️ Inactive (needs credentials) |
| Reactive | 4 | 112 | ⚠️ Inactive (needs credentials) |
| Self-Improvement | 10 | 337 | ⚠️ Inactive (needs credentials) |
| **Total** | **18** | **534** | Configure in n8n UI |

**Next Steps**: Configure Jira, Discord, Anthropic credentials in n8n, then activate.

See [[n8n Automation]] and [[Self-Improvement Architecture]] for details.

---

## 🖥️ Server Pipeline

**Production**: Contabo Cloud VPS (St. Louis, US-central)
- n8n: http://209.145.55.101:5678
- SwjshAK: http://209.145.55.101:3000
- OpenClaw: localhost:3001 (internal)

**Retired**: GCP, Oracle Cloud, Fly.io (all legacy files deleted 2026-03-17)

See [[Deployment]] for full server setup and management commands.

---

## 🎯 Current Focus

**Active Work**: Autonomous Jira improvement agents LIVE — next steps
1. Wire n8n API key (`python scripts/wire_n8n_jira.py --api-key KEY --activate`) — WAITING ON JACK
2. Build prepare.py + strategy.py for AutoResearch mutation loop
3. Enforce 4 Arbiter constraints in backtest code
4. Activate SPX Sniper paper trading

**📌 Planning Hub**: See [[🎯 Master Tracker]] for complete daily/weekly/monthly priorities

See Also: [[Current Sprint]] | [[Roadmap]] | [[📅 Daily Log]]

---

## 🧠 Quick Navigation

### Core Systems
- [[System Architecture]] - How everything connects
- [[Agent System]] - Trading agents
- [[Management Agents]] - AI management agents
- [[n8n Automation]] - Workflow automation
- [[Self-Improvement Architecture]] - Autonomous enhancement

### Agents
**Trading Agents:**
- [[Pivot Pete]] - Futures (ES, NQ, YM)
- [[Boba Trades]] - Options trading
- [[Bitcoin Bob]] - Crypto markets
- [[SPX Sniper]] - SPX options
- [[Sterling FX]] - Forex trading

**Management Agents:**
- [[Chief Agent]] - Orchestrator
- [[Ops Agent]] - System Health
- [[Hunter Agent]] - Infrastructure
- [[Arbiter Agent]] - Trade Grading
- [[Cortana Agent]] - Research
- [[Scout Agent]] - Opportunities

### Development
- [[API Reference]] - All endpoints
- [[Deployment]] - Production setup
- [[GitHub & CI-CD]] - Branch protection, workflows, PRs
- [[Jira Projects]] - Project management
- [[OpenClaw HQ Setup]] - Agent orchestration
- [[Troubleshooting]] - Common issues

---

## 🔗 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CONTABO VPS                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   n8n       │    │  OpenClaw   │    │  SwjshAK    │          │
│  │  :5678      │───▶│   :3001     │───▶│   :3000     │          │
│  │ 18 workflows│    │ 6 AI agents │    │ Dashboard   │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│  ┌─────────────────────────┼─────────────────────────────────┐  │
│  │                   INTEGRATIONS                             │  │
│  │  Discord │ Jira │ Anthropic │ Alpaca │ OANDA │ GitHub     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📈 Recent Activity

- ✅ **Autonomous Jira Agents LIVE** (2026-03-21): 6 threaded improvement agents (INFRA, PULSE, LEARN, GRADE, BACK, MGMT) running eval→ticket→fix→close cycles
- ✅ **War Room + Surgeon Skills**: Karpathy autoresearch convention — Surgeon eval 94/100, GamePlan eval 96/100
- ✅ **Brain-Wired Engines**: `load_brain_knowledge()` integrated into all 5 Python trading engines
- ✅ **n8n Automation**: 18 workflows deployed (534 nodes)
- ✅ **Intel Layer Expansion**: 9 new pillars added
- ✅ **Jira Projects**: 6 projects configured (MGMT, LEARN, GRADE, PULSE, INFRA, BACK)

---

## 🚨 Known Issues

1. **n8n Credentials**: Need to configure Jira, Discord, Anthropic API in n8n UI
2. **GAP-025**: OpenClaw gateway bound to loopback - Docker can't reach it
3. **GAP-022**: OPENCLAW_GATEWAY env not in Docker container
4. **Sterling FX**: 0 trades (threshold 1.5% too high)

See [[Troubleshooting]] for resolution steps.

---

## 📚 Documentation Index

### Architecture
- [[System Architecture]]
- [[Self-Improvement Architecture]]
- [[Database Schema]]
- [[Data Flow]]

### Automation
- [[n8n Automation]]
- [[OpenClaw HQ Setup]]
- [[Jira Projects]]
- [[Management Agents]]

### Trading
- [[Strategies Overview]]
- [[Risk Management]]
- [[Signal Processing]]
- [[Trade Execution]]

### Operational
- [[Startup Commands]]
- [[LLM Control API]]
- [[Deployment]]
- [[GitHub & CI-CD]]
- [[Troubleshooting]]
