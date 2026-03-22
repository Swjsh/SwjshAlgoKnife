#!/usr/bin/env npx tsx
/**
 * Semantic Action Parser for Agent Accomplishments
 * ==================================================
 * Parses agent output (logs, results files) to extract structured accomplishments.
 *
 * Action Types:
 *   - bug_fix: Fixed a bug, resolved an issue
 *   - pr_merged: Merged a pull request, committed code
 *   - doc_updated: Updated documentation
 *   - test_added: Added or updated tests
 *   - improvement: General improvement, optimization
 *   - pattern_found: Discovered a pattern or insight
 *   - security_fix: Fixed a security issue
 *   - config_change: Changed configuration
 *
 * Usage:
 *   npx tsx scripts/parse_accomplishments.ts                    # Parse latest session
 *   npx tsx scripts/parse_accomplishments.ts --terminal 3       # Parse specific terminal
 *   npx tsx scripts/parse_accomplishments.ts --session abc123   # Parse specific session
 *   npx tsx scripts/parse_accomplishments.ts --save             # Save to database
 *
 * Part of Research Agent Audit System — achieving 95%+ Structured Output score
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface ParsedAccomplishment {
  agent_id: string;
  agent_type: 'research' | 'halo' | 'trading';
  timestamp: string;
  action_type: string;
  description: string;
  quantified_value: number | null;
  jira_ticket: string | null;
  git_commit: string | null;
  source_file: string;
  source_line: number;
  confidence: number;
}

interface ActionPattern {
  type: string;
  patterns: RegExp[];
  extractors?: {
    jira?: RegExp;
    commit?: RegExp;
    value?: RegExp;
  };
}

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');

// Action patterns with regex
const ACTION_PATTERNS: ActionPattern[] = [
  {
    type: 'bug_fix',
    patterns: [
      /\b(fixed|resolved|patched|corrected|repaired)\s+(bug|issue|error|problem|defect)/i,
      /\bbug\s*#?\d+\s+(fixed|resolved)/i,
      /\bfix(?:ed|ing)?\s+(?:the\s+)?(?:bug|issue|error)/i,
    ],
    extractors: {
      jira: /([A-Z]+-\d+)/,
    },
  },
  {
    type: 'pr_merged',
    patterns: [
      /\b(merged|created|opened)\s+(?:pull\s+request|PR)\s*#?\d*/i,
      /\bPR\s*#?\d+\s+(merged|created)/i,
      /\bcommitted?\s+(?:changes?|code)\s+to/i,
      /\bgit\s+commit/i,
    ],
    extractors: {
      commit: /([a-f0-9]{7,40})/i,
    },
  },
  {
    type: 'doc_updated',
    patterns: [
      /\b(updated|added|wrote|created|revised)\s+(?:the\s+)?(?:docs?|documentation|readme|guide)/i,
      /\bdocumentation\s+(updated|added|improved)/i,
      /\bCLAUDE\.md\s+(updated|modified)/i,
    ],
  },
  {
    type: 'test_added',
    patterns: [
      /\b(added|created|wrote|implemented)\s+(?:\d+\s+)?tests?/i,
      /\btest\s+coverage\s+(increased|improved)/i,
      /\btests?\s+(passing|added|created)/i,
    ],
    extractors: {
      value: /(\d+)\s*(?:tests?|%)/,
    },
  },
  {
    type: 'improvement',
    patterns: [
      /\b(improved|optimized|enhanced|refactored)/i,
      /\b(performance|speed|efficiency)\s+(improved|increased|optimized)/i,
      /\brefactored?\s+(?:the\s+)?(?:code|function|module)/i,
    ],
  },
  {
    type: 'pattern_found',
    patterns: [
      /\b(discovered|found|identified|detected)\s+(?:a\s+)?pattern/i,
      /\bhypothesis\s+(confirmed|validated)/i,
      /\binsight:\s/i,
      /\bpattern\s+(?:H-\d+|found|identified)/i,
    ],
  },
  {
    type: 'security_fix',
    patterns: [
      /\b(fixed|patched|resolved)\s+(?:a\s+)?(?:security|vulnerability|CVE)/i,
      /\bsecurity\s+(?:issue|vulnerability|hole)\s+(fixed|patched)/i,
      /\bCVE-\d{4}-\d+/i,
    ],
  },
  {
    type: 'config_change',
    patterns: [
      /\b(updated|changed|modified)\s+(?:the\s+)?config(?:uration)?/i,
      /\benv(?:ironment)?\s+var(?:iable)?s?\s+(added|updated)/i,
      /\bsettings?\s+(changed|updated|modified)/i,
    ],
  },
];

// Agent mapping
const RESEARCH_AGENTS: Record<number, string> = {
  1: 'improver',
  2: 'backtester',
  3: 'researcher',
  4: 'brain_updater',
  5: 'security_auditor',
  6: 'integration_tester',
  7: 'intel_aggregator',
  8: 'devops_optimizer',
};

// ============================================================================
// Parser Functions
// ============================================================================

function parseActionType(text: string): { type: string; confidence: number } | null {
  for (const pattern of ACTION_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        // Calculate confidence based on match quality
        const match = text.match(regex);
        const matchLength = match ? match[0].length : 0;
        const confidence = Math.min(0.9, 0.5 + (matchLength / text.length));

        return { type: pattern.type, confidence };
      }
    }
  }
  return null;
}

function extractMetadata(text: string, actionType: string): {
  jira_ticket: string | null;
  git_commit: string | null;
  quantified_value: number | null;
} {
  const result = {
    jira_ticket: null as string | null,
    git_commit: null as string | null,
    quantified_value: null as number | null,
  };

  const pattern = ACTION_PATTERNS.find(p => p.type === actionType);
  if (!pattern?.extractors) return result;

  if (pattern.extractors.jira) {
    const match = text.match(pattern.extractors.jira);
    if (match) result.jira_ticket = match[1];
  }

  if (pattern.extractors.commit) {
    const match = text.match(pattern.extractors.commit);
    if (match) result.git_commit = match[1];
  }

  if (pattern.extractors.value) {
    const match = text.match(pattern.extractors.value);
    if (match) result.quantified_value = parseFloat(match[1]);
  }

  // Also try to extract Jira tickets globally
  if (!result.jira_ticket) {
    const jiraMatch = text.match(/([A-Z]{2,10}-\d+)/);
    if (jiraMatch) result.jira_ticket = jiraMatch[1];
  }

  return result;
}

function parseTerminalResults(terminal: number): ParsedAccomplishment[] {
  const accomplishments: ParsedAccomplishment[] = [];
  const agentId = RESEARCH_AGENTS[terminal] || `terminal_${terminal}`;

  // Try to read results.json
  const resultsFile = path.join(OVERNIGHT_DIR, `terminal_${terminal}_results.json`);
  if (fs.existsSync(resultsFile)) {
    try {
      const content = fs.readFileSync(resultsFile, 'utf-8');
      const results = JSON.parse(content);

      // Parse accomplishments array if present
      if (results.accomplishments && Array.isArray(results.accomplishments)) {
        for (const item of results.accomplishments) {
          const text = typeof item === 'string' ? item : item.description || '';
          const parsed = parseActionType(text);

          if (parsed) {
            const metadata = extractMetadata(text, parsed.type);
            accomplishments.push({
              agent_id: agentId,
              agent_type: 'research',
              timestamp: new Date().toISOString(),
              action_type: parsed.type,
              description: text.substring(0, 500),
              quantified_value: metadata.quantified_value,
              jira_ticket: metadata.jira_ticket,
              git_commit: metadata.git_commit,
              source_file: resultsFile,
              source_line: 0,
              confidence: parsed.confidence,
            });
          }
        }
      }
    } catch {
      // Invalid JSON
    }
  }

  // Try to read summary.md
  const summaryFile = path.join(OVERNIGHT_DIR, `terminal_${terminal}_summary.md`);
  if (fs.existsSync(summaryFile)) {
    try {
      const content = fs.readFileSync(summaryFile, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;

        const parsed = parseActionType(line);
        if (parsed && parsed.confidence > 0.5) {
          const metadata = extractMetadata(line, parsed.type);

          // Avoid duplicates
          const isDupe = accomplishments.some(
            a => a.description === line.substring(0, 500)
          );
          if (isDupe) continue;

          accomplishments.push({
            agent_id: agentId,
            agent_type: 'research',
            timestamp: new Date().toISOString(),
            action_type: parsed.type,
            description: line.substring(0, 500),
            quantified_value: metadata.quantified_value,
            jira_ticket: metadata.jira_ticket,
            git_commit: metadata.git_commit,
            source_file: summaryFile,
            source_line: i + 1,
            confidence: parsed.confidence,
          });
        }
      }
    } catch {
      // Can't read file
    }
  }

  // Try to read heartbeat.jsonl
  const heartbeatFile = path.join(OVERNIGHT_DIR, `terminal_${terminal}_heartbeat.jsonl`);
  if (fs.existsSync(heartbeatFile)) {
    try {
      const content = fs.readFileSync(heartbeatFile, 'utf-8');
      const lines = content.trim().split('\n').slice(-50); // Last 50 entries

      for (let i = 0; i < lines.length; i++) {
        try {
          const entry = JSON.parse(lines[i]);
          const message = entry.message || entry.action || '';
          const parsed = parseActionType(message);

          if (parsed && parsed.confidence > 0.6) {
            const metadata = extractMetadata(message, parsed.type);

            accomplishments.push({
              agent_id: agentId,
              agent_type: 'research',
              timestamp: entry.timestamp || new Date().toISOString(),
              action_type: parsed.type,
              description: message.substring(0, 500),
              quantified_value: metadata.quantified_value,
              jira_ticket: metadata.jira_ticket,
              git_commit: metadata.git_commit,
              source_file: heartbeatFile,
              source_line: i + 1,
              confidence: parsed.confidence,
            });
          }
        } catch {
          // Invalid JSON line
        }
      }
    } catch {
      // Can't read file
    }
  }

  return accomplishments;
}

function parseAllTerminals(): ParsedAccomplishment[] {
  const all: ParsedAccomplishment[] = [];

  for (let terminal = 1; terminal <= 8; terminal++) {
    const terminalAccomplishments = parseTerminalResults(terminal);
    all.push(...terminalAccomplishments);
  }

  // Sort by timestamp descending
  all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return all;
}

function saveToDB(accomplishments: ParsedAccomplishment[]): void {
  try {
    const Database = require('better-sqlite3');
    const { DATABASE_PATH } = require('../src/lib/dataPaths');
    const db = new Database(DATABASE_PATH);

    const insertStmt = db.prepare(`
      INSERT INTO accomplishments
      (agent_id, agent_type, timestamp, action_type, description, quantified_value, jira_ticket, git_commit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    for (const acc of accomplishments) {
      try {
        insertStmt.run(
          acc.agent_id,
          acc.agent_type,
          acc.timestamp,
          acc.action_type,
          acc.description,
          acc.quantified_value,
          acc.jira_ticket,
          acc.git_commit
        );
        inserted++;
      } catch (err) {
        // May be duplicate or other error
      }
    }

    db.close();
    console.log(`✓ Saved ${inserted}/${accomplishments.length} accomplishments to database`);
  } catch (error) {
    console.warn('⚠ Could not save to SQLite:', (error as Error).message);
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const saveToDb = args.includes('--save');

  // Get terminal argument
  const terminalArg = args.find(a => a.startsWith('--terminal='));
  const terminal = terminalArg ? parseInt(terminalArg.split('=')[1], 10) : null;

  if (!jsonOutput) {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║     SEMANTIC ACTION PARSER                        ║');
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log(`║  Target: ${terminal ? `Terminal ${terminal}` : 'All Terminals'}                            ║`);
    console.log('╚═══════════════════════════════════════════════════╝');
    console.log('');
  }

  // Parse accomplishments
  let accomplishments: ParsedAccomplishment[];
  if (terminal) {
    accomplishments = parseTerminalResults(terminal);
  } else {
    accomplishments = parseAllTerminals();
  }

  if (jsonOutput) {
    console.log(JSON.stringify(accomplishments, null, 2));
  } else {
    console.log(`Found ${accomplishments.length} accomplishments:\n`);

    for (const acc of accomplishments.slice(0, 20)) {
      const icon = {
        bug_fix: '🐛',
        pr_merged: '🔀',
        doc_updated: '📝',
        test_added: '✅',
        improvement: '⬆️',
        pattern_found: '🔍',
        security_fix: '🔒',
        config_change: '⚙️',
      }[acc.action_type] || '•';

      console.log(`${icon} [${acc.action_type}] ${acc.description.substring(0, 60)}...`);
      console.log(`   Agent: ${acc.agent_id} | Confidence: ${(acc.confidence * 100).toFixed(0)}%`);
      if (acc.jira_ticket) console.log(`   Jira: ${acc.jira_ticket}`);
      console.log('');
    }

    if (accomplishments.length > 20) {
      console.log(`... and ${accomplishments.length - 20} more`);
    }
  }

  // Save to database if requested
  if (saveToDb && accomplishments.length > 0) {
    saveToDB(accomplishments);
  }
}

main();
