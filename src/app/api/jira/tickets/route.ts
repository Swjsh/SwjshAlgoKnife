import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Ticket interface for Jira issue data
 */
interface Ticket {
  key: string;
  summary: string;
  status: string;
  priority: string;
  updated: string;
}

/**
 * Agent ticket state containing done, in-progress, and next tickets
 */
interface AgentTickets {
  done: Ticket | null;
  inProgress: Ticket | null;
  next: Ticket | null;
}

/**
 * Response structure for the Jira tickets endpoint
 */
interface JiraTicketsResponse {
  agents: Record<string, AgentTickets>;
  lastUpdated: string;
}

/**
 * Agent to Jira project mapping
 * - chief: MGMT (Management)
 * - hunter: INFRA (Infrastructure)
 * - ops: SCRUM (Operations/Sprint)
 * - scout: BACK (Backend)
 * - arbiter: PULSE (Monitoring)
 * - cortana: LEARN, GRADE (Learning & Grading - multi-project)
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
 * Execute jira_client.py with given arguments and return parsed JSON
 */
async function execJiraClient(args: string[]): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const proc = spawn('python', [JIRA_CLIENT_PATH, ...args], {
      cwd: SCRIPTS_DIR,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Jira API] jira_client.py exited with code ${code}:`, stderr);
        resolve(null);
        return;
      }

      // The CLI outputs human-readable text for "list" command, not JSON
      // We need to parse the raw output or use the JSON that comes from
      // looking at the underlying _request return value
      // For this, we'll need to extract issue data from the formatted output
      resolve({ raw: stdout, stderr });
    });

    proc.on('error', (err) => {
      console.error('[Jira API] Failed to spawn jira_client.py:', err);
      resolve(null);
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 15000);
  });
}

/**
 * Fetch tickets for a specific project and status using JQL
 */
async function fetchTicketsByStatus(
  project: string,
  status: 'Done' | 'In Progress' | 'To Do',
  limit: number = 1
): Promise<Ticket | null> {
  // Construct arguments for the list command
  // Note: We don't pass ORDER BY via --jql because jira_client.py concatenates
  // with AND, causing invalid JQL. Jira returns results in created DESC order by default.
  const args = [
    'list',
    project,
    '--status', status,
    '--max', limit.toString(),
  ];

  const result = await execJiraClient(args);
  if (!result) return null;

  // The CLI outputs human-readable format, not JSON
  // We need a different approach - use the 'get' command approach
  // or modify to request JSON output
  //
  // Looking at jira_client.py, the 'list' command prints formatted output,
  // not JSON. We need to either:
  // 1. Modify jira_client.py to support JSON output
  // 2. Parse the formatted output
  // 3. Use the underlying API directly
  //
  // For now, let's parse the formatted output which looks like:
  // Found N issues in PROJECT:
  //   [KEY] (status, priority) Summary text here

  const raw = (result.raw as string) || '';
  const lines = raw.split('\n').filter(line => line.trim().startsWith('['));

  if (lines.length === 0) return null;

  // Parse first matching line: "  [KEY] (status, priority) Summary"
  const match = lines[0].match(/\[([^\]]+)\]\s*\(([^,]+),\s*([^)]+)\)\s*(.+)/);
  if (!match) return null;

  return {
    key: match[1],
    summary: match[4].length > 50 ? match[4].substring(0, 47) + '...' : match[4],
    status: match[2].trim(),
    priority: match[3].trim(),
    updated: new Date().toISOString(), // Not available in CLI output
  };
}

/**
 * Fetch all ticket categories for a single project
 */
async function fetchProjectTickets(project: string): Promise<AgentTickets> {
  const [done, inProgress, next] = await Promise.all([
    // Done: Last completed ticket
    fetchTicketsByStatus(project, 'Done', 1),
    // In Progress: Currently active ticket
    fetchTicketsByStatus(project, 'In Progress', 1),
    // Next: To Do (first available)
    fetchTicketsByStatus(project, 'To Do', 1),
  ]);

  return { done, inProgress, next };
}

/**
 * Merge tickets from multiple projects (for agents like cortana with LEARN + GRADE)
 * Takes the most recently updated ticket from each category across projects
 */
function mergeProjectTickets(ticketSets: AgentTickets[]): AgentTickets {
  const merged: AgentTickets = {
    done: null,
    inProgress: null,
    next: null,
  };

  for (const tickets of ticketSets) {
    // For done: prefer most recently updated
    if (tickets.done) {
      if (!merged.done || tickets.done.updated > merged.done.updated) {
        merged.done = tickets.done;
      }
    }

    // For inProgress: prefer first found (there should typically be one)
    if (tickets.inProgress && !merged.inProgress) {
      merged.inProgress = tickets.inProgress;
    }

    // For next: prefer first found with highest priority
    if (tickets.next && !merged.next) {
      merged.next = tickets.next;
    }
  }

  return merged;
}

/**
 * GET /api/jira/tickets
 *
 * Fetches Jira tickets for all 6 Halo agents.
 * Returns done, in-progress, and next tickets for each agent.
 */
/**
 * POST /api/jira/tickets
 *
 * Creates a new Jira ticket.
 * Body: { project: string, summary: string, description?: string, priority?: string, labels?: string[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { project, summary, description, priority, labels } = body;

    if (!project || !summary) {
      return NextResponse.json(
        { error: 'Missing required fields: project, summary' },
        { status: 400 }
      );
    }

    // Build jira_client.py create command
    const args = ['create', project, summary];

    if (description) {
      args.push('--desc', description);
    }

    if (priority) {
      args.push('--priority', priority);
    }

    if (labels && labels.length > 0) {
      args.push('--labels', labels.join(','));
    }

    const result = await execJiraClient(args);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create Jira ticket', details: 'jira_client.py returned no result' },
        { status: 500 }
      );
    }

    const raw = (result.raw as string) || '';

    // Parse the CLI output to extract the created ticket key
    // Output format: "Created issue: PROJECT-123"
    const keyMatch = raw.match(/Created issue:\s*(\S+)/i) || raw.match(/([A-Z]+-\d+)/);
    const ticketKey = keyMatch ? keyMatch[1] : null;

    return NextResponse.json({
      success: true,
      key: ticketKey,
      project,
      summary,
      raw: raw.trim(),
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Jira API] Error creating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to create Jira ticket', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jira/tickets
 *
 * Fetches Jira tickets for all 6 Halo agents.
 * Returns done, in-progress, and next tickets for each agent.
 */
export async function GET() {
  try {
    const agentNames = Object.keys(AGENT_PROJECT_MAP);

    // Fetch tickets for all agents in parallel
    const agentTicketPromises = agentNames.map(async (agent) => {
      const projects = AGENT_PROJECT_MAP[agent];

      try {
        // Fetch tickets for all projects this agent is responsible for
        const projectTicketSets = await Promise.all(
          projects.map((project) => fetchProjectTickets(project))
        );

        // Merge if multiple projects, otherwise use the single result
        const tickets =
          projectTicketSets.length > 1
            ? mergeProjectTickets(projectTicketSets)
            : projectTicketSets[0];

        return { agent, tickets };
      } catch (error) {
        console.error(`[Jira API] Error fetching tickets for ${agent}:`, error);
        return {
          agent,
          tickets: { done: null, inProgress: null, next: null },
        };
      }
    });

    const results = await Promise.all(agentTicketPromises);

    // Build response object
    const agents: Record<string, AgentTickets> = {};
    for (const { agent, tickets } of results) {
      agents[agent] = tickets;
    }

    const response: JiraTicketsResponse = {
      agents,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Jira API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Jira tickets',
        agents: {},
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
