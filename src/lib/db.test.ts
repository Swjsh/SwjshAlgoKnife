import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Test database path
const testDbPath = path.join(process.cwd(), 'test-journal.db');

describe('Database Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Close existing connection if any
    if (db) {
      try {
        db.close();
      } catch (e) {
        // Ignore if not open
      }
    }

    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {
        // Ignore if locked
      }
    }

    // Create fresh test database
    db = new Database(testDbPath);

    // Initialize schema
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
  });

  afterEach(() => {
    // Close database after each test
    if (db) {
      try {
        db.close();
      } catch (e) {
        // Ignore if already closed
      }
    }
  });

  afterAll(() => {
    // Cleanup
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Trades Table', () => {
    it('should insert a new trade', () => {
      const stmt = db.prepare(`
        INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run('ES', 'LONG', 5000.50, 1, 'ORB 15m', 'OPEN', '2026-01-01T09:30:00Z');

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBe(1);
    });

    it('should retrieve trades by status', () => {
      // Insert test data
      const insertStmt = db.prepare(`
        INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run('ES', 'LONG', 5000, 1, 'ORB 15m', 'OPEN', '2026-01-01');
      insertStmt.run('NQ', 'SHORT', 17000, 2, 'VWAP Reversion', 'CLOSED', '2026-01-01');
      insertStmt.run('BTC', 'LONG', 45000, 0.1, 'Support/Resistance', 'OPEN', '2026-01-01');

      const selectStmt = db.prepare('SELECT * FROM trades WHERE status = ?');
      const openTrades = selectStmt.all('OPEN');

      expect(openTrades).toHaveLength(2);
      expect(openTrades[0].symbol).toBe('ES');
      expect(openTrades[1].symbol).toBe('BTC');
    });

    it('should update trade with exit data and PnL', () => {
      // Insert trade
      const insertStmt = db.prepare(`
        INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run('ES', 'LONG', 5000, 1, 'ORB 15m', 'OPEN', '2026-01-01');

      // Update with exit
      const updateStmt = db.prepare(`
        UPDATE trades
        SET exit_price = ?, exit_date = ?, status = ?, pnl = ?
        WHERE id = ?
      `);

      const pnl = (5025 - 5000) * 50; // ES point value = $50
      updateStmt.run(5025, '2026-01-01T15:00:00Z', 'WIN', pnl, 1);

      const selectStmt = db.prepare('SELECT * FROM trades WHERE id = ?');
      const trade = selectStmt.get(1) as any;

      expect(trade.exit_price).toBe(5025);
      expect(trade.status).toBe('WIN');
      expect(trade.pnl).toBe(1250);
    });

    it('should enforce direction constraint', () => {
      const stmt = db.prepare(`
        INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        stmt.run('ES', 'INVALID', 5000, 1, 'ORB 15m', 'OPEN', '2026-01-01');
      }).toThrow();
    });
  });

  describe('Signals Table', () => {
    it('should insert a signal', () => {
      const stmt = db.prepare(`
        INSERT INTO signals (symbol, strategy, action, price, payload)
        VALUES (?, ?, ?, ?, ?)
      `);

      const payload = JSON.stringify({ timeframe: '15m', confidence: 'high' });
      const result = stmt.run('ES', 'ORB 15m Breakout', 'BUY', 5000.50, payload);

      expect(result.changes).toBe(1);
    });

    it('should retrieve unprocessed signals', () => {
      const insertStmt = db.prepare(`
        INSERT INTO signals (symbol, strategy, action, price, processed)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertStmt.run('ES', 'ORB 15m', 'BUY', 5000, 0);
      insertStmt.run('NQ', 'VWAP', 'SELL', 17000, 1);
      insertStmt.run('BTC', 'Support', 'BUY', 45000, 0);

      const selectStmt = db.prepare('SELECT * FROM signals WHERE processed = 0');
      const unprocessed = selectStmt.all();

      expect(unprocessed).toHaveLength(2);
    });

    it('should mark signal as processed', () => {
      const insertStmt = db.prepare(`
        INSERT INTO signals (symbol, strategy, action, price)
        VALUES (?, ?, ?, ?)
      `);

      insertStmt.run('ES', 'ORB 15m', 'BUY', 5000);

      const updateStmt = db.prepare('UPDATE signals SET processed = 1 WHERE id = ?');
      updateStmt.run(1);

      const selectStmt = db.prepare('SELECT * FROM signals WHERE id = ?');
      const signal = selectStmt.get(1) as any;

      expect(signal.processed).toBe(1);
    });
  });

  describe('Journal Entries Table', () => {
    it('should insert a journal entry', () => {
      const stmt = db.prepare(`
        INSERT INTO journal_entries (date, daily_pnl, mood, notes, tags)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        '2026-01-01',
        1250.50,
        'confident',
        'Great trading day, ORB strategy worked perfectly',
        'orb,futures,win'
      );

      expect(result.changes).toBe(1);
    });

    it('should retrieve journal entry by date', () => {
      const insertStmt = db.prepare(`
        INSERT INTO journal_entries (date, daily_pnl, mood, notes)
        VALUES (?, ?, ?, ?)
      `);

      insertStmt.run('2026-01-01', 1250, 'confident', 'Good day');
      insertStmt.run('2026-01-02', -500, 'frustrated', 'Bad day');

      const selectStmt = db.prepare('SELECT * FROM journal_entries WHERE date = ?');
      const entry = selectStmt.get('2026-01-01') as any;

      expect(entry.daily_pnl).toBe(1250);
      expect(entry.mood).toBe('confident');
    });

    it('should update journal entry', () => {
      const insertStmt = db.prepare(`
        INSERT INTO journal_entries (date, daily_pnl, mood)
        VALUES (?, ?, ?)
      `);

      insertStmt.run('2026-01-01', 1000, 'neutral');

      const updateStmt = db.prepare(`
        UPDATE journal_entries
        SET daily_pnl = ?, mood = ?, notes = ?
        WHERE date = ?
      `);

      updateStmt.run(1500, 'confident', 'Updated after final trade', '2026-01-01');

      const selectStmt = db.prepare('SELECT * FROM journal_entries WHERE date = ?');
      const entry = selectStmt.get('2026-01-01') as any;

      expect(entry.daily_pnl).toBe(1500);
      expect(entry.mood).toBe('confident');
      expect(entry.notes).toBe('Updated after final trade');
    });

    it('should enforce date as primary key', () => {
      const stmt = db.prepare(`
        INSERT INTO journal_entries (date, daily_pnl)
        VALUES (?, ?)
      `);

      stmt.run('2026-01-01', 1000);

      expect(() => {
        stmt.run('2026-01-01', 2000);
      }).toThrow();
    });
  });

  describe('Settings Table', () => {
    it('should insert a setting', () => {
      const stmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
      `);

      const result = stmt.run('ACCOUNT_BALANCE', '10000');
      expect(result.changes).toBe(1);
    });

    it('should retrieve setting by key', () => {
      const insertStmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
      `);

      insertStmt.run('RISK_PER_TRADE', '1');
      insertStmt.run('MAX_DAILY_LOSS', '500');

      const selectStmt = db.prepare('SELECT * FROM settings WHERE key = ?');
      const setting = selectStmt.get('RISK_PER_TRADE') as any;

      expect(setting.value).toBe('1');
    });

    it('should update setting value', () => {
      const insertStmt = db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
      `);

      insertStmt.run('ACCOUNT_BALANCE', '10000');

      const updateStmt = db.prepare(`
        UPDATE settings SET value = ? WHERE key = ?
      `);

      updateStmt.run('15000', 'ACCOUNT_BALANCE');

      const selectStmt = db.prepare('SELECT * FROM settings WHERE key = ?');
      const setting = selectStmt.get('ACCOUNT_BALANCE') as any;

      expect(setting.value).toBe('15000');
    });
  });

  describe('Transaction Handling', () => {
    it('should rollback on error', () => {
      const insertTrade = db.prepare(`
        INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertSignal = db.prepare(`
        INSERT INTO signals (symbol, strategy, action, price)
        VALUES (?, ?, ?, ?)
      `);

      expect(() => {
        db.transaction(() => {
          insertTrade.run('ES', 'LONG', 5000, 1, 'ORB', 'OPEN', '2026-01-01');
          insertSignal.run('ES', 'ORB', 'BUY', 5000);
          // This should fail and rollback
          insertTrade.run('NQ', 'INVALID_DIRECTION', 17000, 1, 'VWAP', 'OPEN', '2026-01-01');
        })();
      }).toThrow();

      // Verify rollback - no records should exist
      const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get() as any;
      const signalCount = db.prepare('SELECT COUNT(*) as count FROM signals').get() as any;

      expect(tradeCount.count).toBe(0);
      expect(signalCount.count).toBe(0);
    });

    it('should commit successful transaction', () => {
      const insertTrade = db.prepare(`
        INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertSignal = db.prepare(`
        INSERT INTO signals (symbol, strategy, action, price)
        VALUES (?, ?, ?, ?)
      `);

      db.transaction(() => {
        insertTrade.run('ES', 'LONG', 5000, 1, 'ORB', 'OPEN', '2026-01-01');
        insertSignal.run('ES', 'ORB', 'BUY', 5000);
      })();

      const tradeCount = db.prepare('SELECT COUNT(*) as count FROM trades').get() as any;
      const signalCount = db.prepare('SELECT COUNT(*) as count FROM signals').get() as any;

      expect(tradeCount.count).toBe(1);
      expect(signalCount.count).toBe(1);
    });
  });
});
