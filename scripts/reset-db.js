const Database = require('better-sqlite3');
const db = new Database('journal.db');

// Get current trades
const trades = db.prepare('SELECT * FROM trades ORDER BY id').all();

// Clean everything
db.exec('DELETE FROM trades');
db.exec('DELETE FROM signals');
try { db.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name = ?").run('trades'); } catch(e) {}
try { db.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name = ?").run('signals'); } catch(e) {}

// Reinsert with clean IDs
const ins = db.prepare(`INSERT INTO trades (symbol, direction, entry_price, exit_price, size, strategy, status, pnl, notes, entry_date, exit_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
for (const t of trades) {
  ins.run(t.symbol, t.direction, t.entry_price, t.exit_price, t.size, t.strategy, t.status, t.pnl, t.notes, t.entry_date, t.exit_date);
}

console.log('DB reset complete:');
console.log(JSON.stringify(db.prepare('SELECT id, symbol, direction, status, pnl FROM trades').all(), null, 2));
