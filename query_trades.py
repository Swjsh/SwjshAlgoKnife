import sqlite3

conn = sqlite3.connect(r'C:\Users\jackw\Desktop\SwjshAlgoKnife\journal.db')
cur = conn.cursor()
cur.execute("""SELECT symbol, direction, ROUND(entry_price,5) as entry, status, entry_date 
             FROM trades 
             WHERE status='OPEN' 
             AND (symbol LIKE '%USD%' OR symbol LIKE '%GBP%' OR symbol LIKE '%EUR%' OR symbol LIKE '%JPY%')
             ORDER BY entry_date DESC""")
rows = cur.fetchall()
if rows:
    for row in rows:
        print(row)
else:
    print("No open positions")
conn.close()
