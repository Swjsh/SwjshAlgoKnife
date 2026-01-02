// ═══════════════════════════════════════════════════════════════
// KILL SWITCH - Emergency Halt System
// "Better to miss a winning trade than survive a catastrophic loss."
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');

export interface KillSwitchState {
    isActive: boolean;
    triggeredAt: string | null;
    reason: string | null;
    triggeredBy: string | null; // 'MANUAL' | 'OVERSEER' | 'RISK_ENGINE'
}

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

        killSwitchStates.set(agentId, {
            isActive: false,
            triggeredAt: null,
            reason: null,
            triggeredBy: null,
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
