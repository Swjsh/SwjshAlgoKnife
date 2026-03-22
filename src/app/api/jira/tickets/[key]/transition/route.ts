import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * Valid status transitions for Jira tickets
 */
type JiraStatus = 'In Progress' | 'Done';

/**
 * Request body for ticket transition
 */
interface TransitionRequest {
  status: JiraStatus;
  comment?: string;
}

/**
 * Success response for transition
 */
interface TransitionSuccessResponse {
  success: true;
  key: string;
  newStatus: string;
  commentAdded: boolean;
}

/**
 * Error response for transition
 */
interface TransitionErrorResponse {
  error: string;
  details?: string;
}

const SCRIPTS_DIR = path.join(process.cwd(), 'scripts');
const JIRA_CLIENT_PATH = path.join(SCRIPTS_DIR, 'jira_client.py');

/**
 * Execute jira_client.py with given arguments
 * Returns { success: boolean, stdout: string, stderr: string }
 */
async function execJiraClient(
  args: string[]
): Promise<{ success: boolean; stdout: string; stderr: string }> {
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
      resolve({
        success: code === 0,
        stdout,
        stderr,
      });
    });

    proc.on('error', (err) => {
      console.error('[Jira Transition API] Failed to spawn jira_client.py:', err);
      resolve({
        success: false,
        stdout: '',
        stderr: String(err),
      });
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      proc.kill();
      resolve({
        success: false,
        stdout,
        stderr: 'Process timed out after 15 seconds',
      });
    }, 15000);
  });
}

/**
 * Validate the transition request body
 */
function validateRequest(body: unknown): body is TransitionRequest {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const { status } = body as Partial<TransitionRequest>;

  if (!status || !['In Progress', 'Done'].includes(status)) {
    return false;
  }

  return true;
}

/**
 * POST /api/jira/tickets/[key]/transition
 *
 * Transitions a Jira ticket to a new status.
 * Optionally adds a comment to the ticket.
 *
 * Body: { status: 'In Progress' | 'Done', comment?: string }
 *
 * Returns:
 * - Success: { success: true, key: string, newStatus: string, commentAdded: boolean }
 * - Error: { error: string, details?: string } with status 500
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse<TransitionSuccessResponse | TransitionErrorResponse>> {
  try {
    const { key } = await params;

    // Validate the key format (e.g., SCRUM-9, INFRA-15)
    if (!key || !/^[A-Z]+-\d+$/.test(key)) {
      return NextResponse.json(
        { error: 'Invalid ticket key format', details: `Expected format like SCRUM-9, got: ${key}` },
        { status: 400 }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!validateRequest(body)) {
      return NextResponse.json(
        { error: 'Invalid request body', details: 'status must be "In Progress" or "Done"' },
        { status: 400 }
      );
    }

    const { status, comment } = body;

    // Execute transition command
    const transitionResult = await execJiraClient(['transition', key, status]);

    if (!transitionResult.success) {
      console.error(`[Jira Transition API] Failed to transition ${key}:`, transitionResult.stderr);
      return NextResponse.json(
        {
          error: `Failed to transition ticket ${key} to ${status}`,
          details: transitionResult.stderr || 'jira_client.py transition failed',
        },
        { status: 500 }
      );
    }

    // Add comment if provided
    let commentAdded = false;
    if (comment && comment.trim()) {
      const commentResult = await execJiraClient(['comment', key, comment]);

      if (commentResult.success) {
        commentAdded = true;
      } else {
        // Log warning but don't fail the request - transition was successful
        console.warn(`[Jira Transition API] Transition succeeded but comment failed for ${key}:`, commentResult.stderr);
      }
    }

    return NextResponse.json({
      success: true,
      key,
      newStatus: status,
      commentAdded,
    });
  } catch (error) {
    console.error('[Jira Transition API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to transition ticket',
        details: String(error),
      },
      { status: 500 }
    );
  }
}
