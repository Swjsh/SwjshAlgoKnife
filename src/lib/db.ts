// import Database from 'better-sqlite3'; // Converted to require for build safety
import path from 'path';

// Initialize DB
const dbPath = path.join(process.cwd(), 'journal.db');
let db: any;

try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
  });
} catch (error) {
  console.warn("⚠️ Failed to load better-sqlite3 (likely build environment or Vercel). Using mock DB.");
  // Mock DB for build time or serverless environments where sqlite is missing
  db = {
    prepare: () => ({
      run: () => ({ lastInsertRowid: 0 }),
      get: () => null,
      all: () => []
    }),
    transaction: (fn: any) => () => fn(),
    exec: () => { }
  };
}

// Create Tables
export function initDB() {
  const createTradesTable = `
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL CHECK(direction IN ('LONG', 'SHORT')),
      entry_price REAL,
      exit_price REAL,
      size REAL,
      strategy TEXT,
      status TEXT CHECK(status IN ('OPEN', 'CLOSED', 'WIN', 'LOSS', 'BE')),
      pnl REAL,
      notes TEXT,
      entry_date TEXT NOT NULL,
      exit_date TEXT,
      screenshot_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createSignalsTable = `
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      symbol TEXT NOT NULL,
      strategy TEXT,
      action TEXT NOT NULL,
      price REAL,
      payload TEXT,
      processed INTEGER DEFAULT 0
    );
  `;

  const createJournalTable = `
    CREATE TABLE IF NOT EXISTS journal_entries (
      date TEXT PRIMARY KEY,
      daily_pnl REAL DEFAULT 0,
      mood TEXT,
      notes TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createSettingsTable = `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.transaction(() => {
    db.exec(createTradesTable);
    db.exec(createSignalsTable);
    db.exec(createJournalTable);
    db.exec(createSettingsTable);
  })();

  if (process.env.NODE_ENV === 'development') {
    console.log("Database initialized");
  }
}

export default db;
