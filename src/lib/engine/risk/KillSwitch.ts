// ═══════════════════════════════════════════════════════════════
// KILL SWITCH - Emergency Halt System
// "Better to miss a winning trade than survive a catastrophic loss."
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { AGENTS_DB_PATH } from '../../dataPaths';

const DB_PATH = AGENTS_DB_PATH;

export interface KillSwitchState {
    isActive: boolean;
    triggeredAt: string | null;
    reason: string | null;
    triggeredBy: string | null; // 'MANUAL' | 'OVERSEER' | 'RISK_ENGINE'
    cooldownEndsAt: string | null; // ISO timestamp when auto-reset fires
}

// Cooldown timers: agentId → NodeJS.Timeout
const cooldownTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

export interface KillSwitchLog {
    timestamp: string;
    action: 'TRIGGERED' | 'RESET';
    reason: string;
    triggeredBy: string;
}

// In-memory state (for fast checks)
const killSwitchStates: Map<string, KillSwitchState> = new Map();

// Global halt flag
let GLOBAL_HALT = false;

export class KillSwitch {
    /**
     * Trigger the kill switch for an agent.
     * Immediately halts all trading for that agent.
     */
    static trigger(agentId: string, reason: string, triggeredBy: string = 'SYSTEM'): void {
        console.log(`🛑 [KILL SWITCH] TRIGGERED for ${agentId.toUpperCase()}: ${reason}`);

        const state: KillSwitchState = {
            isActive: true,
            triggeredAt: new Date().toISOString(),
            reason,
            triggeredBy,
            cooldownEndsAt: null,
        };

        killSwitchStates.set(agentId, state);

        // Persist to DB
        try {
            const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            if (db[agentId]) {
                db[agentId].status = 'KILLED';
                db[agentId].killSwitch = state;

                // Add to kill switch log
                if (!db[agentId].killSwitchLog) {
                    db[agentId].killSwitchLog = [];
                }
                db[agentId].killSwitchLog.unshift({
                    timestamp: state.triggeredAt,
                    action: 'TRIGGERED',
                    reason,
                    triggeredBy,
                });

                fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            }
        } catch (e) {
            console.error('❌ [KILL SWITCH] Failed to persist state:', e);
        }
    }

    /**
     * Trigger the kill switch with an auto-reset cooldown timer.
     * After `cooldownMs` milliseconds the switch resets automatically.
     * If called again before the cooldown expires, the timer resets.
     *
     * @param agentId   - e.g. 'crypto', 'fx'
     * @param reason    - Human-readable trigger reason
     * @param triggeredBy - 'MANUAL' | 'OVERSEER' | 'RISK_ENGINE'
     * @param cooldownMs  - Auto-reset delay in ms (default: 30 minutes)
     */
    static triggerWithCooldown(
        agentId: string,
        reason: string,
        triggeredBy: string = 'RISK_ENGINE',
        cooldownMs: number = 30 * 60 * 1000,
    ): void {
        // Clear any existing cooldown timer for this agent
        const existing = cooldownTimers.get(agentId);
        if (existing) {
            clearTimeout(existing);
            cooldownTimers.delete(agentId);
        }

        const cooldownEndsAt = new Date(Date.now() + cooldownMs).toISOString();
        const state: KillSwitchState = {
            isActive: true,
            triggeredAt: new Date().toISOString(),
            reason,
            triggeredBy,
            cooldownEndsAt,
        };

        killSwitchStates.set(agentId, state);

        console.log(`🛑 [KILL SWITCH] TRIGGERED w/ cooldown for ${agentId.toUpperCase()}: ${reason}`);
        console.log(`   ⏱  Auto-reset in ${Math.round(cooldownMs / 60000)}m at ${cooldownEndsAt}`);

        // Persist to DB with cooldown info
        try {
            const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            if (db[agentId]) {
                db[agentId].status = 'KILLED';
                db[agentId].killSwitch = state;
                if (!db[agentId].killSwitchLog) db[agentId].killSwitchLog = [];
                db[agentId].killSwitchLog.unshift({
                    timestamp: state.triggeredAt,
                    action: 'TRIGGERED',
                    reason: `${reason} [cooldown: ${Math.round(cooldownMs / 60000)}m]`,
                    triggeredBy,
                });
                fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            }
        } catch (e) {
            console.error('❌ [KILL SWITCH] Failed to persist cooldown state:', e);
        }

        // Schedule auto-reset
        const timer = setTimeout(() => {
            console.log(`⏰ [KILL SWITCH] Auto-reset cooldown expired for ${agentId.toUpperCase()} — resuming`);
            KillSwitch.reset(agentId, `Auto-reset after ${Math.round(cooldownMs / 60000)}m cooldown`);
            cooldownTimers.delete(agentId);
        }, cooldownMs);

        // Don't let this timer keep the Node process alive
        if (timer.unref) timer.unref();
        cooldownTimers.set(agentId, timer);
    }

    /**
     * Get milliseconds remaining on the cooldown for an agent.
     * Returns 0 if no cooldown is active.
     */
    static getCooldownRemaining(agentId: string): number {
        const state = killSwitchStates.get(agentId);
        if (!state?.isActive || !state.cooldownEndsAt) return 0;

        const remaining = new Date(state.cooldownEndsAt).getTime() - Date.now();
        return Math.max(0, remaining);
    }

    /**
     * Cancel an active cooldown timer without resetting the kill switch.
     * Use this if you want to manually take over after a cooldown trigger.
     */
    static cancelCooldown(agentId: string): void {
        const timer = cooldownTimers.get(agentId);
        if (timer) {
            clearTimeout(timer);
            cooldownTimers.delete(agentId);
            console.log(`🔕 [KILL SWITCH] Cooldown cancelled for ${agentId.toUpperCase()} — kill switch remains active`);

            // Update state to remove cooldownEndsAt
            const state = killSwitchStates.get(agentId);
            if (state) {
                killSwitchStates.set(agentId, { ...state, cooldownEndsAt: null });
            }
        }
    }

    /**
     * Check if an agent's kill switch is active.
     */
    static isTriggered(agentId: string): boolean {
        if (GLOBAL_HALT) return true;

        const state = killSwitchStates.get(agentId);
        if (state?.isActive) return true;

        // Also check DB in case of restart
        try {
            const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            if (db[agentId]?.status === 'KILLED') {
                return true;
            }
        } catch {
            // Fail safe - if we can't read, assume active
        }

        return false;
    }

    /**
     * Reset the kill switch for an agent.
     * Allows trading to resume.
     */
    static reset(agentId: string, reason: string = 'Manual reset'): void {
        console.log(`✅ [KILL SWITCH] RESET for ${agentId.toUpperCase()}: ${reason}`);

        // Cancel any pending cooldown timer
        const timer = cooldownTimers.get(agentId);
        if (timer) {
            clearTimeout(timer);
            cooldownTimers.delete(agentId);
        }

        killSwitchStates.set(agentId, {
            isActive: false,
            triggeredAt: null,
            reason: null,
            triggeredBy: null,
            cooldownEndsAt: null,
        });

        // Persist to DB
        try {
            const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            if (db[agentId]) {
                db[agentId].status = 'ACTIVE';
                db[agentId].killSwitch = null;

                // Log the reset
                if (!db[agentId].killSwitchLog) {
                    db[agentId].killSwitchLog = [];
                }
                db[agentId].killSwitchLog.unshift({
                    timestamp: new Date().toISOString(),
                    action: 'RESET',
                    reason,
                    triggeredBy: 'MANUAL',
                });

                fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
            }
        } catch (e) {
            console.error('❌ [KILL SWITCH] Failed to persist reset:', e);
        }
    }

    /**
     * Get the current state of an agent's kill switch.
     */
    static getState(agentId: string): KillSwitchState {
        return killSwitchStates.get(agentId) || {
            isActive: false,
            triggeredAt: null,
            reason: null,
            triggeredBy: null,
            cooldownEndsAt: null,
        };
    }

    /**
     * GLOBAL HALT - Stops ALL agents system-wide.
     */
    static globalHalt(reason: string): void {
        console.log(`🚨 [KILL SWITCH] GLOBAL HALT ACTIVATED: ${reason}`);
        GLOBAL_HALT = true;

        // Trigger kill switch on all known agents
        const agents = ['fx', 'crypto', 'spx', 'futures', 'boba'];
        agents.forEach(agent => {
            this.trigger(agent, `GLOBAL HALT: ${reason}`, 'OVERSEER');
        });
    }

    /**
     * Reset global halt.
     */
    static resetGlobalHalt(): void {
        console.log('✅ [KILL SWITCH] Global halt RESET');
        GLOBAL_HALT = false;
    }

    /**
     * Check if global halt is active.
     */
    static isGlobalHaltActive(): boolean {
        return GLOBAL_HALT;
    }
}
