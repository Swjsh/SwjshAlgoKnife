import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Loop state returned from jira_agent_loop.py status command
 */
interface LoopState {
  running: boolean;
  currentProject: string | null;
  currentIssue: string | null;
  iterationCount: number;
  issuesCompleted: number;
  skillsLearned: number;
  lastActivity: string | null;
}

/**
 * POST request body for loop control
 */
interface LoopControlRequest {
  action: 'start' | 'stop';
  project?: string;
}

/**
 * Response structure for POST requests
 */
interface LoopControlResponse {
  success: boolean;
  message: string;
  state: LoopState;
}

const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');
const JIRA_LOOP_PATH = path.join(SCRIPTS_DIR, 'jira_agent_loop.py');

/**
 * Execute jira_agent_loop.py with given arguments
 * Returns { stdout, stderr, code }
 */
async function execJiraLoop(
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn('python', [JIRA_LOOP_PATH, ...args], {
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
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (err) => {
      console.error('[Jira Loop API] Failed to spawn jira_agent_loop.py:', err);
      resolve({ stdout: '', stderr: String(err), code: -1 });
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr, code: null });
    }, 15000);
  });
}

/**
 * Parse the status output from jira_agent_loop.py
 *
 * Expected format:
 * Loop State:
 *   Running: True/False
 *   Current Project: SCRUM/None
 *   Current Issue: SCRUM-9/None
 *   Iterations: 1
 *   Issues Completed: 0
 *   Skills Learned: 0
 *   Last Activity: 2026-03-22T10:00:00.000000/Never
 */
function parseStatusOutput(output: string): LoopState {
  const defaultState: LoopState = {
    running: false,
    currentProject: null,
    currentIssue: null,
    iterationCount: 0,
    issuesCompleted: 0,
    skillsLearned: 0,
    lastActivity: null,
  };

  try {
    const lines = output.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse Running: True/False
      if (trimmed.startsWith('Running:')) {
        const value = trimmed.split(':')[1]?.trim().toLowerCase();
        defaultState.running = value === 'true';
      }

      // Parse Current Project: SCRUM/None
      if (trimmed.startsWith('Current Project:')) {
        const value = trimmed.split(':')[1]?.trim();
        defaultState.currentProject = value === 'None' ? null : value;
      }

      // Parse Current Issue: SCRUM-9/None
      if (trimmed.startsWith('Current Issue:')) {
        const value = trimmed.split(':')[1]?.trim();
        defaultState.currentIssue = value === 'None' ? null : value;
      }

      // Parse Iterations: 1
      if (trimmed.startsWith('Iterations:')) {
        const value = trimmed.split(':')[1]?.trim();
        defaultState.iterationCount = parseInt(value, 10) || 0;
      }

      // Parse Issues Completed: 0
      if (trimmed.startsWith('Issues Completed:')) {
        const value = trimmed.split(':')[1]?.trim();
        defaultState.issuesCompleted = parseInt(value, 10) || 0;
      }

      // Parse Skills Learned: 0
      if (trimmed.startsWith('Skills Learned:')) {
        const value = trimmed.split(':')[1]?.trim();
        defaultState.skillsLearned = parseInt(value, 10) || 0;
      }

      // Parse Last Activity: 2026-03-22T10:00:00.000000/Never
      if (trimmed.startsWith('Last Activity:')) {
        const value = trimmed.split('Last Activity:')[1]?.trim();
        defaultState.lastActivity = value === 'Never' ? null : value;
      }
    }

    return defaultState;
  } catch (error) {
    console.error('[Jira Loop API] Error parsing status output:', error);
    return defaultState;
  }
}

/**
 * GET /api/jira/loop
 *
 * Returns the current loop status by spawning jira_agent_loop.py status
 */
export async function GET() {
  try {
    const result = await execJiraLoop(['status']);

    if (result.code === null) {
      return NextResponse.json(
        {
          error: 'Timeout waiting for jira_agent_loop.py status',
          running: false,
          currentProject: null,
          currentIssue: null,
          iterationCount: 0,
          issuesCompleted: 0,
        },
        { status: 504 }
      );
    }

    if (result.code !== 0) {
      console.error(
        '[Jira Loop API] jira_agent_loop.py status failed:',
        result.stderr
      );
      return NextResponse.json(
        {
          error: 'Failed to get loop status',
          details: result.stderr,
          running: false,
          currentProject: null,
          currentIssue: null,
          iterationCount: 0,
          issuesCompleted: 0,
        },
        { status: 500 }
      );
    }

    const state = parseStatusOutput(result.stdout);

    return NextResponse.json(state);
  } catch (error) {
    console.error('[Jira Loop API] Unexpected error in GET:', error);
    return NextResponse.json(
      {
        error: 'Unexpected error getting loop status',
        details: String(error),
        running: false,
        currentProject: null,
        currentIssue: null,
        iterationCount: 0,
        issuesCompleted: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/jira/loop
 *
 * Control the Jira agent loop.
 * Body: { action: 'start' | 'stop', project?: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoopControlRequest;
    const { action, project } = body;

    // Validate action
    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid action. Must be 'start' or 'stop'.",
          state: {
            running: false,
            currentProject: null,
            currentIssue: null,
            iterationCount: 0,
            issuesCompleted: 0,
            skillsLearned: 0,
            lastActivity: null,
          },
        } as LoopControlResponse,
        { status: 400 }
      );
    }

    // Build command arguments
    const args: string[] = [action];
    if (action === 'start' && project) {
      args.push(project);
    }

    // Execute the command
    const result = await execJiraLoop(args);

    if (result.code === null) {
      return NextResponse.json(
        {
          success: false,
          message: `Timeout executing jira_agent_loop.py ${action}`,
          state: {
            running: false,
            currentProject: null,
            currentIssue: null,
            iterationCount: 0,
            issuesCompleted: 0,
            skillsLearned: 0,
            lastActivity: null,
          },
        } as LoopControlResponse,
        { status: 504 }
      );
    }

    if (result.code !== 0) {
      console.error(
        `[Jira Loop API] jira_agent_loop.py ${action} failed:`,
        result.stderr
      );
      return NextResponse.json(
        {
          success: false,
          message: `Failed to ${action} loop: ${result.stderr}`,
          state: {
            running: false,
            currentProject: null,
            currentIssue: null,
            iterationCount: 0,
            issuesCompleted: 0,
            skillsLearned: 0,
            lastActivity: null,
          },
        } as LoopControlResponse,
        { status: 500 }
      );
    }

    // Fetch the current state after the action
    const statusResult = await execJiraLoop(['status']);
    const state = parseStatusOutput(statusResult.stdout);

    const actionMessage =
      action === 'start'
        ? `Loop started${project ? ` for project ${project}` : ''}`
        : 'Loop stopped';

    return NextResponse.json({
      success: true,
      message: actionMessage,
      state,
    } as LoopControlResponse);
  } catch (error) {
    console.error('[Jira Loop API] Unexpected error in POST:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Unexpected error: ${String(error)}`,
        state: {
          running: false,
          currentProject: null,
          currentIssue: null,
          iterationCount: 0,
          issuesCompleted: 0,
          skillsLearned: 0,
          lastActivity: null,
        },
      } as LoopControlResponse,
      { status: 500 }
    );
  }
}
