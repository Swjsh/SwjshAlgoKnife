const Database = require('better-sqlite3');
const db = new Database('journal.db');
const stale = db.prepare("SELECT COUNT(*) as cnt FROM trades WHERE status='PENDING' AND datetime(entry_date) < datetime('now','-30 minutes')").get();
const overnight = db.prepare("SELECT COUNT(*) as cnt FROM trades WHERE status='OPEN' AND date(entry_date) < date('now')").get();
console.log(JSON.stringify({stale: stale.cnt, overnight: overnight.cnt}));
