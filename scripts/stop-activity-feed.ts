/**
 * Stop Activity Feed - Graceful Shutdown Script
 *
 * Kills all activity feed related processes:
 * - Agent proxy processes
 * - WebSocket server
 * - Cleans up temporary files
 *
 * Usage:
 *   npx tsx scripts/stop-activity-feed.ts
 *   npx tsx scripts/stop-activity-feed.ts --force    # Force kill
 *   npx tsx scripts/stop-activity-feed.ts --cleanup  # Only cleanup, no kill
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMP_PROMPTS_DIR = path.join(PROJECT_ROOT, '.agent-prompts');
const PID_FILE = path.join(PROJECT_ROOT, 'data', '.activity-feed.pid');

// Process patterns to match
const PROCESS_PATTERNS = [
    'ws-server.ts',
    'start-halo-agents.ts',
    'agent-proxy.ts',
];

// ============================================================================
// CLI Parsing
// ============================================================================

interface Options {
    force: boolean;
    cleanupOnly: boolean;
    verbose: boolean;
}

function parseArgs(): Options {
    const args = process.argv.slice(2);
    return {
        force: args.includes('--force') || args.includes('-f'),
        cleanupOnly: args.includes('--cleanup') || args.includes('-c'),
        verbose: args.includes('--verbose') || args.includes('-v'),
    };
}

// ============================================================================
// Logging
// ============================================================================

function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    const prefix = `[${new Date().toISOString()}] [STOP] [${level}]`;

    switch (level) {
        case 'ERROR':
            console.error(`${prefix} ${message}`);
            break;
        case 'WARN':
            console.warn(`${prefix} ${message}`);
            break;
        default:
            console.log(`${prefix} ${message}`);
    }
}

// ============================================================================
// Process Management
// ============================================================================

interface ProcessInfo {
    pid: number;
    name: string;
    cmd: string;
}

/**
 * Find processes matching our patterns (Windows)
 */
function findProcessesWindows(patterns: string[]): ProcessInfo[] {
    const processes: ProcessInfo[] = [];

    try {
        // Use WMIC to get process list with command line
        const result = spawnSync('wmic', [
            'process',
            'where',
            `"CommandLine like '%tsx%' or CommandLine like '%node%'"`,
            'get',
            'ProcessId,Name,CommandLine',
            '/format:csv',
        ], {
            encoding: 'utf8',
            shell: true,
            windowsHide: true,
        });

        if (result.stdout) {
            const lines = result.stdout.split('\n').filter(line => line.trim());

            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 4) {
                    const cmd = parts.slice(1, -2).join(','); // CommandLine
                    const name = parts[parts.length - 2]; // Name
                    const pid = parseInt(parts[parts.length - 1], 10); // ProcessId

                    if (isNaN(pid) || pid === 0) continue;

                    // Check if command matches any of our patterns
                    for (const pattern of patterns) {
                        if (cmd.includes(pattern)) {
                            processes.push({ pid, name, cmd });
                            break;
                        }
                    }
                }
            }
        }
    } catch (error) {
        // Fallback: Try PowerShell
        try {
            const psResult = spawnSync('powershell', [
                '-Command',
                `Get-Process | Where-Object { $_.Path -like '*node*' } | Select-Object Id, ProcessName, Path | ConvertTo-Json`,
            ], {
                encoding: 'utf8',
                windowsHide: true,
            });

            if (psResult.stdout) {
                const data = JSON.parse(psResult.stdout);
                const procs = Array.isArray(data) ? data : [data];

                for (const proc of procs) {
                    if (proc && proc.Id) {
                        // We can't easily check command line, so just list node processes
                        processes.push({
                            pid: proc.Id,
                            name: proc.ProcessName,
                            cmd: proc.Path || '',
                        });
                    }
                }
            }
        } catch {
            log('Could not enumerate processes', 'WARN');
        }
    }

    return processes;
}

/**
 * Find processes matching our patterns (Unix/Linux/Mac)
 */
function findProcessesUnix(patterns: string[]): ProcessInfo[] {
    const processes: ProcessInfo[] = [];

    try {
        const result = spawnSync('ps', ['aux'], {
            encoding: 'utf8',
        });

        if (result.stdout) {
            const lines = result.stdout.split('\n').slice(1); // Skip header

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 11) continue;

                const pid = parseInt(parts[1], 10);
                const cmd = parts.slice(10).join(' ');

                if (isNaN(pid)) continue;

                for (const pattern of patterns) {
                    if (cmd.includes(pattern)) {
                        processes.push({
                            pid,
                            name: parts[10] || 'unknown',
                            cmd,
                        });
                        break;
                    }
                }
            }
        }
    } catch (error) {
        log('Could not enumerate processes', 'WARN');
    }

    return processes;
}

/**
 * Kill a process by PID
 */
function killProcess(pid: number, force: boolean = false): boolean {
    try {
        if (process.platform === 'win32') {
            const args = force ? ['/F', '/PID', pid.toString()] : ['/PID', pid.toString()];
            spawnSync('taskkill', args, { windowsHide: true });
        } else {
            const signal = force ? 'SIGKILL' : 'SIGTERM';
            process.kill(pid, signal);
        }
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Stop all activity feed processes
 */
function stopProcesses(options: Options): number {
    log('Searching for activity feed processes...');

    const findFn = process.platform === 'win32' ? findProcessesWindows : findProcessesUnix;
    const processes = findFn(PROCESS_PATTERNS);

    if (processes.length === 0) {
        log('No activity feed processes found');
        return 0;
    }

    log(`Found ${processes.length} process(es) to stop:`);

    for (const proc of processes) {
        if (options.verbose) {
            log(`  PID ${proc.pid}: ${proc.cmd.substring(0, 80)}...`);
        } else {
            log(`  PID ${proc.pid}: ${proc.name}`);
        }
    }

    if (options.cleanupOnly) {
        log('Cleanup-only mode, not killing processes');
        return processes.length;
    }

    let killed = 0;
    for (const proc of processes) {
        if (killProcess(proc.pid, options.force)) {
            log(`  Stopped PID ${proc.pid}`);
            killed++;
        } else {
            log(`  Failed to stop PID ${proc.pid}`, 'WARN');
        }
    }

    return killed;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up temporary files
 */
function cleanup(): void {
    log('Cleaning up temporary files...');

    // Remove merged prompt files
    if (fs.existsSync(TEMP_PROMPTS_DIR)) {
        try {
            fs.rmSync(TEMP_PROMPTS_DIR, { recursive: true, force: true });
            log(`  Removed ${TEMP_PROMPTS_DIR}`);
        } catch (error) {
            log(`  Could not remove ${TEMP_PROMPTS_DIR}`, 'WARN');
        }
    }

    // Remove PID file
    if (fs.existsSync(PID_FILE)) {
        try {
            fs.unlinkSync(PID_FILE);
            log(`  Removed ${PID_FILE}`);
        } catch (error) {
            log(`  Could not remove ${PID_FILE}`, 'WARN');
        }
    }

    log('Cleanup complete');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
    const options = parseArgs();

    console.log('');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(' Activity Feed — Shutdown');
    console.log('──────────────────────────────────────────────────────────────');
    console.log('');

    // Stop processes
    const stopped = stopProcesses(options);

    // Give processes time to clean up
    if (stopped > 0 && !options.cleanupOnly) {
        log('Waiting for processes to terminate...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Cleanup temporary files
    cleanup();

    console.log('');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(` Shutdown complete. ${stopped} process(es) stopped.`);
    console.log('──────────────────────────────────────────────────────────────');
    console.log('');
}

main().catch((error) => {
    log(`Fatal error: ${error}`, 'ERROR');
    process.exit(1);
});
