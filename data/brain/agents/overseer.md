# The Overseer — Agent Memory

> The Overseer is the risk guardian. Survival > Profitability.
> This file tracks the Overseer's decisions, escalation patterns, and risk model calibration.
> Runs on Sonnet (intentionally — risk decisions need higher reasoning).

---

## Current Risk Parameters

```yaml
# These are the Overseer's enforcement thresholds.
# Evolution Engine can tighten these, NEVER loosen without Jack.
account_balance: 10000
max_daily_loss_pct: 10              # $1,000 on $10k
max_daily_loss_warn_pct: 5          # $500 = warning
max_per_trade_risk_pct: 1           # $100
max_concurrent_trades: 3
max_correlated_exposure: 2
kill_switch_consecutive_losses: 3   # Per agent
kill_switch_strategy_losses: 3      # Per strategy in 48h
auto_resume_allowed: false          # Kill switch requires manual override
```

---

## Escalation History

> Every kill switch, warning, and escalation the Overseer has issued.
> Used to detect patterns: is the kill switch firing too often? On the same agent?

<!-- Format:
### [DATE] ESCALATION: [type]
- Trigger: [what caused it]
- Agent(s): [affected]
- Action: [what was done]
- Resolution: [how it was resolved]
- Time to resolve: [how long the system was halted]
-->

---

## Risk Model Calibration

> Track whether the risk thresholds are set correctly.
> If kill switch fires 3+ times in a week on the same trigger → thresholds may be too loose upstream.
> If kill switch never fires after 100+ trades → thresholds may be too tight or agents too conservative.

- Kill switch fires (lifetime): 0
- Warnings issued (lifetime): 0
- False positives (fired but shouldn't have): 0
- Missed catches (should have fired but didn't): 0
- Average time halted per kill switch: _no data_

---

## Behavioral Patterns

<!-- Evolution Engine writes patterns about risk events here -->

---

## Mutation History

<!-- Risk parameter changes are logged here -->
