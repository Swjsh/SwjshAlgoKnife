'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Square, RefreshCw, Circle, Send, Zap, Rocket, Terminal } from 'lucide-react';
import styles from './ResearchSuperTerminal.module.css';
import type { LogEntry, AgentStatus } from '@/hooks/useActivityFeed';

interface AutoResearchMetrics {
    branch: string;
    experimentsRun: number;
    experimentsKept: number;
    experimentsDiscarded: number;
    currentMetric: number | null;
    bestMetric: number | null;
}

interface ResearchSuperTerminalProps {
    agentId: string;
    emoji: string;
    name: string;
    color: string;
    terminalNumber: number;
    status: AgentStatus;
    logs: LogEntry[];
    lastActivity?: string;
    autoresearch?: AutoResearchMetrics;
    onSendCommand?: (agentId: string, command: string) => void;
    onStart?: (agentId: string) => void;
    onStop?: (agentId: string) => void;
    onRefresh?: (agentId: string) => void;
    onDeploy?: (agentId: string) => void;
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

function getLogLevelClass(level: LogEntry['level']): string {
    switch (level) {
        case 'SUCCESS': return 'success';
        case 'ERROR': return 'error';
        case 'WARN': return 'warn';
        case 'ACTION': return 'action';
        default: return 'info';
    }
}

export default function ResearchSuperTerminal({
    agentId,
    emoji,
    name,
    color,
    terminalNumber,
    status,
    logs,
    lastActivity,
    autoresearch,
    onSendCommand,
    onStart,
    onStop,
    onRefresh,
    onDeploy,
    isActionLoading = false,
}: ResearchSuperTerminalProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = useState('');

    const isOnline = status === 'online';
    const isBusy = status === 'busy';
    const isOffline = status === 'offline';
    const isActive = isOnline || isBusy;

    const statusColor = isOnline ? '#10b981' : isBusy ? '#06b6d4' : '#ef4444';
    const statusLabel = isOnline ? 'ONLINE' : isBusy ? 'BUSY' : 'OFFLINE';

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
            style={{ '--agent-accent': color } as React.CSSProperties}
        >
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.terminalBadge}>T{terminalNumber}</div>
                    <span className={styles.emoji}>{emoji}</span>
                    <div className={styles.headerInfo}>
                        <span className={styles.name}>{name}</span>
                        <span className={styles.meta}>
                            {lastActivity ? `Active ${timeAgo(lastActivity)}` : 'Waiting...'}
                        </span>
                    </div>
                </div>

                <div className={styles.headerRight}>
                    {/* AutoResearch Metrics */}
                    {autoresearch && autoresearch.experimentsRun > 0 && (
                        <div className={styles.metricsBar}>
                            <span className={styles.metricItem}>
                                {autoresearch.experimentsRun} exp
                            </span>
                            <span className={styles.metricSep}>|</span>
                            <span className={styles.metricItem}>
                                {Math.round((autoresearch.experimentsKept / autoresearch.experimentsRun) * 100)}% kept
                            </span>
                            {autoresearch.bestMetric !== null && (
                                <>
                                    <span className={styles.metricSep}>|</span>
                                    <span className={styles.metricBest}>
                                        best: {autoresearch.bestMetric.toFixed(3)}
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Status Badge */}
                    <div className={styles.statusBadge} style={{ color: statusColor }}>
                        <Circle size={8} fill={statusColor} />
                        <span>{statusLabel}</span>
                    </div>

                    {/* Control Buttons */}
                    <div className={styles.controls}>
                        {/* Deploy Button - always shown for offline agents */}
                        {isOffline && onDeploy && (
                            <button
                                className={`${styles.ctrlBtn} ${styles.deployBtn}`}
                                onClick={() => onDeploy(agentId)}
                                disabled={isActionLoading}
                                title="Deploy agent"
                            >
                                <Rocket size={12} />
                            </button>
                        )}

                        {/* Start Button */}
                        {!isActive && onStart && (
                            <button
                                className={`${styles.ctrlBtn} ${styles.startBtn}`}
                                onClick={() => onStart(agentId)}
                                disabled={isActionLoading}
                                title="Start agent"
                            >
                                <Play size={12} fill="currentColor" />
                            </button>
                        )}

                        {/* Refresh Button - for active agents */}
                        {isActive && onRefresh && (
                            <button
                                className={`${styles.ctrlBtn} ${styles.refreshBtn}`}
                                onClick={() => onRefresh(agentId)}
                                disabled={isActionLoading}
                                title="Refresh / resync agent"
                            >
                                <RefreshCw size={12} />
                            </button>
                        )}

                        {/* Stop Button - for active agents */}
                        {isActive && onStop && (
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

            {/* Terminal Content */}
            <div className={styles.terminal} ref={scrollRef}>
                {logs.length === 0 ? (
                    <div className={styles.emptyState}>
                        <span className={styles.emptyEmoji}>{emoji}</span>
                        <span className={styles.emptyText}>Awaiting transmissions...</span>
                        <span className={styles.emptyHint}>Deploy agent to begin research</span>
                    </div>
                ) : (
                    logs.slice(-100).map((log) => (
                        <div
                            key={log.id}
                            className={`${styles.logLine} ${styles[getLogLevelClass(log.level)]}`}
                        >
                            <span className={styles.timestamp}>{formatTimestamp(log.timestamp)}</span>
                            <span className={styles.logText}>{typeof log.text === 'string' ? log.text : JSON.stringify(log.text)}</span>
                        </div>
                    ))
                )}
            </div>

            {/* Command Input */}
            <div className={styles.inputSection}>
                <span className={styles.inputPrompt} style={{ color }}>
                    {emoji} &gt;
                </span>
                <input
                    type="text"
                    className={styles.input}
                    placeholder={isActive ? `Command ${name}...` : `${name} offline...`}
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
            <div className={styles.accentBar} style={{ background: color }} />
        </div>
    );
}
