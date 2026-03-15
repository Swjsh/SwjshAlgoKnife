#!/usr/bin/env python3
"""
Bitcoin Bob Runner - Integrates with agent_runner.ts
Wraps bitcoin_bob_engine.py to output AGENT_STATUS_UPDATE JSON
for the agents dashboard (matching boba/spx_sniper pattern).
"""

import sys
import json
import time
from datetime import datetime
from bitcoin_bob_engine import (
    PAIRS, run_scan, get_current_price, check_trade_exits,
    check_zone_entries, broadcast_status, YF_TO_SIGNAL, SCAN_INTERVAL_MIN,
    TICK_INTERVAL_SEC, MAX_OPEN_TRADES
)
from agent_utils import (
    call_preflight, send_feedback, should_take_trade, get_size_multiplier,
    log_message, get_random_quip, load_agent_state, save_agent_state
)


AGENT_ID = 'bitcoin_bob'


def main():
    """Run Bitcoin Bob with proper AGENT_STATUS_UPDATE protocol for dashboard."""
    print(f"[Bitcoin Bob] Starting Crypto S/D Zone Trader...", flush=True)
    print(f"[Bitcoin Bob] Pairs: {', '.join(PAIRS)}", flush=True)
    print(f"[Bitcoin Bob] Max positions: {MAX_OPEN_TRADES}", flush=True)
    log_message('crypto', get_random_quip('crypto'))
    log_message('crypto', f"Bitcoin Bob online - scanning {', '.join(PAIRS)}")

    # ── Restore persisted state ──────────────────────────────────────────────
    saved = load_agent_state(AGENT_ID)
    zones_by_pair = saved.get('zones_by_pair', {})
    active_trades = saved.get('active_trades', [])
    scan_count = saved.get('scan_count', 0)
    if active_trades:
        print(f"[Bitcoin Bob] Restored {len(active_trades)} active trades from saved state", flush=True)

    last_scan_time = 0  # force scan on first tick

    while True:
        try:
            now = time.time()
            now_str = datetime.now().strftime('%H:%M:%S')

            # ── Periodic zone rescan ─────────────────────────────────────────
            if now - last_scan_time >= SCAN_INTERVAL_MIN * 60:
                # Preserve triggered state so we don't re-enter same zones
                triggered = {}
                for pair, zones in zones_by_pair.items():
                    triggered[pair] = {
                        (z['top'], z['bottom']): z.get('status')
                        for z in zones
                    }

                zones_by_pair = run_scan()
                last_scan_time = now
                scan_count += 1

                # Restore triggered state on re-scanned zones
                for pair, zones in zones_by_pair.items():
                    for z in zones:
                        key = (z['top'], z['bottom'])
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
                print(f"[{now_str}] Bob scanning... {price_str}", flush=True)

            # ── Check open trade exits ───────────────────────────────────────
            trades_before = len(active_trades)
            if active_trades:
                active_trades = check_trade_exits(active_trades, prices)
                # Report closed trades via feedback
                if len(active_trades) < trades_before:
                    closed_count = trades_before - len(active_trades)
                    print(f"[Bitcoin Bob] {closed_count} trade(s) closed", flush=True)

            # ── Check zone entries (with intel preflight) ────────────────────
            if zones_by_pair:
                # Before entering, run intel preflight on potential entries
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

                        entered = False
                        direction = None
                        if zone['type'] == 'DEMAND' and zone['bottom'] <= price <= zone['top']:
                            entered = True
                            direction = 'LONG'
                        elif zone['type'] == 'SUPPLY' and zone['bottom'] <= price <= zone['top']:
                            entered = True
                            direction = 'SHORT'

                        if entered and direction:
                            # Intel preflight check
                            symbol = YF_TO_SIGNAL.get(pair, pair.replace('-', ''))
                            preflight = call_preflight(AGENT_ID, symbol, direction, 'BitcoinBob_SR')
                            if should_take_trade(preflight):
                                # Let the engine handle the actual entry
                                break
                            else:
                                print(f"[INTEL] Bob SKIPPED {pair} {direction}: {preflight.get('reasons', [])}", flush=True)

                zones_by_pair, active_trades = check_zone_entries(
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
                    "name": "Bitcoin Bob",
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

            print(f"[SUCCESS] [{now_str}] Bob update: {len(pending)} pending zones, "
                  f"{len(active_trades)} active trades", flush=True)

        except Exception as e:
            print(f"[ERROR] [Bitcoin Bob] {e}", file=sys.stderr, flush=True)
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
                'top': z.get('top', 0),
                'bottom': z.get('bottom', 0),
                'entry': z.get('entry', 0),
                'stop_loss': z.get('stop_loss', 0),
                'take_profit': z.get('take_profit', 0),
                'status': z.get('status', 'PENDING'),
                'triggered': z.get('triggered', False),
            })
    return result


if __name__ == "__main__":
    main()
