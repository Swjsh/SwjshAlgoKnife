// src/lib/agentManager.ts
// Manages agent process lifecycle - spawns/stops Python agents based on bot control
// Cost-conscious: Uses local Python processes, no external services

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface AgentProcess {
    pid: number;
    botId: string;
    strategy: string;
    startedAt: Date;
    process: ChildProcess;
}

// In-memory store of running agents (process manager)
const runningAgents: Map<string, AgentProcess> = new Map();

// Strategy to script mapping - all local Python scripts, zero cost
const STRATEGY_SCRIPTS: Record<string, string> = {
    'ORB': 'orb_engine.py',
    'VWAP': 'vwap_engine.py',
    'BBB': 'bollinger_engine.py',
    'ThreeDucks': 'three_ducks_engine.py',
    'Grid': 'grid_engine.py',
    'Manual': 'manual_engine.py',
    // Existing agents
    'BitcoinBob': 'bitcoin_bob_engine.py',
    'SterlingFX': 'sterling_fx_engine.py',
    'PivotPete': 'run_pivot_pete.py',
};

export function startAgent(
    botId: string,
    strategy: string,
    brokerConfigId: string
): { success: boolean; pid?: number; error?: string } {
    // Check if already running
    if (runningAgents.has(botId)) {
        return { success: false, error: 'Agent already running for this bot' };
    }

    const scriptName = STRATEGY_SCRIPTS[strategy];
    if (!scriptName) {
        // Fallback to generic agent for unknown strategies
        console.log(`No specific script for ${strategy}, using generic agent`);
    }

    const scriptPath = scriptName
        ? path.join(process.cwd(), 'scripts', scriptName)
        : path.join(process.cwd(), 'scripts', 'generic_agent.py');

    try {
        // Spawn Python agent with bot context
        const agentProcess = spawn('python', [
            scriptPath,
            '--bot-id', botId,
            '--broker-config-id', brokerConfigId,
        ], {
            cwd: process.cwd(),
            env: { ...process.env },
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (!agentProcess.pid) {
            return { success: false, error: 'Failed to spawn agent process' };
        }

        // Store process reference
        runningAgents.set(botId, {
            pid: agentProcess.pid,
            botId,
            strategy,
            startedAt: new Date(),
            process: agentProcess,
        });

        // Handle process output (for logging)
        agentProcess.stdout?.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            console.log(`[Agent:${botId}] ${msg}`);
        });

        agentProcess.stderr?.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            console.error(`[Agent:${botId}:ERR] ${msg}`);
        });

        // Handle process exit
        agentProcess.on('exit', (code: number | null) => {
            console.log(`[Agent:${botId}] Process exited with code ${code}`);
            runningAgents.delete(botId);
        });

        return { success: true, pid: agentProcess.pid };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export function stopAgent(botId: string): { success: boolean; error?: string } {
    const agent = runningAgents.get(botId);
    if (!agent) {
        return { success: true }; // Already stopped
    }

    try {
        agent.process.kill('SIGTERM');
        runningAgents.delete(botId);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export function pauseAgent(botId: string): { success: boolean; error?: string } {
    // Agent checks bot.status === 'PAUSED' in DB and skips execution
    // No external service needed - agent polls DB
    const agent = runningAgents.get(botId);
    if (!agent) {
        return { success: false, error: 'Agent not running' };
    }
    return { success: true };
}

export function getRunningAgents(): Array<{
    botId: string;
    pid: number;
    strategy: string;
    startedAt: string;
    uptime: number;
}> {
    const now = Date.now();
    return Array.from(runningAgents.values()).map(agent => ({
        botId: agent.botId,
        pid: agent.pid,
        strategy: agent.strategy,
        startedAt: agent.startedAt.toISOString(),
        uptime: Math.floor((now - agent.startedAt.getTime()) / 1000),
    }));
}

export function isAgentRunning(botId: string): boolean {
    return runningAgents.has(botId);
}

export function getAgentInfo(botId: string) {
    const agent = runningAgents.get(botId);
    if (!agent) return null;
    return {
        pid: agent.pid,
        strategy: agent.strategy,
        startedAt: agent.startedAt.toISOString(),
        uptime: Math.floor((Date.now() - agent.startedAt.getTime()) / 1000),
    };
}
