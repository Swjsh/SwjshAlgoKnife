#!/usr/bin/env python3
"""
Digital Dash Runner - Integrates with agent_runner.ts
Wraps digital_dash_engine.py to output AGENT_STATUS_UPDATE JSON
for the agents dashboard (matching bitcoin_bob/boba pattern).

EXECUTION MODES:
• Direct Alpaca: USE_DIRECT_ALPACA=True → Submits orders directly to Alpaca REST API
  (no webhooks, real paper trades to Alpaca)
• Webhook Fallback: USE_DIRECT_ALPACA=False → Uses Next.js webhook → executor chain
  (compatible with multi-user executor logic)

See digital_dash_engine.py line ~31: USE_DIRECT_ALPACA = True/False
"""

import sys
import json
import time
from datetime import datetime
from digital_dash_engine import (
    PAIRS, run_scan, get_current_price, check_trade_exits,
    check_setup_entries, broadcast_status, YF_TO_SIGNAL, SCAN_INTERVAL_MIN,
    TICK_INTERVAL_SEC, MAX_OPEN_TRADES, USE_DIRECT_ALPACA, alpaca_executor
)
from agent_utils import (
    call_preflight, send_feedback, should_take_trade, get_size_multiplier,
    log_message, get_random_quip, load_agent_state, save_agent_state
)


AGENT_ID = 'digital_dash'


def main():
    """Run Digital Dash with proper AGENT_STATUS_UPDATE protocol for dashboard."""
    # Print execution mode
    if USE_DIRECT_ALPACA and alpaca_executor:
        print(f"[Digital Dash] 🔗 EXECUTION MODE: Direct Alpaca REST API", flush=True)
        try:
            account = alpaca_executor.get_account_info()
            print(f"[Digital Dash] Account: {account['account_number']} | Cash: ${account['cash']:,.2f}", flush=True)
        except Exception as e:
            print(f"[Digital Dash] ⚠️ Alpaca connection error: {e}", flush=True)
    else:
        print(f"[Digital Dash] 🌐 EXECUTION MODE: Webhook Fallback (Next.js executor)", flush=True)

    print(f"[Digital Dash] Starting VWAP Mean Reversion Trader...", flush=True)
    print(f"[Digital Dash] Pairs: {', '.join(PAIRS)}", flush=True)
    print(f"[Digital Dash] Max positions: {MAX_OPEN_TRADES}", flush=True)
    log_message('crypto', get_random_quip('crypto'))
    log_message('crypto', f"Digital Dash online - scanning {', '.join(PAIRS)}")

    # ── Restore persisted state ────────────────────────────────────────────────
    saved = load_agent_state(AGENT_ID)
    setups_by_pair = saved.get('setups_by_pair', {})
    active_trades = saved.get('active_trades', [])
    scan_count = saved.get('scan_count', 0)
    if active_trades:
        print(f"[Digital Dash] Restored {len(active_trades)} active trades from saved state", flush=True)

    last_scan_time = 0  # force scan on first tick

    while True:
        try:
            now = time.time()
            now_str = datetime.now().strftime('%H:%M:%S')

            # ── Periodic VWAP rescan ─────────────────────────────────────────
            if now - last_scan_time >= SCAN_INTERVAL_MIN * 60:
                # Preserve triggered state so we don't re-enter same setups
                triggered = {}
                for pair, setups in setups_by_pair.items():
                    triggered[pair] = {
                        (s['vwap'], s['price']): s.get('status')
                        for s in setups
                    }

                setups_by_pair = run_scan()
                last_scan_time = now
                scan_count += 1

                # Restore triggered state on re-scanned setups
                for pair, setups in setups_by_pair.items():
                    for s in setups:
                        key = (s['vwap'], s['price'])
                        if triggered.get(pair, {}).get(key) == 'TRIGGERED':
                            s['triggered'] = True
                            s['status'] = 'TRIGGERED'

            # ── Fetch live prices ────────────────────────────────────────────
            prices = {}
            for pair in PAIRS:
                p = get_current_price(pair)
                if p:
                    prices[pair] = p

            if prices:
                price_str = ' | '.join([
                    f"{p.replace('-USD', '')}: ${v:,.0f}" for p, v in prices.items()
                ])
                print(f"[{now_str}] Dash scanning... {price_str}", flush=True)

            # ── Check open trade exits ───────────────────────────────────────
            trades_before = len(active_trades)
            if active_trades:
                active_trades = check_trade_exits(active_trades, prices)
                # Report closed trades via feedback
                if len(active_trades) < trades_before:
                    closed_count = trades_before - len(active_trades)
                    print(f"[Digital Dash] {closed_count} trade(s) closed", flush=True)

            # ── Check setup entries (with intel preflight) ───────────────────
            if setups_by_pair:
                # Before entering, run intel preflight on potential entries
                open_tickers = {t['ticker'] for t in active_trades}
                for pair, setups in setups_by_pair.items():
                    price = prices.get(pair)
                    if price is None or pair in open_tickers:
                        continue
                    if len(active_trades) >= MAX_OPEN_TRADES:
                        break

                    for setup in setups:
                        if setup.get('triggered') or setup.get('status') != 'PENDING':
                            continue

                        direction = 'LONG' if setup['type'] == 'VWAP_LONG' else 'SHORT'

                        # Intel preflight check
                        symbol = YF_TO_SIGNAL.get(pair, pair.replace('-', ''))
                        preflight = call_preflight(AGENT_ID, symbol, direction, 'DigitalDash_VWAP')
                        if should_take_trade(preflight):
                            # Let the engine handle the actual entry
                            break
                        else:
                            print(f"[INTEL] Dash SKIPPED {pair} {direction}: {preflight.get('reasons', [])}", flush=True)

                setups_by_pair, active_trades = check_setup_entries(
                    setups_by_pair, active_trades, prices
                )

            # ── Persist state ────────────────────────────────────────────────
            save_agent_state(AGENT_ID, {
                'setups_by_pair': _serialize_setups(setups_by_pair),
                'active_trades': active_trades,
                'scan_count': scan_count,
            })

            # ── Build status for dashboard ───────────────────────────────────
            all_setups = [s for setups in setups_by_pair.values() for s in setups]
            pending = [s for s in all_setups if s.get('status') == 'PENDING']

            output = {
                "last_updated": datetime.now().isoformat(),
                "status": "ACTIVE",
                "active_pairs": len(PAIRS),
                "total_zones_found": len(all_setups),
                "performance": {
                    "win_rate": 0,
                    "total_pnl": 0,
                    "trades": 0,
                },
                "pending_orders": pending[:10],
                "closed_trades": [],
                "meta": {
                    "name": "Digital Dash",
                    "type": "Crypto"
                }
            }

            # Add active trades
            for trade in active_trades:
                output.setdefault('pending_orders', [])

            # ── Emit AGENT_STATUS_UPDATE for agent_runner.ts ─────────────────
            print("AGENT_STATUS_UPDATE:" + json.dumps(output), flush=True)

            # Also broadcast via the engine's file-based status
            broadcast_status(all_setups, active_trades, scan_count, prices)

            print(f"[SUCCESS] [{now_str}] Dash update: {len(pending)} pending setups, "
                  f"{len(active_trades)} active trades", flush=True)

        except Exception as e:
            print(f"[ERROR] [Digital Dash] {e}", file=sys.stderr, flush=True)
            import traceback
            traceback.print_exc(file=sys.stderr)

        time.sleep(TICK_INTERVAL_SEC)


def _serialize_setups(setups_by_pair: dict) -> dict:
    """Make setups JSON-serializable (strip any non-serializable fields)."""
    result = {}
    for pair, setups in setups_by_pair.items():
        result[pair] = []
        for s in setups:
            result[pair].append({
                'created_at': s.get('created_at', ''),
                'type': s.get('type', ''),
                'vwap': s.get('vwap', 0),
                'price': s.get('price', 0),
                'deviation_pct': s.get('deviation_pct', 0),
                'rsi': s.get('rsi', 0),
                'entry': s.get('entry', 0),
                'stop_loss': s.get('stop_loss', 0),
                'take_profit': s.get('take_profit', 0),
                'status': s.get('status', 'PENDING'),
                'triggered': s.get('triggered', False),
            })
    return result


if __name__ == "__main__":
    main()
