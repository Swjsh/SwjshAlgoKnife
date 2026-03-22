'use client';

import React, { useState } from 'react';
import { Settings, Plug, Zap, Play, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './WorkflowGrid.module.css';

interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  category: 'system' | 'integration' | 'automation' | 'manual';
}

interface WorkflowGridProps {
  workflows: WorkflowSummary[];
  className?: string;
}

const CATEGORY_CONFIG: Record<WorkflowSummary['category'], { icon: LucideIcon; color: string; label: string }> = {
  system: { icon: Settings, color: '#ff6d5a', label: 'System' },
  integration: { icon: Plug, color: '#06b6d4', label: 'Integration' },
  automation: { icon: Zap, color: '#a855f7', label: 'Automation' },
  manual: { icon: Play, color: '#22c55e', label: 'Manual' },
};

function WorkflowTile({ workflow, index }: { workflow: WorkflowSummary; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  const config = CATEGORY_CONFIG[workflow.category];
  const Icon = config.icon;

  // Extract workflow code (e.g., "WF-S01" from "WF-S01: Some Name")
  const codeMatch = workflow.name.match(/^(WF-[A-Z]\d+)/);
  const code = codeMatch ? codeMatch[1] : workflow.id.slice(0, 6);
  const displayName = workflow.name.replace(/^WF-[A-Z]\d+:\s*/, '');

  return (
    <div
      className={styles.tile}
      style={{
        '--tile-color': config.color,
        '--tile-delay': `${index * 0.04}s`,
      } as React.CSSProperties}
      data-active={workflow.active}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={styles.tileInner}>
        <div className={styles.iconGlow} />
        <Icon size={22} className={styles.icon} />
      </div>

      {/* Status indicator */}
      <span
        className={styles.statusDot}
        data-status={workflow.active ? 'active' : 'paused'}
      />

      {/* Workflow code badge */}
      <div className={styles.codeBadge}>{code}</div>

      {/* Hover tooltip */}
      <div className={`${styles.tooltip} ${isHovered ? styles.tooltipVisible : ''}`}>
        <span className={styles.tooltipName}>{displayName || workflow.name}</span>
        <span className={styles.tooltipCategory}>{config.label}</span>
        <span className={styles.tooltipStatus}>
          {workflow.active ? 'Active' : 'Paused'}
        </span>
      </div>
    </div>
  );
}

function OrbitalLines() {
  return (
    <svg className={styles.orbitalSvg} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#a855f7" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#ff6d5a" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Central glow */}
      <circle cx="200" cy="200" r="60" fill="url(#centerGlow)" />

      {/* n8n logo at center */}
      <g transform="translate(185, 185)">
        <path
          d="M15 1L3 7.5v13L15 27l12-6.5v-13L15 1z"
          fill="#ff6d5a"
          fillOpacity="0.9"
        />
        <circle cx="9" cy="14" r="2" fill="white" fillOpacity="0.9" />
        <circle cx="21" cy="14" r="2" fill="white" fillOpacity="0.9" />
        <line x1="11" y1="14" x2="19" y2="14" stroke="white" strokeWidth="1" strokeOpacity="0.8" />
      </g>

      {/* Animated orbital rings */}
      {[70, 110, 150, 180].map((r, i) => (
        <circle
          key={i}
          cx="200"
          cy="200"
          r={r}
          fill="none"
          stroke={`url(#ringGradient)`}
          strokeWidth="0.5"
          strokeDasharray={`${3 + i} ${6 + i * 2}`}
          opacity={0.4 - i * 0.08}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 200 200`}
            to={`${i % 2 === 0 ? 360 : -360} 200 200`}
            dur={`${25 + i * 10}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* Pulse at center */}
      <circle cx="200" cy="200" r="3" fill="#a855f7" opacity="0.8">
        <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export function WorkflowGrid({ workflows, className }: WorkflowGridProps) {
  const activeCount = workflows.filter(w => w.active).length;
  const pausedCount = workflows.length - activeCount;

  // Group by category for stats
  const categoryStats = {
    system: workflows.filter(w => w.category === 'system').length,
    integration: workflows.filter(w => w.category === 'integration').length,
    automation: workflows.filter(w => w.category === 'automation').length,
    manual: workflows.filter(w => w.category === 'manual').length,
  };

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* Left: Stats Panel */}
      <div className={styles.statsPanel}>
        <span className={styles.sectionLabel}>WORKFLOWS</span>
        <h2 className={styles.title}>Automation Grid</h2>

        <div className={styles.summaryStats}>
          <div className={styles.summaryStat}>
            <span className={styles.summaryValue}>{activeCount}</span>
            <span className={styles.summaryLabel}>Active</span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryValue}>{pausedCount}</span>
            <span className={styles.summaryLabel}>Paused</span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryValue}>{workflows.length}</span>
            <span className={styles.summaryLabel}>Total</span>
          </div>
        </div>

        <div className={styles.categoryBreakdown}>
          {Object.entries(categoryStats).map(([cat, count]) => {
            const config = CATEGORY_CONFIG[cat as WorkflowSummary['category']];
            const Icon = config.icon;
            return (
              <div key={cat} className={styles.categoryRow} style={{ '--cat-color': config.color } as React.CSSProperties}>
                <Icon size={14} />
                <span className={styles.categoryName}>{config.label}</span>
                <span className={styles.categoryCount}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Workflow Grid with Orbital Effect */}
      <div className={styles.gridWrapper}>
        <OrbitalLines />
        <div className={styles.grid}>
          {workflows.map((workflow, idx) => (
            <WorkflowTile key={workflow.id} workflow={workflow} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default WorkflowGrid;
