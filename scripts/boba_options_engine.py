"""
Boba — Real Options S&D Zone Trader (Paper)
=============================================
• Scans SPY 15m candles for Supply & Demand zones
• Selects REAL options contracts via yfinance chains
• Buys CALLs at demand zones, PUTs at supply zones
• Time-gated: entries only 9:30-11:00 AM EST (peak options volume)
• Risk managed by PREMIUM (stop at -50% premium, target at +100%)
• Continuous live loop with 5-minute scans
• Broadcasts AGENT_STATUS_UPDATE for the dashboard

Changes from boba_trades_engine.py:
  ❌ No more SPY equity proxy
  ✅ Real options chain selection via options_utils.py
  ✅ Contract-level position tracking (OCC symbols, Greeks, premium P&L)
  ✅ Premium-based SL/TP instead of underlying price SL/TP
  ✅ Position sizing based on max premium risk
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
from options_utils import OptionsChain, OptionContract, calculate_options_risk, build_occ_symbol
from data_feeds import build_feed_for_agent, get_latest_price

# ── Config ────────────────────────────────────────────────────────────────────
UNDERLYING          = 'SPY'
TIMEFRAME           = '15m'
PERIOD              = '5d'
SCAN_INTERVAL_SEC   = 300            # 5 minute scan interval
MAX_OPEN_TRADES     = 1              # Options = one at a time
ACCOUNT_BALANCE     = 25_000         # Paper account balance
RISK_PER_TRADE      = 0.02           # 2% of account per trade
MAX_PREMIUM_LOSS    = 0.50           # Exit if premium drops 50%
TARGET_PREMIUM_GAIN = 1.00           # Target: double the premium (100% gain)
MIN_CONTRACT_VOLUME = 50             # Minimum volume for contract selection
MIN_OPEN_INTEREST   = 100            # Minimum OI
MAX_SPREAD_PCT      = 15.0           # Max bid-ask spread %
STATUS_FILE         = Path(__file__).parent.parent / 'data' / 'boba_agent_status.json'
WEBHOOK_URL         = "http://localhost:3000/api/webhook/tradingview"
WEBHOOK_SECRET      = os.getenv("WEBHOOK_SECRET")
if not WEBHOOK_SECRET:
    raise RuntimeError("WEBHOOK_SECRET environment variable is required")

# Options selection preferences
EXPIRY_TYPE         = 'weekly'       # weekly expirations for multi-day hold
TARGET_DELTA_CALL   = 0.40           # Slightly ITM calls for better fill
TARGET_DELTA_PUT    = -0.40          # Slightly ITM puts

EST = pytz.timezone('US/Eastern')


# ── Time Gates ────────────────────────────────────────────────────────────────
def is_entry_window() -> bool:
    """Entries 9:45-14:00 EST (wider window for S&D zone hits)."""
    now = datetime.now(EST).time()
    return dtime(9, 45) <= now <= dtime(14, 0)


def is_market_hours() -> bool:
    now_et = datetime.now(EST)
    if now_et.weekday() >= 5:
        return False
    return dtime(9, 30) <= now_et.time() <= dtime(16, 0)


# ── Webhook ───────────────────────────────────────────────────────────────────
def fire_signal(action: str, contract: OptionContract, premium: float,
                qty: int = 1, stop_premium: float = None,
                target_premium: float = None, reason: str = "") -> bool:
    """Fire a webhook with full contract details."""
    payload = {
        "symbol":       contract.occ_symbol,
        "underlying":   UNDERLYING,
        "action":       action,
        "price":        premium,
        "strategy":     "Boba_Options_SD",
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
        }
    }
    headers = {
        "Content-Type":     "application/json",
        "X-Webhook-Secret": WEBHOOK_SECRET,
    }
    try:
        resp = requests.post(WEBHOOK_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            print(f"[Boba] Signal: {action} {contract.occ_symbol} @ ${premium:.2f} x{qty}")
            log_message('boba', f"{action} {contract.occ_symbol} @ ${premium:.2f} x{qty} | {reason}", type='trade')
            return True
        else:
            print(f"[Boba] Webhook failed {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"[Boba] Webhook error: {e}")
        return False


# ── Status Broadcast ──────────────────────────────────────────────────────────
def broadcast_status(zones_count: int, active_trades: list, price: float,
                     scan_count: int, balance: float):
    total_pnl = sum(t.get('unrealized_pnl', 0) for t in active_trades)
    closed_pnl = sum(t.get('pnl', 0) for t in closed_trades_log)

    state = {
        "id":              "boba",
        "name":            "Boba",
        "last_updated":    datetime.now().isoformat(),
        "status":          "ACTIVE" if is_entry_window() else "SCANNING",
        "market_price":    round(price, 2),
        "active_pairs":    1,
        "scan_count":      scan_count,
        "pending_orders":  [],
        "active_trades":   active_trades,
        "total_zones_found": zones_count,
        "performance": {
            "win_rate":    0,
            "total_pnl":   round(closed_pnl, 2),
            "unrealized":  round(total_pnl, 2),
            "trades":      len(closed_trades_log),
            "balance":     round(balance, 2),
        }
    }
    STATUS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_FILE, 'w') as f:
        json.dump(state, f, indent=2)

    contract_str = active_trades[0].get('occ_symbol', '') if active_trades else 'none'
    msg = f"SPY ${price:.2f} | Zones: {zones_count} | Contract: {contract_str} | PnL: ${total_pnl:+.2f}"
    print(
        f"AGENT_STATUS_UPDATE:{json.dumps({'agentId': 'boba', 'status': state['status'], 'message': msg, 'timestamp': datetime.now().isoformat()})}",
        flush=True
    )


# ── Zone Detection ────────────────────────────────────────────────────────────
def find_zones(df: pd.DataFrame) -> tuple:
    """Identify S&D zones on 15m data. Returns (demand_zones, supply_zones)."""
    demand = []
    supply = []

    if df.empty or len(df) < 10:
        return demand, supply

    for i in range(5, len(df) - 1):
        cur  = df.iloc[i]
        prev = df.iloc[i - 1]

        body = abs(cur['Close'] - cur['Open'])
        avg_range = (df['High'].iloc[i-5:i] - df['Low'].iloc[i-5:i]).mean()

        if avg_range == 0:
            continue

        is_impulse = body > avg_range * 1.5

        if is_impulse:
            if cur['Close'] > cur['Open']:
                demand.append({
                    'top':     float(cur['Open']),
                    'bottom':  float(prev['Low']),
                    'fresh':   True,
                    'type':    'DEMAND',
                    'created': df.index[i].strftime('%Y-%m-%d %H:%M') if hasattr(df.index[i], 'strftime') else str(df.index[i]),
                })
            else:
                supply.append({
                    'top':     float(prev['High']),
                    'bottom':  float(cur['Open']),
                    'fresh':   True,
                    'type':    'SUPPLY',
                    'created': df.index[i].strftime('%Y-%m-%d %H:%M') if hasattr(df.index[i], 'strftime') else str(df.index[i]),
                })

    return demand[-5:], supply[-5:]


# ── Options Contract Selection ────────────────────────────────────────────────
def select_entry_contract(zone_type: str, underlying_price: float) -> tuple:
    """
    Select a real options contract based on zone type.

    Returns (OptionContract, risk_calc) or (None, None).
    """
    try:
        chain = OptionsChain(UNDERLYING)

        # IV environment check — don't buy expensive premiums
        iv_env = chain.check_iv_environment(max_iv_rank=75.0)
        if not iv_env['favorable']:
            print(f"[Boba] IV too high: {iv_env['reason']} — skipping entry")
            return None, None
        if iv_env.get('iv_rank') is not None:
            print(f"[Boba] IV Rank: {iv_env['iv_rank']:.0f}% ({iv_env.get('assessment', '?')})")

        if zone_type == 'DEMAND':
            # Bullish zone → buy CALL
            contract = chain.select_call(
                selection='delta',
                target_delta=TARGET_DELTA_CALL,
                expiry_type=EXPIRY_TYPE,
                min_volume=MIN_CONTRACT_VOLUME,
                min_oi=MIN_OPEN_INTEREST,
                max_spread_pct=MAX_SPREAD_PCT,
            )
        else:
            # Bearish zone → buy PUT
            contract = chain.select_put(
                selection='delta',
                target_delta=TARGET_DELTA_PUT,
                expiry_type=EXPIRY_TYPE,
                min_volume=MIN_CONTRACT_VOLUME,
                min_oi=MIN_OPEN_INTEREST,
                max_spread_pct=MAX_SPREAD_PCT,
            )

        if contract is None:
            print(f"[Boba] No suitable {'CALL' if zone_type == 'DEMAND' else 'PUT'} contract found")
            return None, None

        # Calculate position sizing
        risk = calculate_options_risk(
            contract,
            account_balance=ACCOUNT_BALANCE,
            risk_pct=RISK_PER_TRADE,
            max_loss_pct=MAX_PREMIUM_LOSS,
            target_gain_pct=TARGET_PREMIUM_GAIN,
        )

        if risk.get("qty", 0) == 0:
            print(f"[Boba] Position sizing returned 0 contracts")
            return None, None

        print(f"[Boba] Selected: {contract.occ_symbol}")
        print(f"        Strike: ${contract.strike} | Mid: ${contract.mid:.2f} | Delta: {contract.delta:.2f}")
        print(f"        DTE: {contract.dte} | IV: {contract.implied_volatility:.1%} | Spread: {contract.spread_pct:.1f}%")
        print(f"        Qty: {risk['qty']} | Cost: ${risk['total_cost']:.2f} | Max Loss: ${risk['max_loss']:.2f}")

        return contract, risk

    except Exception as e:
        print(f"[Boba] Contract selection error: {e}")
        import traceback
        traceback.print_exc()
        return None, None


# ── Shared chain instance for premium checks (avoids full re-fetch every scan) ─
_shared_chain: OptionsChain | None = None

def _get_chain() -> OptionsChain:
    """Get or create the shared OptionsChain instance (reused across scans)."""
    global _shared_chain
    if _shared_chain is None:
        _shared_chain = OptionsChain(UNDERLYING)
    return _shared_chain


# ── Live Premium Check ────────────────────────────────────────────────────────
def get_current_premium(occ_symbol: str, contract_type: str, strike: float, expiration: str) -> float | None:
    """
    Get current mid price for an open contract.
    Uses shared chain instance with 60s cache — no full re-fetch every scan.
    """
    try:
        return _get_chain().get_premium(expiration, strike, contract_type, max_cache_age=60.0)
    except Exception:
        return None


# ── Entry Check ───────────────────────────────────────────────────────────────
def check_zone_entries(demand_zones: list, supply_zones: list,
                       active_trades: list, price: float) -> tuple:
    """Check if price has entered any fresh zone. If so, select a real options contract."""
    if len(active_trades) >= MAX_OPEN_TRADES:
        return demand_zones, supply_zones, active_trades

    # Check demand zones (CALL)
    for zone in demand_zones:
        if not zone['fresh']:
            continue
        if zone['bottom'] <= price <= zone['top']:
            # Intel preflight check
            preflight = call_preflight('boba', UNDERLYING, 'LONG', 'Boba_Options_SD')
            if not should_take_trade(preflight):
                print(f"[Boba] Intel says NO_GO for LONG — skipping zone")
                zone['fresh'] = False
                continue

            print(f"[Boba] DEMAND zone hit: ${zone['bottom']:.2f}-${zone['top']:.2f}")

            contract, risk = select_entry_contract('DEMAND', price)
            if contract is None:
                continue

            success = fire_signal(
                action='BUY',
                contract=contract,
                premium=contract.mid,
                qty=risk['qty'],
                stop_premium=risk['stop_premium'],
                target_premium=risk['target_premium'],
                reason=f"Demand zone ({zone['bottom']:.2f}-{zone['top']:.2f}) | {contract.occ_symbol}",
            )
            if success:
                zone['fresh'] = False
                active_trades.append({
                    'direction':       'LONG',
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
                    'underlying_at_entry': price,
                    'opened_at':       datetime.now().isoformat(),
                    'zone_type':       'DEMAND',
                    'unrealized_pnl':  0,
                })
            break

    if len(active_trades) >= MAX_OPEN_TRADES:
        return demand_zones, supply_zones, active_trades

    # Check supply zones (PUT)
    for zone in supply_zones:
        if not zone['fresh']:
            continue
        if zone['bottom'] <= price <= zone['top']:
            preflight = call_preflight('boba', UNDERLYING, 'SHORT', 'Boba_Options_SD')
            if not should_take_trade(preflight):
                print(f"[Boba] Intel says NO_GO for SHORT — skipping zone")
                zone['fresh'] = False
                continue

            print(f"[Boba] SUPPLY zone hit: ${zone['bottom']:.2f}-${zone['top']:.2f}")

            contract, risk = select_entry_contract('SUPPLY', price)
            if contract is None:
                continue

            success = fire_signal(
                action='BUY',  # Buying PUTs (not shorting)
                contract=contract,
                premium=contract.mid,
                qty=risk['qty'],
                stop_premium=risk['stop_premium'],
                target_premium=risk['target_premium'],
                reason=f"Supply zone ({zone['bottom']:.2f}-{zone['top']:.2f}) | {contract.occ_symbol}",
            )
            if success:
                zone['fresh'] = False
                active_trades.append({
                    'direction':       'SHORT',  # Directional bias, not position direction
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
                    'underlying_at_entry': price,
                    'opened_at':       datetime.now().isoformat(),
                    'zone_type':       'SUPPLY',
                    'unrealized_pnl':  0,
                })
            break

    return demand_zones, supply_zones, active_trades


# ── Trade Exit Monitor ────────────────────────────────────────────────────────
closed_trades_log = []

def check_trade_exits(active_trades: list, underlying_price: float) -> list:
    """Monitor open positions by PREMIUM, not underlying price."""
    remaining = []

    for trade in active_trades:
        # Fetch current premium for the contract
        current = get_current_premium(
            trade['occ_symbol'],
            trade['contract_type'],
            trade['strike'],
            trade['expiration'],
        )

        if current is None:
            # Can't get premium — keep trade open, log warning
            print(f"[Boba] WARNING: Can't fetch premium for {trade['occ_symbol']}")
            remaining.append(trade)
            continue

        trade['current_premium'] = current
        entry = trade['entry_premium']
        pnl_per_contract = (current - entry) * 100
        total_pnl = pnl_per_contract * trade['qty']
        trade['unrealized_pnl'] = round(total_pnl, 2)
        pnl_pct = ((current - entry) / entry * 100) if entry > 0 else 0

        print(f"   {trade['occ_symbol']}: ${current:.2f} (entry ${entry:.2f}) | PnL: ${total_pnl:+.2f} ({pnl_pct:+.1f}%)")

        # Check expiration
        exp_date = datetime.strptime(trade['expiration'], '%Y-%m-%d').date()
        if date.today() >= exp_date and datetime.now(EST).time() >= dtime(15, 45):
            # Close before expiry
            reason = "Closing before expiration"
            _close_trade(trade, current, reason, 'EXPIRY')
            continue

        # Trailing stop: if premium up 50%+, trail SL to lock in 25% gain minimum
        if entry > 0:
            gain_pct = (current - entry) / entry
            if gain_pct >= 0.50 and not trade.get('trailing'):
                new_sl = round(entry * 1.25, 2)  # Lock in 25% gain
                if new_sl > trade['stop_premium']:
                    trade['stop_premium'] = new_sl
                    trade['trailing'] = True
                    print(f"   TRAILING: SL raised to ${new_sl:.2f} (locking 25% gain)")

        # Premium-based stops
        if current <= trade['stop_premium']:
            reason = f"Premium SL hit: ${current:.2f} <= ${trade['stop_premium']:.2f}"
            _close_trade(trade, current, reason, 'STOP')
            continue

        if current >= trade['target_premium']:
            reason = f"Premium TP hit: ${current:.2f} >= ${trade['target_premium']:.2f}"
            _close_trade(trade, current, reason, 'TARGET')
            continue

        remaining.append(trade)

    return remaining


def _close_trade(trade: dict, exit_premium: float, reason: str, exit_type: str):
    """Close a trade and log it."""
    entry = trade['entry_premium']
    pnl_per_contract = (exit_premium - entry) * 100
    total_pnl = pnl_per_contract * trade['qty']

    print(f"[Boba] CLOSED {trade['occ_symbol']}: ${entry:.2f} → ${exit_premium:.2f} | PnL: ${total_pnl:+.2f} | {reason}")
    log_message('boba', f"CLOSED {trade['occ_symbol']} | PnL: ${total_pnl:+.2f} | {reason}", type='trade')

    # Fire exit webhook
    # Create a minimal contract for the webhook
    dummy_contract = OptionContract(
        symbol=UNDERLYING,
        contract_type=trade['contract_type'],
        strike=trade['strike'],
        expiration=trade['expiration'],
        bid=exit_premium, ask=exit_premium, mid=exit_premium,
        last_price=exit_premium, volume=0, open_interest=0,
        implied_volatility=trade.get('iv', 0),
        occ_symbol=trade['occ_symbol'],
    )
    fire_signal('SELL', dummy_contract, exit_premium, trade['qty'], reason=reason)

    # Send feedback to intel
    outcome = 'WIN' if total_pnl > 0 else 'LOSS'
    send_feedback(
        agent_id='boba',
        symbol=UNDERLYING,
        direction=trade['direction'],
        outcome=outcome,
        pnl=total_pnl,
        strategy='Boba_Options_SD',
        notes=f"{trade['occ_symbol']} | {exit_type} | {reason}",
    )

    closed_trades_log.append({
        **trade,
        'exit_premium': exit_premium,
        'exit_time': datetime.now().isoformat(),
        'pnl': round(total_pnl, 2),
        'exit_type': exit_type,
    })


# ── Live Price ────────────────────────────────────────────────────────────────
_price_feed = None

def get_current_price() -> float | None:
    """
    Get SPY price. Uses Alpaca WebSocket cache first (real-time IEX),
    falls back to yfinance REST if WebSocket cache is stale.
    """
    try:
        price = get_latest_price(UNDERLYING, max_cache_age=15.0)
        if price:
            return price
        # Hard fallback
        hist = yf.Ticker(UNDERLYING).history(period='1d', interval='5m')
        if not hist.empty:
            return float(hist['Close'].iloc[-1])
    except Exception as e:
        print(f"[Boba] Price fetch failed: {e}")
    return None


# ── Main Loop ─────────────────────────────────────────────────────────────────
def run():
    print("""
+=================================================+
|       BOBA  -  Real Options S&D Zone Trader     |
|  Underlying: SPY                                |
|  Contracts:  Weekly, ~0.40 delta calls/puts     |
|  Risk:       2% per trade, 50% premium SL       |
|  Scan: every 5min | Entry: 9:45 AM-2:00 PM EST   |
+=================================================+
""")
    log_message('boba', get_random_quip('boba'))
    log_message('boba', f"Boba online - selecting REAL options contracts on {UNDERLYING}")

    # Start real-time price feed (Alpaca WebSocket → falls back to yfinance)
    global _price_feed
    _price_feed = build_feed_for_agent('boba')

    demand_zones    = []
    supply_zones    = []
    active_trades   = []
    scan_count      = 0
    last_zone_scan  = 0
    balance         = ACCOUNT_BALANCE

    while True:
        try:
            if not is_market_hours():
                now_str = datetime.now(EST).strftime('%H:%M:%S')
                print(f"[Boba] Outside market hours ({now_str} ET). Sleeping 5m...")
                time.sleep(300)
                continue

            scan_count += 1
            now = time.time()
            now_str = datetime.now(EST).strftime('%H:%M:%S')
            print(f"\n[{now_str}] Boba scan #{scan_count}")

            # Full zone rescan every 15 minutes
            if now - last_zone_scan >= 900:
                print(f"[Boba] Rescanning zones...")
                data = yf.download(UNDERLYING, period=PERIOD, interval=TIMEFRAME, progress=False)
                if isinstance(data.columns, pd.MultiIndex):
                    data.columns = data.columns.get_level_values(0)
                if not data.empty:
                    demand_zones, supply_zones = find_zones(data)
                    print(f"[Boba] {UNDERLYING}: {len(demand_zones)} demand, {len(supply_zones)} supply zones")
                last_zone_scan = now

            # Get live price
            price = get_current_price()
            if price is None:
                time.sleep(60)
                continue

            print(f"   SPY: ${price:.2f} | Zones: {len(demand_zones) + len(supply_zones)} | Open: {len(active_trades)}")

            # Check exits on open options positions (by premium)
            if active_trades:
                active_trades = check_trade_exits(active_trades, price)

            # Check entries (only during entry window)
            if is_entry_window() and (demand_zones or supply_zones):
                demand_zones, supply_zones, active_trades = check_zone_entries(
                    demand_zones, supply_zones, active_trades, price
                )
            elif not is_entry_window():
                print(f"   Entry window closed - monitoring exits only")

            # Update balance from closed trades
            balance = ACCOUNT_BALANCE + sum(t.get('pnl', 0) for t in closed_trades_log)

            # Broadcast
            total_zones = len(demand_zones) + len(supply_zones)
            broadcast_status(total_zones, active_trades, price, scan_count, balance)

            time.sleep(SCAN_INTERVAL_SEC)

        except KeyboardInterrupt:
            print("\nBoba shutting down...")
            break
        except Exception as e:
            print(f"[Boba] Error: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)


if __name__ == "__main__":
    run()
