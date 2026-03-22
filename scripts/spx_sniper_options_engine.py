"""
SPX Sniper — Real 0DTE Options Scalper (Paper)
================================================
• Uses ^SPX underlying price action to generate CALL/PUT signals
• Selects REAL 0DTE options contracts via yfinance chains
• Enforces "Gold Rules":
    1. Time Gate: No trades before 10:30 AM or after 2:30 PM EST
    2. Trend Following: Trade with 9 EMA + VWAP alignment
    3. Pulse Check: Momentum confirmation via RSI
    4. 0DTE Only: Same-day expiration contracts
• Premium-based risk: SL at -40% premium, TP at +60% premium
• Tighter stops after 2:00 PM (theta acceleration)
• Max 2 trades per day (loss discipline)
• Broadcasts AGENT_STATUS_UPDATE for the dashboard

Changes from spx_sniper_engine.py:
  ❌ No more SPY equity proxy
  ✅ Real SPY 0DTE options via options_utils.py
  ✅ Contract-level tracking with OCC symbols and Greeks
  ✅ Premium-based SL/TP with time-of-day theta awareness
  ✅ Daily trade count limit (max 2 losers = done for the day)
"""

import os
import yfinance as yf
import pandas as pd
import numpy as np
import json
import time
import requests
from pathlib import Path
from datetime import datetime, time as dtime, date
import pytz
from agent_utils import log_message, get_random_quip, call_preflight, should_take_trade, send_feedback
from options_utils import OptionsChain, OptionContract, calculate_options_risk
from data_feeds import build_feed_for_agent, get_latest_price

# ── Config ────────────────────────────────────────────────────────────────────
SPX_TICKER          = '^SPX'
OPTIONS_UNDERLYING  = 'SPY'          # SPY options as SPX proxy (much more liquid 0DTEs)
TIMEFRAME           = '5m'
PERIOD              = '5d'
SCAN_INTERVAL_SEC   = 300            # 5 minute scan
MAX_OPEN_TRADES     = 1              # 0DTE = one at a time
MAX_DAILY_TRADES    = 3              # Max trades per day (including losers)
MAX_DAILY_LOSSES    = 2              # Stop trading after 2 losses in a day
RISK_REWARD         = 1.5            # Target R:R on premium
ACCOUNT_BALANCE     = 25_000
RISK_PER_TRADE      = 0.015          # 1.5% per trade (tighter for 0DTE)
MAX_PREMIUM_LOSS    = 0.40           # 40% premium SL (faster for 0DTE)
TARGET_PREMIUM_GAIN = 0.60           # 60% premium TP
LATE_SESSION_CUTOFF = dtime(14, 0)   # After 2 PM: tighter stops
LATE_PREMIUM_LOSS   = 0.25           # 25% premium SL after 2 PM (theta acceleration)
MIN_CONTRACT_VOLUME = 100            # 0DTE needs high volume
MIN_OPEN_INTEREST   = 200
MAX_SPREAD_PCT      = 10.0           # Tight spreads for scalps
STATUS_FILE         = Path(__file__).parent.parent / 'data' / 'spx_agent_status.json'
WEBHOOK_URL         = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET      = os.getenv("WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError("WEBHOOK_SECRET environment variable is required")

EST = pytz.timezone('US/Eastern')


# ── Indicators ────────────────────────────────────────────────────────────────
def calculate_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # EMA 9
    df['EMA9'] = df['Close'].ewm(span=9, adjust=False).mean()

    # VWAP with proper daily reset
    df['TP'] = (df['High'] + df['Low'] + df['Close']) / 3
    df['TPxVol'] = df['TP'] * df['Volume']
    df['TradeDate'] = df.index.date if hasattr(df.index, 'date') else pd.to_datetime(df.index).date
    df['CumTPxVol'] = df.groupby('TradeDate')['TPxVol'].cumsum()
    df['CumVol'] = df.groupby('TradeDate')['Volume'].cumsum()
    df['VWAP'] = df['CumTPxVol'] / df['CumVol'].replace(0, np.nan)
    df['VWAP'] = df['VWAP'].ffill()
    df.drop(columns=['TP', 'TPxVol', 'TradeDate', 'CumTPxVol', 'CumVol'], inplace=True)

    # RSI 14 (with NaN protection)
    delta = df['Close'].diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss.replace(0, np.nan)
    df['RSI'] = 100 - (100 / (1 + rs))
    df['RSI'] = df['RSI'].fillna(50.0)
    return df


# ── Time Gates ────────────────────────────────────────────────────────────────
def is_safe_time() -> bool:
    """No entries before 10:30 AM or after 2:30 PM for 0DTE."""
    now = datetime.now(EST).time()
    return dtime(10, 30) <= now <= dtime(14, 30)


def is_late_session() -> bool:
    """After 2 PM — tighten stops due to theta acceleration."""
    return datetime.now(EST).time() >= LATE_SESSION_CUTOFF


def is_market_hours() -> bool:
    now_et = datetime.now(EST)
    if now_et.weekday() >= 5:
        return False
    return dtime(9, 30) <= now_et.time() <= dtime(16, 0)


# ── Webhook ───────────────────────────────────────────────────────────────────
def fire_signal(action: str, contract: OptionContract, premium: float,
                qty: int = 1, stop_premium: float = None,
                target_premium: float = None, reason: str = "") -> bool:
    payload = {
        "symbol":       contract.occ_symbol,
        "underlying":   OPTIONS_UNDERLYING,
        "action":       action,
        "price":        premium,
        "strategy":     "SPXSniper_0DTE",
        "stopLoss":     stop_premium,
        "takeProfit":   target_premium,
        "qty":          qty,
        "notes":        reason,
        "meta": {
            "contract_type": contract.contract_type,
            "strike":        contract.strike,
            "expiration":    contract.expiration,
            "delta":         contract.delta,
            "theta":         contract.theta,
            "iv":            contract.implied_volatility,
            "dte":           contract.dte,
            "is_0dte":       contract.dte == 0,
        }
    }
    headers = {
        "Content-Type":     "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[SPX Sniper] Signal: {action} {contract.occ_symbol} @ ${premium:.2f} x{qty}")
            log_message('spx', f"{action} {contract.occ_symbol} @ ${premium:.2f} x{qty} | {reason}", type='trade')
            return True
        else:
            print(f"[SPX Sniper] Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[SPX Sniper] Webhook error: {e}")
        return False


# ── Status Broadcast ──────────────────────────────────────────────────────────
def broadcast_status(trend: str, price: float, active_trades: list,
                     pending_signals: list, scan_count: int, day_stats: dict):
    total_pnl = sum(t.get('unrealized_pnl', 0) for t in active_trades)

    state = {
        "id":              "spx_sniper",
        "name":            "SPX Sniper",
        "last_updated":    datetime.now().isoformat(),
        "status":          "ACTIVE" if is_safe_time() else "WAITING (Time Gate)",
        "market_price":    round(price, 2),
        "trend":           trend,
        "active_pairs":    1,
        "scan_count":      scan_count,
        "pending_orders":  pending_signals[:3],
        "active_trades":   active_trades,
        "performance": {
            "win_rate":     day_stats.get('win_rate', 0),
            "total_pnl":    day_stats.get('total_pnl', 0),
            "unrealized":   round(total_pnl, 2),
            "trades_today": day_stats.get('trades_today', 0),
            "losses_today": day_stats.get('losses_today', 0),
        }
    }
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_FILE, 'w') as f:
        json.dump(state, f, indent=2)

    contract_str = active_trades[0].get('occ_symbol', '') if active_trades else 'none'
    msg = f"SPX ${price:.2f} | {trend} | {contract_str} | Day PnL: ${day_stats.get('total_pnl', 0):+.2f}"
    print(
        f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'spx_sniper', 'status': state['status'], 'message': msg, 'timestamp': datetime.now().isoformat()})}",
        flush=True
    )


# ── Signal Generation ─────────────────────────────────────────────────────────
def generate_signals(df: pd.DataFrame) -> tuple:
    """Analyze 5m candles for CALL/PUT setups. Returns (signals, trend, price)."""
    signals = []
    last  = df.iloc[-1]
    prev  = df.iloc[-2]

    trend = "NEUTRAL"
    if last['Close'] > last['EMA9'] and last['Close'] > last['VWAP']:
        trend = "BULLISH"
    elif last['Close'] < last['EMA9'] and last['Close'] < last['VWAP']:
        trend = "BEARISH"

    current_price = float(last['Close'])
    rsi = float(last['RSI']) if not pd.isna(last['RSI']) else 50.0

    # CALL Setup: VWAP cross-up + bullish trend + RSI < 70
    if prev['Close'] < prev['VWAP'] and last['Close'] > last['VWAP']:
        if trend == "BULLISH" and rsi < 70:
            signals.append({
                'type':    'CALL',
                'reason':  f"VWAP cross-up | Trend: {trend} | RSI: {rsi:.1f}",
                'price':   current_price,
            })

    # PUT Setup: VWAP cross-down + bearish trend + RSI > 30
    elif prev['Close'] > prev['VWAP'] and last['Close'] < last['VWAP']:
        if trend == "BEARISH" and rsi > 30:
            signals.append({
                'type':    'PUT',
                'reason':  f"VWAP cross-down | Trend: {trend} | RSI: {rsi:.1f}",
                'price':   current_price,
            })

    return signals, trend, current_price


# ── Options Contract Selection ────────────────────────────────────────────────
def select_0dte_contract(signal_type: str) -> tuple:
    """
    Select a 0DTE options contract.
    Returns (OptionContract, risk_calc) or (None, None).
    """
    try:
        chain = OptionsChain(OPTIONS_UNDERLYING)

        # IV environment check — 0DTE is more forgiving on IV but still skip extremes
        iv_env = chain.check_iv_environment(max_iv_rank=85.0)
        if not iv_env['favorable']:
            print(f"[SPX Sniper] IV too high: {iv_env['reason']} — skipping")
            return None, None
        if iv_env.get('iv_rank') is not None:
            print(f"[SPX Sniper] IV Rank: {iv_env['iv_rank']:.0f}% ({iv_env.get('assessment', '?')})")

        # 0DTE: today's expiration
        expiry = chain.find_expiration('0dte')
        if not expiry:
            # No 0DTE available, try nearest
            expiry = chain.find_expiration('nearest')
            if not expiry:
                print(f"[SPX Sniper] No expirations available")
                return None, None

        exp_date = datetime.strptime(expiry, "%Y-%m-%d").date()
        dte = (exp_date - date.today()).days
        if dte > 1:
            print(f"[SPX Sniper] WARNING: Nearest expiry is {dte} DTE, not 0DTE ({expiry})")

        if signal_type == 'CALL':
            # ATM or slightly OTM call for 0DTE
            contract = chain.select_call(
                selection='atm',
                expiry_type='0dte',
                min_volume=MIN_CONTRACT_VOLUME,
                min_oi=MIN_OPEN_INTEREST,
                max_spread_pct=MAX_SPREAD_PCT,
            )
        else:
            contract = chain.select_put(
                selection='atm',
                expiry_type='0dte',
                min_volume=MIN_CONTRACT_VOLUME,
                min_oi=MIN_OPEN_INTEREST,
                max_spread_pct=MAX_SPREAD_PCT,
            )

        if contract is None:
            print(f"[SPX Sniper] No suitable 0DTE {signal_type} found")
            return None, None

        # Tighter risk for late session
        loss_pct = LATE_PREMIUM_LOSS if is_late_session() else MAX_PREMIUM_LOSS

        risk = calculate_options_risk(
            contract,
            account_balance=ACCOUNT_BALANCE,
            risk_pct=RISK_PER_TRADE,
            max_loss_pct=loss_pct,
            target_gain_pct=TARGET_PREMIUM_GAIN,
        )

        if risk.get("qty", 0) == 0:
            return None, None

        print(f"[SPX Sniper] Selected 0DTE: {contract.occ_symbol}")
        print(f"        Strike: ${contract.strike} | Mid: ${contract.mid:.2f} | Delta: {contract.delta:.2f}")
        print(f"        DTE: {contract.dte} | IV: {contract.implied_volatility:.1%} | Theta: {contract.theta:.4f}")
        print(f"        Qty: {risk['qty']} | Cost: ${risk['total_cost']:.2f}")
        print(f"        SL: ${risk['stop_premium']:.2f} (-{loss_pct*100:.0f}%) | TP: ${risk['target_premium']:.2f} (+{TARGET_PREMIUM_GAIN*100:.0f}%)")

        return contract, risk

    except Exception as e:
        print(f"[SPX Sniper] Contract selection error: {e}")
        import traceback
        traceback.print_exc()
        return None, None


# ── Shared chain instance for premium checks ──────────────────────────────────
_shared_chain: OptionsChain | None = None

def _get_chain() -> OptionsChain:
    global _shared_chain
    if _shared_chain is None:
        _shared_chain = OptionsChain(OPTIONS_UNDERLYING)
    return _shared_chain


# ── Live Premium Check ────────────────────────────────────────────────────────
def get_current_premium(contract_type: str, strike: float, expiration: str) -> float | None:
    """
    Get current mid price for an open 0DTE contract.
    Uses 30s chain cache (tighter for 0DTE where time matters more).
    """
    try:
        return _get_chain().get_premium(expiration, strike, contract_type, max_cache_age=30.0)
    except Exception as e:
        print(f"[SPX Sniper] Failed to get premium for {contract_type} {strike} {expiration}: {e}")
        return None


# ── Trade Exit Monitor ────────────────────────────────────────────────────────
def check_trade_exits(active_trades: list, current_price: float, day_stats: dict) -> list:
    remaining = []

    for trade in active_trades:
        current = get_current_premium(
            trade['contract_type'],
            trade['strike'],
            trade['expiration'],
        )

        if current is None:
            print(f"[SPX Sniper] WARNING: Can't fetch premium for {trade['occ_symbol']}")
            remaining.append(trade)
            continue

        trade['current_premium'] = current
        entry = trade['entry_premium']
        pnl_per_contract = (current - entry) * 100
        total_pnl = pnl_per_contract * trade['qty']
        trade['unrealized_pnl'] = round(total_pnl, 2)
        pnl_pct = ((current - entry) / entry * 100) if entry > 0 else 0

        print(f"   {trade['occ_symbol']}: ${current:.2f} (entry ${entry:.2f}) | PnL: ${total_pnl:+.2f} ({pnl_pct:+.1f}%)")

        # Late session: tighten stops
        effective_sl = trade['stop_premium']
        if is_late_session() and not trade.get('tightened'):
            # Tighten SL to 25% loss
            tighter_sl = round(entry * (1 - LATE_PREMIUM_LOSS), 2)
            if tighter_sl > effective_sl:
                effective_sl = tighter_sl
                trade['stop_premium'] = tighter_sl
                trade['tightened'] = True
                print(f"   Tightened SL to ${tighter_sl:.2f} (late session theta)")

        # Check forced close at 3:50 PM for 0DTE
        if datetime.now(EST).time() >= dtime(15, 50):
            _close_trade(trade, current, "EOD forced close (3:50 PM)", 'EOD', day_stats)
            continue

        # Trailing stop: if premium up 30%+, trail SL to breakeven + 10%
        if entry > 0:
            gain_pct = (current - entry) / entry
            if gain_pct >= 0.30 and not trade.get('trailing'):
                new_sl = round(entry * 1.10, 2)  # Lock in 10% gain
                if new_sl > effective_sl:
                    trade['stop_premium'] = new_sl
                    effective_sl = new_sl
                    trade['trailing'] = True
                    print(f"   TRAILING: SL raised to ${new_sl:.2f} (breakeven + 10%)")

        # Premium-based stops
        if current <= effective_sl:
            _close_trade(trade, current, f"Premium SL: ${current:.2f} <= ${effective_sl:.2f}", 'STOP', day_stats)
            continue

        if current >= trade['target_premium']:
            _close_trade(trade, current, f"Premium TP: ${current:.2f} >= ${trade['target_premium']:.2f}", 'TARGET', day_stats)
            continue

        remaining.append(trade)

    return remaining


def _close_trade(trade: dict, exit_premium: float, reason: str, exit_type: str, day_stats: dict):
    entry = trade['entry_premium']
    pnl_per_contract = (exit_premium - entry) * 100
    total_pnl = pnl_per_contract * trade['qty']

    print(f"[SPX Sniper] CLOSED {trade['occ_symbol']}: ${entry:.2f} → ${exit_premium:.2f} | PnL: ${total_pnl:+.2f} | {reason}")
    log_message('spx', f"CLOSED {trade['occ_symbol']} | PnL: ${total_pnl:+.2f} | {reason}", type='trade')

    # Update day stats
    day_stats['trades_today'] = day_stats.get('trades_today', 0) + 1
    day_stats['total_pnl'] = day_stats.get('total_pnl', 0) + total_pnl
    if total_pnl <= 0:
        day_stats['losses_today'] = day_stats.get('losses_today', 0) + 1

    wins = day_stats.get('wins', 0) + (1 if total_pnl > 0 else 0)
    day_stats['wins'] = wins
    total = day_stats['trades_today']
    day_stats['win_rate'] = round(wins / total * 100, 1) if total > 0 else 0

    # Fire exit webhook
    dummy_contract = OptionContract(
        symbol=OPTIONS_UNDERLYING,
        contract_type=trade['contract_type'],
        strike=trade['strike'],
        expiration=trade['expiration'],
        bid=exit_premium, ask=exit_premium, mid=exit_premium,
        last_price=exit_premium, volume=0, open_interest=0,
        implied_volatility=trade.get('iv', 0),
        occ_symbol=trade['occ_symbol'],
    )
    fire_signal('SELL', dummy_contract, exit_premium, trade['qty'], reason=reason)

    # Feedback to intel
    outcome = 'WIN' if total_pnl > 0 else 'LOSS'
    send_feedback(
        agent_id='spx',
        symbol=OPTIONS_UNDERLYING,
        direction=trade['signal_type'],
        outcome=outcome,
        pnl=total_pnl,
        strategy='SPXSniper_0DTE',
        notes=f"{trade['occ_symbol']} | 0DTE | {exit_type} | {reason}",
    )


# ── Main Loop ─────────────────────────────────────────────────────────────────
def run():
    print("""
+=================================================+
|    SPX SNIPER  -  Real 0DTE Options Scalper     |
|  Underlying: SPY 0DTE options                   |
|  Contracts:  ATM, same-day expiration           |
|  Risk:       1.5% per trade, 40% premium SL     |
|  Time Gate:  10:30 AM - 2:30 PM EST             |
|  Max:        3 trades/day, 2 losses = stop      |
+=================================================+
""")
    log_message('spx', get_random_quip('spx'))
    log_message('spx', f"SPX Sniper online - REAL 0DTE options on {OPTIONS_UNDERLYING}")

    # Start real-time SPY price feed (Alpaca WebSocket → yfinance fallback)
    _price_feed = build_feed_for_agent('spx_sniper')

    active_trades   = []
    scan_count      = 0
    current_day     = None
    day_stats       = {}

    while True:
        try:
            if not is_market_hours():
                now_str = datetime.now(EST).strftime('%H:%M:%S')
                print(f"[SPX Sniper] Outside market hours ({now_str} ET). Sleeping 5m...")
                time.sleep(300)
                continue

            # Reset daily stats on new day
            today = date.today().isoformat()
            if today != current_day:
                current_day = today
                day_stats = {'trades_today': 0, 'losses_today': 0, 'total_pnl': 0, 'wins': 0, 'win_rate': 0}
                print(f"[SPX Sniper] New trading day: {today}")

            # Check daily limits
            if day_stats.get('losses_today', 0) >= MAX_DAILY_LOSSES:
                print(f"[SPX Sniper] Daily loss limit reached ({MAX_DAILY_LOSSES} losses). Done for today.")
                # Still monitor exits
                if active_trades:
                    data = yf.download(SPX_TICKER, period='1d', interval=TIMEFRAME, progress=False)
                    if isinstance(data.columns, pd.MultiIndex):
                        data.columns = data.columns.get_level_values(0)
                    if not data.empty:
                        price = float(data['Close'].iloc[-1])
                        active_trades = check_trade_exits(active_trades, price, day_stats)
                        broadcast_status("STOPPED", price, active_trades, [], scan_count, day_stats)
                time.sleep(300)
                continue

            if day_stats.get('trades_today', 0) >= MAX_DAILY_TRADES and not active_trades:
                print(f"[SPX Sniper] Max daily trades reached ({MAX_DAILY_TRADES}). Done for today.")
                time.sleep(300)
                continue

            scan_count += 1
            now_str = datetime.now(EST).strftime('%H:%M:%S')
            print(f"\n[{now_str}] SPX Sniper scan #{scan_count}")

            # Fetch SPX candle history for indicator calculation
            data = yf.download(SPX_TICKER, period=PERIOD, interval=TIMEFRAME, progress=False)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            if data.empty:
                print("[SPX Sniper] No data received, retrying...")
                time.sleep(60)
                continue

            df = calculate_indicators(data)
            signals, trend, current_price = generate_signals(df)

            # Refresh SPY price in cache so OptionsChain.spot gets real-time data when
            # selecting contracts. get_latest_price warms _cache; OptionsChain picks it up.
            rt_spy = get_latest_price(OPTIONS_UNDERLYING, max_cache_age=15.0)
            if rt_spy:
                print(f"   [RT] SPY: ${rt_spy:.2f} (real-time) | SPX: ${current_price:.2f} (candle)")

            rsi_val = df['RSI'].iloc[-1]
            rsi_str = f"{rsi_val:.1f}" if not pd.isna(rsi_val) else "N/A"
            late_str = " [LATE SESSION]" if is_late_session() else ""
            print(f"   SPX: ${current_price:.2f} | {trend} | RSI: {rsi_str}{late_str}")
            print(f"   Day: {day_stats['trades_today']} trades | {day_stats['losses_today']} losses | PnL: ${day_stats['total_pnl']:+.2f}")

            # Check exits
            if active_trades:
                active_trades = check_trade_exits(active_trades, current_price, day_stats)

            # Enter new trades
            if is_safe_time() and signals and len(active_trades) < MAX_OPEN_TRADES:
                sig = signals[0]

                # Intel preflight
                direction = 'LONG' if sig['type'] == 'CALL' else 'SHORT'
                preflight = call_preflight('spx', OPTIONS_UNDERLYING, direction, 'SPXSniper_0DTE')
                if not should_take_trade(preflight):
                    print(f"[SPX Sniper] Intel says NO_GO — skipping {sig['type']}")
                else:
                    print(f"[SPX Sniper] {sig['type']} signal detected: {sig['reason']}")

                    contract, risk = select_0dte_contract(sig['type'])
                    if contract:
                        success = fire_signal(
                            action='BUY',
                            contract=contract,
                            premium=contract.mid,
                            qty=risk['qty'],
                            stop_premium=risk['stop_premium'],
                            target_premium=risk['target_premium'],
                            reason=f"0DTE {sig['type']} | {sig['reason']}",
                        )
                        if success:
                            active_trades.append({
                                'signal_type':     sig['type'],
                                'contract_type':   contract.contract_type,
                                'occ_symbol':      contract.occ_symbol,
                                'strike':          contract.strike,
                                'expiration':      contract.expiration,
                                'entry_premium':   contract.mid,
                                'current_premium': contract.mid,
                                'stop_premium':    risk['stop_premium'],
                                'target_premium':  risk['target_premium'],
                                'qty':             risk['qty'],
                                'total_cost':      risk['total_cost'],
                                'delta':           contract.delta,
                                'theta':           contract.theta,
                                'iv':              contract.implied_volatility,
                                'dte':             contract.dte,
                                'underlying_at_entry': current_price,
                                'opened_at':       datetime.now().isoformat(),
                                'reason':          sig['reason'],
                                'unrealized_pnl':  0,
                                'tightened':       False,
                            })

            elif not is_safe_time():
                gate_str = "before 10:30 AM" if datetime.now(EST).time() < dtime(10, 30) else "after 2:30 PM"
                print(f"   Time gate active ({gate_str})")

            # Broadcast
            broadcast_status(trend, current_price, active_trades, signals, scan_count, day_stats)

            time.sleep(SCAN_INTERVAL_SEC)

        except KeyboardInterrupt:
            print("\nSPX Sniper shutting down...")
            break
        except Exception as e:
            print(f"[SPX Sniper] Error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)


if __name__ == "__main__":
    run()
