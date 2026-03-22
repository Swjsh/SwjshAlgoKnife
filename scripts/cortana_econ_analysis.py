#!/usr/bin/env python3
"""
Cortana Economic Event Impact Analysis (LEARN-11)
Correlates trade performance with economic calendar events
"""

import json
import re
from datetime import datetime, timedelta
from collections import defaultdict

def load_json(path):
    with open(path, 'r') as f:
        return json.load(f)

# Known high-impact events for Jan 24 - Mar 14, 2026 period (heuristic)
# These are estimated dates based on typical scheduling patterns
HIGH_IMPACT_EVENTS = {
    # NFP - First Friday of month (8:30 AM ET)
    "2026-02-07": "NFP",
    "2026-03-07": "NFP",

    # CPI - Mid-month (8:30 AM ET)
    "2026-02-12": "CPI",
    "2026-03-12": "CPI",

    # FOMC - Approx every 6 weeks (2 PM ET)
    "2026-01-29": "FOMC",  # Estimated
    "2026-03-19": "FOMC",  # Estimated (just outside our backtest)

    # Initial Jobless Claims - Every Thursday
    # Too many to list, will check day of week

    # PPI - Day after CPI typically
    "2026-02-13": "PPI",
    "2026-03-13": "PPI",
}

def is_event_day(date_str):
    """Check if date is a high-impact event day"""
    # Parse date from trade entry time
    date_only = date_str.split()[0]
    return date_only in HIGH_IMPACT_EVENTS

def get_event_type(date_str):
    """Get event type for date"""
    date_only = date_str.split()[0]
    return HIGH_IMPACT_EVENTS.get(date_only, None)

def is_claims_day(date_str):
    """Check if Thursday (weekly claims)"""
    try:
        date_only = date_str.split()[0]
        dt = datetime.strptime(date_only, "%Y-%m-%d")
        return dt.weekday() == 3  # Thursday
    except:
        return False

def main():
    # Load backtest data
    sr_data = load_json('data/backtests/SPY_supp_res_2026-03-15_12-18-21.json')
    orb_data = load_json('data/backtests/SPY_orb_2026-03-15_12-18-24.json')

    sr_trades = sr_data['results']['supp_res']['trades']
    orb_trades = orb_data['results']['orb']['trades']
    all_trades = orb_trades + sr_trades

    print('=' * 60)
    print('CORTANA: ECONOMIC EVENT IMPACT ANALYSIS')
    print('LEARN-11: Economic Event Impact on Agent Win Rates')
    print('Date: 2026-03-22')
    print('=' * 60)

    # Categorize trades
    event_day_trades = []
    non_event_trades = []
    claims_day_trades = []

    for t in all_trades:
        entry_time = t['entry_time']
        date_only = entry_time.split()[0]

        if is_event_day(entry_time):
            event_day_trades.append((t, get_event_type(entry_time)))
        elif is_claims_day(entry_time):
            claims_day_trades.append(t)
        else:
            non_event_trades.append(t)

    # Calculate metrics
    def calc_stats(trades, label=""):
        if not trades:
            return None
        wins = sum(1 for t in trades if t['pnl'] > 0)
        total = len(trades)
        wr = wins / total * 100
        pnl = sum(t['pnl'] for t in trades)
        return {'wins': wins, 'total': total, 'wr': wr, 'pnl': pnl}

    print('\n--- EVENT DAY VS NON-EVENT DAY PERFORMANCE ---\n')

    # High impact event days
    event_stats = {'wins': 0, 'total': 0, 'pnl': 0}
    for t, event_type in event_day_trades:
        event_stats['total'] += 1
        event_stats['pnl'] += t['pnl']
        if t['pnl'] > 0:
            event_stats['wins'] += 1

    if event_stats['total'] > 0:
        event_wr = event_stats['wins'] / event_stats['total'] * 100
        print(f"HIGH IMPACT EVENT DAYS (NFP/CPI/FOMC/PPI):")
        print(f"  Trades: {event_stats['total']}")
        print(f"  Win Rate: {event_wr:.1f}%")
        print(f"  Total PnL: ${event_stats['pnl']:,.2f}")
        print(f"  Avg PnL: ${event_stats['pnl']/event_stats['total']:,.2f}")
    else:
        print("HIGH IMPACT EVENT DAYS: No trades on event days")

    # Non-event days
    non_event_stats = calc_stats(non_event_trades)
    if non_event_stats:
        print(f"\nNON-EVENT DAYS:")
        print(f"  Trades: {non_event_stats['total']}")
        print(f"  Win Rate: {non_event_stats['wr']:.1f}%")
        print(f"  Total PnL: ${non_event_stats['pnl']:,.2f}")
        print(f"  Avg PnL: ${non_event_stats['pnl']/non_event_stats['total']:,.2f}")

    # Claims days (weekly)
    claims_stats = calc_stats(claims_day_trades)
    if claims_stats:
        print(f"\nTHURSDAYS (Weekly Claims Days):")
        print(f"  Trades: {claims_stats['total']}")
        print(f"  Win Rate: {claims_stats['wr']:.1f}%")
        print(f"  Total PnL: ${claims_stats['pnl']:,.2f}")

    # Event-by-event breakdown
    print('\n--- EVENT-BY-EVENT BREAKDOWN ---\n')
    event_breakdown = defaultdict(list)
    for t, event_type in event_day_trades:
        event_breakdown[event_type].append(t)

    for event_type, trades in sorted(event_breakdown.items()):
        wins = sum(1 for t in trades if t['pnl'] > 0)
        wr = wins / len(trades) * 100
        pnl = sum(t['pnl'] for t in trades)
        print(f"{event_type}: {len(trades)} trades, {wr:.0f}% WR, ${pnl:,.2f} PnL")
        for t in trades:
            win_loss = 'WIN' if t['pnl'] > 0 else 'LOSS'
            print(f"  - {t['entry_time'].split()[0]} {t['side']}: ${t['pnl']:,.2f} ({win_loss})")

    # Comparison
    print('\n--- COMPARISON ---\n')

    if event_stats['total'] > 0 and non_event_stats:
        diff = event_wr - non_event_stats['wr']
        print(f"Event Day WR:      {event_wr:.1f}%")
        print(f"Non-Event Day WR:  {non_event_stats['wr']:.1f}%")
        print(f"Difference:        {diff:+.1f} pp")

        avg_event_pnl = event_stats['pnl'] / event_stats['total']
        avg_non_event_pnl = non_event_stats['pnl'] / non_event_stats['total']
        print(f"\nEvent Day Avg PnL:     ${avg_event_pnl:,.2f}")
        print(f"Non-Event Day Avg PnL: ${avg_non_event_pnl:,.2f}")

    # Limitations
    print('\n--- LIMITATIONS & CAVEATS ---\n')
    print("1. Event dates are HEURISTIC (estimated based on typical scheduling)")
    print("2. Sample size is SMALL for event days")
    print("3. No intraday timing analysis (pre vs post event)")
    print("4. Missing actual event data (expected vs actual values)")
    print("5. Need ForexFactory historical data for precise correlation")

    # Recommendation
    print('\n--- PRELIMINARY FINDING ---\n')
    if event_stats['total'] > 0 and non_event_stats and event_stats['total'] >= 3:
        if abs(event_wr - non_event_stats['wr']) > 15:
            if event_wr > non_event_stats['wr']:
                print("OBSERVATION: Event days show BETTER performance")
                print("  This may indicate volatility suits our strategies")
            else:
                print("OBSERVATION: Event days show WORSE performance")
                print("  Consider implementing event blackouts")
        else:
            print("OBSERVATION: No significant difference between event/non-event days")
            print("  Effect size too small to warrant action")
    else:
        print("INSUFFICIENT DATA: Need more trades on event days for analysis")
        print("  Current sample size too small for statistical confidence")
        print("  Recommend: Track live performance through paper trading period")

    # Next steps
    print('\n--- RECOMMENDED NEXT STEPS ---\n')
    print("1. Enable Economic Calendar Engine in live trading")
    print("2. Tag all trades with active event windows")
    print("3. Track pre-event vs live-event vs post-event performance")
    print("4. Re-analyze after 30+ trades on event days")
    print("5. Consider implementing blackout zones for HIGH impact events")

    print('\n' + '=' * 60)
    print('END ECONOMIC EVENT ANALYSIS')
    print('=' * 60)

if __name__ == '__main__':
    main()
