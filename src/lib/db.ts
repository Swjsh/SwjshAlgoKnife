// import Database from 'better-sqlite3'; // Converted to require for build safety
import path from 'path';
import { DATABASE_PATH } from './dataPaths';

// Initialize DB — uses DATABASE_PATH env var so production can point to a persistent volume
const dbPath = DATABASE_PATH;
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

  // ── Intelligence Bus Table ────────────────────────────────────
  const createIntelSignalsTable = `
    CREATE TABLE IF NOT EXISTS intel_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      source TEXT NOT NULL,
      symbol TEXT NOT NULL,
      signal_type TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      summary TEXT,
      payload TEXT,
      expires_at DATETIME
    );
  `;

  const createIntelIndex = `
    CREATE INDEX IF NOT EXISTS idx_intel_active
    ON intel_signals(symbol, expires_at);
  `;

  // ── Intel Preflight Log — records every go/no-go decision ─────
  const createPreflightLogTable = `
    CREATE TABLE IF NOT EXISTS intel_preflight_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      agent_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      strategy TEXT,
      decision TEXT NOT NULL CHECK(decision IN ('GO', 'NO_GO', 'REDUCED')),
      intel_score REAL,
      size_multiplier REAL,
      reason TEXT,
      signals_snapshot TEXT,
      regime TEXT,
      latency_ms INTEGER DEFAULT 0
    );
  `;

  // ── Agent Feedback Log — agents report trade outcomes back to intel ──
  const createFeedbackLogTable = `
    CREATE TABLE IF NOT EXISTS agent_feedback_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      agent_id TEXT NOT NULL,
      trade_id INTEGER,
      symbol TEXT NOT NULL,
      direction TEXT NOT NULL,
      strategy TEXT,
      outcome TEXT NOT NULL CHECK(outcome IN ('WIN', 'LOSS', 'BE', 'TIMEOUT', 'MANUAL_CLOSE')),
      pnl REAL,
      duration_minutes REAL,
      intel_score_at_entry REAL,
      intel_decision_at_entry TEXT,
      notes TEXT
    );
  `;

  const createPreflightIndex = `
    CREATE INDEX IF NOT EXISTS idx_preflight_agent_ts
    ON intel_preflight_log(agent_id, timestamp);
  `;

  const createFeedbackIndex = `
    CREATE INDEX IF NOT EXISTS idx_feedback_agent_ts
    ON agent_feedback_log(agent_id, timestamp);
  `;

  db.transaction(() => {
    db.exec(createTradesTable);
    db.exec(createSignalsTable);
    db.exec(createJournalTable);
    db.exec(createSettingsTable);
    db.exec(createIntelSignalsTable);
    db.exec(createIntelIndex);
    db.exec(createPreflightLogTable);
    db.exec(createFeedbackLogTable);
    db.exec(createPreflightIndex);
    db.exec(createFeedbackIndex);
  })();

  // ── Migration: add intel_snapshot column if it doesn't exist yet ──
  try {
    db.exec(`ALTER TABLE trades ADD COLUMN intel_snapshot TEXT DEFAULT NULL`);
  } catch {
    // Column already exists — safe to ignore
  }

  // Initialize account management tables
  try {
    const { initAccountTables, initializeAccountSystem } = require('./accounts');
    initAccountTables();
    initializeAccountSystem(100000); // $100k starting capital
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Account tables init skipped (circular dependency or build env)');
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log("Database initialized");
  }
}

// Auto-initialize on first import
try {
  initDB();
} catch (e) {
  // Silently handle — mock DB will work for build environments
  if (process.env.NODE_ENV === 'development') {
    console.error('DB auto-init failed:', e);
  }
}

export default db;
