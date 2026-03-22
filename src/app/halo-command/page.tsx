'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import styles from './halo-command.module.css';

type AgentState = 'idle' | 'typing' | 'reading' | 'running' | 'waiting' | 'offline';

interface AgentConfig {
  id: string;
  name: string;
  callsign: string;
  color: string;
  colorGlow: string;
  role: string;
  room: string;
  roomLabel: string;
  jira: string;
  // Fixed position of the character's head in the background art (% of room)
  charPos: { x: number; y: number };
  idleMessages: string[];
  offlineMsg: string;
}

const AGENTS: AgentConfig[] = [
  {
    id: 'chief', name: 'Master Chief', callsign: 'SPARTAN-117',
    color: '#4ade80', colorGlow: 'rgba(74, 222, 128, 0.4)',
    role: 'MGMT Coordinator', room: 'chief', roomLabel: 'COMMAND OFFICE', jira: 'MGMT',
    charPos: { x: 38, y: 55 }, // Chief seated at desk, head position
    offlineMsg: 'Awaiting orders',
    idleMessages: [
      'Checking MGMT board...',
      'Scanning for unassigned tickets',
      'Waiting for sprint updates',
      'Monitoring agent check-ins',
      'Reviewing open PRs',
    ],
  },
  {
    id: 'arbiter', name: 'The Arbiter', callsign: "THEL 'VADAM",
    color: '#a855f7', colorGlow: 'rgba(168, 85, 247, 0.4)',
    role: 'PULSE Monitor', room: 'arbiter', roomLabel: 'SANGHEILI STUDY', jira: 'PULSE',
    charPos: { x: 50, y: 52 }, // Arbiter at his holotable
    offlineMsg: 'Systems nominal — standby',
    idleMessages: [
      'Polling PULSE board...',
      'Waiting for health alerts',
      'Checking system heartbeat',
      'Scanning for new PULSE tickets',
      'Monitoring uptime metrics',
    ],
  },
  {
    id: 'cortana', name: 'Cortana', callsign: 'CTN 0452-9',
    color: '#06b6d4', colorGlow: 'rgba(6, 182, 212, 0.4)',
    role: 'LEARN + GRADE', room: 'cortana', roomLabel: 'AI CORE', jira: 'LEARN',
    charPos: { x: 42, y: 32 }, // Cortana hologram center
    offlineMsg: 'AI Core in sleep mode',
    idleMessages: [
      'Checking LEARN/GRADE board...',
      'Waiting for PRs to grade',
      'Scanning for new patterns',
      'Queuing backtest requests',
      'Idle — no open LEARN tickets',
    ],
  },
  {
    id: 'scout', name: 'Scout', callsign: 'ODST-RECON',
    color: '#2dd4bf', colorGlow: 'rgba(45, 212, 191, 0.4)',
    role: 'BACK Explorer', room: 'scout', roomLabel: 'RECON BAY', jira: 'BACK',
    charPos: { x: 38, y: 55 }, // Scout standing on platform
    offlineMsg: 'Recon bay dark',
    idleMessages: [
      'Checking BACK board...',
      'Scanning for research tasks',
      'Waiting for new recon assignments',
      'Idle — no open BACK tickets',
      'Monitoring data source feeds',
    ],
  },
  {
    id: 'ops', name: 'Ops', callsign: 'ODST-HEAVY',
    color: '#f59e0b', colorGlow: 'rgba(245, 158, 11, 0.4)',
    role: 'SCRUM Developer', room: 'ops', roomLabel: 'DPS', jira: 'SCRUM',
    charPos: { x: 48, y: 50 }, // Ops standing center on platform
    offlineMsg: 'Dev station powered down',
    idleMessages: [
      'Checking SCRUM board...',
      'Waiting for ticket assignment',
      'Scanning sprint backlog',
      'Idle — no in-progress SCRUM tasks',
      'Checking CI pipeline status',
    ],
  },
  {
    id: 'hunter', name: 'Hunter', callsign: 'INFRA-OPS',
    color: '#60a5fa', colorGlow: 'rgba(96, 165, 250, 0.4)',
    role: 'INFRA Builder', room: 'hunter', roomLabel: 'HUNTER', jira: 'INFRA',
    charPos: { x: 50, y: 52 }, // Hunter standing center
    offlineMsg: 'Infra bay offline',
    idleMessages: [
      'Checking INFRA board...',
      'Scanning for infra tickets',
      'Monitoring deploy pipeline',
      'Idle — no open INFRA tasks',
      'Waiting for maintenance window',
    ],
  },
];

const ORACLE = {
  id: 'oracle', name: 'Oracle', callsign: 'SAGE-001',
  color: '#9333ea', role: 'Knowledge Overseer', jira: 'SAGE',
  insights: [
    'Dark pool volume spike on SPY — confidence 84%',
    'Politician trade filed: $NVDA buy — 48hr decay',
    'Options flow: unusual call sweep $AAPL 3/28',
    'Macro sentiment shifting bearish — 72hr source',
    'Order flow imbalance detected on ES futures',
    'Source reliability update: Reuters +0.03',
    'Corroboration boost: 3 pillars agree on $TSLA',
    'Recency decay applied to stale macro data',
    'Validating yesterday\'s predictions... 4/6 correct',
    'New intel: Fed speaker scheduled tomorrow 2pm',
  ],
};

interface AgentStatus {
  id: string;
  state: AgentState;
  currentTask: string;
  speechBubble: string;
  lastSeen: string;
  actionsToday: number;
}

export default function HaloCommandPage() {
  const [agentStatuses, setAgentStatuses] = useState<Map<string, AgentStatus>>(new Map());
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [activityLog, setActivityLog] = useState<Array<{ agent: string; color: string; msg: string; time: string }>>([]);
  const [oracleLog, setOracleLog] = useState<Array<{ msg: string; time: string }>>([]);
  const [oracleInput, setOracleInput] = useState('');
  const activityRef = useRef<HTMLDivElement>(null);
  const oracleRef = useRef<HTMLDivElement>(null);

  // Initialize
  useEffect(() => {
    const initial = new Map<string, AgentStatus>();
    AGENTS.forEach(agent => {
      initial.set(agent.id, {
        id: agent.id, state: 'idle',
        currentTask: '',
        speechBubble: agent.idleMessages[Math.floor(Math.random() * agent.idleMessages.length)],
        lastSeen: new Date().toISOString(),
        actionsToday: 0,
      });
    });
    setAgentStatuses(initial);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setActivityLog([
      { agent: 'SYSTEM', color: '#06b6d4', msg: 'UNSC Infinity Command Deck Online', time: now },
      { agent: 'SYSTEM', color: '#06b6d4', msg: 'All stations reporting in', time: now },
    ]);
    setOracleLog([
      { msg: 'SAGE Knowledge System initialized', time: now },
      { msg: '18 intel pillars connected', time: now },
    ]);
  }, []);

  // Fetch live status from API
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/activity/agents').catch(() => null);
      if (!res?.ok) return;
      const data = await res.json();
      if (!data?.agents) return;

      setAgentStatuses(prev => {
        const next = new Map(prev);
        for (const apiAgent of data.agents) {
          const name = (apiAgent.name || '').toLowerCase();
          const agent = AGENTS.find(a => a.id === name);
          if (!agent) continue;
          const existing = next.get(agent.id);
          if (!existing) continue;

          let state: AgentState = 'idle';
          const task = apiAgent.currentTask || '';
          const status = (apiAgent.status || '').toLowerCase();

          if (status === 'offline' || status === 'error') state = 'offline';
          else if (status === 'busy') {
            if (task.toLowerCase().match(/read|analyz|scan|review/)) state = 'reading';
            else if (task.toLowerCase().match(/writ|implement|fix|creat|build|code/)) state = 'typing';
            else if (task.toLowerCase().match(/run|exec|deploy|test/)) state = 'running';
            else if (task.toLowerCase().match(/wait|pend|block|approv/)) state = 'waiting';
            else state = 'typing';
          } else if (status === 'online') state = 'idle';

          next.set(agent.id, {
            ...existing, state,
            currentTask: task || existing.currentTask,
            lastSeen: apiAgent.lastSeen || existing.lastSeen,
            actionsToday: apiAgent.actionsToday || existing.actionsToday,
          });
        }
        return next;
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const i = setInterval(fetchStatus, 5000);
    return () => clearInterval(i);
  }, [fetchStatus]);

  // Clock — defer to client to avoid hydration mismatch
  useEffect(() => {
    setTime(new Date());
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  // Rotate speech bubbles — prefer real currentTask, fall back to idle/offline messages
  useEffect(() => {
    const i = setInterval(() => {
      setAgentStatuses(prev => {
        const next = new Map(prev);
        // Pick 1-2 random agents to update their bubble
        const ids = Array.from(next.keys());
        const count = Math.random() > 0.5 ? 2 : 1;
        for (let n = 0; n < count; n++) {
          const id = ids[Math.floor(Math.random() * ids.length)];
          const st = next.get(id);
          const cfg = AGENTS.find(a => a.id === id);
          if (!st || !cfg) continue;

          // If agent has a real currentTask from API, show that
          let newBubble: string;
          if (st.currentTask && st.state !== 'offline' && st.state !== 'idle') {
            newBubble = st.currentTask;
          } else if (st.state === 'offline') {
            newBubble = cfg.offlineMsg;
          } else {
            newBubble = cfg.idleMessages[Math.floor(Math.random() * cfg.idleMessages.length)];
          }
          next.set(id, { ...st, speechBubble: newBubble });

          // Log to activity feed only if agent is actually doing something
          if (st.state !== 'offline') {
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setActivityLog(prev => [...prev.slice(-20), { agent: cfg.name, color: cfg.color, msg: newBubble, time: now }]);
          }
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(i);
  }, []);

  // Oracle insights feed
  useEffect(() => {
    const i = setInterval(() => {
      const insight = ORACLE.insights[Math.floor(Math.random() * ORACLE.insights.length)];
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setOracleLog(prev => [...prev.slice(-12), { msg: insight, time: now }]);
    }, 8000);
    return () => clearInterval(i);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (activityRef.current) activityRef.current.scrollTop = activityRef.current.scrollHeight;
  }, [activityLog]);
  useEffect(() => {
    if (oracleRef.current) oracleRef.current.scrollTop = oracleRef.current.scrollHeight;
  }, [oracleLog]);

  const handleOracleSubmit = useCallback(() => {
    const cmd = oracleInput.trim();
    if (!cmd) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setOracleLog(prev => [...prev.slice(-12), { msg: `[YOU] ${cmd}`, time: now }]);
    setOracleInput('');
    setTimeout(() => {
      setOracleLog(prev => [...prev.slice(-12), { msg: `Processing: "${cmd.substring(0, 40)}"...`, time: now }]);
    }, 600);
  }, [oracleInput]);

  const onlineCount = Array.from(agentStatuses.values()).filter(a => a.state !== 'offline').length;
  const typingCount = Array.from(agentStatuses.values()).filter(a => a.state === 'typing' || a.state === 'running').length;

  const stateLabel = (s: AgentState) => {
    switch (s) {
      case 'typing': return 'WRITING';
      case 'reading': return 'SCANNING';
      case 'running': return 'EXECUTING';
      case 'waiting': return 'AWAITING';
      case 'idle': return 'STANDBY';
      case 'offline': return 'OFFLINE';
    }
  };

  const selectedCfg = selectedAgent ? AGENTS.find(a => a.id === selectedAgent) : null;
  const selectedSt = selectedAgent ? agentStatuses.get(selectedAgent) : null;

  return (
    <div className={styles.page}>
      <div className={styles.scanlines} />

      {/* ─── TOP BAR ─── */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <div className={styles.unscBadge}>UNSC</div>
          <div className={styles.topTitle}>
            <span className={styles.titleMain}>HALO COMMAND CENTER</span>
            <span className={styles.titleSub}>DECK 117 — AUTONOMOUS OPS</span>
          </div>
        </div>
        <div className={styles.topStats}>
          <div className={styles.statChip}>
            <span className={styles.statVal}>{onlineCount}/{AGENTS.length}</span>
            <span className={styles.statLabel}>SPARTANS</span>
          </div>
          <div className={styles.statChip}>
            <span className={`${styles.statVal} ${styles.cyan}`}>{typingCount}</span>
            <span className={styles.statLabel}>ACTIVE OPS</span>
          </div>
          <div className={styles.statChip}>
            <span className={`${styles.statVal} ${styles.green}`}>NOMINAL</span>
            <span className={styles.statLabel}>THREAT LVL</span>
          </div>
        </div>
        <div className={styles.topRight}>
          <span className={styles.clock}>{time ? time.toLocaleTimeString() : '--:--:--'}</span>
          <span className={styles.clockDate}>{time ? time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '---'}</span>
        </div>
      </header>

      {/* ─── MAIN ─── */}
      <div className={styles.mainLayout}>
        {/* ─── PIXEL ART MAP ─── */}
        <div className={styles.mapSection}>
          <div className={styles.imageContainer}>
            <img src="/sprites/halo/command-center-bg.jpg" alt="UNSC Command Center" className={styles.bgImage} draggable={false} />

            {/* Room overlays with speech bubbles */}
            {AGENTS.map((agent) => {
              const st = agentStatuses.get(agent.id);
              const isActive = st && st.state !== 'offline' && st.state !== 'idle';
              const isSelected = selectedAgent === agent.id;

              return (
                <div
                  key={agent.id}
                  className={`${styles.roomOverlay} ${styles['room_' + agent.room]} ${isSelected ? styles.roomSelected : ''} ${isActive ? styles.roomActive : ''}`}
                  style={{ '--ac': agent.color, '--acg': agent.colorGlow } as React.CSSProperties}
                  onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                >
                  {/* Tags above room */}
                  <div className={styles.jiraTag}>{agent.jira}</div>
                  <div className={`${styles.statusBadge} ${styles['st_' + (st?.state || 'offline')]}`}>
                    <span className={styles.statusDot} />
                    <span className={styles.statusText}>{stateLabel(st?.state || 'offline')}</span>
                  </div>

                  {/* ─── ACTIVITY GLOW — subtle pulse under character when not offline ─── */}
                  {st && st.state !== 'offline' && (
                    <div
                      className={styles.activityGlow}
                      style={{
                        left: `${agent.charPos.x}%`,
                        top: `${agent.charPos.y + 12}%`,
                        '--ac': agent.color,
                        '--acg': agent.colorGlow,
                      } as React.CSSProperties}
                    />
                  )}

                  {/* ─── SPEECH BUBBLE — pinned above character's head in the background ─── */}
                  {st && (
                    <div
                      className={`${styles.speechBubble} ${st.state === 'offline' ? styles.speechOffline : ''}`}
                      style={{
                        '--ac': agent.color,
                        left: `${agent.charPos.x}%`,
                        top: `${Math.max(agent.charPos.y - 12, 2)}%`,
                      } as React.CSSProperties}
                    >
                      <div className={styles.speechText}>
                        {st.speechBubble || (st.state === 'offline' ? agent.offlineMsg : 'Standing by...')}
                      </div>
                      <div className={styles.speechTail} />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Central nexus stats */}
            <div className={styles.nexusOverlay}>
              <div className={styles.nexusStats}>
                <span className={styles.nexusStat}>{onlineCount} ONLINE</span>
                <span className={styles.nexusDivider}>|</span>
                <span className={styles.nexusStat}>{typingCount} CODING</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL (BIGGER FONTS) ─── */}
        <aside className={styles.sidePanel}>

          {/* Agent Detail Card */}
          {selectedCfg && selectedSt ? (
            <div className={styles.agentCard} style={{ '--ac': selectedCfg.color, '--acg': selectedCfg.colorGlow } as React.CSSProperties}>
              <div className={styles.cardHeader}>
                <div>
                  <h3 className={styles.cardName}>{selectedCfg.name}</h3>
                  <span className={styles.cardCallsign}>{selectedCfg.callsign}</span>
                </div>
                <div className={`${styles.cardStatus} ${styles['st_' + selectedSt.state]}`}>
                  {stateLabel(selectedSt.state)}
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardRow}><span>Station</span><span>{selectedCfg.roomLabel}</span></div>
                <div className={styles.cardRow}><span>Role</span><span>{selectedCfg.role}</span></div>
                <div className={styles.cardRow}><span>Jira</span><span>{selectedCfg.jira}</span></div>
                <div className={styles.cardRow}><span>Last Seen</span><span>{new Date(selectedSt.lastSeen).toLocaleTimeString()}</span></div>
                <div className={styles.cardRow}><span>Actions</span><span>{selectedSt.actionsToday}</span></div>
                <div className={styles.missionBox}>
                  <div className={styles.missionLabel}>CURRENT ACTIVITY</div>
                  <div className={styles.missionText}>{selectedSt.speechBubble}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.noSelection}>
              <span>Click a room to inspect an agent</span>
            </div>
          )}

          {/* Oracle Terminal */}
          <div className={styles.oraclePanel}>
            <div className={styles.panelHeader}>
              <span>ORACLE // SAGE</span>
              <span className={styles.panelBadge} style={{ color: '#9333ea' }}>LIVE</span>
            </div>
            <div className={styles.panelBody} ref={oracleRef}>
              {oracleLog.map((entry, i) => (
                <div key={i} className={styles.logEntry}>
                  <span className={styles.logTime}>{entry.time}</span>
                  <span className={styles.logMsg}>{entry.msg}</span>
                </div>
              ))}
            </div>
            <div className={styles.panelInput}>
              <span className={styles.inputPrompt}>SAGE &gt;</span>
              <input
                type="text"
                value={oracleInput}
                onChange={(e) => setOracleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOracleSubmit()}
                placeholder="Query Oracle..."
                className={styles.inputField}
              />
            </div>
          </div>

          {/* Activity Feed */}
          <div className={styles.activityPanel}>
            <div className={styles.panelHeader}>
              <span>ACTIVITY FEED</span>
              <span className={styles.panelBadge} style={{ color: '#06b6d4' }}>LIVE</span>
            </div>
            <div className={styles.panelBody} ref={activityRef}>
              {activityLog.map((entry, i) => (
                <div key={i} className={styles.logEntry}>
                  <span className={styles.logTime}>{entry.time}</span>
                  <span className={styles.logAgent} style={{ color: entry.color }}>{entry.agent}</span>
                  <span className={styles.logMsg}>{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
