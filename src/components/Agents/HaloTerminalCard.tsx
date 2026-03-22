'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Square, RefreshCw, Circle, Send, Zap } from 'lucide-react';
import styles from './HaloTerminalCard.module.css';

interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

interface HaloTerminalCardProps {
  agentId: string;
  emoji: string;
  name: string;
  accent: string;
  status: 'online' | 'dead' | 'idle' | 'unknown';
  lastHeartbeat?: string;
  lastTask?: string;
  cycleCount?: number;
  logs?: LogEntry[];
  onStart?: (agentId: string) => void;
  onStop?: (agentId: string) => void;
  onRestart?: (agentId: string) => void;
  onNudge?: (agentId: string) => void;
  onSendCommand?: (agentId: string, command: string) => void;
  isActionLoading?: boolean;
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function timeAgo(isoString: string | undefined): string {
  if (!isoString) return 'never';
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function HaloTerminalCard({
  agentId,
  emoji,
  name,
  accent,
  status,
  lastHeartbeat,
  lastTask,
  cycleCount = 0,
  logs = [],
  onStart,
  onStop,
  onRestart,
  onNudge,
  onSendCommand,
  isActionLoading = false,
}: HaloTerminalCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  const isOnline = status === 'online';
  const isDead = status === 'dead';
  const isIdle = status === 'idle';

  const statusColor = isOnline ? '#10b981' : isDead ? '#ef4444' : isIdle ? '#f59e0b' : 'rgba(255,255,255,0.3)';
  const statusLabel = isOnline ? 'ONLINE' : isDead ? 'DEAD' : isIdle ? 'IDLE' : 'OFFLINE';

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = useCallback(() => {
    const command = inputValue.trim();
    if (!command || !onSendCommand) return;
    onSendCommand(agentId, command);
    setInputValue('');
  }, [inputValue, agentId, onSendCommand]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={styles.card}
      style={{ '--agent-accent': accent } as React.CSSProperties}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.emoji}>{emoji}</span>
          <div className={styles.headerInfo}>
            <span className={styles.name}>{name.toUpperCase()}</span>
            <span className={styles.meta}>
              Cycle {cycleCount} · {timeAgo(lastHeartbeat)}
            </span>
          </div>
        </div>

        <div className={styles.headerRight}>
          {/* Status Badge */}
          <div className={styles.statusBadge} style={{ color: statusColor }}>
            <Circle size={8} fill={statusColor} />
            <span>{statusLabel}</span>
          </div>

          {/* Control Buttons */}
          <div className={styles.controls}>
            {isDead && onNudge && (
              <button
                className={`${styles.ctrlBtn} ${styles.nudgeBtn}`}
                onClick={() => onNudge(agentId)}
                disabled={isActionLoading}
                title="Wake up agent"
              >
                <Zap size={12} />
              </button>
            )}
            {!isOnline && onStart && (
              <button
                className={`${styles.ctrlBtn} ${styles.startBtn}`}
                onClick={() => onStart(agentId)}
                disabled={isActionLoading}
                title="Start agent"
              >
                <Play size={12} fill="currentColor" />
              </button>
            )}
            {isOnline && onRestart && (
              <button
                className={`${styles.ctrlBtn} ${styles.restartBtn}`}
                onClick={() => onRestart(agentId)}
                disabled={isActionLoading}
                title="Restart agent"
              >
                <RefreshCw size={12} />
              </button>
            )}
            {isOnline && onStop && (
              <button
                className={`${styles.ctrlBtn} ${styles.stopBtn}`}
                onClick={() => onStop(agentId)}
                disabled={isActionLoading}
                title="Stop agent"
              >
                <Square size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Last Task Strip */}
      {lastTask && (
        <div className={styles.taskStrip}>
          <span className={styles.taskLabel}>LAST:</span>
          <span className={styles.taskText}>{lastTask}</span>
        </div>
      )}

      {/* Terminal Content */}
      <div className={styles.terminal} ref={scrollRef}>
        {logs.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyEmoji}>{emoji}</span>
            <span className={styles.emptyText}>Awaiting transmissions...</span>
          </div>
        ) : (
          logs.slice(-50).map((log) => (
            <div
              key={log.id}
              className={`${styles.logLine} ${styles[log.level]}`}
            >
              <span className={styles.timestamp}>{formatTimestamp(log.timestamp)}</span>
              <span className={styles.logText}>{log.text}</span>
            </div>
          ))
        )}
      </div>

      {/* Command Input */}
      <div className={styles.inputSection}>
        <span className={styles.inputPrompt} style={{ color: accent }}>
          {emoji} &gt;
        </span>
        <input
          type="text"
          className={styles.input}
          placeholder={`Command ${name}...`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!onSendCommand}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSubmit}
          disabled={!inputValue.trim() || !onSendCommand}
        >
          <Send size={12} />
        </button>
      </div>

      {/* Accent Bar */}
      <div className={styles.accentBar} style={{ background: accent }} />
    </div>
  );
}
