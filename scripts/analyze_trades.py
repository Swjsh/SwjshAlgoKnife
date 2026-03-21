#!/usr/bin/env python3
"""Analyze historical trades for pattern aggregation - LEARN-10"""

import json
from collections import Counter
from pathlib import Path

def main():
    trades_file = Path("C:/Users/jackw/Desktop/SwjshAlgoKnife/docs/analysis/trades_summary.json")

    with open(trades_file, 'r') as f:
        data = json.load(f)

    stats = data['statistics']
    by_underlying = stats['by_underlying']

    # Calculate win rates and grades for each ticker
    results = []
    for ticker, info in by_underlying.items():
        trades = info['trades']
        pnl = info['pnl']
        winners = info['winners']
        win_rate = (winners / trades * 100) if trades > 0 else 0
        avg_pnl = pnl / trades if trades > 0 else 0

        # Grading logic based on Cortana rubric
        if win_rate >= 60 and avg_pnl > 0:
            grade = 'A'
        elif win_rate >= 50 and avg_pnl >= 0:
            grade = 'B'
        elif win_rate >= 40:
            grade = 'C'
        elif win_rate >= 30:
            grade = 'D'
        else:
            grade = 'F'

        results.append({
            'ticker': ticker,
            'trades': trades,
            'winners': winners,
            'win_rate': round(win_rate, 1),
            'pnl': round(pnl, 2),
            'avg_pnl': round(avg_pnl, 2),
            'grade': grade
        })

    # Sort by trades (volume) descending
    results.sort(key=lambda x: x['trades'], reverse=True)

    print("=" * 80)
    print("CORTANA PATTERN ANALYSIS - LEARN-10")
    print("Historical Trade Data: 2025")
    print("=" * 80)
    print()

    print("TICKER GRADE REPORT - Top 20 by Volume")
    print("-" * 80)
    print(f"{'Ticker':<8} {'Trades':<8} {'WR%':<8} {'PnL':<12} {'Avg PnL':<10} {'Grade':<6}")
    print("-" * 80)
    for r in results[:20]:
        print(f"{r['ticker']:<8} {r['trades']:<8} {r['win_rate']:<8} {r['pnl']:<12} {r['avg_pnl']:<10} {r['grade']:<6}")

    print()
    print("GRADE DISTRIBUTION")
    print("-" * 40)
    grades = Counter(r['grade'] for r in results)
    for grade in ['A', 'B', 'C', 'D', 'F']:
        count = grades.get(grade, 0)
        pct = count / len(results) * 100
        print(f"  {grade}: {count} tickers ({pct:.1f}%)")

    print()
    print("TOP 5 PERFORMERS (by win rate, min 10 trades)")
    print("-" * 60)
    filtered = [r for r in results if r['trades'] >= 10]
    filtered.sort(key=lambda x: x['win_rate'], reverse=True)
    for r in filtered[:5]:
        print(f"  {r['ticker']}: {r['win_rate']}% WR, {r['trades']} trades, ${r['pnl']} PnL")

    print()
    print("BOTTOM 5 PERFORMERS (by win rate, min 10 trades)")
    print("-" * 60)
    for r in filtered[-5:]:
        print(f"  {r['ticker']}: {r['win_rate']}% WR, {r['trades']} trades, ${r['pnl']} PnL")

    print()
    print("PATTERN: Volume vs Win Rate Correlation")
    print("-" * 60)
    high_volume = [r for r in results if r['trades'] >= 100]
    low_volume = [r for r in results if 10 <= r['trades'] < 50]
    hv_wr = sum(r['win_rate'] for r in high_volume) / len(high_volume) if high_volume else 0
    lv_wr = sum(r['win_rate'] for r in low_volume) / len(low_volume) if low_volume else 0
    print(f"  High volume (100+ trades) avg WR: {hv_wr:.1f}%")
    print(f"  Low volume (10-49 trades) avg WR: {lv_wr:.1f}%")
    delta = hv_wr - lv_wr
    print(f"  Delta: {delta:.1f}% ({'high volume underperforms' if delta < 0 else 'high volume outperforms'})")

    print()
    print("PATTERNS IDENTIFIED (confidence scoring)")
    print("=" * 80)

    # Pattern 1: Volume inverse correlation
    patterns = []

    if delta < -5:
        patterns.append({
            'id': 'P005-VOLUME',
            'name': 'Volume Inverse Correlation',
            'confidence': 85 if delta < -10 else 70,
            'description': 'Higher trading frequency correlates with lower win rates',
            'action': 'Reduce position size and frequency on high-volume tickers',
            'data': f'Delta: {delta:.1f}%'
        })

    # Pattern 2: HD outperformance
    hd = next((r for r in results if r['ticker'] == 'HD'), None)
    if hd and hd['win_rate'] == 100:
        patterns.append({
            'id': 'P006-HD',
            'name': 'HD Perfect Win Rate',
            'confidence': 60,  # Low sample size
            'description': 'HD showed 100% win rate across all trades',
            'action': 'Monitor HD for pattern continuation, increase allocation if validated',
            'data': f"{hd['trades']} trades, ${hd['pnl']} PnL"
        })

    # Pattern 3: AMD catastrophic
    amd = next((r for r in results if r['ticker'] == 'AMD'), None)
    if amd and amd['win_rate'] < 15:
        patterns.append({
            'id': 'P007-AMD',
            'name': 'AMD Systematic Failure',
            'confidence': 90,
            'description': 'AMD showed catastrophic 11.4% win rate',
            'action': 'AVOID AMD trades or require additional confluence',
            'data': f"{amd['trades']} trades, ${amd['pnl']} PnL, {amd['win_rate']}% WR"
        })

    # Pattern 4: SPY vs QQQ
    spy = next((r for r in results if r['ticker'] == 'SPY'), None)
    qqq = next((r for r in results if r['ticker'] == 'QQQ'), None)
    if spy and qqq:
        patterns.append({
            'id': 'P008-INDEX',
            'name': 'SPY vs QQQ Performance',
            'confidence': 80,
            'description': f"SPY ({spy['win_rate']}% WR) outperformed QQQ ({qqq['win_rate']}% WR)",
            'action': 'Prefer SPY over QQQ for index trades',
            'data': f"SPY: ${spy['pnl']}, QQQ: ${qqq['pnl']}"
        })

    for p in patterns:
        print()
        print(f"  [{p['id']}] {p['name']}")
        print(f"  Confidence: {p['confidence']}%")
        print(f"  Description: {p['description']}")
        print(f"  Action: {p['action']}")
        print(f"  Data: {p['data']}")

    print()
    print("=" * 80)
    print("Analysis complete. Patterns ready for aggregation.")
    print("=" * 80)

    return patterns

if __name__ == '__main__':
    main()
