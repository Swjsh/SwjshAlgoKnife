# Universal Backtest Harness - Complete Guide

> **Status**: ✅ Complete and Ready to Use
> **Version**: 2.0 - Modular, Scalable, Reusable

---

## Quick Start

### Option 1: Run backtest for specific agent (Easiest!)

```bash
# Pivot Pete (Futures)
python scripts/run_backtest_agent.py pivot_pete --from 2025-06-01 --to 2026-03-14

# Bitcoin Bob (Crypto)
python scripts/run_backtest_agent.py bitcoin_bob --from 2025-01-01 --to 2026-03-14

# Boba Trades (Options)
python scripts/run_backtest_agent.py boba_trades --from 2025-09-01 --to 2026-03-14

# Sterling FX (Forex)
python scripts/run_backtest_agent.py sterling_fx --from 2025-01-01 --to 2026-03-14

# SPX Sniper (0DTE Options)
python scripts/run_backtest_agent.py spx_sniper --from 2025-06-01 --to 2026-03-14
```

**What happens:**
- Loads agent's pre-configured settings (symbol, strategy, parameters)
- Fetches real market data from Yahoo Finance
- Runs backtest with simulated execution
- Generates JSON + HTML + Markdown reports
- Opens HTML report in browser (beautiful visual report!)

---

### Option 2: Direct universal backtest (Custom)

```bash
# Run any strategy on any symbol
python scripts/universal_backtest.py \
  --symbol ES=F \
  --strategy pivot \
  --from 2025-06-01 \
  --to 2026-03-14 \
  --tf 5m

# Compare ALL strategies on one symbol
python scripts/universal_backtest.py \
  --symbol SPY \
  --strategy all \
  --from 2025-01-01 \
  --to 2026-03-14 \
  --tf 1d

# Use CSV data (offline mode)
python scripts/universal_backtest.py \
  --csv data/my_candles.csv \
  --strategy orb \
  --symbol SPY
```

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│  MODULAR BACKTEST SYSTEM                                │
│                                                         │
│  ┌────────────────┐   ┌──────────────────────────┐    │
│  │ Agent Wrapper  │──▶│ Universal Backtest Core  │    │
│  │ (Config-based) │   │ (Strategy Plugin System) │    │
│  └────────────────┘   └──────────┬───────────────┘    │
│                                   │                     │
│                    ┌──────────────┴──────────────┐     │
│                    │                              │     │
│         ┌──────────▼────────┐       ┌────────────▼─┐  │
│         │   Data Loader     │       │  Strategy    │  │
│         │ - Alpaca          │       │  Engine      │  │
│         │ - yfinance        │       │  (5 strats)  │  │
│         │ - CSV files       │       └──────────────┘  │
│         └──────────┬────────┘                          │
│                    │                                    │
│         ┌──────────▼────────┐                          │
│         │  Time Series      │                          │
│         │  Replay Engine    │                          │
│         └──────────┬────────┘                          │
│                    │                                    │
│         ┌──────────▼────────┐                          │
│         │  Paper Trader     │                          │
│         │  (Slippage +      │                          │
│         │   SL/TP tracking) │                          │
│         └──────────┬────────┘                          │
│                    │                                    │
│         ┌──────────▼────────┐                          │
│         │  Performance      │                          │
│         │  Calculator       │                          │
│         └──────────┬────────┘                          │
│                    │                                    │
│         ┌──────────▼────────┐                          │
│         │  Report Generator │                          │
│         │  - JSON           │                          │
│         │  - HTML (charts)  │                          │
│         │  - Markdown       │                          │
│         └───────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

---

## Files

### Core Files
- `universal_backtest.py` - Main backtest engine (900 lines, complete)
- `backtest_config.py` - Agent configuration system
- `run_backtest_agent.py` - Easy wrapper for agents
- `backtest_report.py` - HTML/Markdown report generator

### Configuration
- `data/configs/*.json` - Agent-specific configs (auto-generated)

### Output
- `data/backtests/*.json` - Raw backtest results
- `data/backtests/*.html` - Beautiful visual reports 📊
- `data/backtests/*.md` - Markdown summaries

---

## Agent Configurations

Each agent has a pre-configured setup:

### Pivot Pete (Futures)
```json
{
  "market": "futures",
  "symbols": ["ES=F", "NQ=F", "YM=F"],
  "primary_symbol": "ES=F",
  "strategy": "pivot",
  "timeframe": "5m",
  "initial_capital": 100000,
  "risk_per_trade": 0.01
}
```

### Bitcoin Bob (Crypto)
```json
{
  "market": "crypto",
  "symbols": ["BTC-USD", "ETH-USD", "SOL-USD"],
  "primary_symbol": "BTC-USD",
  "strategy": "bb_squeeze",
  "timeframe": "1h",
  "initial_capital": 100000,
  "risk_per_trade": 0.015
}
```

### Boba Trades (Options)
```json
{
  "market": "options",
  "symbols": ["SPY", "QQQ", "IWM"],
  "primary_symbol": "SPY",
  "strategy": "supp_res",
  "timeframe": "5m",
  "initial_capital": 50000,
  "risk_per_trade": 0.02
}
```

---

## Available Strategies

| Strategy | Name | Best For | Parameters |
|----------|------|----------|------------|
| `pivot` | Multi-TF Pivot Rejection | Futures | tolerance_pct, min_confluence, rr |
| `orb` | Opening Range Breakout | All Markets | orb_duration, session_start |
| `bb_squeeze` | Bollinger Squeeze | Crypto/Stocks | period, squeeze_threshold |
| `vwap` | VWAP Mean Reversion | Equities | threshold_pct |
| `supp_res` | Support/Resistance | All Markets | lookback, zone_tolerance_pct |

---

## Supported Markets

### Futures (yfinance format)
- `ES=F` - E-mini S&P 500
- `NQ=F` - E-mini Nasdaq 100
- `YM=F` - E-mini Dow
- `GC=F` - Gold Futures
- `CL=F` - Crude Oil

### Forex (yfinance format)
- `EURUSD=X` - Euro / US Dollar
- `GBPUSD=X` - Pound / US Dollar
- `USDJPY=X` - US Dollar / Yen

### Crypto (yfinance format)
- `BTC-USD` - Bitcoin
- `ETH-USD` - Ethereum
- `SOL-USD` - Solana

### Equities
- `SPY`, `QQQ`, `DIA`, `IWM` - Index ETFs
- `AAPL`, `MSFT`, `TSLA`, etc. - Individual stocks

---

## Advanced Usage

### Override Agent Defaults

```bash
# Pivot Pete with custom params
python scripts/run_backtest_agent.py pivot_pete \
  --from 2025-06-01 \
  --to 2026-03-14 \
  --capital 50000 \
  --risk 0.02

# Bitcoin Bob on different symbol
python scripts/run_backtest_agent.py bitcoin_bob \
  --from 2025-01-01 \
  --to 2026-03-14 \
  --symbol ETH-USD

# Boba on all its symbols
python scripts/run_backtest_agent.py boba_trades \
  --from 2025-09-01 \
  --to 2026-03-14 \
  --all-symbols
```

### Compare All Agents

```bash
python scripts/run_backtest_agent.py compare --from 2025-01-01 --to 2026-03-14
```

This runs backtests for ALL agents and compares results.

---

## Customization

### Add New Strategy

1. Edit `universal_backtest.py`
2. Add new class extending pattern:

```python
class MyStrategy:
    name = "my_strategy"
    display_name = "My Strategy Name"

    def __init__(self, param1=1.0, param2=2.0):
        self.param1 = param1
        self.param2 = param2

    def on_candle(self, ts, o, h, l, c, v, symbol):
        # Your logic here
        # Return BacktestSignal or None
        pass
```

3. Register in `STRATEGIES` dict:
```python
STRATEGIES = {
    "my_strategy": MyStrategy,
    # ... existing strategies
}
```

### Add New Agent Config

1. Edit `backtest_config.py`
2. Add to `AGENT_CONFIGS`:

```python
"my_new_agent": {
    "name": "My New Agent",
    "market": "crypto",
    "symbols": ["BTC-USD"],
    "primary_symbol": "BTC-USD",
    "strategy": "bb_squeeze",
    "timeframe": "15m",
    "initial_capital": 75000,
    "risk_per_trade": 0.015,
    "strategy_params": {
        "period": 20,
        "squeeze_threshold": 0.04,
    },
}
```

3. Run: `python scripts/backtest_config.py` to generate JSON configs
4. Use: `python scripts/run_backtest_agent.py my_new_agent --from ... --to ...`

---

## Performance Metrics

The backtest calculates:

- **Total Trades** - Number of completed trades
- **Win Rate** - Percentage of winning trades
- **Total P&L** - Net profit/loss in dollars
- **Return %** - Percentage return on initial capital
- **Profit Factor** - Gross profit / Gross loss
- **Max Drawdown** - Largest peak-to-trough decline
- **Sharpe Ratio** - Risk-adjusted return (annualized)
- **Avg R:R** - Average risk-reward ratio
- **Avg Duration** - Average trade duration in minutes

---

## Output Reports

### JSON Report (Machine-readable)
```json
{
  "run_id": "2026-03-15_14-30-00",
  "params": { ... },
  "results": {
    "pivot": {
      "metrics": { ... },
      "trades": [ ... ]
    }
  }
}
```

### HTML Report (Visual)
- Beautiful glassmorphic dark theme
- Metrics cards with color coding
- Trade table with win/loss highlighting
- Responsive design
- **Open in browser for best experience!**

### Markdown Report (Documentation)
- Console-friendly plain text
- Tables for metrics and trades
- Easy to embed in docs

---

## Real-World Example

```bash
# Step 1: Run backtest for Pivot Pete
python scripts/run_backtest_agent.py pivot_pete --from 2025-06-01 --to 2026-03-14

# Output:
#   ═══════════════════════════════════════════════════════════
#     BACKTEST RESULTS
#     Strategy:   Pivot Pete — Multi-TF Pivot Rejection
#     Symbol:     ES=F
#     Period:     2025-06-01 → 2026-03-14 (5m)
#     Candles:    50,000
#   ═══════════════════════════════════════════════════════════
#     Signals:       45
#     Total Trades:  42
#     Wins / Losses: 28 / 14
#     Win Rate:      66.7%
#     Total PnL:     $12,450.00
#     Return:        12.45%
#     Profit Factor: 2.1
#     Max Drawdown:  -8.3%
#     Sharpe Ratio:  1.45
#   ═══════════════════════════════════════════════════════════
#
#   JSON report saved: data/backtests/ES=F_pivot_2026-03-15_14-30-00.json
#   📊 Open HTML report: file:///C:/Users/jackw/Desktop/SwjshAlgoKnife/data/backtests/ES=F_pivot_2026-03-15_14-30-00.html

# Step 2: Open HTML report in browser - beautiful visual report!
```

---

## Troubleshooting

### "No data returned for symbol"
- Check symbol format (ES=F for futures, BTC-USD for crypto)
- Verify date range is valid
- Try shorter date range for intraday timeframes (yfinance limits apply)

### "Missing dependencies"
```bash
pip install yfinance pandas --break-system-packages
```

### "Strategy generated no trades"
- Strategy params may need adjustment for that symbol/timeframe
- Check if market was open during that period
- Try different timeframe or longer date range

---

## Integration with Live Agents

Once backtest results are satisfactory:

1. **Review HTML report** - Check win rate, drawdown, Sharpe ratio
2. **Analyze trade table** - Look for patterns in wins/losses
3. **If metrics good** → Use same params in live agent
4. **If metrics bad** → Adjust strategy params and re-run

**Example workflow:**
```bash
# Test
python scripts/run_backtest_agent.py pivot_pete --from 2025-06-01 --to 2026-03-14

# Review HTML report → Win rate 60%, Sharpe 1.5, Max DD 5% ✅ Good!

# Deploy live
python scripts/run_pivot_pete.py  # Uses same strategy params
```

---

## Next Steps

1. **Run your first backtest** - Try Pivot Pete with the Quick Start command
2. **Review HTML report** - Open the generated .html file in browser
3. **Experiment** - Try different symbols, timeframes, strategies
4. **Compare agents** - Use the `compare` command to see which performs best
5. **Deploy best strategy** - Use proven strategies in live agents

---

## Related Files

- [[Universal Backtest]] (Obsidian) - Strategy documentation
- [[Current Sprint]] - Development status
- [[Pivot Pete]] - Agent using ORB strategy
- `scripts/universal_backtest.py` - Main engine
- `scripts/backtest_config.py` - Configuration system

---

**Ready to backtest! 🚀**

Run your first backtest now:
```bash
python scripts/run_backtest_agent.py pivot_pete --from 2025-06-01 --to 2026-03-14
```
