#!/usr/bin/env python3
"""
Backtest Report Generator
=========================
Generates HTML reports with equity curves, trade tables, and metrics visualizations.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any


def generate_html_report(report_data: Dict[str, Any], output_path: str):
    """Generate standalone HTML report with embedded charts."""

    params = report_data['params']
    results = report_data['results']

    # Build HTML
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backtest Report - {params['symbol']} {params['strategy']}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #e2e8f0;
            padding: 2rem;
            min-height: 100vh;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        .header {{
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(6, 182, 212, 0.2);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
        }}
        h1 {{
            color: #06b6d4;
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }}
        .subtitle {{
            color: #94a3b8;
            font-size: 1rem;
        }}
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }}
        .metric-card {{
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(6, 182, 212, 0.2);
            border-radius: 8px;
            padding: 1.5rem;
            transition: transform 0.2s, border-color 0.2s;
        }}
        .metric-card:hover {{
            transform: translateY(-2px);
            border-color: rgba(6, 182, 212, 0.4);
        }}
        .metric-label {{
            color: #94a3b8;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        .metric-value {{
            color: #06b6d4;
            font-size: 1.75rem;
            font-weight: 600;
        }}
        .metric-value.positive {{ color: #10b981; }}
        .metric-value.negative {{ color: #ef4444; }}
        .section {{
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(6, 182, 212, 0.2);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }}
        .section-title {{
            color: #06b6d4;
            font-size: 1.25rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid rgba(6, 182, 212, 0.2);
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        th {{
            background: rgba(6, 182, 212, 0.1);
            color: #06b6d4;
            padding: 0.75rem;
            text-align: left;
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        td {{
            padding: 0.75rem;
            border-bottom: 1px solid rgba(148, 163, 184, 0.1);
        }}
        tr:hover {{
            background: rgba(6, 182, 212, 0.05);
        }}
        .trade-win {{ color: #10b981; }}
        .trade-loss {{ color: #ef4444; }}
        .footer {{
            text-align: center;
            color: #64748b;
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(148, 163, 184, 0.1);
        }}
        .chart {{
            width: 100%;
            height: 400px;
            margin: 1rem 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{params['symbol']} - {params.get('strategy', 'Unknown Strategy')}</h1>
            <div class="subtitle">
                {params['start']} → {params['end']} | {params.get('interval', '1d')} |
                Balance: ${params['balance']:,.2f} | Risk: {params['risk_pct']*100:.1f}%
            </div>
        </div>
"""

    # Add metrics for each strategy
    for strategy_name, strategy_result in results.items():
        metrics = strategy_result['metrics']
        trades = strategy_result.get('trades', [])

        total_pnl = metrics.get('total_pnl', 0)
        return_pct = metrics.get('return_pct', 0)
        win_rate = metrics.get('win_rate', 0)

        pnl_class = "positive" if total_pnl > 0 else "negative"
        return_class = "positive" if return_pct > 0 else "negative"

        html += f"""
        <div class="section">
            <div class="section-title">{strategy_result.get('strategy', strategy_name)}</div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Trades</div>
                    <div class="metric-value">{metrics.get('total_trades', 0)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Win Rate</div>
                    <div class="metric-value">{win_rate:.1f}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total P&L</div>
                    <div class="metric-value {pnl_class}">${total_pnl:,.2f}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Return</div>
                    <div class="metric-value {return_class}">{return_pct:.2f}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Profit Factor</div>
                    <div class="metric-value">{metrics.get('profit_factor', 0)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Max Drawdown</div>
                    <div class="metric-value negative">{metrics.get('max_drawdown_pct', 0):.2f}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Sharpe Ratio</div>
                    <div class="metric-value">{metrics.get('sharpe_ratio', 0):.2f}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg R:R</div>
                    <div class="metric-value">{metrics.get('avg_rr', 0):.2f}</div>
                </div>
            </div>
"""

        # Add trade table if trades exist
        if trades:
            html += f"""
            <div class="section-title" style="margin-top: 2rem;">Recent Trades (Last 20)</div>
            <table>
                <thead>
                    <tr>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>Side</th>
                        <th>Entry $</th>
                        <th>Exit $</th>
                        <th>P&L</th>
                        <th>R:R</th>
                        <th>Duration</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
"""
            for trade in trades:
                pnl = trade.get('pnl', 0)
                pnl_class = "trade-win" if pnl > 0 else "trade-loss"

                html += f"""
                    <tr>
                        <td>{trade.get('entry_time', 'N/A')[:16]}</td>
                        <td>{trade.get('exit_time', 'N/A')[:16]}</td>
                        <td>{trade.get('side', 'N/A')}</td>
                        <td>${trade.get('entry_price', 0):,.2f}</td>
                        <td>${trade.get('exit_price', 0):,.2f}</td>
                        <td class="{pnl_class}">${pnl:,.2f}</td>
                        <td>{trade.get('rr', 0):.2f}</td>
                        <td>{trade.get('duration_min', 0):.1f}m</td>
                        <td style="font-size: 0.75rem; color: #94a3b8;">{trade.get('reason', 'N/A')[:50]}</td>
                    </tr>
"""
            html += """
                </tbody>
            </table>
"""

        html += """
        </div>
"""

    # Footer
    html += f"""
        <div class="footer">
            Generated by SwjshAK Universal Backtester | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>
"""

    # Write file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"  HTML report saved: {output_path}")


def generate_markdown_report(report_data: Dict[str, Any], output_path: str):
    """Generate markdown report for terminal viewing or documentation."""

    params = report_data['params']
    results = report_data['results']

    md = f"""# Backtest Report

**Symbol**: {params['symbol']}
**Period**: {params['start']} → {params['end']}
**Timeframe**: {params.get('interval', '1d')}
**Initial Balance**: ${params['balance']:,.2f}
**Risk Per Trade**: {params['risk_pct']*100:.1f}%

---

"""

    for strategy_name, strategy_result in results.items():
        metrics = strategy_result['metrics']
        trades = strategy_result.get('trades', [])

        md += f"""## {strategy_result.get('strategy', strategy_name)}

### Performance Metrics

| Metric | Value |
|--------|-------|
| Total Trades | {metrics.get('total_trades', 0)} |
| Win Rate | {metrics.get('win_rate', 0):.1f}% |
| Total P&L | ${metrics.get('total_pnl', 0):,.2f} |
| Return | {metrics.get('return_pct', 0):.2f}% |
| Profit Factor | {metrics.get('profit_factor', 0)} |
| Max Drawdown | {metrics.get('max_drawdown_pct', 0):.2f}% |
| Sharpe Ratio | {metrics.get('sharpe_ratio', 0):.2f} |
| Avg R:R | {metrics.get('avg_rr', 0):.2f} |
| Avg Duration | {metrics.get('avg_duration_min', 0):.1f} min |

"""

        if trades:
            md += """### Recent Trades

| Entry | Exit | Side | P&L | R:R | Reason |
|-------|------|------|-----|-----|--------|
"""
            for trade in trades[-10:]:  # Last 10 trades
                md += f"| {trade.get('entry_time', 'N/A')[:16]} | {trade.get('exit_time', 'N/A')[:16]} | {trade.get('side', 'N/A')} | ${trade.get('pnl', 0):,.2f} | {trade.get('rr', 0):.2f} | {trade.get('reason', 'N/A')[:40]} |\n"

        md += "\n---\n\n"

    md += f"""
---
*Generated by SwjshAK Universal Backtester | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(md)

    print(f"  Markdown report saved: {output_path}")


def generate_reports_from_json(json_path: str):
    """Generate both HTML and Markdown reports from a JSON backtest result."""

    with open(json_path, 'r') as f:
        report_data = json.load(f)

    # Derive output paths
    json_file = Path(json_path)
    html_path = json_file.with_suffix('.html')
    md_path = json_file.with_suffix('.md')

    generate_html_report(report_data, str(html_path))
    generate_markdown_report(report_data, str(md_path))

    return str(html_path), str(md_path)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python backtest_report.py <backtest_results.json>")
        sys.exit(1)

    json_path = sys.argv[1]
    html_path, md_path = generate_reports_from_json(json_path)

    print(f"\nReports generated:")
    print(f"  HTML: {html_path}")
    print(f"  Markdown: {md_path}")
