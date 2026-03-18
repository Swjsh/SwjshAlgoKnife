#!/usr/bin/env python3
"""
Crypto Cody Runner - Integrates with agent_runner.ts
Wraps crypto_cody_engine.py to output AGENT_STATUS_UPDATE JSON
for the agents dashboard (matching Bitcoin Bob pattern).

EXECUTION MODES:
• Direct Alpaca: USE_DIRECT_ALPACA=True → Submits orders directly to Alpaca REST API
  (no webhooks, real paper trades to Alpaca)
• Webhook Fallback: USE_DIRECT_ALPACA=False → Uses Next.js webhook → executor chain
  (compatible with multi-user executor logic)

See crypto_cody_engine.py line ~31: USE_DIRECT_ALPACA = True/False
"""

import sys
import json
import time
from datetime import datetime
from crypto_cody_engine import (
    PAIRS, run_scan, get_current_price, check_trade_exits,
    check_squeeze_breakouts, broadcast_status, YF_TO_SIGNAL, SCAN_INTERVAL_MIN,
    TICK_INTERVAL_SEC, MAX_OPEN_TRADES, USE_DIRECT_ALPACA, alpaca_executor
)
from agent_utils import (
    call_preflight, send_feedback, should_take_trade, get_size_multiplier,
    log_message, get_random_quip, load_agent_state, save_agent_state
)


AGENT_ID = 'crypto_cody'


def main():
    """Run Crypto Cody with proper AGENT_STATUS_UPDATE protocol for dashboard."""
    # Print execution mode
    if USE_DIRECT_ALPACA and alpaca_executor:
        print(f"[Crypto Cody] 🔗 EXECUTION MODE: Direct Alpaca REST API", flush=True)
        try:
            account = alpaca_executor.get_account_info()
            print(f"[Crypto Cody] Account: {account['account_number']} | Cash: ${account['cash']:,.2f}", flush=True)
        except Exception as e:
            print(f"[Crypto Cody] ⚠️ Alpaca connection error: {e}", flush=True)
    else:
        print(f"[Crypto Cody] 🌐 EXECUTION MODE: Webhook Fallback (Next.js executor)", flush=True)

    print(f"[Crypto Cody] Starting BB Squeeze Momentum Trader...", flush=True)
    print(f"[Crypto Cody] Pairs: {', '.join(PAIRS)}", flush=True)
    print(f"[Crypto Cody] Max positions: {MAX_OPEN_TRADES}", flush=True)
    log_message('crypto', get_random_quip('crypto'))
    log_message('crypto', f"Crypto Cody online - scanning {', '.join(PAIRS)}")

    # ── Restore persisted state ──────────────────────────────────────────────
    saved = load_agent_state(AGENT_ID)
    zones_by_pair = saved.get('zones_by_pair', {})
    active_trades = saved.get('active_trades', [])
    scan_count = saved.get('scan_count', 0)
    if active_trades:
        print(f"[Crypto Cody] Restored {len(active_trades)} active trades from saved state", flush=True)

    last_scan_time = 0  # force scan on first tick

    while True:
        try:
            now = time.time()
            now_str = datetime.now().strftime('%H:%M:%S')

            # ── Periodic squeeze zone rescan ─────────────────────────────────────
            if now - last_scan_time >= SCAN_INTERVAL_MIN * 60:
                # Preserve triggered state so we don't re-enter same zones
                triggered = {}
                for pair, zones in zones_by_pair.items():
                    triggered[pair] = {
                        (z['bb_upper'], z['bb_lower']): z.get('status')
                        for z in zones
                    }

                zones_by_pair = run_scan()
                last_scan_time = now
                scan_count += 1

                # Restore triggered state on re-scanned zones
                for pair, zones in zones_by_pair.items():
                    for z in zones:
                        key = (z['bb_upper'], z['bb_lower'])
                        if triggered.get(pair, {}).get(key) == 'TRIGGERED':
                            z['triggered'] = True
                            z['status'] = 'TRIGGERED'

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
                print(f"[{now_str}] Cody scanning... {price_str}", flush=True)

            # ── Check open trade exits ───────────────────────────────────────
            trades_before = len(active_trades)
            if active_trades:
                active_trades = check_trade_exits(active_trades, prices)
                # Report closed trades via feedback
                if len(active_trades) < trades_before:
                    closed_count = trades_before - len(active_trades)
                    print(f"[Crypto Cody] {closed_count} trade(s) closed", flush=True)

            # ── Check squeeze breakout entries (with intel preflight) ────────────
            if zones_by_pair:
                # Before entering, run intel preflight on potential breakouts
                open_tickers = {t['ticker'] for t in active_trades}
                for pair, zones in zones_by_pair.items():
                    price = prices.get(pair)
                    if price is None or pair in open_tickers:
                        continue
                    if len(active_trades) >= MAX_OPEN_TRADES:
                        break

                    for zone in zones:
                        if zone.get('triggered') or zone.get('status') != 'PENDING':
                            continue

                        # Check for breakout
                        entered = False
                        direction = None
                        if price > zone['bb_upper']:  # LONG
                            entered = True
                            direction = 'LONG'
                        elif price < zone['bb_lower']:  # SHORT
                            entered = True
                            direction = 'SHORT'

                        if entered and direction:
                            # Intel preflight check
                            symbol = YF_TO_SIGNAL.get(pair, pair.replace('-', ''))
                            preflight = call_preflight(AGENT_ID, symbol, direction, 'CryptoCody_BBSqueeze')
                            if should_take_trade(preflight):
                                # Let the engine handle the actual entry
                                break
                            else:
                                print(f"[INTEL] Cody SKIPPED {pair} {direction}: {preflight.get('reasons', [])}", flush=True)

                zones_by_pair, active_trades = check_squeeze_breakouts(
                    zones_by_pair, active_trades, prices
                )

            # ── Persist state ────────────────────────────────────────────────
            save_agent_state(AGENT_ID, {
                'zones_by_pair': _serialize_zones(zones_by_pair),
                'active_trades': active_trades,
                'scan_count': scan_count,
            })

            # ── Build status for dashboard ───────────────────────────────────
            all_zones = [z for zones in zones_by_pair.values() for z in zones]
            pending = [z for z in all_zones if z.get('status') == 'PENDING']

            output = {
                "last_updated": datetime.now().isoformat(),
                "status": "ACTIVE",
                "active_pairs": len(PAIRS),
                "total_zones_found": len(all_zones),
                "performance": {
                    "win_rate": 0,
                    "total_pnl": 0,
                    "trades": 0,
                },
                "pending_orders": pending[:10],
                "closed_trades": [],
                "meta": {
                    "name": "Crypto Cody",
                    "type": "Crypto"
                }
            }

            # Add active trades
            for trade in active_trades:
                output.setdefault('pending_orders', [])

            # ── Emit AGENT_STATUS_UPDATE for agent_runner.ts ─────────────────
            print("AGENT_STATUS_UPDATE:" + json.dumps(output), flush=True)

            # Also broadcast via the engine's file-based status
            broadcast_status(all_zones, active_trades, scan_count, prices)

            print(f"[SUCCESS] [{now_str}] Cody update: {len(pending)} pending zones, "
                  f"{len(active_trades)} active trades", flush=True)

        except Exception as e:
            print(f"[ERROR] [Crypto Cody] {e}", file=sys.stderr, flush=True)
            import traceback
            traceback.print_exc(file=sys.stderr)

        time.sleep(TICK_INTERVAL_SEC)


def _serialize_zones(zones_by_pair: dict) -> dict:
    """Make zones JSON-serializable (strip any non-serializable fields)."""
    result = {}
    for pair, zones in zones_by_pair.items():
        result[pair] = []
        for z in zones:
            result[pair].append({
                'created_at': z.get('created_at', ''),
                'type': z.get('type', ''),
                'bb_upper': z.get('bb_upper', 0),
                'bb_lower': z.get('bb_lower', 0),
                'current_price': z.get('current_price', 0),
                'squeeze_candles': z.get('squeeze_candles', 0),
                'status': z.get('status', 'PENDING'),
                'triggered': z.get('triggered', False),
            })
    return result


if __name__ == "__main__":
    main()
