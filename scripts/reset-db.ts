/**
 * SWJSH — Database Reset Script
 * Wipes all trades, signals, and journal entries. Run once to start clean.
 * Usage: npx tsx scripts/reset-db.ts
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'journal.db');
const db = new Database(DB_PATH);

const before = {
    trades:  (db.prepare('SELECT COUNT(*) as n FROM trades').get() as any).n,
    signals: (db.prepare('SELECT COUNT(*) as n FROM signals').get() as any).n,
    journal: (db.prepare('SELECT COUNT(*) as n FROM journal_entries').get() as any).n,
};

console.log('\nBefore wipe:');
console.log(`  trades:          ${before.trades}`);
console.log(`  signals:         ${before.signals}`);
console.log(`  journal entries: ${before.journal}`);

db.transaction(() => {
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM signals').run();
    db.prepare('DELETE FROM journal_entries').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('trades', 'signals')").run();
})();

const after = {
    trades:  (db.prepare('SELECT COUNT(*) as n FROM trades').get() as any).n,
    signals: (db.prepare('SELECT COUNT(*) as n FROM signals').get() as any).n,
};

console.log('\nAfter wipe:');
console.log(`  trades:  ${after.trades}`);
console.log(`  signals: ${after.signals}`);
console.log('\n✓ Database clean. Next trade will be id=1.\n');

db.close();
