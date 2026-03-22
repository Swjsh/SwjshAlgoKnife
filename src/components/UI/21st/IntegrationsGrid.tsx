'use client';

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import styles from './IntegrationsGrid.module.css';
import type { LucideIcon } from 'lucide-react';

/* ───────── Types ───────── */
export interface Integration {
  name: string;
  icon: LucideIcon;
  color: string;
  status?: 'connected' | 'active' | 'streaming' | 'idle';
  description?: string;
}

interface IntegrationsGridProps {
  integrations: Integration[];
  className?: string;
  title?: string;
  subtitle?: string;
}

/* ───────── Single integration tile ───────── */
function IntegrationTile({ integration, index }: { integration: Integration; index: number }) {
  const Icon = integration.icon;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={styles.tile}
      style={{
        '--tile-color': integration.color,
        '--tile-delay': `${index * 0.06}s`,
      } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Octagonal clip with glow */}
      <div className={styles.tileInner}>
        <div className={styles.iconGlow} style={{ background: `radial-gradient(circle, ${integration.color}22 0%, transparent 70%)` }} />
        <Icon
          size={24}
          style={{ color: integration.color }}
          className={styles.tileIcon}
        />
      </div>

      {/* Status dot */}
      {integration.status && (
        <span
          className={cn(
            styles.statusDot,
            integration.status === 'connected' && styles.statusConnected,
            integration.status === 'active' && styles.statusActive,
            integration.status === 'streaming' && styles.statusStreaming,
            integration.status === 'idle' && styles.statusIdle,
          )}
        />
      )}

      {/* Hover label */}
      <div className={cn(styles.tileLabel, isHovered && styles.tileLabelVisible)}>
        <span className={styles.tileName}>{integration.name}</span>
        {integration.description && (
          <span className={styles.tileDesc}>{integration.description}</span>
        )}
      </div>
    </div>
  );
}

/* ───────── Orbital connection lines (SVG) ───────── */
function ConnectionLines({ count }: { count: number }) {
  return (
    <svg className={styles.connectionSvg} viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.15" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        <filter id="glowFilter">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Central pulse */}
      <circle cx="200" cy="200" r="80" fill="url(#orbGlow)" />
      <circle cx="200" cy="200" r="3" fill="#a855f7" opacity="0.8">
        <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Orbital rings */}
      {[80, 130, 170].map((r, i) => (
        <circle
          key={i}
          cx="200" cy="200" r={r}
          fill="none"
          stroke={`rgba(168, 85, 247, ${0.08 - i * 0.02})`}
          strokeWidth="0.5"
          strokeDasharray={`${4 + i * 2} ${8 + i * 4}`}
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 200 200`}
            to={`${i % 2 === 0 ? 360 : -360} 200 200`}
            dur={`${30 + i * 15}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

/* ───────── Main Component ───────── */
export default function IntegrationsGrid({ integrations, className, title, subtitle }: IntegrationsGridProps) {
  return (
    <div className={cn(styles.container, className)}>
      {/* Left: Info */}
      <div className={styles.info}>
        <span className={styles.label}>INTEGRATIONS</span>
        <h2 className={styles.title}>{title || 'Connected Services'}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{integrations.filter(i => i.status === 'active' || i.status === 'streaming').length}</span>
            <span className={styles.statLabel}>Active</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{integrations.length}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
        </div>
      </div>

      {/* Right: Grid */}
      <div className={styles.gridWrapper}>
        <ConnectionLines count={integrations.length} />
        <div className={styles.grid}>
          {integrations.map((integration, idx) => (
            <IntegrationTile key={integration.name} integration={integration} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}
