# SwjshAK Brain - Obsidian Knowledge Base

Welcome to the **SwjshAK Algorithmic Trading Platform** knowledge base!

This Obsidian vault serves as a comprehensive reference and "second brain" for understanding the entire project.

---

## 🚀 Quick Start

**New to this project?** Start here:
1. [[🎯 Master Tracker]] - **⭐ START HERE** - Your daily/weekly/monthly planning hub
2. [[📅 Daily Log]] - Daily accountability and progress
3. [[📊 Dashboard]] - Current system status
4. [[System Architecture]] - How it all works
5. [[Roadmap]] - Long-term strategic vision

**Looking for something specific?** Use the index below or Obsidian's search (Ctrl+Shift+F)

---

## 📑 Table of Contents

### 🎯 Planning & Tracking (Start Here Daily)

**Your daily workflow:**
- **[[🎯 Master Tracker]]** - ⭐ Single source of truth for all planning
- **[[📅 Daily Log]]** - Daily progress and accountability
- [[Current Sprint]] - Active sprint details
- [[Roadmap]] - Long-term strategic vision
- [[Technical Debt]] - Refactoring backlog
- [[Paper Trading Week Plan]] - Validation schedule
- [[📋 Document Cleanup Plan]] - Roadmap consolidation plan

---

### Core Documentation

#### Overview
- [[📊 Dashboard]] - Current system status and quick navigation
- [[System Architecture]] - Complete technical architecture

#### Trading Agents
- [[Agent System]] - How autonomous agents work
- [[Pivot Pete]] - Futures trading agent (ES, NQ, YM)
- [[Boba Trades]] - Options trading agent
- [[Bitcoin Bob]] - Crypto trading agent
- [[SPX Sniper]] - SPX options agent
- [[Sterling FX]] - Forex trading agent

#### Management Agents (NEW)
- [[Management Agents]] - Overview of AI management agents
- [[Chief Agent]] - Orchestrator, CEO assistant
- [[Ops Agent]] - System health, kill switch
- [[Hunter Agent]] - Tech debt, infrastructure
- [[Arbiter Agent]] - Trade grading
- [[Cortana Agent]] - Research, learning
- [[Scout Agent]] - Revenue, opportunities

#### Automation (NEW)
- [[n8n Automation]] - 18 workflows, 534 nodes
- [[Self-Improvement Architecture]] - How system improves itself
- [[OpenClaw HQ Setup]] - Agent orchestration
- [[Jira Projects]] - Project management (6 projects)

#### Strategies
- [[Strategies Overview]] - All trading strategies explained
- [[ORB]] - Opening Range Breakout
- [[VWAP Reversion]] - Mean reversion trading
- [[Support Resistance]] - Zone-based trading
- [[Three Ducks]] - Multi-timeframe trend following
- [[Bollinger Breakout]] - Volatility expansion
- [[Never Stopped Out]] - Advanced ORB variant

#### Technical Reference
- [[Database Schema]] - SQLite table definitions
- [[API Reference]] - REST API endpoints (1100+ lines documented)
- [[LLM Control API]] - Control system via HTTP
- [[Connection Map]] - What depends on what
- [[UI Components]] - Premium 21st Century UI library (10+ components)

#### Operations
- [[Startup Commands]] - How to start the system (PM2, Docker, manual)
- [[Deployment]] - Production setup on Contabo VPS
- [[Troubleshooting]] - Common issues and fixes

---

## 🎯 Use Cases

### "What's the current status?"
→ Go to [[📊 Dashboard]]

### "How do I start the system?"
→ See [[Startup Commands]]

### "An agent is broken, how do I fix it?"
→ Check [[Troubleshooting]]

### "I want to add a new trading strategy"
→ Read [[Strategies Overview]] → "Adding a New Strategy"

### "How does data flow through the system?"
→ Review [[System Architecture]] → "Data Flow"

### "What's next on the roadmap?"
→ View [[Roadmap]] and [[Current Sprint]]

---

## 🔍 How to Navigate This Vault

### Links
- `[[Page Name]]` - Internal links to other pages
- Click any link to navigate
- Use **Alt + ← / →** to go back/forward

### Tags
- `#architecture` - System design docs
- `#agents` - Agent-specific content
- `#strategies` - Trading strategy docs
- `#api` - API documentation
- `#roadmap` - Planning and tracking
- `#troubleshooting` - Debugging guides

**Search by tag**: Click tags or use Obsidian's tag pane

### Graph View
- Click the graph icon to see connections between pages
- Useful for understanding relationships

---

## 📊 Current System Status

| Component | Status |
|-----------|--------|
| Dashboard | ✅ Running |
| Agent Runner | ✅ Active |
| **n8n Automation** | ✅ **18 workflows deployed** |
| **Jira Improvement Agents** | ✅ **6 agents LIVE** (eval→ticket→fix→close) |
| **Jira Projects** | ✅ 6 projects active |
| Pivot Pete | 🔧 Deferred (April) |
| Boba Trades | ⚠️ Needs optimization |
| Bitcoin Bob | ✅ Active (4 pending zones) |
| SPX Sniper | ✅ Ready for paper |
| Sterling FX | ❌ Blocked (threshold fix needed) |
| Database | ✅ Working |
| Webhooks | ✅ Working |

**Last Updated**: 2026-03-21

See [[📊 Dashboard]] for real-time status

---

## 🗺️ Project Context

### What is SwjshAK?

**SwjshAK (Swjsh Army Knife)** is an algorithmic trading platform focused on:
- **Autonomous trading agents** with specialized market strategies
- **Real-time monitoring** via Next.js dashboard
- **Multi-market support** (Futures, Options, Crypto, Forex)
- **Risk management** with kill switch and position sizing
- **Trade journaling** and performance tracking

### Tech Stack
- **Frontend**: Next.js 15, React, CSS Modules
- **Backend**: Node.js, TypeScript, SQLite
- **Agents**: Python (hybrid TS/Python architecture)
- **Brokers**: Alpaca, OANDA
- **Data**: TradingView, Alpaca, Polygon

### Design Philosophy
"Cyber-Industrial" dark mode aesthetic with:
- Electric cyan primary (`#06b6d4`)
- Neon purple accents (`#a855f7`)
- Glassmorphism effects

---

## 🧭 Getting Started Checklist

New team member? Complete these steps:

- [ ] Read [[System Architecture]]
- [ ] Review [[Agent System]]
- [ ] Clone repo: `git clone <repo-url>`
- [ ] Copy `.env.example` to `.env` and add keys
- [ ] Run `npm install`
- [ ] Run `pip install -r requirements.txt`
- [ ] Start system: `./START_SWJSH.ps1`
- [ ] Access dashboard: http://localhost:3000
- [ ] Join daily standup (see [[Current Sprint]])

---

## 📝 Contributing to This Vault

### Adding New Pages
1. Create markdown file in vault root
2. Add YAML frontmatter:
```yaml
---
tags: #tag1 #tag2
status: 📘 Reference | ✅ Active | 🔧 In Progress | ⚠️ Needs Review
---
```
3. Link from relevant pages using `[[Page Name]]`
4. Add to [[README]] index if major page

### Page Status Icons
- 📘 Reference (evergreen documentation)
- ✅ Active (currently in use)
- 🔧 In Progress (being built)
- ⚠️ Needs Review (requires attention)
- 📋 Planned (future work)
- 🔮 Future (long-term vision)

---

## 🔗 External Resources

- **Code Repository**: `C:\Users\jackw\Desktop\SwjshAlgoKnife`
- **Production Dashboard**: http://209.145.55.101:3000
- **n8n Automation**: http://209.145.55.101:5678
- **Issue Tracker**: Jira (see [[Jira Projects]] - 6 active projects)
- **Documentation Site**: This Obsidian vault is the source of truth

---

## 📅 Maintenance

This vault is actively maintained. Key pages are updated:
- [[📊 Dashboard]] - Updated with each commit
- [[Current Sprint]] - Updated daily
- [[Roadmap]] - Updated weekly
- [[Agent System]] - Updated when agents change

**Last full audit**: 2026-03-22

---

## 💡 Tips for Using Obsidian

- **Cmd/Ctrl + P**: Command palette (quick actions)
- **Cmd/Ctrl + O**: Quick switcher (open any page)
- **Cmd/Ctrl + Shift + F**: Global search
- **Cmd/Ctrl + G**: Open graph view
- **Cmd/Ctrl + E**: Toggle edit/preview mode
- **Cmd/Ctrl + [**: Fold/unfold headings

---

## 🎉 Welcome!

You now have access to the complete knowledge base for SwjshAK.

Start exploring, and remember: **all pages are interconnected** via links. If you're ever lost, come back here or check the [[📊 Dashboard]].

Happy trading! 🚀📈
