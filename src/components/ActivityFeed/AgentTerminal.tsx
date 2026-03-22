'use client';

import React, { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import Image from 'next/image';
import { Terminal, Circle, Send, Zap } from 'lucide-react';
import styles from './AgentTerminal.module.css';
import type { AgentState, LogEntry, AgentStatus, HeartbeatAgentState } from '@/hooks/useActivityFeed';

interface AgentTerminalProps {
    agent: AgentState;
    onSendCommand?: (agentId: string, command: string) => void;
    heartbeat?: HeartbeatAgentState;
    onNudge?: (agentId: string) => void;
}

// ANSI color code mapping
const ANSI_COLORS: Record<string, string> = {
    '\x1b[30m': '#1e1e1e', // black
    '\x1b[31m': '#ef4444', // red
    '\x1b[32m': '#22c55e', // green
    '\x1b[33m': '#fbbf24', // yellow
    '\x1b[34m': '#3b82f6', // blue
    '\x1b[35m': '#a855f7', // magenta
    '\x1b[36m': '#06b6d4', // cyan
    '\x1b[37m': '#e5e5e5', // white
    '\x1b[90m': '#6b7280', // bright black (gray)
    '\x1b[91m': '#f87171', // bright red
    '\x1b[92m': '#4ade80', // bright green
    '\x1b[93m': '#fde047', // bright yellow
    '\x1b[94m': '#60a5fa', // bright blue
    '\x1b[95m': '#c084fc', // bright magenta
    '\x1b[96m': '#22d3ee', // bright cyan
    '\x1b[97m': '#ffffff', // bright white
    '\x1b[0m': '',         // reset
};

function stringifyMessage(input: unknown): string {
    if (typeof input === 'string') {
        return input;
    }
    if (input === null || input === undefined) {
        return '';
    }
    if (typeof input === 'object') {
        try {
            // For objects, try to extract meaningful text
            const obj = input as Record<string, unknown>;
            // Check for common message fields
            if ('message' in obj && typeof obj.message === 'string') {
                return obj.message;
            }
            if ('text' in obj && typeof obj.text === 'string') {
                return obj.text;
            }
            if ('line' in obj && typeof obj.line === 'string') {
                return obj.line;
            }
            if ('content' in obj && typeof obj.content === 'string') {
                return obj.content;
            }
            // Fallback to JSON
            return JSON.stringify(input, null, 0);
        } catch {
            return String(input);
        }
    }
    return String(input);
}

// Format log message for display - truncate long messages and highlight prefixes
function formatLogMessage(text: string): { prefix: string | null; content: string } {
    // Check for common prefixes like [USER], [TOOL], [RESULT]
    const prefixMatch = text.match(/^\[([A-Z]+)\]\s*/);
    if (prefixMatch) {
        return {
            prefix: prefixMatch[1],
            content: text.substring(prefixMatch[0].length).substring(0, 200),
        };
    }
    return { prefix: null, content: text.substring(0, 400) };
}

function parseAnsiText(input: unknown): React.ReactNode[] {
    const text = stringifyMessage(input);
    // Truncate very long messages for readability (increased for raw terminal output)
    const truncatedText = text.length > 500 ? text.substring(0, 500) + '...' : text;
    const parts: React.ReactNode[] = [];
    let currentColor: string | null = null;
    let currentText = '';
    let i = 0;

    while (i < truncatedText.length) {
        // Check for ANSI escape sequence
        if (truncatedText[i] === '\x1b' && truncatedText[i + 1] === '[') {
            // Find the end of the sequence
            let seqEnd = i + 2;
            while (seqEnd < truncatedText.length && truncatedText[seqEnd] !== 'm') {
                seqEnd++;
            }
            if (seqEnd < truncatedText.length) {
                const seq = truncatedText.slice(i, seqEnd + 1);

                // Push current accumulated text
                if (currentText) {
                    parts.push(
                        <span key={parts.length} style={currentColor ? { color: currentColor } : undefined}>
                            {currentText}
                        </span>
                    );
                    currentText = '';
                }

                // Update color or reset
                if (seq === '\x1b[0m') {
                    currentColor = null;
                } else if (ANSI_COLORS[seq]) {
                    currentColor = ANSI_COLORS[seq];
                }

                i = seqEnd + 1;
                continue;
            }
        }

        currentText += truncatedText[i];
        i++;
    }

    // Push remaining text
    if (currentText) {
        parts.push(
            <span key={parts.length} style={currentColor ? { color: currentColor } : undefined}>
                {currentText}
            </span>
        );
    }

    return parts.length > 0 ? parts : [truncatedText];
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

function getLogLevelIcon(level: LogEntry['level']): string {
    switch (level) {
        case 'SUCCESS': return '\u2705';
        case 'ERROR': return '\u274C';
        case 'WARN': return '\u26A0\uFE0F';
        case 'ACTION': return '\u26A1';
        default: return '\u203A';
    }
}

function getStatusLabel(status: AgentStatus): string {
    switch (status) {
        case 'online': return 'ONLINE';
        case 'busy': return 'BUSY';
        case 'offline': return 'OFFLINE';
    }
}

function formatLastSeen(isoString: string | null): string {
    if (!isoString) return 'Never';
    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

function getHeartbeatLabel(status: HeartbeatAgentState['status']): string {
    switch (status) {
        case 'alive': return '';
        case 'stale': return 'QUIET';
        case 'dead': return 'UNRESPONSIVE';
        default: return '';
    }
}

export function AgentTerminal({ agent, onSendCommand, heartbeat, onNudge }: AgentTerminalProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const [isPending, setIsPending] = useState(false);

    const heartbeatStatus = heartbeat?.status || 'unknown';
    const isStaleOrDead = heartbeatStatus === 'stale' || heartbeatStatus === 'dead';
    const heartbeatLabel = getHeartbeatLabel(heartbeatStatus);

    // Handle wake button click
    const handleNudge = useCallback(() => {
        if (onNudge) {
            onNudge(agent.id);
        }
    }, [agent.id, onNudge]);

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [agent.logs]);

    // Handle command submission
    const handleSubmit = useCallback(() => {
        const command = inputValue.trim();
        if (!command || !onSendCommand) return;

        setIsPending(true);
        onSendCommand(agent.id, command);
        setInputValue('');

        // Clear pending state after 3 seconds (command queue polling)
        setTimeout(() => setIsPending(false), 3000);
    }, [inputValue, agent.id, onSendCommand]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    return (
        <div className={styles.terminalWindow} style={{ '--agent-color': agent.color } as React.CSSProperties}>
            {/* Color-coordinated Header */}
            <div className={styles.header} style={{ borderBottom: `2px solid ${agent.color}40` }}>
                <div className={styles.headerLeft}>
                    {agent.avatar ? (
                        <div className={styles.avatarWrapper} style={{ borderColor: agent.color }}>
                            <Image
                                src={agent.avatar}
                                alt={agent.name}
                                width={40}
                                height={40}
                                className={styles.avatar}
                                unoptimized
                            />
                        </div>
                    ) : (
                        <span className={styles.emoji}>{agent.emoji}</span>
                    )}
                    <div className={styles.headerInfo}>
                        <span className={styles.title} style={{ color: agent.color }}>{agent.name.toUpperCase()}</span>
                        <span className={styles.titleSub}>TERMINAL</span>
                    </div>
                </div>
                <div className={styles.headerRight}>
                    {/* Heartbeat indicator */}
                    {heartbeat && (
                        <div
                            className={`${styles.heartbeat} ${styles[`heartbeat${heartbeatStatus.charAt(0).toUpperCase() + heartbeatStatus.slice(1)}`]}`}
                            title={`Last seen: ${formatLastSeen(heartbeat.lastSeen)}${heartbeat.nudgeCount > 0 ? ` | Nudged ${heartbeat.nudgeCount}x` : ''}`}
                        >
                            <div className={styles.heartbeatDot} />
                            {heartbeatLabel && <span className={styles.heartbeatLabel}>{heartbeatLabel}</span>}
                        </div>
                    )}

                    {/* Wake button for stale/dead agents */}
                    {isStaleOrDead && onNudge && (
                        <button
                            className={styles.wakeButton}
                            onClick={handleNudge}
                            title="Send wake-up ping to agent"
                            style={{ '--agent-color': agent.color } as React.CSSProperties}
                        >
                            <Zap size={12} />
                            Wake
                        </button>
                    )}

                    <div className={`${styles.status} ${styles[agent.status]}`}>
                        <Circle size={8} fill="currentColor" className={styles.statusDot} />
                        <span className={styles.statusText}>{getStatusLabel(agent.status)}</span>
                    </div>
                </div>
            </div>

            {/* Terminal Content */}
            <div className={styles.content} ref={scrollRef}>
                {agent.logs.length === 0 ? (
                    <div className={styles.emptyState}>
                        {agent.avatar ? (
                            <div className={styles.emptyAvatarWrapper}>
                                <Image
                                    src={agent.avatar}
                                    alt={agent.name}
                                    width={48}
                                    height={48}
                                    className={styles.avatar}
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <span className={styles.emptyIcon}>{agent.emoji}</span>
                        )}
                        <span className={styles.emptyText}>Awaiting transmissions...</span>
                    </div>
                ) : (
                    agent.logs.map((log) => (
                        <div
                            key={log.id}
                            className={`${styles.logLine} ${styles[log.level.toLowerCase()]}`}
                        >
                            <span className={styles.timestamp}>{formatTimestamp(log.timestamp)}</span>
                            <span className={styles.icon}>{getLogLevelIcon(log.level)}</span>
                            <span className={styles.message}>{parseAnsiText(log.text)}</span>
                        </div>
                    ))
                )}

                {/* Pending command indicator */}
                {isPending && (
                    <div className={styles.pendingCommand}>
                        <div className={styles.pendingSpinner} />
                        <span>Command queued, waiting for agent...</span>
                    </div>
                )}
            </div>

            {/* Input Section */}
            <div className={styles.inputSection}>
                <span className={styles.inputPrompt} style={{ color: agent.color }}>
                    {agent.avatar ? (
                        <Image
                            src={agent.avatar}
                            alt=""
                            width={16}
                            height={16}
                            className={styles.inputAvatar}
                            unoptimized
                        />
                    ) : (
                        agent.emoji
                    )}
                    {' '}&gt;
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    className={styles.input}
                    placeholder={agent.status !== 'offline' ? `Send command to ${agent.name}...` : `${agent.name} offline — commands will queue...`}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!onSendCommand}
                />
                <button
                    className={styles.sendButton}
                    onClick={handleSubmit}
                    disabled={!inputValue.trim() || !onSendCommand}
                    title="Send command (Enter)"
                >
                    <Send size={14} />
                </button>
            </div>

            {/* Color accent bar at bottom */}
            <div className={styles.accentBar} style={{ background: agent.color }} />
        </div>
    );
}

export default AgentTerminal;
