'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './TerminalChat.module.css';
import { Send, Terminal, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ChatMessage {
    sender: string;
    text: string;
    time: string;
    isAgent: boolean;
    type?: 'info' | 'error' | 'success';
}

interface TerminalChatProps {
    agentName: string;
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    isTyping?: boolean;
}

export default function TerminalChat({ agentName, messages, onSendMessage, isTyping = false }: TerminalChatProps) {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = () => {
        if (!inputValue.trim()) return;
        onSendMessage(inputValue);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.chatContainer}>
            <div className={styles.header}>
                <Terminal size={14} className={styles.icon} />
                <span className={styles.title}>MISSION LOG • {agentName.toUpperCase()}</span>
                <div style={{ flex: 1 }} />
                <div className={styles.statusIndicator} />
            </div>

            <div className={styles.messages}>
                {messages.length > 0 ? (
                    messages.map((msg, idx) => (
                        <div key={idx} className={styles.logLine}>
                            <span className={styles.logTimestamp}>[{msg.time}]</span>
                            <span className={msg.isAgent ? styles.logSource : styles.logSourceUser}>
                                {msg.isAgent ? 'SYSTEM' : 'USER'}
                            </span>
                            <span className={`${styles.logContent} ${msg.type === 'error' ? styles.logError : msg.type === 'success' ? styles.logSuccess : ''}`}>
                                {msg.text}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className={styles.logLine}>
                        <span className={styles.logTimestamp}>[--:--:--]</span>
                        <span className={styles.logSource}>SYSTEM</span>
                        <span className={styles.logContent}>Log initialization complete. Awaiting events...</span>
                    </div>
                )}

                {isTyping && (
                    <div className={styles.logLine}>
                        <span className={styles.logTimestamp}>[{new Date().toLocaleTimeString()}]</span>
                        <span className={styles.logSource}>SYSTEM</span>
                        <span className={styles.logContent}>Processing...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
                <div className={styles.inputWrapper}>
                    <span className={styles.promptSymbol}>{'>'}</span>
                    <input
                        className={styles.input}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter command..."
                    />
                </div>
            </div>
        </div>
    );
}
