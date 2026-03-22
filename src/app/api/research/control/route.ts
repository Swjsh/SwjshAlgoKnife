/**
 * /api/research/control — Research Agent Control API
 *
 * POST /api/research/control
 *   Controls research agent lifecycle: start, stop, refresh, deploy
 *
 * Request body:
 *   - action: 'start' | 'stop' | 'refresh' | 'deploy'
 *   - terminal?: number (1-8)
 *   - agentId?: string
 *
 * Actions:
 *   - start: Start a stopped agent
 *   - stop: Stop a running agent
 *   - refresh: Trigger a resync/refresh of agent status
 *   - deploy: Deploy a new agent instance
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const CONTROL_DIR = path.join(OVERNIGHT_DIR, 'control');

// Terminal to agent mapping
const TERMINAL_AGENTS: Record<number, string> = {
    1: 'improver',
    2: 'backtester',
    3: 'researcher',
    4: 'brain_updater',
    5: 'security_auditor',
    6: 'integration_tester',
    7: 'intel_aggregator',
    8: 'devops_optimizer',
};

// Agent to terminal mapping
const AGENT_TERMINALS: Record<string, number> = Object.fromEntries(
    Object.entries(TERMINAL_AGENTS).map(([k, v]) => [v, parseInt(k, 10)])
);

type AgentAction = 'start' | 'stop' | 'refresh' | 'deploy';

interface ControlRequest {
    action: AgentAction;
    terminal?: number;
    agentId?: string;
    timestamp?: string;
}

interface ControlFile {
    action: AgentAction;
    agentId: string;
    terminal: number;
    timestamp: string;
    status: 'pending' | 'acknowledged' | 'completed';
}

async function ensureDir(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch {
        // Directory may already exist
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body: ControlRequest = await req.json();
        const { action, terminal, agentId } = body;

        // Validate action
        const validActions: AgentAction[] = ['start', 'stop', 'refresh', 'deploy'];
        if (!action || !validActions.includes(action)) {
            return NextResponse.json({
                success: false,
                error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
                timestamp: new Date().toISOString(),
            }, { status: 400 });
        }

        // Determine target terminal
        let targetTerminal: number | null = null;

        if (terminal !== undefined) {
            targetTerminal = typeof terminal === 'number' ? terminal : parseInt(String(terminal), 10);
            if (isNaN(targetTerminal) || targetTerminal < 1 || targetTerminal > 8) {
                return NextResponse.json({
                    success: false,
                    error: 'Invalid terminal number. Must be 1-8.',
                    timestamp: new Date().toISOString(),
                }, { status: 400 });
            }
        } else if (agentId) {
            targetTerminal = AGENT_TERMINALS[agentId.toLowerCase()];
            if (!targetTerminal) {
                return NextResponse.json({
                    success: false,
                    error: `Unknown agent: ${agentId}`,
                    validAgents: Object.keys(AGENT_TERMINALS),
                    timestamp: new Date().toISOString(),
                }, { status: 400 });
            }
        } else {
            return NextResponse.json({
                success: false,
                error: 'Must specify terminal (1-8) or agentId',
                timestamp: new Date().toISOString(),
            }, { status: 400 });
        }

        const targetAgentId = TERMINAL_AGENTS[targetTerminal];

        // Ensure control directory exists
        await ensureDir(CONTROL_DIR);

        // Write control file for the agent to pick up
        const controlFile: ControlFile = {
            action,
            agentId: targetAgentId,
            terminal: targetTerminal,
            timestamp: new Date().toISOString(),
            status: 'pending',
        };

        const controlPath = path.join(CONTROL_DIR, `terminal_${targetTerminal}_control.json`);
        await fs.writeFile(controlPath, JSON.stringify(controlFile, null, 2), 'utf-8');

        // Also update the status file to reflect the new state
        const statusDir = path.join(OVERNIGHT_DIR, 'status');
        await ensureDir(statusDir);
        const statusPath = path.join(statusDir, `terminal_${targetTerminal}.json`);

        let statusData: Record<string, unknown> = {};
        try {
            const existing = await fs.readFile(statusPath, 'utf-8');
            statusData = JSON.parse(existing);
        } catch {
            // File doesn't exist, start fresh
        }

        // Update status based on action
        switch (action) {
            case 'start':
            case 'deploy':
                statusData.status = 'busy';
                statusData.lastActivity = new Date().toISOString();
                statusData.lastAction = action;
                break;
            case 'stop':
                statusData.status = 'offline';
                statusData.lastAction = action;
                break;
            case 'refresh':
                statusData.lastRefresh = new Date().toISOString();
                statusData.lastAction = action;
                break;
        }

        statusData.lastUpdated = new Date().toISOString();
        await fs.writeFile(statusPath, JSON.stringify(statusData, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            action,
            terminal: targetTerminal,
            agentId: targetAgentId,
            message: `${action.charAt(0).toUpperCase() + action.slice(1)} command sent to terminal ${targetTerminal} (${targetAgentId})`,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('[research/control] Error processing control request:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process control request',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}

// GET - Check control status for a terminal
export async function GET(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    const terminalParam = url.searchParams.get('terminal');

    if (!terminalParam) {
        // Return all control statuses
        try {
            await ensureDir(CONTROL_DIR);
            const statuses: Record<number, ControlFile | null> = {};

            for (let t = 1; t <= 8; t++) {
                const controlPath = path.join(CONTROL_DIR, `terminal_${t}_control.json`);
                try {
                    const content = await fs.readFile(controlPath, 'utf-8');
                    statuses[t] = JSON.parse(content);
                } catch {
                    statuses[t] = null;
                }
            }

            return NextResponse.json({
                success: true,
                statuses,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            return NextResponse.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to read control statuses',
                timestamp: new Date().toISOString(),
            }, { status: 500 });
        }
    }

    const terminal = parseInt(terminalParam, 10);
    if (isNaN(terminal) || terminal < 1 || terminal > 8) {
        return NextResponse.json({
            success: false,
            error: 'Invalid terminal number. Must be 1-8.',
            timestamp: new Date().toISOString(),
        }, { status: 400 });
    }

    try {
        const controlPath = path.join(CONTROL_DIR, `terminal_${terminal}_control.json`);
        const content = await fs.readFile(controlPath, 'utf-8');
        const controlFile: ControlFile = JSON.parse(content);

        return NextResponse.json({
            success: true,
            terminal,
            agentId: TERMINAL_AGENTS[terminal],
            control: controlFile,
            timestamp: new Date().toISOString(),
        });
    } catch {
        return NextResponse.json({
            success: true,
            terminal,
            agentId: TERMINAL_AGENTS[terminal],
            control: null,
            message: 'No pending control action',
            timestamp: new Date().toISOString(),
        });
    }
}
