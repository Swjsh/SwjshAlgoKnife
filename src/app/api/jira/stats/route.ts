import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Agent to Jira project mapping (mirrors tickets/route.ts)
 */
const AGENT_PROJECT_MAP: Record<string, string[]> = {
    chief: ['MGMT'],
    hunter: ['INFRA'],
    ops: ['SCRUM'],
    scout: ['BACK'],
    arbiter: ['PULSE'],
    cortana: ['LEARN', 'GRADE'],
};

const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');
const JIRA_CLIENT_PATH = path.join(SCRIPTS_DIR, 'jira_client.py');

/**
 * Execute jira_client.py list command and count results by parsing the `total` field
 * from the Jira search API response.
 */
async function countIssues(project: string, statusFilter: string): Promise<number> {
    return new Promise((resolve) => {
        // Use list with --max 0 to get just the total count
        // Actually jira_client uses /search/jql which returns { total, issues[] }
        // We'll ask for max 1 result and parse the "Found N issues" line
        const proc = spawn('python', [JIRA_CLIENT_PATH, 'list', project, '--status', statusFilter, '--max', '1'], {
            cwd: SCRIPTS_DIR,
            env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
        proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error(`[Jira Stats] Error counting ${project}/${statusFilter}:`, stderr.slice(0, 200));
                resolve(0);
                return;
            }
            // Parse "Found N issues in PROJECT:" from the CLI output
            const match = stdout.match(/Found\s+(\d+)\s+issues?\s+in/i);
            resolve(match ? parseInt(match[1], 10) : 0);
        });

        proc.on('error', () => resolve(0));

        // Timeout after 10s
        setTimeout(() => { proc.kill(); resolve(0); }, 10000);
    });
}

export interface AgentStats {
    done: number;
    inProgress: number;
    todo: number;
    total: number;
}

/**
 * GET /api/jira/stats
 *
 * Returns ticket counts (done, inProgress, todo, total) per Halo agent.
 * Fetches live data from Jira via jira_client.py.
 */
export async function GET() {
    try {
        const agentNames = Object.keys(AGENT_PROJECT_MAP);

        const results = await Promise.all(
            agentNames.map(async (agent) => {
                const projects = AGENT_PROJECT_MAP[agent];

                // Sum counts across all projects for this agent
                let done = 0;
                let inProgress = 0;
                let todo = 0;

                await Promise.all(
                    projects.map(async (project) => {
                        const [d, ip, t] = await Promise.all([
                            countIssues(project, 'Done'),
                            countIssues(project, 'In Progress'),
                            countIssues(project, 'To Do'),
                        ]);
                        done += d;
                        inProgress += ip;
                        todo += t;
                    })
                );

                return {
                    agent,
                    stats: {
                        done,
                        inProgress,
                        todo,
                        total: done + inProgress + todo,
                    } as AgentStats,
                };
            })
        );

        const agents: Record<string, AgentStats> = {};
        for (const { agent, stats } of results) {
            agents[agent] = stats;
        }

        return NextResponse.json({
            agents,
            lastUpdated: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Jira Stats] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch Jira stats', agents: {}, lastUpdated: new Date().toISOString() },
            { status: 500 }
        );
    }
}
