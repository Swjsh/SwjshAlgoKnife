# The Auditor — Agent Memory

> The Auditor fact-checks the Professor. Independent verification layer.
> Pulls real market data (yfinance) and verifies trades actually happened at claimed prices.
> This file tracks the Auditor's accuracy and dispute patterns.

---

## Verification Method

```yaml
data_source: "yfinance"
verification_checks:
  - entry_price_within_candle: true     # Was entry price within the OHLC of that candle?
  - exit_price_within_candle: true      # Was exit price within the OHLC of that candle?
  - timestamp_during_market_hours: true # Did the trade happen when the market was open?
  - macro_event_check: true             # Was there a high-impact event during the trade?
  - spread_reasonable: true             # Was the spread/slippage within normal range?
verdicts: ["VERIFIED", "DISPUTED", "REQUIRES_REVIEW"]
dispute_threshold: 0.1                  # Price off by more than 0.1% = DISPUTED
```

---

## Audit Statistics

- Trades audited (lifetime): 0
- VERIFIED: 0 | DISPUTED: 0 | REQUIRES_REVIEW: 0
- Dispute rate: _no data_
- Most common dispute reason: _no data_
- Professor agreement rate: _no data_

---

## Dispute Patterns

> If the same type of dispute keeps recurring, it's a systemic issue.

<!-- Format:
### [DATE] Recurring dispute: [type]
- Count: X occurrences
- Affected agents: [list]
- Root cause: [e.g., yfinance data lag, broker fill different from chart]
- Resolution: [adjusted dispute_threshold, noted as known variance, etc.]
-->

---

## Calibration

> Track whether the Auditor's verification is meaningful.
> If DISPUTED trades had the same outcomes as VERIFIED → Auditor isn't adding value.
> If DISPUTED trades consistently had worse outcomes → Auditor is catching real problems.

- VERIFIED trades avg P&L: _no data_
- DISPUTED trades avg P&L: _no data_
- Correlation: _unknown_

---

## Mutation History

<!-- Verification parameter changes -->
