# SwjshAlgoKnife Engineering Audit Plan

> **Integrating Everything Claude Code (ECC) with Halo Crew**
> **Date**: 2026-03-22
> **Status**: READY FOR EXECUTION

---

## Executive Summary

This plan integrates **29 ECC skills** and **29 specialized agents** with your existing Halo Crew to create a comprehensive engineering audit system. The goal: make SwjshAlgoKnife production-ready with the rigor of a full engineering team.

---

## Phase 1: Install ECC Skills (Priority Order)

### Tier 1 - Critical for Trading Platform (Install First)

| Skill | Lines | Why Critical | Halo Owner |
|-------|-------|--------------|------------|
| **security-review** | 400+ | Broker API keys, webhook auth, secrets | Hunter (INFRA) |
| **tdd-workflow** | 450+ | Test trading bot logic thoroughly | Ops (SCRUM) |
| **backend-patterns** | 380+ | Multi-broker API design validation | Ops (SCRUM) |
| **verification-loop** | 200+ | Pre-commit quality gates | Arbiter (PULSE) |
| **python-testing** | 300+ | pytest patterns for bot engines | Ops (SCRUM) |

### Tier 2 - High Value

| Skill | Lines | Why Valuable | Halo Owner |
|-------|-------|--------------|------------|
| **api-design** | 320+ | REST conventions for `/api/control` | Ops (SCRUM) |
| **e2e-testing** | 320+ | Dashboard critical path testing | Ops (SCRUM) |
| **eval-harness** | 280+ | Backtest validation, pass@k metrics | Oracle (SAGE) |
| **frontend-patterns** | 350+ | Next.js dashboard optimization | Ops (SCRUM) |

### Tier 3 - Nice to Have

| Skill | Lines | Purpose | Halo Owner |
|-------|-------|---------|------------|
| **mcp-server-patterns** | 250+ | Custom market data tools | Hunter (INFRA) |
| **coding-standards** | 400+ | Immutability in market data | Cortana (LEARN) |
| **strategic-compact** | 120+ | Long debugging sessions | Chief (MGMT) |

---

## Phase 2: Agent Assignment Matrix

### ECC Agents → Halo Crew Mapping

| ECC Agent | Role | Halo Partner | Joint Mission |
|-----------|------|--------------|---------------|
| `code-reviewer` | Senior code quality | **Cortana** (GRADE) | Grade all PRs with patterns |
| `security-reviewer` | Security hardening | **Hunter** (INFRA) | Audit broker APIs, webhooks |
| `python-reviewer` | Python best practices | **Cortana** (LEARN) | Review trading bot engines |
| `typescript-reviewer` | TS/Next.js patterns | **Cortana** (LEARN) | Review dashboard code |
| `planner` | Implementation planning | **Chief** (MGMT) | Plan feature work |
| `architect` | System design | **Scout** (BACK) | Architecture decisions |
| `tdd-guide` | Test-first methodology | **Ops** (SCRUM) | Enforce testing |
| `database-reviewer` | SQL & schema design | **Hunter** (INFRA) | Prisma schema review |
| `build-error-resolver` | Fix build issues | **Arbiter** (PULSE) | Resolve CI failures |

---

## Phase 3: Audit Execution Sequence

### Week 1: Security & Infrastructure Audit

**Day 1-2: Security Review**
```
Agents: security-reviewer + Hunter (INFRA)
Focus Areas:
├── Broker API key management (Alpaca, OANDA, IBKR, Tastytrade, Tradovate)
├── Webhook signature validation (/api/webhook/tradingview)
├── Environment variable exposure
├── Discord webhook URL security
├── Position data in logs
└── WebSocket auth for real-time feeds

Commands:
/harness-audit         # Get baseline score
/code-review           # Full codebase review
```

**Day 3-4: Database & API Review**
```
Agents: database-reviewer + architect
Focus Areas:
├── Prisma schema design (BrokerConfig encryption)
├── SQLite query optimization (trades, signals tables)
├── API route conventions (/api/control, /api/broker/*)
├── Rate limiting implementation
└── Error response patterns

Commands:
/verify                # Build → lint → test
```

**Day 5: Infrastructure**
```
Agents: Hunter (INFRA) + build-error-resolver
Focus Areas:
├── PM2 configuration
├── Docker/supervisord setup
├── CI/CD pipeline (GitHub Actions)
├── Branch protection enforcement
└── Build error resolution
```

### Week 2: Code Quality & Testing

**Day 1-2: Python Trading Bots**
```
Agents: python-reviewer + tdd-guide + Cortana (LEARN)
Target Files:
├── scripts/pivot_pete_engine.py
├── scripts/boba_options_engine.py
├── scripts/spx_sniper_options_engine.py
├── scripts/sterling_fx_engine.py
├── scripts/bitcoin_bob_engine.py
├── scripts/agent_utils.py
└── scripts/position_sync.py

Commands:
/tdd                   # Enforce test-first
/python-review         # Code quality
```

**Day 3-4: TypeScript Frontend**
```
Agents: typescript-reviewer + frontend-patterns
Target Files:
├── src/app/api/control/route.ts
├── src/app/api/broker/*/route.ts
├── src/lib/broker/adapters/*.ts
├── src/lib/engine/manager.ts
├── scripts/agent_runner.ts
└── src/components/Dashboard/*

Commands:
/code-review           # Full TS review
```

**Day 5: E2E Testing**
```
Agents: e2e-testing skill + Ops (SCRUM)
Critical Flows:
├── Login → Dashboard → View positions
├── Submit webhook → Signal appears → Trade logged
├── Start agent → Monitor heartbeat → Stop agent
├── Connect broker → Verify credentials → Save
└── Routing config → Update → Verify

Commands:
/e2e                   # Generate Playwright tests
```

### Week 3: Architecture & Performance

**Day 1-2: Architecture Review**
```
Agents: architect + Scout (BACK)
Focus Areas:
├── Multi-broker abstraction (IBroker interface)
├── Order routing logic
├── Agent orchestration (agent_runner.ts)
├── Real-time data flow (WebSocket → Strategy → Trade)
└── Oracle intelligence pipeline

Output:
- Architecture decision records (ADRs)
- System diagram updates
- Refactoring recommendations
```

**Day 3-4: Performance Optimization**
```
Agents: frontend-patterns + backend-patterns
Focus Areas:
├── Chart rendering performance
├── WebSocket message batching
├── Database query optimization
├── API response caching
└── Context budget analysis

Commands:
/context-budget        # Token usage analysis
```

**Day 5: Documentation**
```
Agents: doc-updater + Chief (MGMT)
Updates:
├── CLAUDE.md refinements
├── API documentation
├── Agent setup guides
├── Deployment runbooks
└── Master Tracker sync
```

---

## Phase 4: Continuous Integration

### Hook Configuration

Add to `.claude/hooks.json`:
```json
{
  "hooks": [
    {
      "type": "PostToolUse",
      "matcher": { "tool": "Edit" },
      "actions": [
        { "command": "npx prettier --write {file}" },
        { "command": "npx eslint --fix {file}" }
      ]
    },
    {
      "type": "PreToolUse",
      "matcher": { "tool": "Bash", "pattern": "git commit" },
      "actions": [
        { "command": "/verify" }
      ]
    }
  ]
}
```

### Quality Gates (Verification Loop)

Every PR must pass:
```
1. TypeScript compile (tsc --noEmit)
2. ESLint (npx eslint src/)
3. Python lint (ruff check scripts/)
4. Unit tests (npm test + pytest)
5. E2E tests (npx playwright test --project=critical)
6. Security scan (npm audit + safety check)
7. Coverage ≥ 80%
```

---

## Phase 5: Eval Framework for Trading

### Capability Evals (pass@3 > 90%)

```markdown
## EVAL: trading-signals

### Capability Evals
- [ ] SPX Sniper generates valid ORB signal on market open
- [ ] Bitcoin Bob detects divergence correctly
- [ ] Pivot Pete calculates pivot points accurately
- [ ] Sterling FX handles OANDA position sync
- [ ] Boba Options calculates Greeks correctly

### Regression Evals (pass^3 = 100%)
- [ ] Existing trades not corrupted by position sync
- [ ] Webhook validation still rejects invalid signatures
- [ ] Order routing falls back correctly when broker unavailable
- [ ] Agent restart doesn't duplicate orders
```

### Performance Evals

```markdown
## EVAL: backtest-performance

### Metrics
- [ ] Sharpe ratio > 1.0 on paper trades
- [ ] Max drawdown < 10%
- [ ] Win rate > 55%
- [ ] Average trade duration < 4 hours

### Oracle Validation
- [ ] Source reliability scores accurate
- [ ] Confidence decay formula correct
- [ ] Auto-rollback triggers at thresholds
```

---

## Phase 6: Multi-Agent Orchestration

### Parallel Audit Execution

Use `/devfleet` to run 5 parallel audits:
```
Agent 1 (code-reviewer)     → Review all Python bots
Agent 2 (typescript-reviewer) → Review all TypeScript
Agent 3 (security-reviewer)  → Security deep-dive
Agent 4 (database-reviewer)  → Schema & queries
Agent 5 (architect)         → Architecture review
```

### Halo Crew Coordination

```
Chief (MGMT)    → Coordinates audit phases, tracks progress
Arbiter (PULSE) → Monitors build health, alerts on failures
Cortana (LEARN) → Extracts patterns, grades PRs
Scout (BACK)    → Researches best practices, competitors
Ops (SCRUM)     → Implements fixes from audit findings
Hunter (INFRA)  → Fixes infrastructure issues
Oracle (SAGE)   → Validates trading logic, source reliability
```

---

## Installation Commands

```bash
# Clone ECC repository
git clone https://github.com/affaan-m/everything-claude-code.git ~/ecc

# Install rules for hybrid Python + TypeScript stack
cd ~/ecc && ./install.sh typescript python

# Copy key skills to project
cp -r ~/.claude/rules/common ~/.claude/rules/
cp -r ~/.claude/rules/typescript ~/.claude/rules/
cp -r ~/.claude/rules/python ~/.claude/rules/

# Verify installation
ls ~/.claude/rules/
# Should show: common/ typescript/ python/
```

---

## Success Metrics

| Metric | Current | Target | Owner |
|--------|---------|--------|-------|
| Test coverage | ~20% | 80%+ | Ops |
| Security issues | Unknown | 0 Critical | Hunter |
| Build time | ~3 min | < 2 min | Arbiter |
| E2E test pass rate | 0% | 95%+ | Ops |
| Documentation coverage | 50% | 90%+ | Chief |
| Oracle accuracy | Unknown | 85%+ | Oracle |

---

## Quick Reference: Slash Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/harness-audit` | Get baseline score | Start of audit |
| `/code-review` | Review code quality | After significant changes |
| `/tdd` | Test-driven development | New features, bug fixes |
| `/verify` | Pre-commit checks | Before every commit |
| `/e2e` | E2E test generation | After UI changes |
| `/plan` | Implementation planning | Before complex features |
| `/devfleet` | Parallel agent execution | Large-scale audits |
| `/security-review` | Security deep-dive | After API changes |
| `/learn` | Extract patterns | After successful sessions |

---

## Next Steps

1. **Today**: Install ECC skills (Tier 1)
2. **Tomorrow**: Run `/harness-audit` for baseline
3. **This Week**: Execute Week 1 security audit
4. **Next Week**: Code quality & testing
5. **Week 3**: Architecture & performance
6. **Ongoing**: Continuous verification loop

---

*This plan integrates 50K+ stars of community-tested engineering practices with SwjshAlgoKnife's trading infrastructure.*
