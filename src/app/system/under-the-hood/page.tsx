'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Bot,
  Database,
  Globe,
  Heart,
  Layers,
  Monitor,
  Server,
  Shield,
  Workflow,
  Zap,
  Brain,
  Swords,
  Target,
  Eye,
  Radio,
  GitBranch,
  Terminal,
  Cpu,
  HardDrive,
  BarChart3,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Users,
  Code,
  Boxes,
} from 'lucide-react';
import FileTree from '@/components/UI/21st/FileTree';
import type { FileNode } from '@/components/UI/21st/FileTree';
import IntegrationsGrid from '@/components/UI/21st/IntegrationsGrid';
import type { Integration } from '@/components/UI/21st/IntegrationsGrid';
import styles from './page.module.css';

type Tab = 'architecture' | 'agents' | 'infrastructure' | 'dataflow' | 'health';

const HALO_CREW = [
  { name: 'Chief', role: 'Project Coordinator', jira: 'MGMT', color: '#6B8E23', icon: Shield, pickup: 'Manual', desc: 'Reads Master Tracker priorities, orchestrates all agent work, creates and assigns Jira issues across projects' },
  { name: 'Arbiter', role: 'System Health Monitor', jira: 'PULSE', color: '#8B4513', icon: Heart, pickup: 'Auto', desc: 'Monitors platform health metrics, detects anomalies in agent behavior, triggers Discord alerts for critical issues' },
  { name: 'Cortana', role: 'Pattern Analysis / PR Grading', jira: 'LEARN, GRADE', color: '#6495ED', icon: Brain, pickup: 'Manual', desc: 'Analyzes code patterns and trading strategy performance, grades pull requests, identifies learning opportunities' },
  { name: 'Scout', role: 'Research & Discovery', jira: 'BACK', color: '#2E8B57', icon: Radio, pickup: 'Auto', desc: 'Researches new strategies and libraries, discovers market opportunities, triages and manages backlog items' },
  { name: 'Ops', role: 'Core Developer', jira: 'SCRUM', color: '#DAA520', icon: Code, pickup: 'Auto', desc: 'Implements sprint features, fixes bugs, writes core platform code — the primary hands-on-keyboard builder' },
  { name: 'Hunter', role: 'Infrastructure Engineer', jira: 'INFRA', color: '#8A2BE2', icon: Server, pickup: 'Auto', desc: 'Manages Docker containers, Contabo VPS, n8n workflows (49 active), deployment pipelines, and monitoring' },
];

const TRADING_AGENTS = [
  { name: 'Sterling', market: 'Forex', strategy: 'Supply & Demand Zones (1H)', broker: 'OANDA', schedule: '24/5', pairs: 'EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD', desc: 'Detects hourly S/D zones, monitors 30s ticks for fills, 1% risk per trade with 5-pip SL buffer', color: '#22c55e' },
  { name: 'Bitcoin Bob', market: 'Crypto', strategy: 'S/D + Momentum', broker: 'Alpaca', schedule: '24/7', pairs: 'BTC/USD, ETH/USD, SOL/USD', desc: 'Hourly zone detection on crypto pairs, max 3 simultaneous positions, live REST API execution', color: '#f59e0b' },
  { name: 'Pivot Pete', market: 'Futures', strategy: 'Pivot Points (Floor Trader)', broker: 'Alpaca', schedule: '9:30-16:00 EST', pairs: 'ES=F (E-mini S&P 500)', desc: 'Classic floor trader pivot levels computed from 5m/1h/daily bars, direct futures execution via Alpaca', color: '#06b6d4' },
  { name: 'Boba', market: 'Options', strategy: 'Probability-Weighted Delta', broker: 'Alpaca', schedule: '9:30-11:00 EST', pairs: 'SPY options (weekly)', desc: 'Weekly expiry options with probability-weighted delta hedging, max 1 spread per expiry cycle', color: '#a855f7' },
  { name: 'SPX Sniper', market: 'Options', strategy: 'Broken Wing Butterflies', broker: 'Alpaca', schedule: '10:30-16:00 EST', pairs: 'SPX index options (0DTE)', desc: 'European-style 0DTE options at key support/resistance, defined-risk spreads only', color: '#ec4899' },
  { name: 'The Professor', market: 'Analysis', strategy: 'Trade Grading (A+ to F)', broker: 'N/A', schedule: 'EOD', pairs: 'All closed trades', desc: 'Grades on R:R ratio, win/loss, duration (<5min = F), and Intel alignment. Stores reviews in agents_db.json', color: '#8b5cf6' },
  { name: 'The Auditor', market: 'Analysis', strategy: 'Grade Verification', broker: 'N/A', schedule: 'EOD', pairs: 'All graded trades', desc: 'Fact-checks Professor: verifies news blame vs econ calendar, audits Intel attribution, can OVERTURN grades', color: '#6366f1' },
];

const JIRA_PROJECTS = [
  { key: 'SCRUM', name: 'Core Dev', pickup: 'Auto', agent: 'Ops' },
  { key: 'PULSE', name: 'Health', pickup: 'Auto', agent: 'Arbiter' },
  { key: 'INFRA', name: 'Infrastructure', pickup: 'Auto', agent: 'Hunter/Ops' },
  { key: 'BACK', name: 'Backlog', pickup: 'Auto', agent: 'Scout' },
  { key: 'LEARN', name: 'Learning', pickup: 'Manual', agent: 'Cortana' },
  { key: 'GRADE', name: 'Grading', pickup: 'Manual', agent: 'Cortana' },
  { key: 'MGMT', name: 'Management', pickup: 'Manual', agent: 'Chief' },
];

const PROJECT_STRUCTURE: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    children: [
      {
        name: 'app',
        type: 'folder',
        children: [
          {
            name: 'system',
            type: 'folder',
            children: [
              {
                name: 'under-the-hood',
                type: 'folder',
                children: [
                  { name: 'page.tsx', type: 'file', extension: 'tsx' },
                ],
              },
            ],
          },
          {
            name: 'agents',
            type: 'folder',
            children: [
              { name: 'page.tsx', type: 'file', extension: 'tsx' },
            ],
          },
          {
            name: 'api',
            type: 'folder',
            children: [
              {
                name: 'control',
                type: 'folder',
                children: [
                  { name: 'route.ts', type: 'file', extension: 'ts' },
                ],
              },
              {
                name: 'webhook',
                type: 'folder',
                children: [
                  {
                    name: 'tradingview',
                    type: 'folder',
                    children: [
                      { name: 'route.ts', type: 'file', extension: 'ts' },
                    ],
                  },
                ],
              },
              {
                name: 'signals',
                type: 'folder',
                children: [
                  { name: 'route.ts', type: 'file', extension: 'ts' },
                ],
              },
              {
                name: 'journal',
                type: 'folder',
                children: [
                  { name: 'route.ts', type: 'file', extension: 'ts' },
                ],
              },
              {
                name: 'agents',
                type: 'folder',
                children: [
                  { name: 'route.ts', type: 'file', extension: 'ts' },
                ],
              },
            ],
          },
          { name: 'globals.css', type: 'file', extension: 'css' },
          { name: 'layout.tsx', type: 'file', extension: 'tsx' },
        ],
      },
      {
        name: 'components',
        type: 'folder',
        children: [
          {
            name: 'Layout',
            type: 'folder',
            children: [
              { name: 'Sidebar.tsx', type: 'file', extension: 'tsx' },
              { name: 'Header.tsx', type: 'file', extension: 'tsx' },
            ],
          },
          {
            name: 'Dashboard',
            type: 'folder',
            children: [
              { name: 'TradingChart.tsx', type: 'file', extension: 'tsx' },
              { name: 'ActiveSignals.tsx', type: 'file', extension: 'tsx' },
            ],
          },
          {
            name: 'Agents',
            type: 'folder',
            children: [
              { name: 'AgentTerminal.tsx', type: 'file', extension: 'tsx' },
            ],
          },
          {
            name: 'UI',
            type: 'folder',
            children: [
              {
                name: '21st',
                type: 'folder',
                children: [
                  { name: 'FileTree.tsx', type: 'file', extension: 'tsx' },
                  { name: 'IntegrationsGrid.tsx', type: 'file', extension: 'tsx' },
                  { name: 'BentoItem.tsx', type: 'file', extension: 'tsx' },
                  { name: 'GlowingEffect.tsx', type: 'file', extension: 'tsx' },
                ],
              },
              { name: 'GlassPanel.tsx', type: 'file', extension: 'tsx' },
              { name: 'PulseIndicator.tsx', type: 'file', extension: 'tsx' },
              { name: 'ShimmerButton.tsx', type: 'file', extension: 'tsx' },
            ],
          },
        ],
      },
      {
        name: 'lib',
        type: 'folder',
        children: [
          {
            name: 'engine',
            type: 'folder',
            children: [
              { name: 'manager.ts', type: 'file', extension: 'ts' },
              { name: 'risk.ts', type: 'file', extension: 'ts' },
              { name: 'executor.ts', type: 'file', extension: 'ts' },
              {
                name: 'strategies',
                type: 'folder',
                children: [
                  { name: 'orb.ts', type: 'file', extension: 'ts' },
                  { name: 'support-resistance.ts', type: 'file', extension: 'ts' },
                  { name: 'vwap.ts', type: 'file', extension: 'ts' },
                  { name: 'three-ducks.ts', type: 'file', extension: 'ts' },
                ],
              },
            ],
          },
          { name: 'db.ts', type: 'file', extension: 'ts' },
          { name: 'utils.ts', type: 'file', extension: 'ts' },
        ],
      },
    ],
  },
  {
    name: 'scripts',
    type: 'folder',
    children: [
      { name: 'agent_runner.ts', type: 'file', extension: 'ts', badge: 'CORE', badgeColor: '#06b6d4' },
      { name: 'activity-bridge.ts', type: 'file', extension: 'ts' },
      { name: 'sterling_engine.py', type: 'file', extension: 'py' },
      { name: 'bitcoin_bob_engine.py', type: 'file', extension: 'py' },
      { name: 'pivot_pete_engine.py', type: 'file', extension: 'py' },
      { name: 'boba_engine.py', type: 'file', extension: 'py' },
      { name: 'spx_sniper_engine.py', type: 'file', extension: 'py' },
      { name: 'position_sync.py', type: 'file', extension: 'py' },
      { name: 'alpaca_executor.py', type: 'file', extension: 'py' },
    ],
  },
  {
    name: 'data',
    type: 'folder',
    children: [
      {
        name: 'brain',
        type: 'folder',
        children: [
          { name: '🎯 Master Tracker.md', type: 'file', extension: 'md' },
          { name: '📊 Dashboard.md', type: 'file', extension: 'md' },
          { name: 'System Architecture.md', type: 'file', extension: 'md' },
          { name: 'Agent System.md', type: 'file', extension: 'md' },
          { name: 'Strategies Overview.md', type: 'file', extension: 'md' },
          { name: 'Troubleshooting.md', type: 'file', extension: 'md' },
          { name: 'Connection Map.md', type: 'file', extension: 'md' },
          { name: 'LLM Control API.md', type: 'file', extension: 'md' },
        ],
      },
      { name: 'swjsh.db', type: 'file', extension: 'sql' },
      { name: 'agents_db.json', type: 'file', extension: 'json', badge: 'LIVE', badgeColor: '#22c55e' },
    ],
  },
];

const INTEGRATIONS: Integration[] = [
  { name: 'Alpaca', icon: Globe, color: '#22c55e', status: 'active', description: 'Futures & Options' },
  { name: 'OANDA', icon: Globe, color: '#3b82f6', status: 'active', description: 'Forex Trading' },
  { name: 'Binance', icon: Zap, color: '#f59e0b', status: 'streaming', description: 'WebSocket Feed' },
  { name: 'TradingView', icon: BarChart3, color: '#fbbf24', status: 'active', description: 'Alerts' },
  { name: 'Discord', icon: Radio, color: '#6366f1', status: 'connected', description: '14 Channels' },
  { name: 'Jira Cloud', icon: GitBranch, color: '#3b82f6', status: 'active', description: '7 Projects' },
  { name: 'n8n', icon: Workflow, color: '#ef4444', status: 'active', description: '49 Workflows' },
  { name: 'Obsidian Brain', icon: Brain, color: '#a855f7', status: 'connected', description: 'Knowledge Base' },
  { name: 'Claude Cowork', icon: Terminal, color: '#22c55e', status: 'connected', description: 'MCP' },
  { name: 'PM2', icon: Monitor, color: '#06b6d4', status: 'active', description: 'Process Manager' },
  { name: 'SQLite DB', icon: Database, color: '#ec4899', status: 'active', description: 'Local DB' },
  { name: 'yfinance', icon: Activity, color: '#06b6d4', status: 'active', description: 'Market Data' },
];

export default function UnderTheHood() {
  const [activeTab, setActiveTab] = useState<Tab>('architecture');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <Layers className={styles.headerIcon} />
            <div>
              <h1 className={styles.pageTitle}>Under the Hood</h1>
              <p className={styles.pageSubtitle}>Enterprise system architecture & infrastructure visualization</p>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className={styles.tabBar}>
          {(['architecture', 'agents', 'infrastructure', 'dataflow', 'health'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ''}`}
            >
              {tab === 'architecture' && <Boxes size={16} />}
              {tab === 'agents' && <Users size={16} />}
              {tab === 'infrastructure' && <Server size={16} />}
              {tab === 'dataflow' && <GitBranch size={16} />}
              {tab === 'health' && <Heart size={16} />}
              <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className={styles.contentArea}>
        <AnimatePresence mode="wait">
          {activeTab === 'architecture' && (
            <motion.div
              key="architecture"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
            >
              <ArchitectureTab hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} svgRef={svgRef} />
            </motion.div>
          )}
          {activeTab === 'agents' && (
            <motion.div
              key="agents"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
            >
              <AgentsTab />
            </motion.div>
          )}
          {activeTab === 'infrastructure' && (
            <motion.div
              key="infrastructure"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
            >
              <InfrastructureTab />
            </motion.div>
          )}
          {activeTab === 'dataflow' && (
            <motion.div
              key="dataflow"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
            >
              <DataFlowTab />
            </motion.div>
          )}
          {activeTab === 'health' && (
            <motion.div
              key="health"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
            >
              <HealthTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ArchitectureTab({ hoveredNode, setHoveredNode, svgRef }: any) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.architectureContainer}>
        {/* Section: System Architecture Diagram */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={styles.architectureDiagramSection}
        >
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>System Architecture</h2>
            <p className={styles.sectionSubtitle}>Real-time trading platform with autonomous agent orchestration</p>
          </div>

          <svg
            ref={svgRef}
            className={styles.architectureSVG}
            viewBox="0 0 1400 900"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Animated flow lines */}
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="rgba(168, 85, 247, 0.6)" />
              </marker>
              <style>{`
                @keyframes flowAnimation {
                  0% { stroke-dashoffset: 0; }
                  100% { stroke-dashoffset: -20; }
                }
                .flow-line {
                  stroke-dasharray: 10, 10;
                  animation: flowAnimation 1.5s linear infinite;
                }
              `}</style>
            </defs>

            {/* YOU (JACK) - Top Center */}
            <g onMouseEnter={() => setHoveredNode('jack')} onMouseLeave={() => setHoveredNode(null)}>
              <circle cx="700" cy="50" r="35" fill="#a855f7" opacity={hoveredNode === 'jack' ? 0.9 : 0.7} />
              <text x="700" y="55" textAnchor="middle" className={styles.nodeText} fontSize="16" fontWeight="700">
                Jack
              </text>
            </g>

            {/* VISIBILITY & CONTROL LAYER - Left Section */}
            <g>
              <text x="100" y="140" className={styles.sectionLabel} fill="#06b6d4">
                VISIBILITY & CONTROL LAYER
              </text>

              {/* Activity Feed */}
              <g onMouseEnter={() => setHoveredNode('activity')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="20" y="160" width="140" height="60" rx="8" fill="rgba(6, 182, 212, 0.15)" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1.5" opacity={hoveredNode === 'activity' ? 1 : 0.7} />
                <text x="30" y="180" className={styles.nodeLabel} fill="#06b6d4">
                  Activity Feed
                </text>
                <text x="30" y="198" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                  :3000 | WS :3001
                </text>
                <text x="30" y="212" className={styles.nodeDetail} fill="#64748b" fontSize="10">
                  6 terminals
                </text>
              </g>

              {/* Obsidian Brain */}
              <g onMouseEnter={() => setHoveredNode('brain')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="20" y="240" width="140" height="60" rx="8" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5" opacity={hoveredNode === 'brain' ? 1 : 0.7} />
                <text x="30" y="260" className={styles.nodeLabel} fill="#a855f7">
                  Obsidian Brain
                </text>
                <text x="30" y="278" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                  Master Tracker
                </text>
                <text x="30" y="292" className={styles.nodeDetail} fill="#64748b" fontSize="10">
                  12 markdown files
                </text>
              </g>

              {/* Discord HQ */}
              <g onMouseEnter={() => setHoveredNode('discord')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="20" y="320" width="140" height="60" rx="8" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" opacity={hoveredNode === 'discord' ? 1 : 0.7} />
                <text x="30" y="340" className={styles.nodeLabel} fill="#6366f1">
                  Discord HQ
                </text>
                <text x="30" y="358" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                  14 channels | 6 bots
                </text>
                <text x="30" y="372" className={styles.nodeDetail} fill="#64748b" fontSize="10">
                  Webhooks enabled
                </text>
              </g>

              {/* Claude Cowork */}
              <g onMouseEnter={() => setHoveredNode('cowork')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="20" y="400" width="140" height="60" rx="8" fill="rgba(34, 197, 94, 0.15)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" opacity={hoveredNode === 'cowork' ? 1 : 0.7} />
                <text x="30" y="420" className={styles.nodeLabel} fill="#22c55e">
                  Claude Cowork
                </text>
                <text x="30" y="438" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                  Desktop app
                </text>
                <text x="30" y="452" className={styles.nodeDetail} fill="#64748b" fontSize="10">
                  MCP connectors
                </text>
              </g>
            </g>

            {/* HALO CREW - Top Left to Center */}
            <g>
              <text x="230" y="140" className={styles.sectionLabel} fill="#ec4899">
                HALO CREW (AI Dev Agents)
              </text>

              {/* Chief */}
              <g onMouseEnter={() => setHoveredNode('chief')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="230" y="160" width="110" height="50" rx="6" fill="rgba(168, 85, 247, 0.12)" stroke="#6B8E23" strokeWidth="2" opacity={hoveredNode === 'chief' ? 0.9 : 0.6} />
                <text x="285" y="177" textAnchor="middle" className={styles.nodeLabel} fill="#f8fafc" fontSize="13">
                  Chief
                </text>
                <text x="285" y="193" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="9">
                  MGMT
                </text>
              </g>

              {/* Arbiter */}
              <g onMouseEnter={() => setHoveredNode('arbiter')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="350" y="160" width="110" height="50" rx="6" fill="rgba(168, 85, 247, 0.12)" stroke="#8B4513" strokeWidth="2" opacity={hoveredNode === 'arbiter' ? 0.9 : 0.6} />
                <text x="405" y="177" textAnchor="middle" className={styles.nodeLabel} fill="#f8fafc" fontSize="13">
                  Arbiter
                </text>
                <text x="405" y="193" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="9">
                  PULSE
                </text>
              </g>

              {/* Cortana */}
              <g onMouseEnter={() => setHoveredNode('cortana')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="470" y="160" width="110" height="50" rx="6" fill="rgba(168, 85, 247, 0.12)" stroke="#6495ED" strokeWidth="2" opacity={hoveredNode === 'cortana' ? 0.9 : 0.6} />
                <text x="525" y="177" textAnchor="middle" className={styles.nodeLabel} fill="#f8fafc" fontSize="13">
                  Cortana
                </text>
                <text x="525" y="193" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="9">
                  LEARN+GRADE
                </text>
              </g>

              {/* Scout */}
              <g onMouseEnter={() => setHoveredNode('scout')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="590" y="160" width="110" height="50" rx="6" fill="rgba(168, 85, 247, 0.12)" stroke="#2E8B57" strokeWidth="2" opacity={hoveredNode === 'scout' ? 0.9 : 0.6} />
                <text x="645" y="177" textAnchor="middle" className={styles.nodeLabel} fill="#f8fafc" fontSize="13">
                  Scout
                </text>
                <text x="645" y="193" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="9">
                  BACK
                </text>
              </g>

              {/* Ops */}
              <g onMouseEnter={() => setHoveredNode('ops')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="710" y="160" width="110" height="50" rx="6" fill="rgba(168, 85, 247, 0.12)" stroke="#DAA520" strokeWidth="2" opacity={hoveredNode === 'ops' ? 0.9 : 0.6} />
                <text x="765" y="177" textAnchor="middle" className={styles.nodeLabel} fill="#f8fafc" fontSize="13">
                  Ops
                </text>
                <text x="765" y="193" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="9">
                  SCRUM
                </text>
              </g>

              {/* Hunter */}
              <g onMouseEnter={() => setHoveredNode('hunter')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="830" y="160" width="110" height="50" rx="6" fill="rgba(168, 85, 247, 0.12)" stroke="#8A2BE2" strokeWidth="2" opacity={hoveredNode === 'hunter' ? 0.9 : 0.6} />
                <text x="885" y="177" textAnchor="middle" className={styles.nodeLabel} fill="#f8fafc" fontSize="13">
                  Hunter
                </text>
                <text x="885" y="193" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="9">
                  INFRA
                </text>
              </g>
            </g>

            {/* JIRA - Below Halo Crew */}
            <g onMouseEnter={() => setHoveredNode('jira')} onMouseLeave={() => setHoveredNode(null)}>
              <rect x="230" y="240" width="710" height="90" rx="8" fill="rgba(59, 130, 246, 0.08)" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="1.5" opacity={hoveredNode === 'jira' ? 0.8 : 0.5} />
              <text x="250" y="260" className={styles.sectionLabel} fill="#3b82f6">
                JIRA - 7 Projects
              </text>
              <text x="250" y="278" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                SCRUM (Auto • Ops) | PULSE (Auto • Arbiter) | INFRA (Auto • Hunter/Ops) | BACK (Auto • Scout)
              </text>
              <text x="250" y="295" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                LEARN (Manual • Cortana) | GRADE (Manual • Cortana) | MGMT (Manual • Chief)
              </text>
              <text x="250" y="312" className={styles.nodeDetail} fill="#64748b" fontSize="10">
                jira_agent_loop.py runs autonomously, syncing issues to agents
              </text>
            </g>

            {/* n8n - Middle Right */}
            <g onMouseEnter={() => setHoveredNode('n8n')} onMouseLeave={() => setHoveredNode(null)}>
              <rect x="1000" y="160" width="150" height="170" rx="8" fill="rgba(239, 68, 68, 0.12)" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1.5" opacity={hoveredNode === 'n8n' ? 1 : 0.7} />
              <text x="1010" y="180" className={styles.nodeLabel} fill="#ef4444">
                n8n Automation
              </text>
              <text x="1010" y="198" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                VPS 209.145.55.101
              </text>
              <text x="1010" y="214" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                49 workflows
              </text>
              <text x="1010" y="230" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                534 nodes | 47 triggers
              </text>
              <text x="1010" y="246" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                Jira Sync • Discord Comms
              </text>
              <text x="1010" y="260" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                Market Alerts • Agent Comms
              </text>
              <text x="1010" y="274" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                Infra Monitors
              </text>
              <text x="1010" y="312" className={styles.nodeLabel} fill="#fbbf24" fontSize="12">
                ↓ Contabo Managed
              </text>
            </g>

            {/* SWJSHAK TRADING ENGINE - Center */}
            <g onMouseEnter={() => setHoveredNode('swjshak')} onMouseLeave={() => setHoveredNode(null)}>
              <rect x="280" y="370" width="480" height="120" rx="10" fill="rgba(6, 182, 212, 0.12)" stroke="rgba(6, 182, 212, 0.5)" strokeWidth="2" opacity={hoveredNode === 'swjshak' ? 0.9 : 0.7} />
              <text x="300" y="395" className={styles.sectionLabel} fill="#06b6d4">
                SWJSHAK Trading Engine (Next.js)
              </text>
              <text x="300" y="415" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                Dashboard • 31 API routes • App Router
              </text>
              <text x="300" y="432" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                LLM Control API (/api/control) • pause/resume/kill commands
              </text>
              <text x="300" y="449" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                Agent Runner (agent_runner.ts) • Watchdog (18 checks, 60s cycle)
              </text>
              <text x="300" y="466" className={styles.nodeDetail} fill="#64748b" fontSize="10">
                data/brain/ (12 markdown files) • SQLite DB
              </text>
            </g>

            {/* TRADING AGENTS - Below Engine */}
            <g>
              <text x="300" y="525" className={styles.sectionLabel} fill="#f59e0b">
                7 Python Trading Agents
              </text>

              {/* Row 1: Sterling, Bitcoin Bob, Pivot Pete */}
              <g onMouseEnter={() => setHoveredNode('sterling')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="240" y="540" width="100" height="65" rx="6" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" opacity={hoveredNode === 'sterling' ? 0.9 : 0.6} />
                <text x="290" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#f59e0b" fontSize="12">
                  Sterling
                </text>
                <text x="290" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  FX • Three Ducks
                </text>
                <text x="290" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  OANDA
                </text>
              </g>

              <g onMouseEnter={() => setHoveredNode('bitcoin')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="350" y="540" width="100" height="65" rx="6" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" opacity={hoveredNode === 'bitcoin' ? 0.9 : 0.6} />
                <text x="400" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#f59e0b" fontSize="12">
                  Bitcoin Bob
                </text>
                <text x="400" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  Crypto • 24/7
                </text>
                <text x="400" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  Binance
                </text>
              </g>

              <g onMouseEnter={() => setHoveredNode('pivot')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="460" y="540" width="100" height="65" rx="6" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" opacity={hoveredNode === 'pivot' ? 0.9 : 0.6} />
                <text x="510" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#f59e0b" fontSize="12">
                  Pivot Pete
                </text>
                <text x="510" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  Futures • ORB
                </text>
                <text x="510" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  Alpaca
                </text>
              </g>

              {/* Row 2: Boba, SPX Sniper, Professor, Auditor */}
              <g onMouseEnter={() => setHoveredNode('boba')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="570" y="540" width="100" height="65" rx="6" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" opacity={hoveredNode === 'boba' ? 0.9 : 0.6} />
                <text x="620" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#f59e0b" fontSize="12">
                  Boba
                </text>
                <text x="620" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  Options • SPY
                </text>
                <text x="620" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  Alpaca
                </text>
              </g>

              <g onMouseEnter={() => setHoveredNode('spx')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="680" y="540" width="100" height="65" rx="6" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" opacity={hoveredNode === 'spx' ? 0.9 : 0.6} />
                <text x="730" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#f59e0b" fontSize="12">
                  SPX Sniper
                </text>
                <text x="730" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  Options • 0DTE
                </text>
                <text x="730" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  Alpaca
                </text>
              </g>

              <g onMouseEnter={() => setHoveredNode('professor')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="790" y="540" width="100" height="65" rx="6" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" opacity={hoveredNode === 'professor' ? 0.9 : 0.6} />
                <text x="840" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#f59e0b" fontSize="12">
                  Professor
                </text>
                <text x="840" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  Grading • EOD
                </text>
                <text x="840" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  Analyst
                </text>
              </g>

              <g onMouseEnter={() => setHoveredNode('auditor')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="900" y="540" width="100" height="65" rx="6" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1" opacity={hoveredNode === 'auditor' ? 0.9 : 0.6} />
                <text x="950" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#f59e0b" fontSize="12">
                  Auditor
                </text>
                <text x="950" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  Verification • EOD
                </text>
                <text x="950" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  Auditor
                </text>
              </g>
            </g>

            {/* EXTERNAL BROKERS - Bottom Right */}
            <g>
              <text x="1050" y="525" className={styles.sectionLabel} fill="#22c55e">
                Live Market Connections
              </text>

              <g onMouseEnter={() => setHoveredNode('alpaca')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="1020" y="540" width="110" height="65" rx="6" fill="rgba(34, 197, 94, 0.15)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1" opacity={hoveredNode === 'alpaca' ? 0.9 : 0.6} />
                <text x="1075" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#22c55e" fontSize="12">
                  Alpaca API
                </text>
                <text x="1075" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  Futures • Options
                </text>
                <text x="1075" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  REST/WebSocket
                </text>
              </g>

              <g onMouseEnter={() => setHoveredNode('oanda')} onMouseLeave={() => setHoveredNode(null)}>
                <rect x="1140" y="540" width="110" height="65" rx="6" fill="rgba(34, 197, 94, 0.15)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1" opacity={hoveredNode === 'oanda' ? 0.9 : 0.6} />
                <text x="1195" y="560" textAnchor="middle" className={styles.nodeLabel} fill="#22c55e" fontSize="12">
                  OANDA API
                </text>
                <text x="1195" y="577" textAnchor="middle" className={styles.nodeDetail} fill="#94a3b8" fontSize="10">
                  Forex Trading
                </text>
                <text x="1195" y="593" textAnchor="middle" className={styles.nodeDetail} fill="#64748b" fontSize="9">
                  REST API
                </text>
              </g>
            </g>

            {/* ═══ FLOW LINES (animated arrows connecting all nodes) ═══ */}
            {/* Jack → Visibility Layer */}
            <line x1="700" y1="85" x2="90" y2="160" className="flow-line" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            {/* Visibility → Halo Crew */}
            <line x1="160" y1="300" x2="285" y2="210" className="flow-line" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            {/* Halo Crew → Jira */}
            <line x1="540" y1="210" x2="540" y2="240" className="flow-line" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            {/* Jira → Engine */}
            <line x1="540" y1="330" x2="520" y2="370" className="flow-line" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            {/* Engine → Trading Agents */}
            <line x1="520" y1="490" x2="520" y2="540" className="flow-line" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            {/* Trading Agents → External Brokers */}
            <line x1="900" y1="575" x2="1020" y2="575" className="flow-line" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="2" markerEnd="url(#arrowhead)" />
            {/* n8n → Engine */}
            <line x1="1000" y1="245" x2="760" y2="380" className="flow-line" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            {/* n8n → Halo Crew */}
            <line x1="1000" y1="200" x2="940" y2="185" className="flow-line" stroke="rgba(239, 68, 68, 0.2)" strokeWidth="1" markerEnd="url(#arrowhead)" />
            {/* Jack → n8n */}
            <line x1="735" y1="50" x2="1000" y2="180" className="flow-line" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            {/* Cowork → Engine */}
            <line x1="160" y1="430" x2="280" y2="420" className="flow-line" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            {/* Discord → n8n */}
            <line x1="160" y1="350" x2="1000" y2="280" className="flow-line" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="1" markerEnd="url(#arrowhead)" />
            {/* Brain → Chief */}
            <line x1="160" y1="260" x2="230" y2="185" className="flow-line" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="1.5" markerEnd="url(#arrowhead)" />

            {/* Legend */}
            <g>
              <text x="240" y="680" className={styles.sectionLabel} fill="#94a3b8">
                Legend
              </text>
              <circle cx="260" cy="700" r="5" fill="rgba(6, 182, 212, 0.5)" />
              <text x="275" y="704" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                Core Platform
              </text>
              <circle cx="420" cy="700" r="5" fill="rgba(168, 85, 247, 0.5)" />
              <text x="435" y="704" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                AI Agent
              </text>
              <circle cx="560" cy="700" r="5" fill="rgba(245, 158, 11, 0.5)" />
              <text x="575" y="704" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                Trading Agent
              </text>
              <circle cx="770" cy="700" r="5" fill="rgba(34, 197, 94, 0.5)" />
              <text x="785" y="704" className={styles.nodeDetail} fill="#94a3b8" fontSize="11">
                External Service
              </text>
            </g>
          </svg>
        </motion.div>

        {/* Section: Project Structure & Integrations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={styles.structureAndIntegrationsSection}
        >
          <div className={styles.twoColumnLayout}>
            {/* Left Column: FileTree */}
            <div className={styles.fileTreeWrapper}>
              <FileTree
                data={PROJECT_STRUCTURE}
                title="Project Structure"
                className={styles.fileTreeContainer}
              />
            </div>

            {/* Right Column: IntegrationsGrid */}
            <div className={styles.integrationsWrapper}>
              <IntegrationsGrid
                integrations={INTEGRATIONS}
                title="Connected Services"
                subtitle="Real-time connections to brokers, data feeds, and infrastructure services powering the SwjshAK trading engine"
                className={styles.integrationsContainer}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function AgentsTab() {
  return (
    <div className={styles.tabContent}>
      {/* Halo Crew Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Halo Crew - AI Development Agents</h2>
          <p className={styles.sectionSubtitle}>6 specialized Claude instances managing core development tasks</p>
        </div>

        <div className={styles.crewGrid}>
          {HALO_CREW.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={styles.crewCard} style={{ borderLeftColor: agent.color }}>
                  <div className={styles.crewHeader}>
                    <Icon size={24} style={{ color: agent.color }} />
                    <div>
                      <h3 className={styles.crewName}>{agent.name}</h3>
                      <p className={styles.crewRole}>{agent.role}</p>
                    </div>
                  </div>
                  <p className={styles.crewDesc}>{agent.desc}</p>
                  <div className={styles.crewFooter}>
                    <span className={styles.crewLabel}>JIRA</span>
                    <span className={styles.crewValue}>{agent.jira}</span>
                    <span className={styles.crewLabel} style={{ marginLeft: '1rem' }}>Pickup</span>
                    <span className={styles.crewValue}>{agent.pickup}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Trading Agents Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={styles.tradingAgentsSection}
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Trading Agents - Autonomous Market Participants</h2>
          <p className={styles.sectionSubtitle}>7 Python-based agents executing strategies across Forex, Crypto, Futures, and Options</p>
        </div>

        <div className={styles.agentGrid}>
          {TRADING_AGENTS.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className={styles.agentCard} style={{ borderTopColor: agent.color }}>
                <div className={styles.agentHeader}>
                  <h3 className={styles.agentName}>{agent.name}</h3>
                  <span className={styles.agentMarket}>{agent.market}</span>
                </div>
                <p className={styles.agentStrategy}>{agent.strategy}</p>
                <p className={styles.agentDesc}>{agent.desc}</p>
                <div className={styles.agentMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Broker</span>
                    <span className={styles.metaValue}>{agent.broker}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Schedule</span>
                    <span className={styles.metaValue}>{agent.schedule}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function InfrastructureTab() {
  return (
    <div className={styles.tabContent}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Infrastructure & Deployment</h2>
          <p className={styles.sectionSubtitle}>Containerized platform with Contabo VPS, n8n automation, and multi-agent orchestration</p>
        </div>

        <svg
          className={styles.infrastructureSVG}
          viewBox="0 0 1200 700"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Network Topology */}
          <defs>
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
              }
              .pulsing-circle {
                animation: pulse 2s ease-in-out infinite;
              }
            `}</style>
          </defs>

          {/* Central Hub */}
          <circle cx="600" cy="350" r="60" fill="rgba(6, 182, 212, 0.2)" stroke="rgba(6, 182, 212, 0.6)" strokeWidth="2" />
          <text x="600" y="350" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill="#06b6d4">
            Agent Runner
          </text>
          <circle cx="600" cy="350" r="8" fill="#06b6d4" className="pulsing-circle" />

          {/* Broker Connections */}
          <g>
            <text x="50" y="50" fontSize="14" fontWeight="600" fill="#22c55e">BROKERS</text>

            {/* Alpaca */}
            <rect x="20" y="80" width="140" height="60" rx="6" fill="rgba(34, 197, 94, 0.1)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
            <text x="90" y="105" textAnchor="middle" fontSize="12" fontWeight="600" fill="#22c55e">Alpaca API</text>
            <text x="90" y="125" textAnchor="middle" fontSize="10" fill="#94a3b8">Futures • Options</text>
            <line x1="160" y1="110" x2="540" y2="310" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="1" strokeDasharray="5,5" />

            {/* OANDA */}
            <rect x="20" y="160" width="140" height="60" rx="6" fill="rgba(59, 130, 246, 0.1)" stroke="rgba(59, 130, 246, 0.4)" strokeWidth="1.5" />
            <text x="90" y="185" textAnchor="middle" fontSize="12" fontWeight="600" fill="#3b82f6">OANDA API</text>
            <text x="90" y="205" textAnchor="middle" fontSize="10" fill="#94a3b8">Forex</text>
            <line x1="160" y1="190" x2="540" y2="330" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="1" strokeDasharray="5,5" />

            {/* Binance */}
            <rect x="20" y="240" width="140" height="60" rx="6" fill="rgba(245, 158, 11, 0.1)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.5" />
            <text x="90" y="265" textAnchor="middle" fontSize="12" fontWeight="600" fill="#f59e0b">Binance WS</text>
            <text x="90" y="285" textAnchor="middle" fontSize="10" fill="#94a3b8">Crypto Streams</text>
            <line x1="160" y1="270" x2="540" y2="350" stroke="rgba(245, 158, 11, 0.3)" strokeWidth="1" strokeDasharray="5,5" />
          </g>

          {/* Trading Agents */}
          <g>
            <text x="1050" y="50" fontSize="14" fontWeight="600" fill="#f59e0b">AGENTS</text>

            {/* Sterling */}
            <rect x="1020" y="80" width="140" height="50" rx="6" fill="rgba(245, 158, 11, 0.1)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.5" />
            <text x="1090" y="105" textAnchor="middle" fontSize="11" fontWeight="600" fill="#f59e0b">Sterling (FX)</text>
            <line x1="660" y1="320" x2="1020" y2="105" stroke="rgba(245, 158, 11, 0.3)" strokeWidth="1" strokeDasharray="5,5" />

            {/* Bitcoin Bob */}
            <rect x="1020" y="145" width="140" height="50" rx="6" fill="rgba(245, 158, 11, 0.1)" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.5" />
            <text x="1090" y="170" textAnchor="middle" fontSize="11" fontWeight="600" fill="#f59e0b">Bitcoin Bob</text>
            <line x1="660" y1="340" x2="1020" y2="170" stroke="rgba(245, 158, 11, 0.3)" strokeWidth="1" strokeDasharray="5,5" />

            {/* Pivot Pete */}
            <rect x="1020" y="210" width="140" height="50" rx="6" fill="rgba(6, 182, 212, 0.1)" stroke="rgba(6, 182, 212, 0.4)" strokeWidth="1.5" />
            <text x="1090" y="235" textAnchor="middle" fontSize="11" fontWeight="600" fill="#06b6d4">Pivot Pete</text>
            <line x1="660" y1="360" x2="1020" y2="235" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1" strokeDasharray="5,5" />

            {/* Boba */}
            <rect x="1020" y="275" width="140" height="50" rx="6" fill="rgba(168, 85, 247, 0.1)" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="1.5" />
            <text x="1090" y="300" textAnchor="middle" fontSize="11" fontWeight="600" fill="#a855f7">Boba (Options)</text>
            <line x1="660" y1="380" x2="1020" y2="300" stroke="rgba(168, 85, 247, 0.3)" strokeWidth="1" strokeDasharray="5,5" />

            {/* SPX Sniper */}
            <rect x="1020" y="340" width="140" height="50" rx="6" fill="rgba(236, 72, 153, 0.1)" stroke="rgba(236, 72, 153, 0.4)" strokeWidth="1.5" />
            <text x="1090" y="365" textAnchor="middle" fontSize="11" fontWeight="600" fill="#ec4899">SPX Sniper</text>
            <line x1="660" y1="380" x2="1020" y2="365" stroke="rgba(236, 72, 153, 0.3)" strokeWidth="1" strokeDasharray="5,5" />
          </g>

          {/* Monitoring & Control */}
          <g>
            <text x="50" y="450" fontSize="14" fontWeight="600" fill="#6366f1">MONITORING</text>

            {/* Watchdog */}
            <rect x="20" y="480" width="140" height="60" rx="6" fill="rgba(99, 102, 241, 0.1)" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="1.5" />
            <text x="90" y="505" textAnchor="middle" fontSize="12" fontWeight="600" fill="#6366f1">Watchdog</text>
            <text x="90" y="525" textAnchor="middle" fontSize="10" fill="#94a3b8">18 Checks • 60s</text>
            <line x1="160" y1="510" x2="540" y2="380" stroke="rgba(99, 102, 241, 0.3)" strokeWidth="1" strokeDasharray="5,5" />

            {/* n8n */}
            <rect x="20" y="560" width="140" height="60" rx="6" fill="rgba(239, 68, 68, 0.1)" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1.5" />
            <text x="90" y="585" textAnchor="middle" fontSize="12" fontWeight="600" fill="#ef4444">n8n Workflows</text>
            <text x="90" y="605" textAnchor="middle" fontSize="10" fill="#94a3b8">49 Workflows</text>
            <line x1="160" y1="590" x2="540" y2="380" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="1" strokeDasharray="5,5" />
          </g>

          {/* Infrastructure Info */}
          <g>
            <text x="1050" y="450" fontSize="14" fontWeight="600" fill="#8A2BE2">INFRASTRUCTURE</text>

            {/* PM2 */}
            <rect x="1020" y="480" width="140" height="60" rx="6" fill="rgba(138, 43, 226, 0.1)" stroke="rgba(138, 43, 226, 0.4)" strokeWidth="1.5" />
            <text x="1090" y="505" textAnchor="middle" fontSize="12" fontWeight="600" fill="#8A2BE2">PM2 Manager</text>
            <text x="1090" y="525" textAnchor="middle" fontSize="10" fill="#94a3b8">3 Processes</text>
            <line x1="660" y1="400" x2="1020" y2="510" stroke="rgba(138, 43, 226, 0.3)" strokeWidth="1" strokeDasharray="5,5" />

            {/* Docker */}
            <rect x="1020" y="560" width="140" height="60" rx="6" fill="rgba(34, 197, 94, 0.1)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="1.5" />
            <text x="1090" y="585" textAnchor="middle" fontSize="12" fontWeight="600" fill="#22c55e">Docker/VPS</text>
            <text x="1090" y="605" textAnchor="middle" fontSize="10" fill="#94a3b8">Contabo 209.145</text>
            <line x1="660" y1="400" x2="1020" y2="590" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="1" strokeDasharray="5,5" />
          </g>
        </svg>

        {/* Infrastructure Cards */}
        <div className={styles.infrastructureCards}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={styles.infraCard}
          >
            <div className={styles.infraCardIcon} style={{ color: '#06b6d4' }}>
              <Cpu size={24} />
            </div>
            <h3>Agent Runner</h3>
            <p>TypeScript orchestrator spawning Python trading agents as child processes. Auto-restart on crash. Manages state in agents_db.json.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className={styles.infraCard}
          >
            <div className={styles.infraCardIcon} style={{ color: '#8A2BE2' }}>
              <Monitor size={24} />
            </div>
            <h3>Watchdog System</h3>
            <p>18 health checks every 60 seconds. Monitors CPU, memory, open trades, PnL, stuck agents. Triggers auto-restart or alerts.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={styles.infraCard}
          >
            <div className={styles.infraCardIcon} style={{ color: '#ef4444' }}>
              <Workflow size={24} />
            </div>
            <h3>n8n Automation</h3>
            <p>49 workflows on VPS 209.145.55.101. Jira sync, Discord notifications, market alerts, agent communications, infrastructure monitoring.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className={styles.infraCard}
          >
            <div className={styles.infraCardIcon} style={{ color: '#22c55e' }}>
              <HardDrive size={24} />
            </div>
            <h3>Data Layer</h3>
            <p>SQLite database with 4 core tables: trades, signals, journal_entries, settings. agents_db.json stores live agent state and audit logs.</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function DataFlowTab() {
  return (
    <div className={styles.tabContent}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Complete Trade Lifecycle Pipeline</h2>
          <p className={styles.sectionSubtitle}>From market signal to trade closure and performance grading</p>
        </div>

        <svg
          className={styles.dataFlowSVG}
          viewBox="0 0 1400 600"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Pipeline stages */}
          <defs>
            <marker id="arrowFlow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#06b6d4" />
            </marker>
          </defs>

          {/* Stage 1: Market Signal */}
          <g>
            <rect x="50" y="120" width="180" height="120" rx="10" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.5)" strokeWidth="2" />
            <text x="140" y="150" textAnchor="middle" fontSize="14" fontWeight="700" fill="#f59e0b">1. Market Signal</text>
            <text x="140" y="175" textAnchor="middle" fontSize="11" fill="#94a3b8">TradingView Webhook</text>
            <text x="140" y="193" textAnchor="middle" fontSize="11" fill="#94a3b8">or Strategy Event</text>
            <text x="140" y="210" textAnchor="middle" fontSize="10" fill="#64748b">signals table</text>
            <line x1="230" y1="180" x2="300" y2="180" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowFlow)" />
          </g>

          {/* Stage 2: Signal Validation */}
          <g>
            <rect x="300" y="120" width="180" height="120" rx="10" fill="rgba(59, 130, 246, 0.15)" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="2" />
            <text x="390" y="150" textAnchor="middle" fontSize="14" fontWeight="700" fill="#3b82f6">2. Validation</text>
            <text x="390" y="175" textAnchor="middle" fontSize="11" fill="#94a3b8">Risk Checks</text>
            <text x="390" y="193" textAnchor="middle" fontSize="11" fill="#94a3b8">Position Limits</text>
            <text x="390" y="210" textAnchor="middle" fontSize="10" fill="#64748b">agents_db.json</text>
            <line x1="480" y1="180" x2="550" y2="180" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowFlow)" />
          </g>

          {/* Stage 3: Trade Execution */}
          <g>
            <rect x="550" y="120" width="180" height="120" rx="10" fill="rgba(34, 197, 94, 0.15)" stroke="rgba(34, 197, 94, 0.5)" strokeWidth="2" />
            <text x="640" y="150" textAnchor="middle" fontSize="14" fontWeight="700" fill="#22c55e">3. Execution</text>
            <text x="640" y="175" textAnchor="middle" fontSize="11" fill="#94a3b8">Live Order to Broker</text>
            <text x="640" y="193" textAnchor="middle" fontSize="11" fill="#94a3b8">REST/WebSocket API</text>
            <text x="640" y="210" textAnchor="middle" fontSize="10" fill="#64748b">trades table</text>
            <line x1="730" y1="180" x2="800" y2="180" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowFlow)" />
          </g>

          {/* Stage 4: Monitoring */}
          <g>
            <rect x="800" y="120" width="180" height="120" rx="10" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="2" />
            <text x="890" y="150" textAnchor="middle" fontSize="14" fontWeight="700" fill="#a855f7">4. Monitoring</text>
            <text x="890" y="175" textAnchor="middle" fontSize="11" fill="#94a3b8">Real-time P&L</text>
            <text x="890" y="193" textAnchor="middle" fontSize="11" fill="#94a3b8">Heartbeat • Alerts</text>
            <text x="890" y="210" textAnchor="middle" fontSize="10" fill="#64748b">watchdog • n8n</text>
            <line x1="980" y1="180" x2="1050" y2="180" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowFlow)" />
          </g>

          {/* Stage 5: Exit */}
          <g>
            <rect x="1050" y="120" width="180" height="120" rx="10" fill="rgba(236, 72, 153, 0.15)" stroke="rgba(236, 72, 153, 0.5)" strokeWidth="2" />
            <text x="1140" y="150" textAnchor="middle" fontSize="14" fontWeight="700" fill="#ec4899">5. Exit</text>
            <text x="1140" y="175" textAnchor="middle" fontSize="11" fill="#94a3b8">Close Position</text>
            <text x="1140" y="193" textAnchor="middle" fontSize="11" fill="#94a3b8">Manual or SL/TP</text>
            <text x="1140" y="210" textAnchor="middle" fontSize="10" fill="#64748b">trade closed</text>
            <line x1="1140" y1="240" x2="1140" y2="310" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowFlow)" />
          </g>

          {/* Stage 6: Grading */}
          <g>
            <rect x="1050" y="310" width="180" height="120" rx="10" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.5)" strokeWidth="2" />
            <text x="1140" y="340" textAnchor="middle" fontSize="14" fontWeight="700" fill="#8b5cf6">6. Grading (EOD)</text>
            <text x="1140" y="365" textAnchor="middle" fontSize="11" fill="#94a3b8">The Professor grades</text>
            <text x="1140" y="383" textAnchor="middle" fontSize="11" fill="#94a3b8">R:R, Duration, Win Rate</text>
            <text x="1140" y="400" textAnchor="middle" fontSize="10" fill="#64748b">agents_db.json</text>
            <line x1="1050" y1="370" x2="980" y2="370" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowFlow)" />
          </g>

          {/* Stage 7: Auditing */}
          <g>
            <rect x="800" y="310" width="180" height="120" rx="10" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.5)" strokeWidth="2" />
            <text x="890" y="340" textAnchor="middle" fontSize="14" fontWeight="700" fill="#6366f1">7. Auditing (EOD)</text>
            <text x="890" y="365" textAnchor="middle" fontSize="11" fill="#94a3b8">The Auditor fact-checks</text>
            <text x="890" y="383" textAnchor="middle" fontSize="11" fill="#94a3b8">News • Econ Calendar</text>
            <text x="890" y="400" textAnchor="middle" fontSize="10" fill="#64748b">Can OVERTURN grades</text>
            <line x1="800" y1="370" x2="730" y2="370" stroke="#06b6d4" strokeWidth="2" markerEnd="url(#arrowFlow)" />
          </g>

          {/* Stage 8: Journal */}
          <g>
            <rect x="550" y="310" width="180" height="120" rx="10" fill="rgba(168, 85, 247, 0.15)" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="2" />
            <text x="640" y="340" textAnchor="middle" fontSize="14" fontWeight="700" fill="#a855f7">8. Journal Entry</text>
            <text x="640" y="365" textAnchor="middle" fontSize="11" fill="#94a3b8">Final Trade Record</text>
            <text x="640" y="383" textAnchor="middle" fontSize="11" fill="#94a3b8">Grade • Audit • Notes</text>
            <text x="640" y="400" textAnchor="middle" fontSize="10" fill="#64748b">journal_entries table</text>
          </g>

          {/* Key Insights */}
          <g>
            <text x="50" y="520" fontSize="13" fontWeight="700" fill="#06b6d4">Key Flow Points:</text>
            <text x="50" y="545" fontSize="11" fill="#94a3b8">• All trades start in signals table → validated against position limits → executed via broker APIs</text>
            <text x="50" y="563" fontSize="11" fill="#94a3b8">• Live P&L tracked in real-time via watchdog • Discord notifications for alerts</text>
            <text x="50" y="581" fontSize="11" fill="#94a3b8">• EOD: The Professor grades, The Auditor audits, Journal finalizes the record</text>
          </g>
        </svg>
      </motion.div>
    </div>
  );
}

function HealthTab() {
  return (
    <div className={styles.tabContent}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>System Health & Monitoring</h2>
          <p className={styles.sectionSubtitle}>Real-time watchdog metrics and heartbeat tracking across all agents</p>
        </div>

        {/* Quick Stats */}
        <div className={styles.healthStats}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className={styles.statCard}>
            <div className={styles.statIcon} style={{ color: '#22c55e' }}>
              <CheckCircle2 size={24} />
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statValue}>7 / 7</p>
              <p className={styles.statLabel}>Agents Active</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className={styles.statCard}>
            <div className={styles.statIcon} style={{ color: '#06b6d4' }}>
              <Monitor size={24} />
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statValue}>18 Checks</p>
              <p className={styles.statLabel}>Watchdog System</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className={styles.statCard}>
            <div className={styles.statIcon} style={{ color: '#f59e0b' }}>
              <Heart size={24} />
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statValue}>60s Cycle</p>
              <p className={styles.statLabel}>Health Check</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }} className={styles.statCard}>
            <div className={styles.statIcon} style={{ color: '#ef4444' }}>
              <AlertTriangle size={24} />
            </div>
            <div className={styles.statInfo}>
              <p className={styles.statValue}>3s Timeout</p>
              <p className={styles.statLabel}>Auto-Restart</p>
            </div>
          </motion.div>
        </div>

        {/* Watchdog Cycle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={styles.watchdogSection}
        >
          <h3 className={styles.subsectionTitle}>Watchdog Cycle (Every 60 Seconds)</h3>
          <svg className={styles.watchdogSVG} viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid meet">
            {/* Central check icon */}
            <circle cx="100" cy="150" r="40" fill="rgba(239, 68, 68, 0.15)" stroke="rgba(239, 68, 68, 0.5)" strokeWidth="2" />
            <text x="100" y="155" textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="700" fill="#ef4444">WATCHDOG</text>

            {/* 18 Checks radiating out */}
            {[
              { label: 'CPU Usage', x: 250, y: 60, color: '#3b82f6' },
              { label: 'Memory', x: 400, y: 40, color: '#3b82f6' },
              { label: 'Disk Free', x: 550, y: 50, color: '#3b82f6' },
              { label: 'Open Trades', x: 700, y: 80, color: '#22c55e' },
              { label: 'Live P&L', x: 820, y: 120, color: '#22c55e' },
              { label: 'Agent 1 ✓', x: 900, y: 170, color: '#22c55e' },
              { label: 'Agent 2 ✓', x: 880, y: 225, color: '#22c55e' },
              { label: 'Agent 3 ✓', x: 800, y: 265, color: '#22c55e' },
              { label: 'Agent 4 ✓', x: 700, y: 280, color: '#22c55e' },
              { label: 'Agent 5 ✓', x: 580, y: 270, color: '#22c55e' },
              { label: 'Agent 6 ✓', x: 450, y: 265, color: '#22c55e' },
              { label: 'Agent 7 ✓', x: 320, y: 245, color: '#22c55e' },
              { label: 'DB Connected', x: 200, y: 225, color: '#a855f7' },
              { label: 'API Healthy', x: 110, y: 285, color: '#a855f7' },
              { label: 'Discord Up', x: 40, y: 220, color: '#6366f1' },
              { label: 'n8n Status', x: 20, y: 140, color: '#ef4444' },
              { label: 'Broker Feeds', x: 50, y: 70, color: '#ec4899' },
              { label: 'Heartbeat OK', x: 160, y: 50, color: '#06b6d4' },
            ].map((check, i) => (
              <g key={i}>
                <line x1="140" y1="150" x2={check.x} y2={check.y} stroke={`${check.color}44`} strokeWidth="1" />
                <rect x={check.x - 55} y={check.y - 15} width="110" height="30" rx="4" fill={`${check.color}11`} stroke={`${check.color}44`} strokeWidth="1" />
                <text x={check.x} y={check.y + 4} textAnchor="middle" fontSize="10" fill={check.color}>{check.label}</text>
              </g>
            ))}
          </svg>
        </motion.div>

        {/* Heartbeat System */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={styles.heartbeatSection}
        >
          <h3 className={styles.subsectionTitle}>Heartbeat System - Real-time Activity Feed</h3>
          <div className={styles.heartbeatCards}>
            <div className={styles.heartbeatCard}>
              <div className={styles.heartbeatDot} style={{ backgroundColor: '#22c55e' }} />
              <div>
                <p className={styles.heartbeatTitle}>Activity Bridge (WS :3001)</p>
                <p className={styles.heartbeatDesc}>Publishes agent heartbeats every 5 seconds. Activity Feed subscribes for real-time visibility.</p>
              </div>
            </div>
            <div className={styles.heartbeatCard}>
              <div className={styles.heartbeatDot} style={{ backgroundColor: '#f59e0b' }} />
              <div>
                <p className={styles.heartbeatTitle}>Stuck Agent Detection</p>
                <p className={styles.heartbeatDesc}>If agent misses 3 heartbeats (15s timeout), marked as stuck. Auto-nudge via n8n triggers Discord alert.</p>
              </div>
            </div>
            <div className={styles.heartbeatCard}>
              <div className={styles.heartbeatDot} style={{ backgroundColor: '#06b6d4' }} />
              <div>
                <p className={styles.heartbeatTitle}>Auto-Restart Logic</p>
                <p className={styles.heartbeatDesc}>If agent process dies, agent_runner.ts auto-restarts it within 30 seconds. Max 5 consecutive restarts.</p>
              </div>
            </div>
            <div className={styles.heartbeatCard}>
              <div className={styles.heartbeatDot} style={{ backgroundColor: '#ef4444' }} />
              <div>
                <p className={styles.heartbeatTitle}>Discord Alerts</p>
                <p className={styles.heartbeatDesc}>Critical issues (stuck agents, system errors) trigger #alerts channel. n8n handles notification routing.</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Service Status Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={styles.serviceStatusSection}
        >
          <h3 className={styles.subsectionTitle}>Service Status</h3>
          <div className={styles.serviceGrid}>
            {[
              { name: 'Dashboard', status: 'active', port: ':3000' },
              { name: 'Agent Runner', status: 'active', port: 'subprocess' },
              { name: 'Activity Bridge', status: 'active', port: ':3001' },
              { name: 'SQLite DB', status: 'active', port: 'local' },
              { name: 'Alpaca API', status: 'active', port: 'REST' },
              { name: 'OANDA API', status: 'active', port: 'REST' },
              { name: 'Binance WS', status: 'streaming', port: 'WebSocket' },
              { name: 'TradingView Webhooks', status: 'active', port: 'inbound' },
              { name: 'Discord Webhooks', status: 'connected', port: 'outbound' },
              { name: 'n8n Workflows', status: 'active', port: 'VPS' },
              { name: 'Jira Integration', status: 'active', port: 'Cloud API' },
              { name: 'Obsidian Sync', status: 'connected', port: 'local' },
            ].map((service, i) => (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.03 }}
                className={styles.serviceItem}
              >
                <div className={styles.serviceIndicator} style={{
                  backgroundColor: service.status === 'active' || service.status === 'streaming' ? '#22c55e' :
                                     service.status === 'connected' ? '#06b6d4' : '#ef4444'
                }} />
                <div>
                  <p className={styles.serviceName}>{service.name}</p>
                  <p className={styles.servicePort}>{service.port}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
