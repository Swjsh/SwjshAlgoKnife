/**
 * /api/research/command — Research Agent Command API
 *
 * POST /api/research/command
 *   Sends a command to a specific research agent or broadcasts to all
 *
 * Request body:
 *   - terminal?: number (1-8) - Target terminal
 *   - agentId?: string - Target agent ID
 *   - broadcast?: boolean - Send to all agents
 *   - command: string - The command to send
 *
 * Writes to:
 *   - .claude/overnight/commands/terminal_N_queue.json
 *   - or .claude/overnight/commands/broadcast_queue.json for broadcasts
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const COMMANDS_DIR = path.join(OVERNIGHT_DIR, 'commands');

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

interface CommandQueueEntry {
    id: string;
    command: string;
    timestamp: string;
    status: 'pending' | 'sent' | 'executed';
    source: 'dashboard' | 'api';
}

interface CommandQueue {
    terminalNumber?: number;
    agentId?: string;
    commands: CommandQueueEntry[];
    lastUpdated: string;
}

async function ensureDir(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch {
        // Directory may already exist
    }
}

async function readQueue(queuePath: string): Promise<CommandQueue> {
    try {
        const content = await fs.readFile(queuePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return {
            commands: [],
            lastUpdated: new Date().toISOString(),
        };
    }
}

async function writeQueue(queuePath: string, queue: CommandQueue): Promise<void> {
    queue.lastUpdated = new Date().toISOString();
    await fs.writeFile(queuePath, JSON.stringify(queue, null, 2), 'utf-8');
}

function generateCommandId(): string {
    return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();
        const { terminal, agentId, broadcast, command, timestamp } = body;

        if (!command || typeof command !== 'string') {
            return NextResponse.json({
                success: false,
                error: 'Missing required field: command (string)',
                timestamp: new Date().toISOString(),
            }, { status: 400 });
        }

        if (command.length > 10000) {
            return NextResponse.json({
                success: false,
                error: 'Command too long. Maximum 10000 characters.',
                timestamp: new Date().toISOString(),
            }, { status: 400 });
        }

        await ensureDir(COMMANDS_DIR);

        const commandEntry: CommandQueueEntry = {
            id: generateCommandId(),
            command: command.trim(),
            timestamp: timestamp || new Date().toISOString(),
            status: 'pending',
            source: 'dashboard',
        };

        if (broadcast) {
            // Broadcast to all terminals
            const results: { terminal: number; agentId: string; success: boolean }[] = [];

            for (let t = 1; t <= 8; t++) {
                const queuePath = path.join(COMMANDS_DIR, `terminal_${t}_queue.json`);
                const queue = await readQueue(queuePath);
                queue.terminalNumber = t;
                queue.agentId = TERMINAL_AGENTS[t];
                queue.commands.push({ ...commandEntry, id: `${commandEntry.id}-t${t}` });
                await writeQueue(queuePath, queue);
                results.push({ terminal: t, agentId: TERMINAL_AGENTS[t], success: true });
            }

            // Also write to broadcast queue for logging
            const broadcastPath = path.join(COMMANDS_DIR, 'broadcast_queue.json');
            const broadcastQueue = await readQueue(broadcastPath);
            broadcastQueue.commands.push(commandEntry);
            await writeQueue(broadcastPath, broadcastQueue);

            return NextResponse.json({
                success: true,
                broadcast: true,
                commandId: commandEntry.id,
                results,
                message: `Command broadcast to all 8 terminals`,
                timestamp: new Date().toISOString(),
            });
        }

        // Single terminal command
        let targetTerminal: number | null = null;

        if (terminal !== undefined) {
            targetTerminal = typeof terminal === 'number' ? terminal : parseInt(terminal, 10);
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
                error: 'Must specify terminal (1-8), agentId, or broadcast: true',
                timestamp: new Date().toISOString(),
            }, { status: 400 });
        }

        const targetAgentId = TERMINAL_AGENTS[targetTerminal];
        const queuePath = path.join(COMMANDS_DIR, `terminal_${targetTerminal}_queue.json`);
        const queue = await readQueue(queuePath);
        queue.terminalNumber = targetTerminal;
        queue.agentId = targetAgentId;
        queue.commands.push(commandEntry);
        await writeQueue(queuePath, queue);

        return NextResponse.json({
            success: true,
            commandId: commandEntry.id,
            terminalNumber: targetTerminal,
            agentId: targetAgentId,
            message: `Command queued for terminal ${targetTerminal} (${targetAgentId})`,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('[research/command] Error processing command:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process command',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}

// GET - Retrieve pending commands for a terminal (for agents to poll)
export async function GET(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    const terminalParam = url.searchParams.get('terminal');
    const markSent = url.searchParams.get('markSent') === 'true';

    if (!terminalParam) {
        return NextResponse.json({
            success: false,
            error: 'Missing required query parameter: terminal (1-8)',
            timestamp: new Date().toISOString(),
        }, { status: 400 });
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
        const queuePath = path.join(COMMANDS_DIR, `terminal_${terminal}_queue.json`);
        const queue = await readQueue(queuePath);

        const pendingCommands = queue.commands.filter(c => c.status === 'pending');

        if (markSent && pendingCommands.length > 0) {
            // Mark commands as sent
            for (const cmd of queue.commands) {
                if (cmd.status === 'pending') {
                    cmd.status = 'sent';
                }
            }
            await writeQueue(queuePath, queue);
        }

        return NextResponse.json({
            success: true,
            terminalNumber: terminal,
            agentId: TERMINAL_AGENTS[terminal],
            commands: pendingCommands,
            totalPending: pendingCommands.length,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error(`[research/command] Error reading commands for terminal ${terminal}:`, error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read command queue',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
