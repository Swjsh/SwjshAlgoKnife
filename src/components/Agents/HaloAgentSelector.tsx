'use client';

import React from 'react';
import styles from './HaloAgentSelector.module.css';

export interface HaloAgentDef {
  id: string;
  emoji: string;
  name: string;
  accent: string;
}

const HALO_AGENTS: HaloAgentDef[] = [
  { id: 'chief', emoji: '🎖️', name: 'Chief', accent: '#f59e0b' },
  { id: 'arbiter', emoji: '⚖️', name: 'Arbiter', accent: '#ef4444' },
  { id: 'ops', emoji: '⚙️', name: 'Ops', accent: '#06b6d4' },
  { id: 'hunter', emoji: '🎯', name: 'Hunter', accent: '#10b981' },
  { id: 'cortana', emoji: '🧠', name: 'Cortana', accent: '#a855f7' },
  { id: 'scout', emoji: '🔍', name: 'Scout', accent: '#ec4899' },
];

// Group definitions
const GROUP_1 = ['chief', 'arbiter', 'ops'];
const GROUP_2 = ['hunter', 'cortana', 'scout'];

interface HaloAgentSelectorProps {
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  agentStatus?: Record<string, 'online' | 'dead' | 'idle' | 'unknown'>;
  disabled?: boolean;
}

export default function HaloAgentSelector({
  selected,
  onSelectionChange,
  agentStatus = {},
  disabled = false,
}: HaloAgentSelectorProps) {
  const toggleAgent = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const selectGroup1 = () => onSelectionChange(new Set(GROUP_1));
  const selectGroup2 = () => onSelectionChange(new Set(GROUP_2));
  const selectAll = () => onSelectionChange(new Set(HALO_AGENTS.map(a => a.id)));
  const clearAll = () => onSelectionChange(new Set());

  return (
    <div className={styles.container}>
      {/* Agent Toggle Grid */}
      <div className={styles.agentGrid}>
        {HALO_AGENTS.map((agent) => {
          const isSelected = selected.has(agent.id);
          const status = agentStatus[agent.id] || 'unknown';
          const isOnline = status === 'online';
          const isDead = status === 'dead';

          return (
            <button
              key={agent.id}
              className={`${styles.agentToggle} ${isSelected ? styles.selected : ''}`}
              style={{
                '--agent-accent': agent.accent,
                borderColor: isSelected ? agent.accent : undefined,
              } as React.CSSProperties}
              onClick={() => toggleAgent(agent.id)}
              disabled={disabled}
              title={`${agent.name} - ${status}`}
            >
              <span className={styles.emoji}>{agent.emoji}</span>
              <span className={styles.name}>{agent.name}</span>
              <span
                className={`${styles.statusDot} ${
                  isOnline ? styles.online : isDead ? styles.dead : styles.offline
                }`}
              />
              {isSelected && <span className={styles.checkmark}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Quick Select Row */}
      <div className={styles.quickSelect}>
        <button
          className={styles.presetBtn}
          onClick={selectGroup1}
          disabled={disabled}
          title="Select Chief, Arbiter, Ops"
        >
          Group 1
        </button>
        <button
          className={styles.presetBtn}
          onClick={selectGroup2}
          disabled={disabled}
          title="Select Hunter, Cortana, Scout"
        >
          Group 2
        </button>
        <button
          className={styles.presetBtn}
          onClick={selectAll}
          disabled={disabled}
        >
          All 6
        </button>
        <button
          className={`${styles.presetBtn} ${styles.clearBtn}`}
          onClick={clearAll}
          disabled={disabled || selected.size === 0}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export { HALO_AGENTS, GROUP_1, GROUP_2 };
