# Performance Memory — Cumulative Stats & Thresholds

> This file accumulates hard numbers. Chief updates it at EOD.
> The Evolution Engine reads it weekly to detect trends and trigger strategy mutations.
>
> Unlike daily-log.md (which is a narrative), this is pure data.
> Chief writes the numbers. The numbers drive the evolution.

---

## Lifetime Stats (Chief updates weekly)

**Last updated:** _not yet initialized_
**Total trades:** 0
**Total P&L:** $0.00
**Overall win rate:** 0%
**Best day:** _none_
**Worst day:** _none_
**Max drawdown (single day):** $0.00
**Longest win streak:** 0
**Longest loss streak:** 0
**Days active:** 0

---

## Per-Agent Cumulative Performance

### Sterling (FX)
- Trades: 0 | Wins: 0 | Losses: 0 | Win Rate: 0%
- Total P&L: $0.00
- Avg win: $0.00 | Avg loss: $0.00
- Best trade: _none_
- Worst trade: _none_
- London-only WR: _no data_ | Overlap WR: _no data_
- **Adjustment triggers hit:** _none_

### Bitcoin Bob (Crypto)
- Trades: 0 | Wins: 0 | Losses: 0 | Win Rate: 0%
- Total P&L: $0.00
- Avg win: $0.00 | Avg loss: $0.00
- BTC WR: _no data_ | ETH WR: _no data_
- **Adjustment triggers hit:** _none_

### Pivot Pete (Futures)
- Trades: 0 | Wins: 0 | Losses: 0 | Win Rate: 0%
- Total P&L: $0.00
- Pivot bounce WR: _no data_ | VWAP confluence WR: _no data_
- **Adjustment triggers hit:** _none_

### Boba (Options)
- Trades: 0 | Wins: 0 | Losses: 0 | Win Rate: 0%
- Total P&L: $0.00
- Avg hold time: _no data_
- Early stop-outs (< 5 min): _no data_
- **Adjustment triggers hit:** _none_

### SPX Sniper (0DTE)
- Trades: 0 | Wins: 0 | Losses: 0 | Win Rate: 0%
- Total P&L: $0.00
- Avg hold time: _no data_
- Pre-2PM WR: _no data_ | Post-2PM WR: _no data_
- **Adjustment triggers hit:** _none_

---

## Per-Strategy Cumulative Performance

<!-- Chief fills this in as strategies generate trades -->

| Strategy | Trades | Win Rate | Total P&L | Avg Win | Avg Loss | Status |
|----------|--------|----------|-----------|---------|----------|--------|
| _none yet_ | | | | | | |

---

## Evolution Triggers (auto-checked by Chief weekly)

These are the thresholds that, when hit, cause the Evolution Engine to
propose a change to strategies.md. Chief reviews and applies.

| Trigger | Threshold | Current | Last Checked | Action |
|---------|-----------|---------|--------------|--------|
| Agent WR below floor | < 35% over 20+ trades | _no data_ | _never_ | Pause agent, review strategy |
| Agent WR excelling | > 65% over 20+ trades | _no data_ | _never_ | Consider increasing position size |
| Strategy never fires | 0 trades in 2 weeks | _no data_ | _never_ | Review signal conditions |
| Strategy loss streak | 3+ consecutive losses | _no data_ | _never_ | Pause strategy, analyze |
| Time-of-day clustering | >60% losses in same 2h window | _no data_ | _never_ | Add time filter |
| News-day underperformance | WR < 30% on high-impact days | _no data_ | _never_ | Add news blackout |
| Friction eating profits | Friction > 10% of gross PnL | _no data_ | _never_ | Review execution |
| Drawdown approaching | > 50% of daily limit hit | _no data_ | _never_ | Reduce position sizes |
| Correlation blow-up | Loss in 2+ correlated trades same day | _no data_ | _never_ | Tighten correlation limits |

---

## Strategy Mutations Log

> When the Evolution Engine changes strategies.md, it logs the mutation here.
> This creates an audit trail of how the playbook evolves over time.

<!-- Format:
### [DATE] Mutation: [what changed]
- Trigger: [which threshold was hit]
- Evidence: [data that caused it]
- Change: [exact modification to strategies.md]
- Rollback plan: [how to undo if it makes things worse]
-->
