/**
 * /api/research/logs — Research Agent Logs API
 *
 * GET /api/research/logs?terminal=N&offset=M
 *   Returns log lines from a specific overnight research terminal (1-8)
 *   - terminal: Required. Terminal number 1-8
 *   - offset: Optional. Line offset to start from (for incremental polling)
 *   - limit: Optional. Max lines to return (default 100)
 *
 * Reads from:
 *   - .claude/overnight/terminal_N_log.txt
 *   - Falls back to .claude/overnight/terminal_N_log.json if exists
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');

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

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    const terminalParam = url.searchParams.get('terminal');
    const offsetParam = url.searchParams.get('offset');
    const limitParam = url.searchParams.get('limit');

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

    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;

    const agentId = TERMINAL_AGENTS[terminal];

    try {
        // Try .txt log file first
        const logFileTxt = path.join(OVERNIGHT_DIR, `terminal_${terminal}_log.txt`);
        if (await fileExists(logFileTxt)) {
            const content = await fs.readFile(logFileTxt, 'utf-8');
            const allLines = content.split('\n').filter(line => line.trim());

            // Get lines from offset
            const newLines = allLines.slice(offset, offset + limit);

            return NextResponse.json({
                success: true,
                logs: newLines,
                totalLines: allLines.length,
                offset,
                hasMore: allLines.length > offset + limit,
                terminalNumber: terminal,
                agentId,
                timestamp: new Date().toISOString(),
            });
        }

        // Try .json log file
        const logFileJson = path.join(OVERNIGHT_DIR, `terminal_${terminal}_log.json`);
        if (await fileExists(logFileJson)) {
            const content = await fs.readFile(logFileJson, 'utf-8');
            const logData = JSON.parse(content);

            // Handle both array format and object with logs array
            const allLogs = Array.isArray(logData) ? logData : (logData.logs || []);
            const newLogs = allLogs.slice(offset, offset + limit);

            // Convert to string lines if they are objects
            const logLines = newLogs.map((log: unknown) => {
                if (typeof log === 'string') return log;
                if (typeof log === 'object' && log !== null) {
                    const logObj = log as Record<string, unknown>;
                    const ts = logObj.timestamp || new Date().toISOString();
                    const level = logObj.level || 'INFO';
                    const text = logObj.text || logObj.message || JSON.stringify(log);
                    return `[${ts}] [${level}] ${text}`;
                }
                return String(log);
            });

            return NextResponse.json({
                success: true,
                logs: logLines,
                totalLines: allLogs.length,
                offset,
                hasMore: allLogs.length > offset + limit,
                terminalNumber: terminal,
                agentId,
                timestamp: new Date().toISOString(),
            });
        }

        // Try agent-specific log file (e.g., improver_log.json)
        const agentLogFile = path.join(OVERNIGHT_DIR, `${agentId}_log.json`);
        if (await fileExists(agentLogFile)) {
            const content = await fs.readFile(agentLogFile, 'utf-8');
            const logData = JSON.parse(content);
            const allLogs = Array.isArray(logData) ? logData : (logData.logs || []);
            const newLogs = allLogs.slice(offset, offset + limit);

            const logLines = newLogs.map((log: unknown) => {
                if (typeof log === 'string') return log;
                if (typeof log === 'object' && log !== null) {
                    const logObj = log as Record<string, unknown>;
                    const ts = logObj.timestamp || new Date().toISOString();
                    const level = logObj.level || 'INFO';
                    const text = logObj.text || logObj.message || JSON.stringify(log);
                    return `[${ts}] [${level}] ${text}`;
                }
                return String(log);
            });

            return NextResponse.json({
                success: true,
                logs: logLines,
                totalLines: allLogs.length,
                offset,
                hasMore: allLogs.length > offset + limit,
                terminalNumber: terminal,
                agentId,
                timestamp: new Date().toISOString(),
            });
        }

        // No log file found
        return NextResponse.json({
            success: true,
            logs: [],
            totalLines: 0,
            offset,
            hasMore: false,
            terminalNumber: terminal,
            agentId,
            message: 'No logs found for this terminal',
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error(`[research/logs] Error reading logs for terminal ${terminal}:`, error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read agent logs',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
