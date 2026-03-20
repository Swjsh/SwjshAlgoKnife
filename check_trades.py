import sqlite3

conn = sqlite3.connect('journal.db')
cursor = conn.cursor()

# Check recent BTC/ETH trades
cursor.execute("""
SELECT symbol, direction, status, ROUND(pnl, 2) as pnl, entry_date, ROUND(entry_price, 2) as entry 
FROM trades 
WHERE (symbol LIKE '%BTC%' OR symbol LIKE '%ETH%') 
AND entry_date >= datetime('now','-24 hours') 
ORDER BY entry_date DESC
""")

trades = cursor.fetchall()

if trades:
    print("=== Recent BTC/ETH Trades (24h) ===")
    for trade in trades:
        print(f"{trade[0]} | {trade[1]} | {trade[2]} | P&L: ${trade[3]} | Entry: ${trade[5]} | {trade[4]}")
else:
    print("No recent BTC/ETH trades in last 24 hours")

conn.close()
