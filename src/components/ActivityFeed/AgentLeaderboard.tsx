'use client';

import React, { useMemo } from 'react';
import { Trophy, Flame, Zap, TrendingUp } from 'lucide-react';
import styles from './AgentLeaderboard.module.css';

interface AgentData {
  id: string;
  status?: string;
  toolCalls?: number;
  actionsCompleted?: number;
  tokensUsed?: number;
  uptime?: number; // minutes
}

interface AgentLeaderboardProps {
  agents: Record<string, AgentData>;
  toolSuccesses: number;
  toolFailures: number;
  actionsToday: number;
}

const AGENT_COLORS: Record<string, string> = {
  chief: '#06b6d4',
  hunter: '#f59e0b',
  ops: '#10b981',
  scout: '#a855f7',
  arbiter: '#ef4444',
  cortana: '#3b82f6',
};

const AGENT_ICONS: Record<string, string> = {
  chief: '👑',
  hunter: '🎯',
  ops: '⚙️',
  scout: '🔍',
  arbiter: '⚖️',
  cortana: '🧠',
};

export function AgentLeaderboard({ agents, toolSuccesses, toolFailures, actionsToday }: AgentLeaderboardProps) {
  // Rank agents by activity (tool calls / actions)
  const rankings = useMemo(() => {
    const agentList = Object.values(agents).filter(Boolean);
    return agentList
      .map((a) => ({
        id: a.id,
        score: (a.toolCalls ?? 0) + (a.actionsCompleted ?? 0),
        toolCalls: a.toolCalls ?? 0,
        status: a.status ?? 'offline',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3
  }, [agents]);

  const successRate = toolSuccesses + toolFailures > 0
    ? Math.round((toolSuccesses / (toolSuccesses + toolFailures)) * 100)
    : 0;

  const hasActivity = rankings.some((r) => r.score > 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Trophy size={13} className={styles.headerIcon} />
        <span className={styles.headerTitle}>LEADERBOARD</span>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {hasActivity ? (
          /* Agent Rankings */
          <div className={styles.rankings}>
            {rankings.map((agent, idx) => (
              <div key={agent.id} className={styles.rankRow} data-rank={idx + 1}>
                <span className={styles.rankMedal}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </span>
                <span className={styles.rankName} style={{ color: AGENT_COLORS[agent.id] || '#888' }}>
                  {agent.id}
                </span>
                <span className={styles.rankScore}>
                  {agent.score > 0 ? agent.score.toLocaleString() : '—'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Quick Stats when no agent activity */
          <div className={styles.quickStats}>
            <div className={styles.quickStat}>
              <Zap size={12} className={styles.quickIcon} />
              <span className={styles.quickValue}>{toolSuccesses.toLocaleString()}</span>
              <span className={styles.quickLabel}>calls</span>
            </div>
            <div className={styles.statSep} />
            <div className={styles.quickStat}>
              <TrendingUp size={12} className={styles.quickIcon} />
              <span className={styles.quickValue}>{successRate}%</span>
              <span className={styles.quickLabel}>success</span>
            </div>
            <div className={styles.statSep} />
            <div className={styles.quickStat}>
              <Flame size={12} className={styles.quickIcon} />
              <span className={styles.quickValue}>{actionsToday}</span>
              <span className={styles.quickLabel}>actions</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentLeaderboard;
