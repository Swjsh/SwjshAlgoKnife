# Roadmap — Where SwjshAK is Headed

> Chief reads this to understand the long-term vision.
> Jack updates this when strategic direction changes.
> Chief can suggest roadmap items based on performance data.

---

## Phase 1: Paper Trading Validation (CURRENT)

**Goal:** Prove the system works end-to-end on paper money. Build a track record.

- [x] Build trading dashboard (Next.js)
- [x] Implement 5 trading agents (Sterling, Bob, Pete, Boba, Sniper)
- [x] Implement oversight agents (Professor, Auditor, Overseer)
- [x] Build agent runner with auto-restart
- [x] Build watchdog monitoring (18 checks, 4 tiers)
- [x] Build LLM Control API
- [x] Set up OpenClaw with Chief + Discord integration
- [x] Create the Brain (13 files, 3 learning loops)
- [x] Deploy to GCP
- [ ] Validate full autonomous loop (48h stable operation)
- [ ] Accumulate 50+ paper trades across all agents
- [ ] First Evolution Engine run (Sunday weekly review)
- [ ] Professor-to-agent feedback loop confirmed working
- [ ] Self-healing tested (simulate an agent crash)

**Exit criteria:** 50+ trades, >40% WR, max drawdown <5% single day, all systems stable for 1 week.

---

## Phase 2: Paper Trading Optimization

**Goal:** Let the brain learn and evolve. Tune strategies based on real data.

- [ ] Evolution Engine has applied 3+ defensive mutations
- [ ] Agent parameters have drifted from defaults based on evidence
- [ ] Professor rubric self-calibrated at least once
- [ ] Learning log has 5+ CONFIRMED patterns
- [ ] Self-healing playbook has handled 3+ incidents without Jack
- [ ] Win rate >50% over 100+ trades
- [ ] Best-performing agent identified and strategy documented
- [ ] Worst-performing agent identified — paused or evolved

**Exit criteria:** 100+ trades, stable >50% WR, brain has meaningful learnings, system self-sustaining for 2+ weeks.

---

## Phase 3: Micro-Live Trading

**Goal:** Transition best-performing agent to live with minimal capital.

- [ ] Select highest-WR agent from paper phase
- [ ] Fund live account with $500-1000 (small enough to lose)
- [ ] Run ONE agent live, rest stay paper
- [ ] Compare live fills vs paper fills (slippage analysis)
- [ ] Live Auditor verification against real market data
- [ ] 20+ live trades before expanding
- [ ] Kill switch thresholds tightened for live ($50 daily max)

**Exit criteria:** 20+ live trades, performance within 10% of paper results, execution quality acceptable.

---

## Phase 4: Scale Live Trading

**Goal:** Gradually move more agents to live. Increase capital as confidence grows.

- [ ] Second agent goes live
- [ ] Account scaled to $5,000
- [ ] All 5 trading agents live
- [ ] Account scaled to $10,000+
- [ ] Cross-agent correlation management proven in live
- [ ] Monthly P&L positive for 3 consecutive months

---

## Phase 5: Advanced Capabilities

**Goal:** Add intelligence layers and new market capabilities.

- [ ] Order flow integration (real-time CVD, absorption)
- [ ] Sentiment analysis (news, social, on-chain)
- [ ] New asset classes (commodities, more crypto pairs)
- [ ] Custom TradingView indicators feeding signals
- [ ] Multi-timeframe confirmation across agents
- [ ] Portfolio-level hedging (agent coordination)

---

## Long-Term Vision

A fully autonomous trading operation that:
1. Manages its own risk without human intervention
2. Evolves its strategies based on market data
3. Heals itself when things break
4. Grows its knowledge base over time
5. Scales capital allocation based on proven performance
6. Reports to Jack via Discord — Jack oversees but doesn't micromanage
