import sqlite3

conn = sqlite3.connect('journal.db')
cur = conn.cursor()
cur.execute("""
    SELECT symbol, direction, ROUND(entry_price,5) as entry, status, entry_date 
    FROM trades 
    WHERE status='OPEN' 
    AND (symbol LIKE '%USD%' OR symbol LIKE '%GBP%' OR symbol LIKE '%EUR%' OR symbol LIKE '%JPY%') 
    ORDER BY entry_date DESC
""")

rows = cur.fetchall()
if rows:
    for row in rows:
        print(f"{row[0]} | {row[1]} | Entry: {row[2]} | Status: {row[3]} | {row[4]}")
else:
    print("NO OPEN FX POSITIONS")

conn.close()
