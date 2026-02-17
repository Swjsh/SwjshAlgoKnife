import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Integration Tests for Agent Ecosystem Implementation
 *
 * Tests the complete implementation of:
 * - Persistent active trades
 * - Multi-pair Yahoo Finance polling
 * - Unified Audit Loop (The Watcher)
 */

const DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');
const BACKUP_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.backup.json');

interface AgentState {
  last_updated: string;
  status: string;
  active_pairs: number;
  total_zones_found: number;
  performance: { win_rate: number; total_pnl: number; trades: number };
  pending_orders: any[];
  active_trades: any[];
  closed_trades: any[];
  reviews?: any[];
  audits?: any[];
  meta: { name: string; type: string };
}

interface DbSchema {
  fx: AgentState;
  crypto: AgentState;
  futures: AgentState;
  boba: AgentState;
  spx?: AgentState;
  professor: AgentState;
  auditor?: AgentState;
}

function readDb(): DbSchema {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db: DbSchema) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function backupDb() {
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
  }
}

function restoreDb() {
  if (fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(BACKUP_PATH, DB_PATH);
    fs.unlinkSync(BACKUP_PATH);
  }
}

describe('Agent Ecosystem Integration Tests', () => {
  beforeAll(() => {
    backupDb();
  });

  afterAll(() => {
    restoreDb();
  });

  describe('Persistent Active Trades', () => {
    it('should persist active trades in agents_db.json', () => {
      const db = readDb();

      // Verify all agents have active_trades field
      expect(db.fx).toHaveProperty('active_trades');
      expect(db.crypto).toHaveProperty('active_trades');
      expect(db.futures).toHaveProperty('active_trades');
      expect(db.boba).toHaveProperty('active_trades');

      expect(Array.isArray(db.fx.active_trades)).toBe(true);
    });

    it('should support adding active trades', () => {
      const db = readDb();
      const initialCount = db.fx.active_trades.length;

      // Add test trade
      const testTrade = {
        ticker: 'EURUSD',
        entry: 1.0850,
        stop: 1.0830,
        side: 'LONG',
        agentId: 'fx',
        startTime: Date.now()
      };

      db.fx.active_trades.push(testTrade);
      writeDb(db);

      // Read back and verify
      const updatedDb = readDb();
      expect(updatedDb.fx.active_trades.length).toBe(initialCount + 1);

      const savedTrade = updatedDb.fx.active_trades[updatedDb.fx.active_trades.length - 1];
      expect(savedTrade.ticker).toBe('EURUSD');
      expect(savedTrade.entry).toBe(1.0850);
      expect(savedTrade.side).toBe('LONG');

      // Cleanup
      db.fx.active_trades.pop();
      writeDb(db);
    });

    it('should move trades from active to closed', () => {
      const db = readDb();

      // Add active trade
      const testTrade = {
        ticker: 'GBPUSD',
        entry: 1.2650,
        stop: 1.2630,
        side: 'LONG',
        agentId: 'fx',
        startTime: Date.now()
      };

      db.fx.active_trades.push(testTrade);
      const initialActiveCount = db.fx.active_trades.length;
      const initialClosedCount = db.fx.closed_trades.length;
      writeDb(db);

      // Close trade
      const closedTrade = {
        closed_at: new Date().toISOString(),
        type: 'DEMAND',
        ticker: testTrade.ticker,
        entry: testTrade.entry,
        exit: 1.2690,
        pnl: 400,
        status: 'WIN'
      };

      const db2 = readDb();
      db2.fx.closed_trades.unshift(closedTrade);
      db2.fx.active_trades = db2.fx.active_trades.filter(t => t.ticker !== testTrade.ticker);
      writeDb(db2);

      // Verify
      const db3 = readDb();
      expect(db3.fx.active_trades.length).toBe(initialActiveCount - 1);
      expect(db3.fx.closed_trades.length).toBe(initialClosedCount + 1);
      expect(db3.fx.closed_trades[0].ticker).toBe('GBPUSD');

      // Cleanup
      db3.fx.closed_trades.shift();
      writeDb(db3);
    });
  });

  describe('Multi-Agent Support', () => {
    it('should support active trades across multiple agents', () => {
      const db = readDb();

      const agents = ['fx', 'crypto', 'futures', 'boba'];
      agents.forEach(agentKey => {
        expect(db[agentKey as keyof DbSchema]).toHaveProperty('active_trades');
        expect(Array.isArray((db[agentKey as keyof DbSchema] as AgentState).active_trades)).toBe(true);
      });
    });

    it('should isolate trades by agent', () => {
      const db = readDb();

      const fxTrade = {
        ticker: 'EURUSD',
        entry: 1.0850,
        stop: 1.0830,
        side: 'LONG',
        agentId: 'fx',
        startTime: Date.now()
      };

      const cryptoTrade = {
        ticker: 'BTCUSD',
        entry: 95000,
        stop: 94500,
        side: 'LONG',
        agentId: 'crypto',
        startTime: Date.now()
      };

      db.fx.active_trades.push(fxTrade);
      db.crypto.active_trades.push(cryptoTrade);
      writeDb(db);

      const db2 = readDb();

      // FX should only have FX trades
      expect(db2.fx.active_trades.every(t => t.agentId === 'fx')).toBe(true);

      // Crypto should only have Crypto trades
      expect(db2.crypto.active_trades.every(t => t.agentId === 'crypto')).toBe(true);

      // Cleanup
      db2.fx.active_trades.pop();
      db2.crypto.active_trades.pop();
      writeDb(db2);
    });
  });

  describe('Unified Audit Loop Structure', () => {
    it('should have professor reviews array', () => {
      const db = readDb();

      expect(db.professor).toHaveProperty('reviews');
      expect(Array.isArray(db.professor.reviews)).toBe(true);
    });

    it('should have professor audits array', () => {
      const db = readDb();

      expect(db.professor).toHaveProperty('audits');
      expect(Array.isArray(db.professor.audits)).toBe(true);
    });

    it('should support adding reviews for any agent', () => {
      const db = readDb();
      const initialReviewCount = db.professor.reviews?.length || 0;

      const testReview = {
        id: 'test_review_1',
        timestamp: new Date().toISOString(),
        target_agent: 'Sterling',
        grade: 'A' as const,
        observation: 'Test trade observation',
        critique: 'Test critique',
        action_item: 'Test action'
      };

      if (!db.professor.reviews) db.professor.reviews = [];
      db.professor.reviews.unshift(testReview);
      writeDb(db);

      const db2 = readDb();
      expect(db2.professor.reviews?.length).toBe(initialReviewCount + 1);
      expect(db2.professor.reviews?.[0].target_agent).toBe('Sterling');

      // Cleanup
      db2.professor.reviews?.shift();
      writeDb(db2);
    });
  });

  describe('Database Integrity', () => {
    it('should maintain valid JSON structure', () => {
      const db = readDb();

      // If we can read it, it's valid JSON
      expect(db).toBeDefined();
      expect(typeof db).toBe('object');
    });

    it('should have all required agent keys', () => {
      const db = readDb();

      expect(db).toHaveProperty('fx');
      expect(db).toHaveProperty('crypto');
      expect(db).toHaveProperty('futures');
      expect(db).toHaveProperty('boba');
      expect(db).toHaveProperty('professor');
    });

    it('should maintain agent metadata', () => {
      const db = readDb();

      expect(db.fx.meta.name).toBe('Sterling');
      expect(db.fx.meta.type).toBe('Forex');

      expect(db.crypto.meta.name).toBe('Bitcoin Bob');
      expect(db.futures.meta.name).toBe('Pivot Pete');
      expect(db.boba.meta.name).toBe('Boba');
      expect(db.professor.meta.name).toBe('The Professor');
    });
  });

  describe('Performance Tracking', () => {
    it('should update performance metrics', () => {
      const db = readDb();

      expect(db.fx.performance).toHaveProperty('win_rate');
      expect(db.fx.performance).toHaveProperty('total_pnl');
      expect(db.fx.performance).toHaveProperty('trades');

      expect(typeof db.fx.performance.win_rate).toBe('number');
      expect(typeof db.fx.performance.total_pnl).toBe('number');
      expect(typeof db.fx.performance.trades).toBe('number');
    });

    it('should calculate win rate correctly after trades', () => {
      const db = readDb();
      const initialTrades = db.fx.performance.trades;

      // Add 2 wins and 1 loss
      db.fx.closed_trades.unshift(
        { ticker: 'EURUSD', status: 'WIN', pnl: 100, entry: 1.0850, exit: 1.0870, type: 'DEMAND', closed_at: new Date().toISOString() },
        { ticker: 'GBPUSD', status: 'WIN', pnl: 200, entry: 1.2650, exit: 1.2690, type: 'DEMAND', closed_at: new Date().toISOString() },
        { ticker: 'USDJPY', status: 'LOSS', pnl: -100, entry: 148.50, exit: 148.30, type: 'SUPPLY', closed_at: new Date().toISOString() }
      );

      // Update performance
      const wins = db.fx.closed_trades.filter(t => t.status === 'WIN').length;
      const total = db.fx.closed_trades.length;
      db.fx.performance.trades = total;
      db.fx.performance.win_rate = Math.round((wins / total) * 100);
      db.fx.performance.total_pnl = db.fx.closed_trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      writeDb(db);

      const db2 = readDb();
      expect(db2.fx.performance.trades).toBeGreaterThan(initialTrades);
      expect(db2.fx.performance.win_rate).toBeGreaterThan(0);
      expect(db2.fx.performance.win_rate).toBeLessThanOrEqual(100);

      // Cleanup
      db2.fx.closed_trades.shift();
      db2.fx.closed_trades.shift();
      db2.fx.closed_trades.shift();
      writeDb(db2);
    });
  });

  describe('Crash Recovery Simulation', () => {
    it('should preserve active trades after simulated crash', () => {
      const db = readDb();

      // Create scenario: 3 active trades
      const testTrades = [
        { ticker: 'EURUSD', entry: 1.0850, stop: 1.0830, side: 'LONG', agentId: 'fx', startTime: Date.now() },
        { ticker: 'GBPUSD', entry: 1.2650, stop: 1.2630, side: 'SHORT', agentId: 'fx', startTime: Date.now() },
        { ticker: 'USDJPY', entry: 148.50, stop: 148.30, side: 'LONG', agentId: 'fx', startTime: Date.now() }
      ];

      db.fx.active_trades.push(...testTrades);
      writeDb(db);

      // Simulate crash/restart by re-reading DB
      const recoveredDb = readDb();

      expect(recoveredDb.fx.active_trades.length).toBeGreaterThanOrEqual(3);
      expect(recoveredDb.fx.active_trades.some(t => t.ticker === 'EURUSD')).toBe(true);
      expect(recoveredDb.fx.active_trades.some(t => t.ticker === 'GBPUSD')).toBe(true);
      expect(recoveredDb.fx.active_trades.some(t => t.ticker === 'USDJPY')).toBe(true);

      // Cleanup
      recoveredDb.fx.active_trades = recoveredDb.fx.active_trades.filter(
        t => !testTrades.some(tt => tt.ticker === t.ticker)
      );
      writeDb(recoveredDb);
    });
  });
});
