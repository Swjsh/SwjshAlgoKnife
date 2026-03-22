# Self-Improvement Architecture

> **Status**: 10 workflows deployed, 337 nodes total
> **Purpose**: System evolves autonomously without human intervention
> **Last Updated**: 2026-03-20

---

## Philosophy

The SwjshAK system is designed to **improve itself**. This isn't just reporting - it's active enhancement:

1. **Agents fix themselves** (health monitoring + auto-recovery)
2. **Codebase improves itself** (tech debt scanning + dependency auditing)
3. **Strategies evolve** (lesson compilation + parameter tuning)
4. **Backlog stays clean** (AI grooming + velocity tracking)
5. **Knowledge compounds** (research pipelines + retrospectives)

## The Four Pillars

### 1. Infrastructure Self-Healing (INFRA)

```
┌─────────────────────────────────────────┐
│         INFRA SELF-HEALING              │
├─────────────────────────────────────────┤
│                                         │
│  Tech Debt Scanner (Daily 6 AM)         │
│  ├── Scans GitHub for TODO/FIXME/HACK   │
│  ├── Detects functions >100 lines       │
│  ├── Finds duplicate code patterns      │
│  ├── Claude AI prioritizes issues       │
│  └── Creates INFRA Jira tickets         │
│                                         │
│  Dependency Auditor (Weekly Sunday)     │
│  ├── Checks npm + pip packages          │
│  ├── Queries OSV vulnerability DB       │
│  ├── Calculates security score 0-100    │
│  ├── Claude AI risk assessment          │
│  └── Creates bug tickets for vulns      │
│                                         │
└─────────────────────────────────────────┘
```

**Workflows**:
- [[WF-INFRA-01 Tech Debt Scanner]] (33 nodes)
- [[WF-INFRA-02 Dependency Auditor]] (41 nodes)

### 2. Operational Resilience (OPS)

```
┌─────────────────────────────────────────┐
│        OPS AUTO-RECOVERY                │
├─────────────────────────────────────────┤
│                                         │
│  Health Aggregator (Every 5 min)        │
│  ├── Parallel checks: API, DB, Agents   │
│  ├── Weighted composite score           │
│  │   ├── SwjshAK API: 25%               │
│  │   ├── Database: 20%                  │
│  │   ├── Agents: 20%                    │
│  │   ├── OpenClaw: 15%                  │
│  │   ├── Alpaca: 10%                    │
│  │   └── n8n: 10%                       │
│  ├── Auto-recovery for crashed agents   │
│  └── Discord alerts by severity         │
│                                         │
│  Anomaly Detector (Every 15 min)        │
│  ├── Z-score statistical analysis       │
│  ├── Metrics: trade freq, P&L, latency  │
│  ├── Severity: |z|>=3 Critical          │
│  ├── Claude AI root cause analysis      │
│  └── Routes to PULSE P1/P2 tickets      │
│                                         │
└─────────────────────────────────────────┘
```

**Workflows**:
- [[WF-OPS-01 Health Aggregator]] (33 nodes)
- [[WF-OPS-02 Anomaly Detector]] (33 nodes)

### 3. Learning & Adaptation (LEARN)

```
┌─────────────────────────────────────────┐
│        LEARN FEEDBACK LOOPS             │
├─────────────────────────────────────────┤
│                                         │
│  Lesson Compiler (Friday 5 PM)          │
│  ├── Aggregates week's trade grades     │
│  ├── Groups by strategy, pattern, time  │
│  ├── Detects recurring mistakes         │
│  ├── Claude AI synthesizes insights     │
│  ├── Updates data/brain/lessons.md      │
│  └── Creates LEARN summary ticket       │
│                                         │
│  Strategy Tuner (Sunday 6 PM)           │
│  ├── Fetches 30-day trade history       │
│  ├── Calculates per-strategy metrics:   │
│  │   ├── Win rate, profit factor        │
│  │   ├── Sharpe ratio, max drawdown     │
│  │   └── Expectancy, avg hold time      │
│  ├── Claude AI proposes param changes   │
│  ├── Creates INFRA tickets (CEO approve)│
│  └── Posts to #approvals Discord        │
│                                         │
└─────────────────────────────────────────┘
```

**Workflows**:
- [[WF-LEARN-01 Lesson Compiler]] (34 nodes)
- [[WF-LEARN-02 Strategy Tuner]] (35 nodes)

### 4. Knowledge Management (BACK/CORTANA/MGMT)

```
┌─────────────────────────────────────────┐
│      KNOWLEDGE MANAGEMENT               │
├─────────────────────────────────────────┤
│                                         │
│  Backlog Groomer (Daily 7 AM)           │
│  ├── Fetches all 6 Jira projects        │
│  ├── Calculates staleness, age          │
│  ├── Claude AI re-prioritizes           │
│  ├── Auto-comments on stale tickets     │
│  └── Suggests closures for obsolete     │
│                                         │
│  Research Pipeline (Wed 10 AM)          │
│  ├── Sources: Reddit, arXiv, HN, GitHub │
│  ├── Normalizes + deduplicates          │
│  ├── Claude AI relevance scoring        │
│  ├── Creates BACK implementation tickets│
│  └── Creates LEARN research tickets     │
│                                         │
│  Weekly Retrospective (Fri 6 PM)        │
│  ├── Aggregates sprint velocity         │
│  ├── Compiles wins + blockers           │
│  ├── Claude AI insights                 │
│  └── Posts to #ceo-briefing             │
│                                         │
│  Velocity Tracker (Weekly)              │
│  ├── Tracks burndown progress           │
│  ├── Calculates team velocity           │
│  └── Forecasts completion dates         │
│                                         │
└─────────────────────────────────────────┘
```

**Workflows**:
- [[WF-BACK-01 Backlog Groomer]] (32 nodes)
- [[WF-CORTANA-01 Research Pipeline]] (36 nodes)
- [[WF-MGMT-01 Weekly Retrospective]] (30 nodes)
- [[WF-MGMT-02 Velocity Tracker]] (33 nodes)

## Data Flow

```
                    ┌──────────────┐
                    │   Sources    │
                    │ GitHub/Jira/ │
                    │ Reddit/APIs  │
                    └──────┬───────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│                  n8n Workflows                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Collect  │─▶│ Analyze  │─▶│  Act     │           │
│  │   Data   │  │ (Claude) │  │ (Create/ │           │
│  └──────────┘  └──────────┘  │  Update) │           │
│                              └──────────┘           │
└───────────────────────┬──────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │   Jira   │  │ Discord  │  │  Brain   │
    │ Tickets  │  │  Alerts  │  │  Files   │
    └──────────┘  └──────────┘  └──────────┘
```

## Feedback Loops

### Loop 1: Immediate (Minutes)
- Health check fails → Auto-restart agent → Log incident
- Anomaly detected → Alert Discord → Create P1 ticket

### Loop 2: Daily
- Tech debt scanned → Tickets created → Developers fix → Codebase improves
- Backlog groomed → Priorities updated → Team focuses on right work

### Loop 3: Weekly
- Lessons compiled → Brain updated → Agents read lessons → Better decisions
- Strategies tuned → Parameters adjusted → Performance improves

### Loop 4: Monthly (Emergent)
- Patterns accumulate → Research identifies → Implementation tickets → New capabilities

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Auto-recovery rate | >90% | Incidents auto-fixed / total incidents |
| Tech debt reduction | -10%/month | TODO count trend |
| Strategy improvement | +5% win rate | Pre/post parameter changes |
| Backlog freshness | <7 day avg age | Average ticket staleness |

## Related Pages

- [[n8n Automation]]
- [[OpenClaw HQ Setup]]
- [[Agent System]]
- [[Roadmap]]
