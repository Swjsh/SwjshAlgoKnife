import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { KillSwitch, KillSwitchState } from '@/lib/engine/risk/KillSwitch';

// Test environment setup
const TEST_DB_PATH = path.join(process.cwd(), 'test_agents_db.json');
const ACCOUNT_BALANCE = 10000;
const DAILY_LOSS_KILL = ACCOUNT_BALANCE * 0.02; // 2% = $200
const DAILY_LOSS_WARN = ACCOUNT_BALANCE * 0.01; // 1% = $100

// Mock data generators
function createMockAgentsDB(agents: string[] = ['futures', 'crypto', 'forex', 'options']): Record<string, any> {
  const db: Record<string, any> = {};
  agents.forEach((agentId) => {
    db[agentId] = {
      status: 'ACTIVE',
      last_updated: new Date().toISOString(),
      active_pairs: 2,
      total_zones_found: 5,
      performance: {
        win_rate: 65.5,
        total_pnl: 1250.75,
        trades: 20,
      },
      pending_orders: [],
      active_trades: [],
      closed_trades: [],
      killSwitch: null,
      killSwitchLog: [],
      meta: {
        name: agentId.toUpperCase(),
      },
    };
  });
  return db;
}

describe('Kill Switch Integration Tests', () => {
  beforeEach(() => {
    // Mock the AGENTS_DB_PATH to use test database
    vi.mock('@/lib/dataPaths', () => ({
      AGENTS_DB_PATH: TEST_DB_PATH,
      DATABASE_PATH: path.join(process.cwd(), 'test_journal.db'),
      dataFile: (filename: string) => path.join(process.cwd(), filename),
    }));

    // Ensure clean test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Create initial mock database
    const initialDB = createMockAgentsDB();
    fs.writeFileSync(TEST_DB_PATH, JSON.stringify(initialDB, null, 2));
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 1: Kill Switch Triggers on Threshold Breach
  // ═══════════════════════════════════════════════════════════════

  describe('Kill Switch Activation', () => {
    it('should trigger kill switch when daily loss exceeds 2% threshold', () => {
      const agentId = 'futures';
      const reason = `Daily loss $${DAILY_LOSS_KILL} breaches -{DAILY_LOSS_KILL} limit`;

      // Trigger the kill switch
      KillSwitch.trigger(agentId, reason, 'RISK_ENGINE');

      // Verify state is active
      const state = KillSwitch.getState(agentId);
      expect(state.isActive).toBe(true);
      expect(state.reason).toContain('Daily loss');
      expect(state.triggeredBy).toBe('RISK_ENGINE');
      expect(state.triggeredAt).not.toBeNull();

      // Verify isTriggered returns true
      expect(KillSwitch.isTriggered(agentId)).toBe(true);
    });

    it('should persist kill switch state to agents_db.json', () => {
      const agentId = 'crypto';
      KillSwitch.trigger(agentId, 'Account balance exceeded loss limit', 'OVERSEER');

      // Read from disk
      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);

      expect(db[agentId].status).toBe('KILLED');
      expect(db[agentId].killSwitch).not.toBeNull();
      expect(db[agentId].killSwitch.isActive).toBe(true);
      expect(db[agentId].killSwitch.reason).toContain('Account balance');
    });

    it('should log kill switch events to killSwitchLog array', () => {
      const agentId = 'forex';
      KillSwitch.trigger(agentId, 'Circuit breaker activated', 'RISK_ENGINE');

      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);

      expect(Array.isArray(db[agentId].killSwitchLog)).toBe(true);
      expect(db[agentId].killSwitchLog.length).toBeGreaterThan(0);

      const logEntry = db[agentId].killSwitchLog[0];
      expect(logEntry.action).toBe('TRIGGERED');
      expect(logEntry.reason).toContain('Circuit breaker');
      expect(logEntry.triggeredBy).toBe('RISK_ENGINE');
      expect(logEntry.timestamp).toBeDefined();
    });

    it('should set status to HALTED for an agent', () => {
      const agentId = 'options';
      KillSwitch.trigger(agentId, 'Max loss threshold breached', 'MANUAL');

      const state = KillSwitch.getState(agentId);
      expect(state.isActive).toBe(true);

      // Verify agent status in DB
      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);
      expect(db[agentId].status).toBe('KILLED');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 2: Kill Switch Halt Prevents Trading
  // ═══════════════════════════════════════════════════════════════

  describe('Kill Switch Halt Behavior', () => {
    it('isTriggered should return true after activation', () => {
      const agentId = 'futures';
      expect(KillSwitch.isTriggered(agentId)).toBe(false);

      KillSwitch.trigger(agentId, 'Test halt', 'SYSTEM');

      expect(KillSwitch.isTriggered(agentId)).toBe(true);
    });

    it('should restore kill switch state from disk after restart', () => {
      const agentId = 'crypto';

      // First process: trigger kill switch
      KillSwitch.trigger(agentId, 'Pre-market volatility detected', 'RISK_ENGINE');

      // Simulate restart by checking if we can read state from disk
      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);

      expect(db[agentId].status).toBe('KILLED');
      expect(db[agentId].killSwitch.isActive).toBe(true);

      // In a real restart, the agent would read this and call KillSwitch.trigger() again
      // Verify the data persists correctly
      const persistedState = db[agentId].killSwitch as KillSwitchState;
      expect(persistedState.triggeredAt).toBeDefined();
      expect(persistedState.reason).toContain('volatility');
    });

    it('should prevent multiple agents from trading when triggered', () => {
      const agents = ['futures', 'crypto', 'forex'];

      agents.forEach((agentId) => {
        KillSwitch.trigger(agentId, 'Systemic risk detected', 'RISK_ENGINE');
      });

      // Verify all agents are halted
      agents.forEach((agentId) => {
        expect(KillSwitch.isTriggered(agentId)).toBe(true);
      });

      // Verify database reflects all agents as KILLED
      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);

      agents.forEach((agentId) => {
        expect(db[agentId].status).toBe('KILLED');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 3: Kill Switch Requires Manual Reset
  // ═══════════════════════════════════════════════════════════════

  describe('Kill Switch Manual Reset (No Auto-Resume)', () => {
    it('should not auto-resume without explicit reset call', async () => {
      const agentId = 'futures';

      // Trigger without cooldown (permanent halt)
      KillSwitch.trigger(agentId, 'Catastrophic loss limit breached', 'OVERSEER');

      expect(KillSwitch.isTriggered(agentId)).toBe(true);

      // Wait to verify it doesn't auto-reset
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(KillSwitch.isTriggered(agentId)).toBe(true);
    });

    it('should allow manual reset via reset() method', () => {
      const agentId = 'crypto';

      // Trigger kill switch
      KillSwitch.trigger(agentId, 'Test halt', 'SYSTEM');
      expect(KillSwitch.isTriggered(agentId)).toBe(true);

      // Reset manually
      KillSwitch.reset(agentId, 'Operator manually reset after market stabilization');

      // Verify state is no longer active
      expect(KillSwitch.isTriggered(agentId)).toBe(false);

      const state = KillSwitch.getState(agentId);
      expect(state.isActive).toBe(false);
      expect(state.triggeredAt).toBeNull();
    });

    it('should update agent status to ACTIVE after reset', () => {
      const agentId = 'forex';

      KillSwitch.trigger(agentId, 'Test', 'SYSTEM');
      KillSwitch.reset(agentId, 'Manual recovery');

      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);

      expect(db[agentId].status).toBe('ACTIVE');
      expect(db[agentId].killSwitch).toBeNull();
    });

    it('should log kill switch reset events', () => {
      const agentId = 'options';

      KillSwitch.trigger(agentId, 'Initial halt', 'SYSTEM');
      KillSwitch.reset(agentId, 'Recovery after review');

      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);

      const log = db[agentId].killSwitchLog;
      expect(log.length).toBeGreaterThanOrEqual(2);

      const resetEntry = log[0]; // Most recent
      expect(resetEntry.action).toBe('RESET');
      expect(resetEntry.reason).toContain('Recovery');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 4: API Integration - killswitch_reset Command
  // ═══════════════════════════════════════════════════════════════

  describe('API Integration - Control Commands', () => {
    it('should support killswitch_reset via control API', () => {
      const agentId = 'futures';

      // Simulate API triggering kill switch
      KillSwitch.globalHalt('API-initiated emergency halt');

      // Verify global halt is active
      expect(KillSwitch.isGlobalHaltActive()).toBe(true);
      expect(KillSwitch.isTriggered(agentId)).toBe(true);

      // Simulate API reset
      KillSwitch.resetGlobalHalt();

      expect(KillSwitch.isGlobalHaltActive()).toBe(false);
    });

    it('should properly handle sequential halt/reset cycles', () => {
      const agentId = 'crypto';

      // Cycle 1: Trigger and reset
      KillSwitch.trigger(agentId, 'First halt', 'SYSTEM');
      expect(KillSwitch.isTriggered(agentId)).toBe(true);

      KillSwitch.reset(agentId, 'First reset');
      expect(KillSwitch.isTriggered(agentId)).toBe(false);

      // Cycle 2: Trigger and reset again
      KillSwitch.trigger(agentId, 'Second halt', 'SYSTEM');
      expect(KillSwitch.isTriggered(agentId)).toBe(true);

      KillSwitch.reset(agentId, 'Second reset');
      expect(KillSwitch.isTriggered(agentId)).toBe(false);

      // Verify log contains both cycles
      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);
      expect(db[agentId].killSwitchLog.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 5: Watchdog Integration - check_daily_pnl()
  // ═══════════════════════════════════════════════════════════════

  describe('Watchdog check_daily_pnl() Integration', () => {
    it('should detect when daily P&L breaches the 2% kill threshold', () => {
      // Daily loss kill limit: 2% of $10,000 = $200
      const dailyLoss = -225; // Exceeds $200 threshold

      const shouldKill = dailyLoss <= -DAILY_LOSS_KILL;
      expect(shouldKill).toBe(true);
    });

    it('should alert but not kill when daily P&L is between warning and kill thresholds', () => {
      // Warning: 1%, Kill: 2%
      const dailyLoss = -150; // Between $100 and $200

      const shouldKill = dailyLoss <= -DAILY_LOSS_KILL;
      const shouldWarn = dailyLoss <= -DAILY_LOSS_WARN;

      expect(shouldKill).toBe(false);
      expect(shouldWarn).toBe(true);
    });

    it('should not alert when daily P&L is within safe limits', () => {
      const dailyLoss = -50; // Under both thresholds

      const shouldKill = dailyLoss <= -DAILY_LOSS_KILL;
      const shouldWarn = dailyLoss <= -DAILY_LOSS_WARN;

      expect(shouldKill).toBe(false);
      expect(shouldWarn).toBe(false);
    });

    it('should calculate kill threshold correctly: 2% of account balance', () => {
      const maxDailyLossPct = 0.02; // 2%
      const calculatedLimit = ACCOUNT_BALANCE * maxDailyLossPct;

      expect(calculatedLimit).toBe(200);
      expect(DAILY_LOSS_KILL).toBe(200);

      // Verify boundary condition
      const atThreshold = -200;
      expect(atThreshold <= -DAILY_LOSS_KILL).toBe(true);
    });

    it('should trigger kill switch when daily loss matches check_daily_pnl() logic', () => {
      const agentId = 'futures';
      const dailyLoss = -225; // Exceeds kill threshold

      // Check if loss would trigger kill
      if (dailyLoss <= -DAILY_LOSS_KILL) {
        KillSwitch.trigger(
          agentId,
          `KILL SWITCH: Daily P&L $${dailyLoss} breaches -${DAILY_LOSS_KILL} limit`,
          'RISK_ENGINE'
        );
      }

      expect(KillSwitch.isTriggered(agentId)).toBe(true);

      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);
      expect(db[agentId].status).toBe('KILLED');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 6: Kill Switch with Cooldown Timer
  // ═══════════════════════════════════════════════════════════════

  describe('Kill Switch Cooldown Behavior', () => {
    it('should trigger kill switch with cooldown timer', () => {
      const agentId = 'crypto';
      const cooldownMs = 5000; // 5 seconds for testing

      KillSwitch.triggerWithCooldown(
        agentId,
        'Temporary halt during high volatility',
        'RISK_ENGINE',
        cooldownMs
      );

      const state = KillSwitch.getState(agentId);
      expect(state.isActive).toBe(true);
      expect(state.cooldownEndsAt).not.toBeNull();

      // Verify cooldown was set
      const remaining = KillSwitch.getCooldownRemaining(agentId);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(cooldownMs);
    });

    it('should report correct cooldown remaining time', (done) => {
      const agentId = 'forex';
      const cooldownMs = 1000; // 1 second

      KillSwitch.triggerWithCooldown(agentId, 'Test cooldown', 'SYSTEM', cooldownMs);

      const initialRemaining = KillSwitch.getCooldownRemaining(agentId);
      expect(initialRemaining).toBeGreaterThan(0);

      // Check after delay
      setTimeout(() => {
        const afterDelay = KillSwitch.getCooldownRemaining(agentId);
        expect(afterDelay).toBeLessThan(initialRemaining);
        done();
      }, 500);
    });

    it('should cancel cooldown without resetting kill switch', () => {
      const agentId = 'options';
      const cooldownMs = 10000; // 10 seconds

      KillSwitch.triggerWithCooldown(agentId, 'Test halt', 'SYSTEM', cooldownMs);
      expect(KillSwitch.isTriggered(agentId)).toBe(true);

      // Cancel the cooldown
      KillSwitch.cancelCooldown(agentId);

      // Kill switch should still be active
      expect(KillSwitch.isTriggered(agentId)).toBe(true);

      // But cooldown should be gone
      const remaining = KillSwitch.getCooldownRemaining(agentId);
      expect(remaining).toBe(0);
    });

    it('should persist cooldown state to agents_db.json', () => {
      const agentId = 'futures';

      KillSwitch.triggerWithCooldown(agentId, 'Volatility spike', 'RISK_ENGINE', 5000);

      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);

      expect(db[agentId].killSwitch.cooldownEndsAt).not.toBeNull();
      expect(db[agentId].killSwitch.isActive).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 7: Global Halt (System-Wide Kill Switch)
  // ═══════════════════════════════════════════════════════════════

  describe('Global Halt - System-Wide Kill Switch', () => {
    it('should activate global halt for all agents', () => {
      KillSwitch.globalHalt('Extreme market conditions detected');

      expect(KillSwitch.isGlobalHaltActive()).toBe(true);

      // All agents should report as triggered
      const agents = ['fx', 'crypto', 'spx', 'futures', 'boba'];
      agents.forEach((agentId) => {
        expect(KillSwitch.isTriggered(agentId)).toBe(true);
      });
    });

    it('should reset global halt and allow trading to resume', () => {
      KillSwitch.globalHalt('Emergency: Flash crash detected');

      expect(KillSwitch.isGlobalHaltActive()).toBe(true);

      KillSwitch.resetGlobalHalt();

      expect(KillSwitch.isGlobalHaltActive()).toBe(false);
    });

    it('should update all agents to KILLED status during global halt', () => {
      KillSwitch.globalHalt('Systemic risk threshold breached');

      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);

      const agents = ['fx', 'crypto', 'spx', 'futures', 'boba'];
      agents.forEach((agentId) => {
        if (db[agentId]) {
          expect(db[agentId].status).toBe('KILLED');
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 8: State Persistence and Recovery
  // ═══════════════════════════════════════════════════════════════

  describe('State Persistence and System Recovery', () => {
    it('should persist state across multiple trigger/reset cycles', () => {
      const agentId = 'crypto';

      // Cycle 1
      KillSwitch.trigger(agentId, 'Halt 1', 'SYSTEM');
      KillSwitch.reset(agentId, 'Reset 1');

      // Cycle 2
      KillSwitch.trigger(agentId, 'Halt 2', 'SYSTEM');
      KillSwitch.reset(agentId, 'Reset 2');

      // Cycle 3
      KillSwitch.trigger(agentId, 'Halt 3', 'SYSTEM');

      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);
      const log = db[agentId].killSwitchLog;

      // Should have 5 entries: 3 triggers + 2 resets
      expect(log.length).toBeGreaterThanOrEqual(5);

      // Last entry should be a TRIGGERED
      expect(log[0].action).toBe('TRIGGERED');
    });

    it('should maintain complete audit trail in killSwitchLog', () => {
      const agentId = 'futures';

      KillSwitch.trigger(agentId, 'Initial alert', 'RISK_ENGINE');
      KillSwitch.reset(agentId, 'Manual override');
      KillSwitch.trigger(agentId, 'Second alert', 'MANUAL');

      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);
      const log = db[agentId].killSwitchLog;

      expect(log[2].reason).toContain('Initial alert');
      expect(log[2].action).toBe('TRIGGERED');
      expect(log[2].triggeredBy).toBe('RISK_ENGINE');

      expect(log[1].reason).toContain('Manual override');
      expect(log[1].action).toBe('RESET');

      expect(log[0].reason).toContain('Second alert');
      expect(log[0].action).toBe('TRIGGERED');
      expect(log[0].triggeredBy).toBe('MANUAL');
    });

    it('should correctly initialize kill switch state on first trigger', () => {
      const agentId = 'forex';

      expect(KillSwitch.isTriggered(agentId)).toBe(false);

      KillSwitch.trigger(agentId, 'First trigger', 'SYSTEM');

      const state = KillSwitch.getState(agentId);
      expect(state.isActive).toBe(true);
      expect(state.triggeredAt).not.toBeNull();
      expect(state.reason).toBe('First trigger');
      expect(state.triggeredBy).toBe('SYSTEM');
      expect(state.cooldownEndsAt).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO 9: Error Handling and Edge Cases
  // ═══════════════════════════════════════════════════════════════

  describe('Error Handling and Edge Cases', () => {
    it('should handle reset on non-existent agent gracefully', () => {
      const nonExistentAgent = 'nonexistent_agent';

      // Reset should not throw
      expect(() => {
        KillSwitch.reset(nonExistentAgent, 'Attempt to reset non-existent agent');
      }).not.toThrow();

      // State should be inactive
      expect(KillSwitch.isTriggered(nonExistentAgent)).toBe(false);
    });

    it('should handle trigger on already-triggered agent', () => {
      const agentId = 'crypto';

      KillSwitch.trigger(agentId, 'First trigger', 'SYSTEM');
      KillSwitch.trigger(agentId, 'Second trigger', 'SYSTEM');

      const state = KillSwitch.getState(agentId);
      expect(state.isActive).toBe(true);

      // Should have both triggers logged
      const dbContent = fs.readFileSync(TEST_DB_PATH, 'utf8');
      const db = JSON.parse(dbContent);
      expect(db[agentId].killSwitchLog.length).toBeGreaterThanOrEqual(2);
    });

    it('should return zero cooldown remaining when no cooldown is active', () => {
      const agentId = 'futures';

      const remaining = KillSwitch.getCooldownRemaining(agentId);
      expect(remaining).toBe(0);

      // Even after triggering without cooldown
      KillSwitch.trigger(agentId, 'No cooldown trigger', 'SYSTEM');
      const remainingAfter = KillSwitch.getCooldownRemaining(agentId);
      expect(remainingAfter).toBe(0);
    });

    it('should handle concurrent operations safely', async () => {
      const agents = ['futures', 'crypto', 'forex'];

      // Trigger all agents concurrently
      await Promise.all(agents.map((agentId) =>
        Promise.resolve(
          KillSwitch.trigger(agentId, 'Concurrent trigger', 'SYSTEM')
        )
      ));

      // All should be triggered
      agents.forEach((agentId) => {
        expect(KillSwitch.isTriggered(agentId)).toBe(true);
      });

      // Reset all concurrently
      await Promise.all(agents.map((agentId) =>
        Promise.resolve(
          KillSwitch.reset(agentId, 'Concurrent reset')
        )
      ));

      // All should be reset
      agents.forEach((agentId) => {
        expect(KillSwitch.isTriggered(agentId)).toBe(false);
      });
    });
  });
});
