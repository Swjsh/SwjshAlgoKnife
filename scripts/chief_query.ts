import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'journal.db');
const db = new Database(dbPath);

const trades = db.prepare(`
  SELECT symbol, direction, strategy, status, pnl, entry_date, exit_date 
  FROM trades 
  WHERE date(entry_date) = date('now') OR (status='OPEN') 
  ORDER BY entry_date DESC
`).all();

const pnl = db.prepare(`
  SELECT ROUND(SUM(pnl),2) as pnl, COUNT(*) as trades, 
    SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins
  FROM trades 
  WHERE date(exit_date) = date('now') AND status IN ('WIN','LOSS')
`).get();

console.log('TRADES:', JSON.stringify(trades));
console.log('PNL:', JSON.stringify(pnl));
db.close();
