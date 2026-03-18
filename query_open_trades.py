import sqlite3

conn = sqlite3.connect('journal.db')
cursor = conn.cursor()

cursor.execute("""
SELECT symbol, direction, ROUND(entry_price,5) as entry, status, entry_date 
FROM trades 
WHERE status='OPEN' 
AND (symbol LIKE '%USD%' OR symbol LIKE '%GBP%' OR symbol LIKE '%EUR%' OR symbol LIKE '%JPY%') 
ORDER BY entry_date DESC
""")

rows = cursor.fetchall()
if rows:
    for row in rows:
        print(f"{row[0]} | {row[1]} | Entry: {row[2]} | {row[3]} | {row[4]}")
else:
    print("No open FX positions.")

conn.close()
