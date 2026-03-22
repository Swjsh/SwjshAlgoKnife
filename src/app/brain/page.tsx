'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ADMIN_EMAILS } from '@/lib/adminEmails';
import Link from 'next/link';

// ═══════════════════════════════════════════════════════════════
// BRAIN COMMAND CENTER V3 — SwjshAK Autonomous Trading System
// System Builder expansion: task queue, agent collaboration,
// OpenClaw confirmation, self-healing, and full brain viz
// ═══════════════════════════════════════════════════════════════

interface BrainFile {
  name: string;
  exists: boolean;
  modified: string | null;
  ageHours: number | null;
  stale: boolean;
  size: number;
  category: string;
}

interface Decision {
  timestamp: string;
  decision: string;
  reason: string;
  action: string;
  severity: 'info' | 'action' | 'warning' | 'critical' | 'builder';
  raw: string;
}

interface Connection {
  status: string;
  label: string;
  detail: string;
}

interface LearningLoop {
  id: string;
  name: string;
  frequency: string;
  trigger: string;
  description: string;
  icon: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  agent: string;
  category: string;
  description: string;
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

interface AgentInfo {
  id: string;
  name: string;
  status: string;
  market: string;
  description: string;
  winRate: number;
  totalPnl: number;
  trades: number;
  activeTrades: number;
  lastUpdated: string;
  hasMemory: boolean;
  memoryFresh: boolean;
}

interface SelfHealingInfo {
  knownIssues: number;
  remediations: number;
  newIssues: number;
  lastModified: string | null;
}

interface BrainData {
  timestamp: string;
  brain: {
    health: {
      files: BrainFile[];
      total: number;
      present: number;
      fresh: number;
      staleCount: number;
      score: number;
    };
    decisions: Decision[];
    patterns: { hypotheses: number; confirmed: number; applied: number; invalidated: number; entries: string[] };
    builderQueue: {
      pending: number;
      completed: number;
      pendingTasks: BuilderTask[];
      completedTasks: BuilderTask[];
      raw: string;
    };
  };
  trading: {
    today: { total: number; wins: number; losses: number; pnl: number; open_trades: number };
    allTime: { total: number; wins: number; pnl: number };
  };
  agents: Record<string, AgentInfo>;
  cron: CronJob[];
  connections: Record<string, Connection>;
  loops: LearningLoop[];
  selfHealing: SelfHealingInfo;
  masterTracker: { modified: string; size: number } | null;
  roadmap: { modified: string; size: number } | null;
}

// ── Cron parser ──────────────────────────────────────────────
function getNextCronFire(cron: string): Date {
  const now = new Date();
  const parts = cron.split(' ');
  const [minute, hour, , , dayOfWeek] = parts;
  const next = new Date(now);
  next.setSeconds(0, 0);

  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2));
    const nextMin = Math.ceil((now.getMinutes() + 1) / interval) * interval;
    if (nextMin >= 60) {
      next.setHours(now.getHours() + 1, 0);
    } else {
      next.setMinutes(nextMin);
    }
    if (hour.includes('-')) {
      const [start, end] = hour.split('-').map(Number);
      if (next.getHours() < start) next.setHours(start, 0);
      else if (next.getHours() > end) {
        next.setDate(next.getDate() + 1);
        next.setHours(start, 0);
      }
    }
  } else if (hour.startsWith('*/')) {
    const interval = parseInt(hour.slice(2));
    const nextHour = Math.ceil((now.getHours() + 1) / interval) * interval;
    next.setMinutes(parseInt(minute));
    if (nextHour >= 24 || next <= now) {
      next.setDate(next.getDate() + 1);
      next.setHours(parseInt(minute) === 0 ? 0 : interval, parseInt(minute));
    } else {
      next.setHours(nextHour);
    }
  } else {
    next.setHours(parseInt(hour), parseInt(minute));
    if (next <= now) next.setDate(next.getDate() + 1);
  }

  if (dayOfWeek === '0') {
    while (next.getDay() !== 0) next.setDate(next.getDate() + 1);
  } else if (dayOfWeek === '1-5') {
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  }

  return next;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'NOW';
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

// ── Colors ───────────────────────────────────────────────────
const CAT_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  autonomous: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)', text: '#c084fc', glow: '0 0 20px rgba(168,85,247,0.15)' },
  reporting: { bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.3)', text: '#67e8f9', glow: '0 0 20px rgba(6,182,212,0.15)' },
  trading: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7', glow: '0 0 20px rgba(16,185,129,0.15)' },
  learning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', text: '#fcd34d', glow: '0 0 20px rgba(245,158,11,0.15)' },
  risk: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5', glow: '0 0 20px rgba(239,68,68,0.15)' },
  evolution: { bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.3)', text: '#f9a8d4', glow: '0 0 20px rgba(236,72,153,0.15)' },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  info: { color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.12)', icon: 'ℹ', label: 'INFO' },
  action: { color: '#fcd34d', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', icon: '⚡', label: 'ACTION' },
  warning: { color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', icon: '⚠', label: 'WARNING' },
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', icon: '🚨', label: 'CRITICAL' },
  builder: { color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.2)', icon: '🏗', label: 'BUILDER' },
};

const AGENT_ICONS: Record<string, string> = {
  chief: '🧠', sterling: '💷', 'bitcoin-bob': '₿', 'pivot-pete': '📊',
  boba: '🫧', 'spx-sniper': '🎯', professor: '🎓', overseer: '🛡️', auditor: '🔍',
  fx: '💷', crypto: '₿', futures: '📊', spx: '🎯', orb: '🏃',
};

const CONNECTION_ICONS: Record<string, string> = {
  nextjs: '▲', database: '🗄️', brain: '🧠', agents: '🤖', openclaw: '🦞', controlApi: '🎮', discord: '💬',
};

const MARKET_COLORS: Record<string, string> = {
  Forex: '#3b82f6', Crypto: '#f59e0b', Options: '#ec4899', Futures: '#8b5cf6', Oversight: '#64748b',
};

// ═══════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════

function GlassCard({ children, glow = '', style = {} }: { children: React.ReactNode; glow?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(17,17,22,0.6)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16,
      boxShadow: glow || '0 4px 30px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

function PulseOrb({ color, size = 8, active = true }: { color: string; size?: number; active?: boolean }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: color,
        animation: active ? 'pulse 2s ease-in-out infinite' : 'none', opacity: active ? 0.4 : 0,
      }} />
      <span style={{
        position: 'relative', display: 'block', width: size, height: size, borderRadius: '50%',
        backgroundColor: color, opacity: active ? 1 : 0.3,
      }} />
    </span>
  );
}

function ProgressRing({ value, max, size = 80, stroke = 6, color = '#a855f7' }: { value: number; max: number; size?: number; stroke?: number; color?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? (value / max) * circumference : 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={circumference - progress}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="#f8fafc" fontSize={size * 0.25} fontWeight="700" style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {Math.round((value / max) * 100)}%
      </text>
    </svg>
  );
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#f8fafc' }}>{title}</h2>
        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{subtitle}</div>
      </div>
      {right}
    </div>
  );
}

// ── Connections Status Bar ───────────────────────────────────
function ConnectionsBar({ connections }: { connections: Record<string, Connection> }) {
  const statusColor = (s: string) => {
    if (s === 'connected') return '#10b981';
    if (s === 'configured') return '#06b6d4';
    if (s === 'offline') return '#64748b';
    if (s === 'missing') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px',
      background: 'rgba(17,17,22,0.5)', backdropFilter: 'blur(12px)',
      borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)',
      marginBottom: 16,
    }}>
      {Object.entries(connections).map(([key, conn]) => {
        const isOpenClaw = key === 'openclaw';
        return (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            borderRadius: 10,
            background: isOpenClaw ? (conn.status === 'connected' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)') : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isOpenClaw ? (conn.status === 'connected' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.25)') : `${statusColor(conn.status)}22`}`,
            transition: 'all 0.3s ease',
            flex: '1 1 auto', minWidth: 140,
            boxShadow: isOpenClaw && conn.status === 'connected' ? '0 0 15px rgba(16,185,129,0.1)' : 'none',
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{CONNECTION_ICONS[key] || '🔗'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PulseOrb color={statusColor(conn.status)} size={6} active={conn.status === 'connected'} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{conn.label}</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conn.detail}
              </div>
            </div>
            <span style={{
              fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
              color: statusColor(conn.status),
              background: `${statusColor(conn.status)}15`,
              border: `1px solid ${statusColor(conn.status)}30`,
              textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
            }}>
              {conn.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#a855f7', icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: string }) {
  return (
    <div style={{
      padding: '18px', borderRadius: 14,
      background: 'rgba(17,17,22,0.6)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// OPENCLAW ORCHESTRATION PANEL
// ══════════════════════════════════════════════════════════════
function OpenClawPanel({ connections, cron, now }: { connections: Record<string, Connection>; cron: CronJob[]; now: number }) {
  const oc = connections?.openclaw;
  const isConnected = oc?.status === 'connected';

  // Find the autonomous cron jobs that OpenClaw orchestrates
  const autonomousJobs = cron.filter(j => j.category === 'autonomous');
  const nextAutonomous = autonomousJobs.map(j => ({
    ...j,
    nextFire: getNextCronFire(j.schedule),
  })).sort((a, b) => a.nextFire.getTime() - b.nextFire.getTime());
  const nextUp = nextAutonomous[0];
  const msToNext = nextUp ? nextUp.nextFire.getTime() - now : 0;

  return (
    <GlassCard glow={isConnected ? '0 0 30px rgba(16,185,129,0.08)' : '0 0 30px rgba(239,68,68,0.08)'}>
      <div style={{ padding: '16px 20px' }}>
        {/* Header with big status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
            background: isConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `2px solid ${isConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            boxShadow: isConnected ? '0 0 25px rgba(16,185,129,0.15)' : 'none',
            animation: isConnected ? 'glow-pulse 3s ease-in-out infinite' : 'none',
          }}>🦞</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>OpenClaw Gateway</h2>
              <span style={{
                fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
                color: isConnected ? '#10b981' : '#ef4444',
                background: isConnected ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${isConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {isConnected ? '● LIVE' : '○ OFFLINE'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
              {isConnected
                ? `Orchestrating ${cron.length} heartbeats • localhost:3001`
                : 'Gateway not reachable — heartbeats paused'}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#c084fc' }}>{autonomousJobs.length}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Autonomous</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#67e8f9' }}>{cron.length}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Jobs</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#6ee7b7' }}>{cron.filter(c => c.category === 'trading').length}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trading</div>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fcd34d' }}>{cron.filter(c => c.category === 'learning' || c.category === 'evolution').length}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Learning</div>
          </div>
        </div>

        {/* Next heartbeat countdown */}
        {nextUp && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            borderRadius: 12, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)',
          }}>
            <div style={{ fontSize: 22 }}>{AGENT_ICONS[nextUp.agent] || '⚡'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>Next: {nextUp.name}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{nextUp.description}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#c084fc', fontVariantNumeric: 'tabular-nums' }}>{formatCountdown(msToNext)}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>
                {nextUp.nextFire.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ══════════════════════════════════════════════════════════════
// LIVE ACTIVITY FEED
// ══════════════════════════════════════════════════════════════
function LiveActivityFeed({ decisions }: { decisions: Decision[] }) {
  const recentDecisions = decisions.slice(0, 10);

  const getSeverityIcon = (severity: string) => {
    const icons: Record<string, string> = {
      critical: '🚨', warning: '⚠️', action: '⚡', builder: '🏗️', info: 'ℹ️',
    };
    return icons[severity] || '○';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: '#f87171', warning: '#fb923c', action: '#fcd34d', builder: '#c084fc', info: '#94a3b8',
    };
    return colors[severity] || '#94a3b8';
  };

  const formatRelativeTime = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    if (secs > 0) return `${secs}s ago`;
    return 'now';
  };

  if (recentDecisions.length === 0) {
    return (
      <div style={{
        padding: '24px', textAlign: 'center', color: '#475569',
        background: 'rgba(17,17,22,0.4)', borderRadius: 12,
      }}>
        <div style={{ fontSize: 18, marginBottom: 6 }}>⏳</div>
        <div style={{ fontSize: 12 }}>No recent activity</div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      maxHeight: 320, overflowY: 'auto', padding: 0,
    }}>
      {recentDecisions.map((d, i) => (
        <div key={i} style={{
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', gap: 10, alignItems: 'flex-start',
          borderLeft: `3px solid ${getSeverityColor(d.severity)}`,
        }}>
          <div style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
            {getSeverityIcon(d.severity)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: getSeverityColor(d.severity),
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {d.severity}
              </span>
              <span style={{ fontSize: 9, color: '#64748b' }}>
                {formatRelativeTime(d.timestamp)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#e2e8f0', fontFamily: 'ui-monospace, monospace', lineHeight: 1.4 }}>
              {d.decision}
            </div>
            {d.action && (
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>
                → {d.action}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// AGENT COLLABORATION GRID
// ══════════════════════════════════════════════════════════════
function AgentGrid({ agents, cron }: { agents: Record<string, AgentInfo>; cron: CronJob[] }) {
  const agentList = Object.values(agents);
  if (agentList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 30, color: '#475569' }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🤖</div>
        <div style={{ fontSize: 12 }}>No agents loaded</div>
      </div>
    );
  }

  // Group: traders vs oversight
  const traders = agentList.filter(a => a.market !== 'Oversight');
  const oversight = agentList.filter(a => a.market === 'Oversight');

  const renderAgent = (a: AgentInfo) => {
    const statusColor = a.status === 'ACTIVE' ? '#10b981' : a.status === 'PAUSED' ? '#f59e0b' : '#ef4444';
    const marketColor = MARKET_COLORS[a.market] || '#64748b';
    const agentCronJobs = cron.filter(c => {
      const nameMap: Record<string, string[]> = {
        fx: ['sterling'], crypto: ['bitcoin-bob'], futures: ['pivot-pete'],
        boba: ['boba'], spx: ['spx-sniper'], professor: ['professor'],
        auditor: ['auditor'], orb: ['overseer'],
      };
      return (nameMap[a.id] || []).some(n => c.agent === n);
    });

    return (
      <div key={a.id} style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.05)`,
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, background: `${marketColor}15`, border: `1px solid ${marketColor}30`,
          }}>
            {AGENT_ICONS[a.id] || '🤖'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{a.name}</span>
              <PulseOrb color={statusColor} size={5} active={a.status === 'ACTIVE'} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                background: `${marketColor}15`, color: marketColor, border: `1px solid ${marketColor}30`,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{a.market}</span>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30`,
                textTransform: 'uppercase',
              }}>{a.status}</span>
            </div>
          </div>
        </div>

        {/* Stats row - enhanced */}
        {a.market !== 'Oversight' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)' }}>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>WIN RATE</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: a.winRate >= 50 ? '#6ee7b7' : '#fcd34d', marginTop: 2 }}>{a.winRate}%</div>
              </div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: `${a.totalPnl >= 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)'}`, border: `1px solid ${a.totalPnl >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}` }}>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>P&L</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: a.totalPnl >= 0 ? '#6ee7b7' : '#fca5a5', marginTop: 2 }}>${a.totalPnl}</div>
              </div>
              <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.1)' }}>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>TRADES</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#67e8f9', marginTop: 2 }}>{a.trades}</div>
              </div>
            </div>
            {/* Last action line */}
            <div style={{ fontSize: 9, color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
              Last seen: {a.lastUpdated ? `${formatTimeAgo(a.lastUpdated)}` : 'Never'}
            </div>
          </div>
        )}

        {/* Brain memory connection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: agentCronJobs.length > 0 ? 8 : 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
            borderRadius: 6, fontSize: 10,
            background: a.hasMemory ? (a.memoryFresh ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)') : 'rgba(239,68,68,0.06)',
            border: `1px solid ${a.hasMemory ? (a.memoryFresh ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)') : 'rgba(239,68,68,0.15)'}`,
            color: a.hasMemory ? (a.memoryFresh ? '#6ee7b7' : '#fcd34d') : '#fca5a5',
          }}>
            <span>🧠</span>
            {a.hasMemory ? (a.memoryFresh ? 'Memory synced' : 'Memory stale') : 'No memory file'}
          </div>
          {a.activeTrades > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
              borderRadius: 6, fontSize: 10,
              background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)', color: '#67e8f9',
            }}>
              🔓 {a.activeTrades} open
            </div>
          )}
        </div>

        {/* Linked cron jobs */}
        {agentCronJobs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {agentCronJobs.map(c => {
              const cat = CAT_COLORS[c.category] || CAT_COLORS.reporting;
              return (
                <span key={c.id} style={{
                  fontSize: 9, padding: '2px 7px', borderRadius: 8,
                  background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`,
                  fontWeight: 600,
                }}>⏰ {c.name}</span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {/* Traders */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px',
        padding: '4px 4px 8px', borderBottom: '1px solid rgba(16,185,129,0.15)', marginBottom: 8,
      }}>
        Trading Agents ({traders.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 16 }}>
        {traders.map(renderAgent)}
      </div>

      {/* Oversight */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px',
        padding: '4px 4px 8px', borderBottom: '1px solid rgba(148,163,184,0.15)', marginBottom: 8,
      }}>
        Oversight Agents ({oversight.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {oversight.map(renderAgent)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// SYSTEM BUILDER SECTION (expanded)
// ══════════════════════════════════════════════════════════════
function SystemBuilderSection({ queue, selfHealing, cron, now }: {
  queue: BrainData['brain']['builderQueue'];
  selfHealing: SelfHealingInfo;
  cron: CronJob[];
  now: number;
}) {
  const builderJob = cron.find(c => c.id === 'system-builder');
  const integrityJob = cron.find(c => c.id === 'brain-integrity-check');
  const builderNext = builderJob ? getNextCronFire(builderJob.schedule) : null;
  const integrityNext = integrityJob ? getNextCronFire(integrityJob.schedule) : null;

  return (
    <GlassCard glow="0 0 30px rgba(168,85,247,0.06)">
      <SectionHeader title="System Builder" subtitle="Autonomous brain auditor — finds gaps, queues fixes, advances roadmap" />
      <div style={{ padding: '0 20px 20px' }}>

        {/* Builder + Integrity heartbeat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {builderJob && builderNext && (
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>🏗️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#c084fc' }}>{builderJob.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{builderJob.schedule}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#c084fc', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCountdown(builderNext.getTime() - now)}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{builderJob.description}</div>
            </div>
          )}
          {integrityJob && integrityNext && (
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>🔍</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#67e8f9' }}>{integrityJob.name}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{integrityJob.schedule}</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#67e8f9', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCountdown(integrityNext.getTime() - now)}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{integrityJob.description}</div>
            </div>
          )}
        </div>

        {/* Self-healing + Queue summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div style={{ padding: '10px', borderRadius: 10, background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: queue.pending > 0 ? '#fcd34d' : '#64748b' }}>{queue.pending}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Pending Tasks</div>
          </div>
          <div style={{ padding: '10px', borderRadius: 10, background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{queue.completed}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Completed</div>
          </div>
          <div style={{ padding: '10px', borderRadius: 10, background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: selfHealing.knownIssues > 0 ? '#fca5a5' : '#64748b' }}>{selfHealing.knownIssues}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Known Issues</div>
          </div>
          <div style={{ padding: '10px', borderRadius: 10, background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#67e8f9' }}>{selfHealing.remediations}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Auto-Healed</div>
          </div>
        </div>

        {/* Pending Tasks List */}
        {queue.pendingTasks && queue.pendingTasks.length > 0 ? (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
              Pending Queue
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {queue.pendingTasks.map((task, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)',
                  borderLeft: `3px solid ${task.severity === 'CRITICAL' ? '#ef4444' : task.severity === 'HIGH' ? '#fb923c' : '#fcd34d'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{task.text}</span>
                    <span style={{
                      fontSize: 9, padding: '1px 7px', borderRadius: 10, fontWeight: 700,
                      color: task.severity === 'CRITICAL' ? '#ef4444' : task.severity === 'HIGH' ? '#fb923c' : '#fcd34d',
                      background: task.severity === 'CRITICAL' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                      textTransform: 'uppercase',
                    }}>{task.severity || 'MEDIUM'}</span>
                  </div>
                  {task.gap && <div style={{ fontSize: 10, color: '#94a3b8' }}>Gap: {task.gap}</div>}
                  {task.suggestedFix && <div style={{ fontSize: 10, color: '#67e8f9', marginTop: 2 }}>Fix: {task.suggestedFix}</div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '20px', borderRadius: 12,
            background: 'rgba(16,185,129,0.03)', border: '1px dashed rgba(16,185,129,0.15)',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>✅</div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Queue clear — System Builder will audit brain on next fire</div>
            {builderNext && (
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
                Next audit in {formatCountdown(builderNext.getTime() - now)}
              </div>
            )}
          </div>
        )}

        {/* Completed Tasks */}
        {queue.completedTasks && queue.completedTasks.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
              Recently Completed
            </div>
            {queue.completedTasks.slice(0, 5).map((task, i) => (
              <div key={i} style={{
                padding: '6px 12px', borderRadius: 8, marginBottom: 4,
                background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.08)',
                fontSize: 11, color: '#94a3b8',
              }}>
                ✓ {task.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ── Learning Loops V2 ────────────────────────────────────────
function LearningLoopsV2({ loops, patterns, cron }: { loops: LearningLoop[]; patterns: BrainData['brain']['patterns']; cron: CronJob[] }) {
  const total = patterns.hypotheses + patterns.confirmed + patterns.applied + patterns.invalidated;
  const stages = [
    { label: 'Hypotheses', count: patterns.hypotheses, color: '#94a3b8', icon: '🔬' },
    { label: 'Confirmed', count: patterns.confirmed, color: '#f59e0b', icon: '✓' },
    { label: 'Applied', count: patterns.applied, color: '#10b981', icon: '⚡' },
    { label: 'Invalidated', count: patterns.invalidated, color: '#ef4444', icon: '✗' },
  ];

  return (
    <div style={{ padding: '0 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {stages.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: '#334155', fontSize: 14 }}>→</span>}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20,
              background: `${s.color}11`, border: `1px solid ${s.color}33`,
            }}>
              <span style={{ fontSize: 11 }}>{s.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.count}</span>
              <span style={{ fontSize: 10, color: '#64748b' }}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.04)', display: 'flex', overflow: 'hidden', gap: 2, marginBottom: 16 }}>
          {stages.filter(s => s.count > 0).map(s => (
            <div key={s.label} style={{ flex: s.count / total, background: s.color, borderRadius: 3, transition: 'flex 1s ease-out' }} />
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {loops.map(loop => {
          const triggerJob = cron.find(c => c.id === loop.trigger);
          return (
            <div key={loop.id} style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{loop.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{loop.name}</div>
                  <div style={{ fontSize: 10, color: '#06b6d4', fontWeight: 600 }}>{loop.frequency}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, marginBottom: 8 }}>
                {loop.description}
              </div>
              {triggerJob && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                  borderRadius: 6, background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)',
                  fontSize: 10, color: '#67e8f9',
                }}>
                  <span style={{ opacity: 0.7 }}>⏰</span>
                  {triggerJob.name} • {triggerJob.schedule}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Decisions Feed V2 ────────────────────────────────────────
function DecisionsFeed({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🧘</div>
        <div style={{ fontSize: 13 }}>No decisions yet. Brain is warming up.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 480, overflowY: 'auto' }}>
      {decisions.map((d, i) => {
        const sev = SEVERITY_CONFIG[d.severity] || SEVERITY_CONFIG.info;
        return (
          <div key={i} style={{
            padding: '12px 14px', borderRadius: 12,
            background: sev.bg, border: `1px solid ${sev.border}`,
            borderLeft: `3px solid ${sev.color}`,
            animation: i < 3 ? 'slide-in 0.3s ease-out' : 'none',
            animationDelay: `${i * 0.05}s`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>
                {d.timestamp ? new Date(d.timestamp.replace(' ', 'T')).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                }) : ''}
              </span>
              <span style={{
                fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                color: sev.color, background: `${sev.color}18`, border: `1px solid ${sev.color}30`,
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {sev.icon} {sev.label}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, lineHeight: 1.45, marginBottom: d.reason || d.action ? 8 : 0 }}>
              {d.decision}
            </div>
            {(d.reason || d.action) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {d.reason && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8',
                    padding: '3px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span style={{ color: '#64748b', fontWeight: 600, fontSize: 10 }}>WHY</span>
                    {d.reason}
                  </div>
                )}
                {d.action && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#fcd34d',
                    padding: '3px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.05)',
                    border: '1px solid rgba(245,158,11,0.1)',
                  }}>
                    <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 10 }}>DO</span>
                    {d.action}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Brain Health Grid ────────────────────────────────────────
function BrainHealthGrid({ files }: { files: BrainFile[] }) {
  const grouped = {
    core: files.filter(f => f.category === 'core'),
    system: files.filter(f => f.category === 'system'),
    agent: files.filter(f => f.category === 'agent'),
  };
  const categoryLabels: Record<string, { label: string; color: string }> = {
    core: { label: 'Core Operations', color: '#a855f7' },
    system: { label: 'System Knowledge', color: '#06b6d4' },
    agent: { label: 'Agent Memory', color: '#10b981' },
  };

  return (
    <div style={{ padding: '8px 16px 16px' }}>
      {Object.entries(grouped).map(([cat, catFiles]) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: categoryLabels[cat].color,
            textTransform: 'uppercase', letterSpacing: '1px', padding: '4px 0 8px',
            borderBottom: `1px solid ${categoryLabels[cat].color}20`, marginBottom: 8,
          }}>
            {categoryLabels[cat].label} ({catFiles.filter(f => f.exists && !f.stale).length}/{catFiles.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
            {catFiles.map(f => (
              <div key={f.name} style={{
                padding: '8px 10px', borderRadius: 8,
                background: f.exists ? (f.stale ? 'rgba(245,158,11,0.05)' : 'rgba(16,185,129,0.04)') : 'rgba(239,68,68,0.05)',
                border: `1px solid ${f.exists ? (f.stale ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.12)') : 'rgba(239,68,68,0.15)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <PulseOrb color={f.exists ? (f.stale ? '#f59e0b' : '#10b981') : '#ef4444'} size={5} active={f.exists && !f.stale} />
                  <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name.replace('agents/', '').replace('.md', '')}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {f.exists ? (f.modified ? formatTimeAgo(f.modified) : 'unknown') : 'MISSING'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cron Timeline V2 ────────────────────────────────────────
function CronTimeline({ jobs, now }: { jobs: CronJob[]; now: number }) {
  const sorted = [...jobs].map(j => ({
    ...j,
    nextFire: getNextCronFire(j.schedule),
  })).sort((a, b) => a.nextFire.getTime() - b.nextFire.getTime());

  return (
    <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {sorted.map(job => {
        const ms = job.nextFire.getTime() - now;
        const isImminent = ms < 600000;
        const cat = CAT_COLORS[job.category] || CAT_COLORS.reporting;
        const progress = Math.max(0, Math.min(100, 100 - (ms / 3600000) * 100));

        return (
          <div key={job.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11,
            background: isImminent ? cat.bg : 'rgba(255,255,255,0.015)',
            border: `1px solid ${isImminent ? cat.border : 'rgba(255,255,255,0.04)'}`,
            boxShadow: isImminent ? cat.glow : 'none',
            transition: 'all 0.5s ease',
            animation: isImminent ? 'glow-pulse 3s ease-in-out infinite' : 'none',
          }}>
            <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, borderRadius: 8, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }}>
              {AGENT_ICONS[job.agent] || '⚡'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#f8fafc' }}>{job.name}</span>
                <span style={{
                  fontSize: 9, padding: '1px 7px', borderRadius: 20, fontWeight: 600,
                  background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>{job.category}</span>
              </div>
              {job.description && (
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.description}
                </div>
              )}
              <div style={{ marginTop: 4, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${cat.text}33, ${cat.text})`,
                  width: `${progress}%`, transition: 'width 1s linear',
                }} />
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 65, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isImminent ? cat.text : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                {formatCountdown(ms)}
              </div>
              <div style={{ fontSize: 10, color: '#475569' }}>
                {job.nextFire.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function BrainDashboard() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<BrainData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/brain');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchRef.current = setInterval(fetchData, 15000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (fetchRef.current) clearInterval(fetchRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [fetchData]);

  // Admin authorization check
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 2s ease-in-out infinite' }}>🧠</div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading authentication...</div>
        </div>
      </div>
    );
  }

  if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h1 style={{ color: '#06b6d4', marginBottom: '20px' }}>Not Authorized</h1>
          <p style={{ color: '#94a3b8', marginBottom: '10px' }}>You do not have permission to access the Brain Dashboard.</p>
          <p style={{ color: '#94a3b8', marginBottom: '10px' }}>Admin access is restricted to: {ADMIN_EMAILS.join(', ')}</p>
          <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Your email: {user?.email || 'Not logged in'}</p>
          <Link href="/" style={{ color: '#06b6d4', textDecoration: 'none' }}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 2s ease-in-out infinite' }}>🧠</div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>
            {error ? `Connection failed: ${error}` : 'Connecting to Brain...'}
          </div>
        </div>
      </div>
    );
  }

  const { brain, trading, cron, connections, loops, agents, selfHealing } = data;
  const winRate = trading.allTime.total > 0 ? Math.round((trading.allTime.wins / trading.allTime.total) * 100) : 0;
  const connectedCount = connections ? Object.values(connections).filter(c => c.status === 'connected' || c.status === 'configured').length : 0;
  const totalConnections = connections ? Object.keys(connections).length : 0;
  const agentCount = agents ? Object.keys(agents).length : 0;

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0c', color: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px 24px',
    }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes glow-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 currentColor; } 50% { box-shadow: 0 0 0 12px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
        @keyframes slide-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
        *::-webkit-scrollbar { width: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
      `}</style>

      {/* ── SYSTEM PULSE BANNER (TOP PRIORITY) ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 12, marginBottom: 20, padding: 0,
      }}>
        {/* Main Status Indicator */}
        <div style={{
          padding: '16px 18px', borderRadius: 14,
          background: connectedCount === totalConnections ? 'rgba(16,185,129,0.08)' : connectedCount > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
          border: `2px solid ${connectedCount === totalConnections ? 'rgba(16,185,129,0.3)' : connectedCount > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
            background: connectedCount === totalConnections ? 'rgba(16,185,129,0.12)' : connectedCount > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
            border: `2px solid ${connectedCount === totalConnections ? 'rgba(16,185,129,0.4)' : connectedCount > 0 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`,
            position: 'relative',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: connectedCount === totalConnections ? '#10b981' : connectedCount > 0 ? '#f59e0b' : '#ef4444',
              position: 'absolute', top: 6, right: 6,
              boxShadow: connectedCount === totalConnections ? '0 0 20px rgba(16,185,129,0.6)' : 'none',
              animation: connectedCount === totalConnections ? 'pulse-ring 2s ease-in-out infinite' : 'none',
            }} />
            <span>🧠</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: connectedCount === totalConnections ? '#10b981' : connectedCount > 0 ? '#f59e0b' : '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {connectedCount === totalConnections ? '● SYSTEM ONLINE' : connectedCount > 0 ? '● DEGRADED' : '● OFFLINE'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>All systems operational</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          padding: '16px 18px', borderRadius: 14,
          background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)',
        }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 6 }}>Updated</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#67e8f9' }}>{lastUpdate || '—'}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Last sync</div>
        </div>

        {/* Active Agents */}
        <div style={{
          padding: '16px 18px', borderRadius: 14,
          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
        }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 6 }}>Agents</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#6ee7b7' }}>{agentCount}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>Active traders</div>
        </div>

        {/* P&L Today */}
        <div style={{
          padding: '16px 18px', borderRadius: 14,
          background: (trading.today.pnl || 0) >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${(trading.today.pnl || 0) >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
        }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 6 }}>P&L Today</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: (trading.today.pnl || 0) >= 0 ? '#6ee7b7' : '#fca5a5' }}>${trading.today.pnl || 0}</div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{trading.today.wins || 0}W / {trading.today.losses || 0}L</div>
        </div>
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)', fontSize: 24, boxShadow: '0 0 30px rgba(168,85,247,0.3)',
          }}>🎯</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', margin: 0,
              background: 'linear-gradient(135deg, #f8fafc, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 200%', animation: 'gradient-shift 8s ease infinite',
            }}>Brain Command Center</h1>
            <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <PulseOrb color="#10b981" size={6} />
              <span>{connectedCount}/{totalConnections} services</span>
              <span style={{ color: '#2d2d3d' }}>|</span>
              <span>{cron.length} heartbeats</span>
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <ProgressRing value={brain.health.fresh} max={brain.health.total} size={60} stroke={5}
            color={brain.health.score >= 80 ? '#10b981' : brain.health.score >= 50 ? '#f59e0b' : '#ef4444'} />
        </div>
      </div>

      {/* ── Connections Status Bar ─────────────────────────── */}
      {connections && <ConnectionsBar connections={connections} />}

      {/* ── Secondary Stats Row ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard label="Open Trades" value={trading.today.open_trades || 0}
          sub="Active positions" color="#06b6d4" icon="🔓" />
        <StatCard label="All-Time" value={`$${trading.allTime.pnl || 0}`}
          sub={`${trading.allTime.total || 0} trades • ${winRate}% WR`}
          color={(trading.allTime.pnl || 0) >= 0 ? '#10b981' : '#ef4444'} icon="📊" />
        <StatCard label="Patterns" value={brain.patterns.confirmed + brain.patterns.applied}
          sub={`${brain.patterns.hypotheses} hypotheses`}
          color="#a855f7" icon="🧬" />
      </div>

      {/* ── OpenClaw + System Builder ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <OpenClawPanel connections={connections} cron={cron} now={now} />
        <SystemBuilderSection queue={brain.builderQueue} selfHealing={selfHealing || { knownIssues: 0, remediations: 0, newIssues: 0, lastModified: null }} cron={cron} now={now} />
      </div>

      {/* ── Agent Collaboration Grid ──────────────────────── */}
      <GlassCard style={{ marginBottom: 14 }}>
        <SectionHeader title="Agent Collaboration"
          subtitle={`${agentCount} agents • Brain ↔ Memory sync • OpenClaw heartbeats`}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {Object.entries(MARKET_COLORS).map(([m, c]) => (
                <span key={m} style={{
                  fontSize: 8, padding: '2px 6px', borderRadius: 8,
                  background: `${c}15`, color: c, border: `1px solid ${c}30`,
                  textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px',
                }}>{m}</span>
              ))}
            </div>
          }
        />
        <AgentGrid agents={agents || {}} cron={cron} />
      </GlassCard>

      {/* ── Live Activity Feed (NEW) ────────────────────── */}
      <GlassCard style={{ marginBottom: 14, boxShadow: '0 0 30px rgba(6,182,212,0.05)' }}>
        <SectionHeader title="Live Activity Feed" subtitle="Recent system decisions and actions — refreshes every 30s"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 10, color: '#64748b' }}>{brain.decisions.length} events</span>
            </div>
          }
        />
        <div style={{ padding: '16px 20px 20px' }}>
          <LiveActivityFeed decisions={brain.decisions} />
        </div>
      </GlassCard>

      {/* ── Main Grid: Timeline | Decisions ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <GlassCard glow="0 0 40px rgba(168,85,247,0.05)">
          <SectionHeader title="Heartbeat Timeline" subtitle={`${cron.length} jobs • Live countdowns`}
            right={
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {Object.entries(CAT_COLORS).map(([cat, c]) => (
                  <span key={cat} style={{
                    fontSize: 8, padding: '2px 6px', borderRadius: 8,
                    background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                    textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px',
                  }}>{cat}</span>
                ))}
              </div>
            }
          />
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            <CronTimeline jobs={cron} now={now} />
          </div>
        </GlassCard>

        <GlassCard glow="0 0 40px rgba(6,182,212,0.05)">
          <SectionHeader title="Chief Decisions" subtitle="Autonomous decisions from the brain"
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {Object.entries(SEVERITY_CONFIG).map(([sev, cfg]) => (
                  <span key={sev} style={{
                    width: 6, height: 6, borderRadius: '50%', background: cfg.color, opacity: 0.6,
                  }} title={sev} />
                ))}
                <span style={{ fontSize: 11, color: '#475569' }}>{brain.decisions.length}</span>
              </div>
            }
          />
          <DecisionsFeed decisions={brain.decisions} />
        </GlassCard>
      </div>

      {/* ── Learning Loops + Brain Files ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <GlassCard>
          <SectionHeader title="Learning Loops" subtitle="4 feedback loops driving system evolution"
            right={<ProgressRing value={brain.patterns.confirmed + brain.patterns.applied} max={Math.max(1, brain.patterns.hypotheses + brain.patterns.confirmed + brain.patterns.applied + brain.patterns.invalidated)} size={44} stroke={4} color="#a855f7" />}
          />
          <LearningLoopsV2 loops={loops || []} patterns={brain.patterns} cron={cron} />
        </GlassCard>

        <GlassCard>
          <SectionHeader title="Brain Files" subtitle={`${brain.health.present} present • ${brain.health.fresh} fresh • ${brain.health.staleCount} stale`}
            right={<ProgressRing value={brain.health.fresh} max={brain.health.total} size={44} stroke={4}
              color={brain.health.score >= 80 ? '#10b981' : '#f59e0b'} />}
          />
          <BrainHealthGrid files={brain.health.files} />
        </GlassCard>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '20px 0 12px', color: '#2d2d3d', fontSize: 11 }}>
        SwjshAK Brain Command Center V3 • Auto-refreshes every 15s • {cron.length} autonomous heartbeats • {agentCount} agents
      </div>
    </div>
  );
}
