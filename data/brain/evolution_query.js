const Database = require('better-sqlite3');
const db = new Database('./journal.db');

console.log('=== WEEKLY STRATEGY BREAKDOWN ===');
const weekly = db.prepare(`SELECT strategy, COUNT(*) trades, ROUND(SUM(pnl),2) total_pnl, SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) wins FROM trades WHERE status IN ('WIN','LOSS') AND entry_date >= datetime('now','-7 days') GROUP BY strategy ORDER BY total_pnl DESC`).all();
console.log(JSON.stringify(weekly, null, 2));

console.log('=== TIME DISTRIBUTION ===');
const timedata = db.prepare(`SELECT CAST(strftime('%H', entry_date) AS INTEGER) as hour, status, COUNT(*) as count FROM trades WHERE status IN ('WIN','LOSS') AND entry_date >= datetime('now','-7 days') GROUP BY hour, status`).all();
console.log(JSON.stringify(timedata, null, 2));

console.log('=== ALL TIME TOTALS ===');
const totals = db.prepare(`SELECT COUNT(*) as trades, ROUND(SUM(pnl),2) as total_pnl, SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins, SUM(CASE WHEN status='LOSS' THEN 1 ELSE 0 END) as losses FROM trades WHERE status IN ('WIN','LOSS')`).get();
console.log(JSON.stringify(totals, null, 2));

console.log('=== RECENT TRADES ===');
const recent = db.prepare(`SELECT id, symbol, direction, strategy, status, ROUND(pnl,2) as pnl, entry_date FROM trades WHERE entry_date >= datetime('now','-7 days') ORDER BY entry_date DESC LIMIT 20`).all();
console.log(JSON.stringify(recent, null, 2));

console.log('=== OPEN POSITIONS ===');
const open = db.prepare(`SELECT id, symbol, direction, strategy, entry_date FROM trades WHERE status='OPEN'`).all();
console.log(JSON.stringify(open, null, 2));
