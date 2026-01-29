'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, History, Activity, TrendingUp, Target, Clock, BarChart3 } from 'lucide-react';
import { useAgent, useAgentContext } from '@/context/AgentContext';
import { useStrategy } from '@/context/StrategyContext';
import ThemeToggle from '@/components/UI/ThemeToggle';
import AgentChartView from '@/components/Dashboard/AgentChartView';
import styles from './page.module.css';

type TabType = 'chart' | 'live' | 'configuration' | 'history';

export default function AgentCockpit() {
    const params = useParams();
    const router = useRouter();
    const agentId = params.id as string;
    const agent = useAgent(agentId);
    const { theme, toggleTheme } = useStrategy();
    const [activeTab, setActiveTab] = useState<TabType>('chart');
    const [chatMessages, setChatMessages] = useState<any[]>([]);

    // Generate messages from agent data
    const generateMessages = () => {
        if (!agent) return [];
        const msgs = [];

        // System Startup
        msgs.push({
            sender: agent.meta?.name || agentId,
            text: `Neural Engine ACTIVE. Status: ${agent.status}`,
            time: new Date(agent.last_updated).toLocaleTimeString(),
            isAgent: true
        });

        // Pending Orders
        if (agent.pending_orders && agent.pending_orders.length > 0) {
            agent.pending_orders.forEach((order: any) => {
                msgs.push({
                    sender: agent.meta?.name || agentId,
                    text: `Identified ${order.type || order.side} zone for ${order.ticker} at ${order.entry}. Monitoring.`,
                    time: order.created_at?.split(' ')[1] || new Date().toLocaleTimeString(),
                    isAgent: true
                });
            });
        }

        // Performance
        if (agent.performance && agent.performance.trades > 0) {
            msgs.push({
                sender: agent.meta?.name || agentId,
                text: `Session Stats: ${agent.performance.win_rate}% win rate, $${agent.performance.total_pnl} PnL.`,
                time: new Date().toLocaleTimeString(),
                isAgent: true
            });
        }

        return msgs;
    };

    const messages = [...generateMessages(), ...chatMessages];

    // Quick prompt handler
    const handleQuickPrompt = (promptType: string) => {
        if (!agent) return;
        const timestamp = new Date().toLocaleTimeString();
        let userPrompt = '';
        let agentResponse = '';

        switch (promptType) {
            case 'status':
                userPrompt = "What's the status?";
                agentResponse = `Status: ${agent.status}. Monitoring ${agent.active_pairs} pair(s). Found ${agent.total_zones_found} zones.`;
                break;
            case 'looking':
                userPrompt = "What are you looking at?";
                if (agent.pending_orders && agent.pending_orders.length > 0) {
                    const tickers = agent.pending_orders.map((o: any) => o.ticker).join(', ');
                    agentResponse = `Tracking ${agent.pending_orders.length} signal(s): ${tickers}.`;
                } else {
                    agentResponse = `Scanning ${agent.meta?.type} markets. No active signals.`;
                }
                break;
            case 'position':
                userPrompt = "What are we in?";
                if (agent.active_trades && agent.active_trades.length > 0) {
                    agentResponse = `Active: ${agent.active_trades.map((t: any) => `${t.ticker} ${t.side}`).join(', ')}.`;
                } else {
                    agentResponse = "No active positions. Waiting for entry signals.";
                }
                break;
            case 'performance':
                userPrompt = "How are we doing?";
                agentResponse = `${agent.performance?.trades || 0} trades, ${agent.performance?.win_rate || 0}% win rate, $${agent.performance?.total_pnl || 0} PnL.`;
                break;
        }

        setChatMessages(prev => [
            ...prev,
            { sender: 'You', text: userPrompt, time: timestamp, isAgent: false }
        ]);

        setTimeout(() => {
            setChatMessages(prev => [
                ...prev,
                { sender: agent.meta?.name || agentId, text: agentResponse, time: new Date().toLocaleTimeString(), isAgent: true }
            ]);
        }, 300);
    };

    if (!agent) {
        return (
            <div className={styles.container}>
                <div className={styles.notFound}>
                    <h2>Agent Not Found</h2>
                    <p>The agent "{agentId}" could not be located.</p>
                    <Link href="/" className={styles.backLink}>
                        <ArrowLeft size={16} />
                        Return to Command Center
                    </Link>
                </div>
            </div>
        );
    }

    const avatarUrl = (agent.meta as any)?.avatar;

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <Link href="/" className={styles.backBtn}>
                    <ArrowLeft size={20} />
                    <span>Command Center</span>
                </Link>
                <div className={styles.headerRight}>
                    <ThemeToggle theme={theme} onToggle={toggleTheme} />
                </div>
            </header>

            {/* Main Layout - 3 Column */}
            <div className={styles.layout}>
                {/* Left Column - Identity */}
                <aside className={styles.leftCol}>
                    <div className={styles.identityCard}>
                        <div className={styles.avatarLarge}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={agent.meta?.name} className={styles.avatarImage} />
                            ) : (
                                <div className={styles.avatarFallback}>
                                    {agent.meta?.name?.charAt(0) || agentId.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className={`${styles.statusIndicator} ${agent.status === 'ACTIVE' || agent.status === 'ONLINE' ? styles.active : styles.idle}`} />
                        </div>
                        <h1 className={styles.agentName}>{agent.meta?.name || agentId}</h1>
                        <span className={styles.agentType}>{agent.meta?.type}</span>
                        <div className={styles.statusBadge}>
                            {agent.status}
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className={styles.quickStats}>
                        <div className={styles.quickStat}>
                            <TrendingUp size={16} />
                            <div>
                                <span className={`${styles.quickStatValue} ${(agent.performance?.total_pnl || 0) >= 0 ? styles.positive : styles.negative}`}>
                                    {(agent.performance?.total_pnl || 0) >= 0 ? '+' : ''}${agent.performance?.total_pnl || 0}
                                </span>
                                <span className={styles.quickStatLabel}>Total PnL</span>
                            </div>
                        </div>
                        <div className={styles.quickStat}>
                            <Target size={16} />
                            <div>
                                <span className={styles.quickStatValue}>{agent.performance?.win_rate || 0}%</span>
                                <span className={styles.quickStatLabel}>Win Rate</span>
                            </div>
                        </div>
                        <div className={styles.quickStat}>
                            <Activity size={16} />
                            <div>
                                <span className={styles.quickStatValue}>{agent.total_zones_found}</span>
                                <span className={styles.quickStatLabel}>Zones Found</span>
                            </div>
                        </div>
                        <div className={styles.quickStat}>
                            <Clock size={16} />
                            <div>
                                <span className={styles.quickStatValue}>{agent.performance?.trades || 0}</span>
                                <span className={styles.quickStatLabel}>Total Trades</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Center Column - Live Feed */}
                <main className={styles.centerCol}>
                    {/* Tabs */}
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'chart' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('chart')}
                        >
                            <BarChart3 size={16} />
                            Chart
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'live' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('live')}
                        >
                            <Activity size={16} />
                            Live Feed
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'configuration' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('configuration')}
                        >
                            <Settings size={16} />
                            Configuration
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
                            onClick={() => setActiveTab('history')}
                        >
                            <History size={16} />
                            History
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'chart' && (
                        <div className={styles.chartPanel}>
                            <AgentChartView agentId={agentId} agent={agent} height="500px" />
                        </div>
                    )}

                    {activeTab === 'live' && (
                        <div className={styles.chatContainer}>
                            <div className={styles.messages}>
                                {messages.length > 0 ? messages.map((msg, i) => (
                                    <div key={i} className={`${styles.messageRow} ${msg.isAgent ? styles.messageLeft : styles.messageRight}`}>
                                        <div className={`${styles.bubble} ${msg.isAgent ? styles.bubbleLeft : styles.bubbleRight}`}>
                                            {msg.isAgent && <span className={styles.agentBubbleName}>{msg.sender}:</span>}
                                            {msg.text}
                                            <div className={styles.messageMeta}>
                                                <span>{msg.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className={styles.emptyState}>Waiting for agent pulse...</div>
                                )}
                            </div>

                            {/* Quick Prompts */}
                            <div className={styles.quickPrompts}>
                                <button className={styles.quickPromptBtn} onClick={() => handleQuickPrompt('status')}>
                                    What's the status?
                                </button>
                                <button className={styles.quickPromptBtn} onClick={() => handleQuickPrompt('looking')}>
                                    What are you looking at?
                                </button>
                                <button className={styles.quickPromptBtn} onClick={() => handleQuickPrompt('position')}>
                                    What are we in?
                                </button>
                                <button className={styles.quickPromptBtn} onClick={() => handleQuickPrompt('performance')}>
                                    How are we doing?
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'configuration' && (
                        <div className={styles.configPanel}>
                            <h3>Agent Configuration</h3>
                            <p className={styles.configNote}>Strategy toggles and parameters for {agent.meta?.name}</p>

                            <div className={styles.configSection}>
                                <h4>Market Focus</h4>
                                <div className={styles.configValue}>{agent.meta?.type}</div>
                            </div>

                            <div className={styles.configSection}>
                                <h4>Active Pairs</h4>
                                <div className={styles.configValue}>{agent.active_pairs} pair(s) being monitored</div>
                            </div>

                            <div className={styles.configSection}>
                                <h4>Current Status</h4>
                                <div className={styles.configValue}>{agent.status}</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className={styles.historyPanel}>
                            <h3>Trade History</h3>
                            {agent.closed_trades && agent.closed_trades.length > 0 ? (
                                <div className={styles.tradeList}>
                                    {agent.closed_trades.slice(0, 10).map((trade: any, i: number) => (
                                        <div key={i} className={styles.tradeItem}>
                                            <div className={styles.tradeInfo}>
                                                <span className={styles.tradeTicker}>{trade.ticker}</span>
                                                <span className={styles.tradeSide}>{trade.side}</span>
                                            </div>
                                            <div className={styles.tradeDetails}>
                                                <span>Entry: {trade.entry}</span>
                                                <span>Exit: {trade.exit || 'N/A'}</span>
                                            </div>
                                            <div className={`${styles.tradePnl} ${(trade.pnl || 0) >= 0 ? styles.positive : styles.negative}`}>
                                                {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl || 0}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.noHistory}>No closed trades yet.</p>
                            )}
                        </div>
                    )}
                </main>

                {/* Right Column - Stats */}
                <aside className={styles.rightCol}>
                    {/* Last 5 Trades */}
                    <div className={styles.statsCard}>
                        <h3>Last 5 Trades</h3>
                        {agent.closed_trades && agent.closed_trades.length > 0 ? (
                            <div className={styles.recentTrades}>
                                {agent.closed_trades.slice(0, 5).map((trade: any, i: number) => (
                                    <div key={i} className={styles.recentTrade}>
                                        <span className={styles.recentTicker}>{trade.ticker}</span>
                                        <span className={`${styles.recentPnl} ${(trade.pnl || 0) >= 0 ? styles.positive : styles.negative}`}>
                                            {(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl || 0}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.noData}>No recent trades</p>
                        )}
                    </div>

                    {/* Active Zones */}
                    <div className={styles.statsCard}>
                        <h3>Active Signals</h3>
                        {agent.pending_orders && agent.pending_orders.length > 0 ? (
                            <div className={styles.zoneList}>
                                {agent.pending_orders.map((order: any, i: number) => (
                                    <div key={i} className={styles.zoneItem}>
                                        <span className={styles.zoneTicker}>{order.ticker}</span>
                                        <span className={`${styles.zoneType} ${styles[order.type?.toLowerCase() || 'demand']}`}>
                                            {order.type || order.side}
                                        </span>
                                        <span className={styles.zoneEntry}>{order.entry}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.noData}>No active signals</p>
                        )}
                    </div>

                    {/* Reviews (Professor/Auditor) */}
                    {(agent.reviews || agent.audits) && (
                        <div className={styles.statsCard}>
                            <h3>Reviews & Audits</h3>
                            {agent.reviews && agent.reviews.length > 0 && (
                                <div className={styles.reviewSection}>
                                    <h4>Professor Reviews</h4>
                                    {agent.reviews.slice(0, 3).map((review: any, i: number) => (
                                        <div key={i} className={styles.reviewItem}>
                                            <span className={styles.reviewGrade}>{review.grade}</span>
                                            <span className={styles.reviewNote}>{review.notes}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {agent.audits && agent.audits.length > 0 && (
                                <div className={styles.auditSection}>
                                    <h4>Auditor Stamps</h4>
                                    {agent.audits.slice(0, 3).map((audit: any, i: number) => (
                                        <div key={i} className={styles.auditItem}>
                                            <span className={`${styles.auditStatus} ${audit.verified ? styles.verified : styles.flagged}`}>
                                                {audit.verified ? 'Verified' : 'Flagged'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
