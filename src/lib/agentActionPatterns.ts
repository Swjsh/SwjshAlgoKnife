/**
 * Agent Action Pattern Detection
 *
 * Detects "nice to know" actions from agent log messages:
 * - Jira ticket creation/updates
 * - Memory/learning updates
 * - Code commits/PRs
 * - File operations
 * - System commands
 */

export type ActionType =
  | 'jira_create'
  | 'jira_update'
  | 'memory_update'
  | 'code_commit'
  | 'pr_create'
  | 'file_write'
  | 'file_edit'
  | 'task_complete'
  | 'error_fix'
  | 'test_run'
  | 'build_run';

export interface AgentAction {
  type: ActionType;
  label: string;        // Human-readable label for UI
  icon: string;         // Emoji icon
  detail?: string;      // Optional extracted detail (ticket ID, filename, etc.)
  timestamp: string;    // ISO timestamp
  agentId: string;      // Which agent performed this
  rawText: string;      // Original matched text
}

interface PatternDefinition {
  type: ActionType;
  label: string;
  icon: string;
  patterns: RegExp[];
  extractDetail?: (match: RegExpMatchArray, fullText: string) => string | undefined;
}

const ACTION_PATTERNS: PatternDefinition[] = [
  // Jira Actions
  {
    type: 'jira_create',
    label: 'Creating Jira Ticket',
    icon: '🎫',
    patterns: [
      /Let me create.*Jira ticket/i,
      /Creating Jira ticket/i,
      /I'll create.*ticket/i,
      /creating.*JIRA/i,
      /ticket created:?\s*([A-Z]+-\d+)/i,
    ],
    extractDetail: (match, fullText) => {
      const ticketMatch = fullText.match(/([A-Z]+-\d+)/);
      return ticketMatch?.[1];
    }
  },
  {
    type: 'jira_update',
    label: 'Updating Jira',
    icon: '📝',
    patterns: [
      /updating.*Jira/i,
      /update.*ticket.*([A-Z]+-\d+)/i,
      /moving.*ticket.*to/i,
      /transitioning.*([A-Z]+-\d+)/i,
    ],
    extractDetail: (match, fullText) => {
      const ticketMatch = fullText.match(/([A-Z]+-\d+)/);
      return ticketMatch?.[1];
    }
  },

  // Memory/Learning Actions
  {
    type: 'memory_update',
    label: 'Updating Memory',
    icon: '🧠',
    patterns: [
      /update.*quality memory/i,
      /updating.*memory/i,
      /saving.*to memory/i,
      /learning.*pattern/i,
      /adding.*to.*knowledge/i,
      /recording.*lesson/i,
    ]
  },

  // Code/Git Actions
  {
    type: 'code_commit',
    label: 'Committing Code',
    icon: '💾',
    patterns: [
      /git commit/i,
      /committing.*changes/i,
      /creating.*commit/i,
    ],
    extractDetail: (match, fullText) => {
      const msgMatch = fullText.match(/(?:commit|message)[:\s]*["']?([^"'\n]+)/i);
      return msgMatch?.[1]?.slice(0, 50);
    }
  },
  {
    type: 'pr_create',
    label: 'Creating PR',
    icon: '🔀',
    patterns: [
      /creating.*pull request/i,
      /opening.*PR/i,
      /gh pr create/i,
    ]
  },

  // File Operations
  {
    type: 'file_write',
    label: 'Writing File',
    icon: '📄',
    patterns: [
      /creating.*file/i,
      /writing.*to.*\.(ts|js|py|json|md)/i,
      /Write tool.*file_path/i,
    ],
    extractDetail: (match, fullText) => {
      const fileMatch = fullText.match(/(?:file[_\s]*path|writing to|creating)[:\s]*["']?([^\s"']+\.[a-z]+)/i);
      return fileMatch?.[1]?.split('/').pop();
    }
  },
  {
    type: 'file_edit',
    label: 'Editing File',
    icon: '✏️',
    patterns: [
      /editing.*file/i,
      /Edit tool.*file_path/i,
      /modifying.*\.(ts|js|py|json|md)/i,
    ],
    extractDetail: (match, fullText) => {
      const fileMatch = fullText.match(/(?:file[_\s]*path|editing|modifying)[:\s]*["']?([^\s"']+\.[a-z]+)/i);
      return fileMatch?.[1]?.split('/').pop();
    }
  },

  // Task/Work Actions
  {
    type: 'task_complete',
    label: 'Task Complete',
    icon: '✅',
    patterns: [
      /task.*complete/i,
      /finished.*implementation/i,
      /completed.*successfully/i,
      /done.*with/i,
    ]
  },
  {
    type: 'error_fix',
    label: 'Fixing Error',
    icon: '🔧',
    patterns: [
      /fixing.*error/i,
      /resolving.*issue/i,
      /patching.*bug/i,
      /fix.*applied/i,
    ]
  },

  // Build/Test Actions
  {
    type: 'test_run',
    label: 'Running Tests',
    icon: '🧪',
    patterns: [
      /running.*tests/i,
      /npm.*test/i,
      /pytest/i,
      /test.*passed/i,
      /test.*failed/i,
    ]
  },
  {
    type: 'build_run',
    label: 'Building',
    icon: '🏗️',
    patterns: [
      /npm.*build/i,
      /building.*project/i,
      /compilation/i,
      /build.*succeeded/i,
    ]
  },
];

/**
 * Detect if a message contains an actionable event
 * Returns the first matching action or null
 */
export function detectAgentAction(
  text: string,
  agentId: string,
  timestamp: string
): AgentAction | null {
  // Skip very short messages
  if (text.length < 10) return null;

  // Skip tool results and system messages
  if (text.startsWith('[RESULT]') || text.startsWith('[SYSTEM]')) return null;

  for (const patternDef of ACTION_PATTERNS) {
    for (const pattern of patternDef.patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: patternDef.type,
          label: patternDef.label,
          icon: patternDef.icon,
          detail: patternDef.extractDetail?.(match, text),
          timestamp,
          agentId,
          rawText: text.slice(0, 200), // Truncate for storage
        };
      }
    }
  }

  return null;
}

/**
 * Get action priority for sorting (higher = more important)
 */
export function getActionPriority(type: ActionType): number {
  const priorities: Record<ActionType, number> = {
    jira_create: 100,
    jira_update: 90,
    pr_create: 85,
    code_commit: 80,
    error_fix: 75,
    task_complete: 70,
    memory_update: 65,
    test_run: 50,
    build_run: 45,
    file_write: 30,
    file_edit: 25,
  };
  return priorities[type] ?? 0;
}

/**
 * Format action for display in UI
 */
export function formatActionDisplay(action: AgentAction): string {
  const detail = action.detail ? `: ${action.detail}` : '';
  return `${action.icon} ${action.label}${detail}`;
}
