import sqlite3
conn = sqlite3.connect('journal.db')
cur = conn.cursor()
cur.execute("""SELECT symbol, direction, status, ROUND(pnl,2) as pnl, entry_date, ROUND(entry_price,2) as entry FROM trades WHERE (symbol LIKE '%BTC%' OR symbol LIKE '%ETH%') AND entry_date >= datetime('now','-24 hours') ORDER BY entry_date DESC""")
for row in cur.fetchall():
    print(row)
conn.close()
