/**
 * /api/research/status — Research Agent Status API
 *
 * GET /api/research/status?terminal=N
 *   Returns the status of a specific overnight research terminal (1-8)
 *
 * Reads from:
 *   - .claude/overnight/terminal_N_status.json (if exists)
 *   - Falls back to checking heartbeat files and process status
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const HEARTBEAT_DIR = path.join(ROOT, 'data', 'heartbeats');

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

interface AgentStatus {
    status: 'online' | 'offline' | 'busy';
    lastActivity: string;
    terminalNumber: number;
    agentId: string;
    agentName: string;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function getFileMtime(filePath: string): Promise<Date | null> {
    try {
        const stats = await fs.stat(filePath);
        return stats.mtime;
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    const terminalParam = url.searchParams.get('terminal');

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

    const agentId = TERMINAL_AGENTS[terminal];
    const agentName = agentId.toUpperCase().replace(/_/g, ' ');

    try {
        // Check for explicit status file first
        const statusFile = path.join(OVERNIGHT_DIR, `terminal_${terminal}_status.json`);
        if (await fileExists(statusFile)) {
            const content = await fs.readFile(statusFile, 'utf-8');
            const statusData = JSON.parse(content);
            return NextResponse.json({
                success: true,
                status: statusData.status || 'offline',
                lastActivity: statusData.lastActivity || statusData.launchedAt || statusData.timestamp || new Date().toISOString(),
                terminalNumber: terminal,
                agentId,
                agentName,
                // Include AutoResearch metrics if present
                autoresearch: statusData.autoresearch || null,
                sessionId: statusData.sessionId || null,
                role: statusData.role || null,
                timestamp: new Date().toISOString(),
            });
        }

        // Check heartbeat file
        const heartbeatFile = path.join(HEARTBEAT_DIR, `${agentId}.json`);
        if (await fileExists(heartbeatFile)) {
            const content = await fs.readFile(heartbeatFile, 'utf-8');
            const heartbeat = JSON.parse(content);
            const lastSeen = new Date(heartbeat.lastSeen || heartbeat.timestamp);
            const now = new Date();
            const ageSecs = (now.getTime() - lastSeen.getTime()) / 1000;

            // Consider agent:
            // - 'busy' if heartbeat within 30 seconds
            // - 'online' if within 5 minutes
            // - 'offline' otherwise
            let status: AgentStatus['status'] = 'offline';
            if (ageSecs < 30) {
                status = 'busy';
            } else if (ageSecs < 300) {
                status = 'online';
            }

            return NextResponse.json({
                success: true,
                status,
                lastActivity: heartbeat.lastSeen || heartbeat.timestamp,
                terminalNumber: terminal,
                agentId,
                agentName,
                timestamp: new Date().toISOString(),
            });
        }

        // Check log file modification time as fallback
        const logFile = path.join(OVERNIGHT_DIR, `terminal_${terminal}_log.txt`);
        const logMtime = await getFileMtime(logFile);
        if (logMtime) {
            const now = new Date();
            const ageSecs = (now.getTime() - logMtime.getTime()) / 1000;

            let status: AgentStatus['status'] = 'offline';
            if (ageSecs < 30) {
                status = 'busy';
            } else if (ageSecs < 300) {
                status = 'online';
            }

            return NextResponse.json({
                success: true,
                status,
                lastActivity: logMtime.toISOString(),
                terminalNumber: terminal,
                agentId,
                agentName,
                timestamp: new Date().toISOString(),
            });
        }

        // No status info found - agent is offline
        return NextResponse.json({
            success: true,
            status: 'offline',
            lastActivity: new Date().toISOString(),
            terminalNumber: terminal,
            agentId,
            agentName,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error(`[research/status] Error checking terminal ${terminal}:`, error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check agent status',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
