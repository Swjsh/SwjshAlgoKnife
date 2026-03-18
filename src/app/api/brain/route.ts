import { NextResponse, NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { requireAdmin } from '@/lib/adminGuard';

const BRAIN_DIR = path.join(process.cwd(), 'data', 'brain');
const AGENTS_DB = path.join(process.cwd(), 'src', 'app', 'api', 'agents', 'agents_db.json');
const JOURNAL_DB = path.join(process.cwd(), 'journal.db');

function readBrainFile(filename: string): { content: string; modified: string; size: number } | null {
  try {
    // SECURITY: Prevent path traversal — reject any filename with ../ or absolute paths
    if (filename.includes('..') || filename.includes('\\') || path.isAbsolute(filename)) {
      console.error(`[Brain] PATH TRAVERSAL BLOCKED: "${filename}"`);
      return null;
    }
    // Whitelist: only allow .md files within brain directory
    if (!filename.endsWith('.md')) {
      console.error(`[Brain] Non-markdown file rejected: "${filename}"`);
      return null;
    }
    const filepath = path.join(BRAIN_DIR, filename);
    // Double-check resolved path is within BRAIN_DIR
    const resolved = path.resolve(filepath);
    if (!resolved.startsWith(path.resolve(BRAIN_DIR))) {
      console.error(`[Brain] PATH TRAVERSAL BLOCKED (resolved): "${filename}" -> "${resolved}"`);
      return null;
    }
    const stat = fs.statSync(filepath);
    const content = fs.readFileSync(filepath, 'utf-8');
    return { content, modified: stat.mtime.toISOString(), size: stat.size };
  } catch {
    return null;
  }
}

function getBrainHealth() {
  const coreFiles = [
    'master-tracker.md', 'strategies.md', 'decisions-log.md',
    'daily-log.md', 'learning-log.md', 'performance-memory.md', 'self-healing.md'
  ];
  const systemFiles = ['system-architecture.md', 'environment.md', 'roadmap.md'];
  const agentFiles = [
    'agents/sterling.md', 'agents/bitcoin-bob.md', 'agents/pivot-pete.md',
    'agents/boba.md', 'agents/spx-sniper.md', 'agents/professor.md',
    'agents/auditor.md', 'agents/overseer.md'
  ];

  const allFiles = [...coreFiles, ...systemFiles, ...agentFiles];
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  const files = allFiles.map(f => {
    const filepath = path.join(BRAIN_DIR, f);
    try {
      const stat = fs.statSync(filepath);
      const ageMs = now - stat.mtime.getTime();
      return {
        name: f, exists: true, modified: stat.mtime.toISOString(),
        ageHours: Math.round(ageMs / (1000 * 60 * 60)),
        stale: ageMs > sevenDays, size: stat.size,
        category: coreFiles.includes(f) ? 'core' : systemFiles.includes(f) ? 'system' : 'agent'
      };
    } catch {
      return { name: f, exists: false, modified: null, ageHours: null, stale: true, size: 0, category: coreFiles.includes(f) ? 'core' : systemFiles.includes(f) ? 'system' : 'agent' };
    }
  });

  return {
    files,
    total: allFiles.length,
    present: files.filter(f => f.exists).length,
    fresh: files.filter(f => f.exists && !f.stale).length,
    staleCount: files.filter(f => f.stale).length,
    score: Math.round((files.filter(f => f.exists && !f.stale).length / allFiles.length) * 100)
  };
}

// Parse decisions into structured objects for the UI
function getRecentDecisions(limit = 25) {
  const file = readBrainFile('decisions-log.md');
  if (!file) return [];
  const lines = file.content.split('\n').filter(l => l.match(/^\[?\d{4}-/));
  return lines.slice(-limit).reverse().map(line => {
    // Parse: [timestamp] DECISION: X | REASON: Y | ACTION: Z
    // or: [timestamp] SYSTEM_BUILDER: ...
    const tsMatch = line.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}[^\]]*)\]?\s*(.*)/);
    const timestamp = tsMatch?.[1] || '';
    const body = tsMatch?.[2] || line;

    const decisionMatch = body.match(/(?:DECISION|SYSTEM_BUILDER):\s*([^|]*)/i);
    const reasonMatch = body.match(/REASON:\s*([^|]*)/i);
    const actionMatch = body.match(/ACTION:\s*([^|]*)/i);

    const decision = decisionMatch?.[1]?.trim() || body;
    const reason = reasonMatch?.[1]?.trim() || '';
    const action = actionMatch?.[1]?.trim() || '';

    const isSystemBuilder = body.includes('SYSTEM_BUILDER');
    const isAction = action && !action.includes('Monitoring') && action !== 'No action';
    const isKillswitch = body.toLowerCase().includes('killswitch');
    const isPause = body.toLowerCase().includes('pause');
    const isWarning = body.toLowerCase().includes('warning') || body.toLowerCase().includes('threshold');

    let severity: 'info' | 'action' | 'warning' | 'critical' | 'builder' = 'info';
    if (isKillswitch) severity = 'critical';
    else if (isWarning || isPause) severity = 'warning';
    else if (isSystemBuilder) severity = 'builder';
    else if (isAction) severity = 'action';

    return { timestamp, decision, reason, action, severity, raw: line };
  });
}

function getLearningPatterns() {
  const file = readBrainFile('learning-log.md');
  if (!file) return { hypotheses: 0, confirmed: 0, applied: 0, invalidated: 0, entries: [] as string[] };
  const content = file.content;
  // Extract actual pattern entries (lines starting with ### or containing HYPOTHESIS/CONFIRMED)
  const entries = content.split('\n')
    .filter(l => l.match(/^###\s/) || l.match(/(HYPOTHESIS|CONFIRMED|APPLIED|INVALIDATED)/i))
    .slice(0, 10);
  return {
    hypotheses: (content.match(/HYPOTHESIS/gi) || []).length,
    confirmed: (content.match(/CONFIRMED/gi) || []).length,
    applied: (content.match(/APPLIED/gi) || []).length,
    invalidated: (content.match(/INVALIDATED/gi) || []).length,
    entries,
  };
}

interface BuilderTask {
  text: string;
  date: string;
  severity: string;
  category: string;
  gap: string;
  suggestedFix: string;
  status: string;
}

function getSystemBuilderQueue() {
  const file = readBrainFile('master-tracker.md');
  if (!file) return { pending: 0, completed: 0, pendingTasks: [] as BuilderTask[], completedTasks: [] as BuilderTask[], raw: '' };
  const content = file.content;
  const queueSection = content.split('## System Builder Queue')[1]?.split('\n## ')[0] || '';
  const pendingRaw = queueSection.split('### Pending')[1]?.split('### Completed')[0] || '';
  const completedRaw = queueSection.split('### Completed')[1] || '';

  const parseTasks = (section: string): BuilderTask[] => {
    // Parse structured tasks: ### [DATE] [SEVERITY] [CATEGORY] Task description
    const taskBlocks = section.split(/(?=^### )/gm).filter(b => b.trim());
    return taskBlocks.map(block => {
      const headerMatch = block.match(/^### \[?(\d{4}-\d{2}-\d{2})?\]?\s*\[?(HIGH|MEDIUM|LOW|CRITICAL)?\]?\s*\[?(.*?)\]?\s*(.*)/m);
      const gapMatch = block.match(/Gap found:\s*(.*)/i);
      const fixMatch = block.match(/Suggested fix:\s*(.*)/i);
      const statusMatch = block.match(/Status:\s*(.*)/i);
      return {
        text: headerMatch?.[4]?.trim() || block.split('\n')[0].replace(/^### /, '').trim(),
        date: headerMatch?.[1] || '',
        severity: headerMatch?.[2] || 'MEDIUM',
        category: headerMatch?.[3] || '',
        gap: gapMatch?.[1]?.trim() || '',
        suggestedFix: fixMatch?.[1]?.trim() || '',
        status: statusMatch?.[1]?.trim() || 'PENDING',
      };
    });
  };

  // Also parse simple "- task" lines
  const parseSimple = (section: string): BuilderTask[] => {
    return (section.match(/^- .+$/gm) || []).map(line => ({
      text: line.replace(/^- /, '').trim(),
      date: '', severity: 'MEDIUM', category: '', gap: '', suggestedFix: '', status: 'PENDING',
    }));
  };

  const pendingTasks = parseTasks(pendingRaw).length > 0 ? parseTasks(pendingRaw) : parseSimple(pendingRaw);
  const completedTasks = parseTasks(completedRaw).length > 0 ? parseTasks(completedRaw) : parseSimple(completedRaw);

  return {
    pending: pendingTasks.length,
    completed: completedTasks.length,
    pendingTasks,
    completedTasks,
    raw: pendingRaw.trim()
  };
}

function getTradeSummary() {
  try {
    const db = new Database(JOURNAL_DB, { readonly: true });
    const today = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins,
             SUM(CASE WHEN status='LOSS' THEN 1 ELSE 0 END) as losses,
             ROUND(SUM(CASE WHEN status IN ('WIN','LOSS') THEN pnl ELSE 0 END),2) as pnl,
             COUNT(CASE WHEN status='OPEN' THEN 1 END) as open_trades
      FROM trades WHERE date(entry_date) = date('now') OR status='OPEN'
    `).get() as Record<string, number>;
    const allTime = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status='WIN' THEN 1 ELSE 0 END) as wins, ROUND(SUM(pnl),2) as pnl
      FROM trades WHERE status IN ('WIN','LOSS')
    `).get() as Record<string, number>;
    db.close();
    return { today, allTime };
  } catch {
    return { today: { total: 0, wins: 0, losses: 0, pnl: 0, open_trades: 0 }, allTime: { total: 0, wins: 0, pnl: 0 } };
  }
}

function getAgentStatuses() {
  try {
    const raw = JSON.parse(fs.readFileSync(AGENTS_DB, 'utf-8'));
    // Return enriched agent summaries for the dashboard
    const agents: Record<string, {
      id: string; name: string; status: string; market: string;
      description: string; winRate: number; totalPnl: number;
      trades: number; activeTrades: number; lastUpdated: string;
      hasMemory: boolean; memoryFresh: boolean;
    }> = {};
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    for (const [id, agent] of Object.entries(raw)) {
      const a = agent as Record<string, unknown>;
      const meta = (a.meta || {}) as Record<string, unknown>;
      const perf = (a.performance || {}) as Record<string, number>;
      const activeTrades = Array.isArray(a.active_trades) ? a.active_trades.length : 0;
      const lastUpdated = (a.last_updated as string) || '';

      // Check if agent has a brain memory file
      const memoryMap: Record<string, string> = {
        fx: 'agents/sterling.md', crypto: 'agents/bitcoin-bob.md',
        futures: 'agents/pivot-pete.md', boba: 'agents/boba.md',
        spx: 'agents/spx-sniper.md', professor: 'agents/professor.md',
        auditor: 'agents/auditor.md', orb: 'agents/overseer.md',
      };
      const memFile = memoryMap[id];
      let hasMemory = false;
      let memoryFresh = false;
      if (memFile) {
        try {
          const stat = fs.statSync(path.join(BRAIN_DIR, memFile));
          hasMemory = true;
          memoryFresh = (now - stat.mtime.getTime()) < sevenDays;
        } catch { /* no file */ }
      }

      agents[id] = {
        id,
        name: (meta.name as string) || id,
        status: (a.status as string) || 'UNKNOWN',
        market: (meta.market as string) || (meta.assets as string) || '',
        description: (meta.description as string) || '',
        winRate: perf.win_rate || 0,
        totalPnl: perf.total_pnl || 0,
        trades: perf.trades || 0,
        activeTrades,
        lastUpdated,
        hasMemory,
        memoryFresh,
      };
    }
    return agents;
  } catch {
    return {};
  }
}

function getSelfHealingStatus() {
  const file = readBrainFile('self-healing.md');
  if (!file) return { knownIssues: 0, remediations: 0, newIssues: 0, lastModified: null };
  const content = file.content;
  const knownIssues = (content.match(/^### \d+\./gm) || []).length;
  const remediationSection = content.split('## Remediation Log')[1]?.split('\n## ')[0] || '';
  const remediations = (remediationSection.match(/^- /gm) || []).length;
  const newIssuesSection = content.split('## New Issues Queue')[1] || '';
  const newIssues = (newIssuesSection.match(/^- /gm) || []).length;
  return { knownIssues, remediations, newIssues, lastModified: file.modified };
}

// Check what services are reachable
async function getConnections() {
  const connections: Record<string, { status: string; label: string; detail: string }> = {};

  // Next.js (always up if this API is responding)
  connections.nextjs = { status: 'connected', label: 'Next.js Dashboard', detail: 'localhost:3000' };

  // Journal DB
  try {
    const db = new Database(JOURNAL_DB, { readonly: true });
    const count = (db.prepare('SELECT COUNT(*) as c FROM trades').get() as { c: number }).c;
    db.close();
    connections.database = { status: 'connected', label: 'Journal DB', detail: `${count} trades` };
  } catch {
    connections.database = { status: 'error', label: 'Journal DB', detail: 'Cannot open' };
  }

  // Brain files
  const brainExists = fs.existsSync(path.join(BRAIN_DIR, 'master-tracker.md'));
  connections.brain = {
    status: brainExists ? 'connected' : 'error',
    label: 'Brain (18 files)',
    detail: brainExists ? BRAIN_DIR : 'Missing'
  };

  // agents_db.json
  try {
    const agents = JSON.parse(fs.readFileSync(AGENTS_DB, 'utf-8'));
    const agentCount = Object.keys(agents).length;
    connections.agents = { status: 'connected', label: 'Agent Runner', detail: `${agentCount} agents tracked` };
  } catch {
    connections.agents = { status: 'error', label: 'Agent Runner', detail: 'agents_db.json missing' };
  }

  // OpenClaw (try to reach the gateway)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://127.0.0.1:3001/', { signal: controller.signal });
    clearTimeout(timeout);
    connections.openclaw = { status: res.ok || res.status === 404 ? 'connected' : 'error', label: 'OpenClaw Gateway', detail: 'localhost:3001' };
  } catch {
    connections.openclaw = { status: 'offline', label: 'OpenClaw Gateway', detail: 'Not reachable' };
  }

  // Control API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('http://localhost:3000/api/control', { signal: controller.signal });
    clearTimeout(timeout);
    connections.controlApi = { status: res.ok ? 'connected' : 'error', label: 'Control API', detail: '/api/control' };
  } catch {
    connections.controlApi = { status: 'offline', label: 'Control API', detail: 'Not reachable' };
  }

  // Discord (check if webhook env var exists)
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const hasDiscord = envContent.includes('DISCORD_CHIEF_WEBHOOK');
    connections.discord = { status: hasDiscord ? 'configured' : 'missing', label: 'Discord', detail: hasDiscord ? 'Webhook configured' : 'No webhook' };
  } catch {
    connections.discord = { status: 'missing', label: 'Discord', detail: 'No .env.local' };
  }

  return connections;
}

function getCronSchedule() {
  return [
    { id: 'chief-decision-loop', name: 'Chief Decision Loop', schedule: '*/30 9-16 * * 1-5', agent: 'chief', category: 'autonomous', description: 'Reads brain, checks agents, enforces rules, logs decisions' },
    { id: 'system-builder', name: 'System Builder', schedule: '0 */3 * * *', agent: 'chief', category: 'autonomous', description: 'Audits brain vs codebase, fills gaps, advances roadmap' },
    { id: 'brain-integrity-check', name: 'Brain Integrity', schedule: '0 7 * * *', agent: 'chief', category: 'autonomous', description: 'Validates all 18 files, checks freshness, auto-repairs' },
    { id: 'eod-brain-update', name: 'EOD Brain Update', schedule: '45 16 * * 1-5', agent: 'chief', category: 'autonomous', description: 'Writes daily log, updates stats, detects patterns' },
    { id: 'morning-briefing', name: 'Morning Brief', schedule: '0 8 * * 1-5', agent: 'chief', category: 'reporting', description: 'Pre-market summary to Discord #chief-main' },
    { id: 'london-open', name: 'London Open', schedule: '0 3 * * 1-5', agent: 'sterling', category: 'trading', description: 'Sterling reads memory, assesses GBP/USD + EUR/USD' },
    { id: 'ny-overlap', name: 'NY Overlap', schedule: '30 8 * * 1-5', agent: 'sterling', category: 'trading', description: 'Sterling checks FX positions at NY-London overlap' },
    { id: 'market-open-check', name: 'Market Open', schedule: '30 9 * * 1-5', agent: 'chief', category: 'reporting', description: 'Confirms all agents active at NYSE open' },
    { id: 'midday-check', name: 'Midday Check', schedule: '0 12 * * 1-5', agent: 'chief', category: 'reporting', description: 'P&L summary, kill switch threshold check' },
    { id: 'sterling-session-close', name: 'Sterling Close', schedule: '0 12 * * 1-5', agent: 'sterling', category: 'trading', description: 'Sterling closes 4-hour window, reports FX session' },
    { id: 'eod-professor-grade', name: 'Professor Grades', schedule: '15 16 * * 1-5', agent: 'professor', category: 'learning', description: 'Grades every trade, writes feedback to agent memory' },
    { id: 'eod-overseer-audit', name: 'Overseer Audit', schedule: '30 16 * * 1-5', agent: 'overseer', category: 'risk', description: 'Daily risk audit, kill switch if thresholds breached' },
    { id: 'bitcoin-bob-watch', name: 'Bitcoin Bob Scan', schedule: '0 */4 * * *', agent: 'bitcoin-bob', category: 'trading', description: 'Reads memory, scans BTC/ETH for impulse zones' },
    { id: 'sterling-forex-scan', name: 'Sterling FX Scan', schedule: '0 */2 * * 1-5', agent: 'sterling', category: 'trading', description: 'Scans for fresh FX zones, applies Professor lessons' },
    { id: 'weekly-evolution-engine', name: 'Evolution Engine', schedule: '0 18 * * 0', agent: 'chief', category: 'evolution', description: 'Weekly brain self-improvement — promotes patterns, mutates strategies' },
  ];
}

// Describe the 4 learning loops with what fires them
function getLearningLoopsMeta() {
  return [
    {
      id: 'professor-feedback', name: 'Professor → Agent Feedback', frequency: 'Daily 4:15 PM',
      trigger: 'eod-professor-grade', description: 'Professor grades trades, writes lessons to agent memory files. Agents read lessons next session.',
      icon: '🎓',
    },
    {
      id: 'pattern-evolution', name: 'Pattern → Strategy Evolution', frequency: 'Weekly Sunday 6 PM',
      trigger: 'weekly-evolution-engine', description: 'Chief detects patterns → HYPOTHESIS → CONFIRMED → APPLIED. Evolution Engine mutates strategies.',
      icon: '🧬',
    },
    {
      id: 'self-healing', name: 'Self-Healing', frequency: 'On-demand',
      trigger: 'watchdog', description: 'Watchdog detects issue → Chief reads playbook → applies auto-fix or escalates to Jack.',
      icon: '🔧',
    },
    {
      id: 'system-builder-loop', name: 'System Builder', frequency: 'Every 3 hours',
      trigger: 'system-builder', description: 'Audits brain vs code → fixes docs → queues tasks → advances roadmap. The meta-loop.',
      icon: '🏗️',
    },
  ];
}

export async function GET(request: NextRequest) {
  // Admin-only access
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.authorized) {
    return adminCheck.error!;
  }

  const brainHealth = getBrainHealth();
  const decisions = getRecentDecisions();
  const patterns = getLearningPatterns();
  const builderQueue = getSystemBuilderQueue();
  const trades = getTradeSummary();
  const agents = getAgentStatuses();
  const cronJobs = getCronSchedule();
  const connections = await getConnections();
  const loops = getLearningLoopsMeta();
  const selfHealing = getSelfHealingStatus();
  const masterTracker = readBrainFile('master-tracker.md');
  const roadmap = readBrainFile('roadmap.md');

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    brain: { health: brainHealth, decisions, patterns, builderQueue },
    trading: trades,
    agents,
    cron: cronJobs,
    connections,
    loops,
    selfHealing,
    masterTracker: masterTracker ? { modified: masterTracker.modified, size: masterTracker.size } : null,
    roadmap: roadmap ? { modified: roadmap.modified, size: roadmap.size } : null,
  });
}
