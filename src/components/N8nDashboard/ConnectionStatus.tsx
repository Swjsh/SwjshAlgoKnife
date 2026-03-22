'use client';

import React from 'react';
import styles from './ConnectionStatus.module.css';

interface ConnectionStatusProps {
  status: 'healthy' | 'degraded' | 'error';
  connected: boolean;
  version?: string;
  lastChecked?: string;
  message?: string;
}

export function ConnectionStatus({ status, connected, version, lastChecked, message }: ConnectionStatusProps) {
  const formatTime = (iso?: string) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className={styles.container} data-status={status}>
      {/* Corner brackets */}
      <div className={`${styles.corner} ${styles.topLeft}`} />
      <div className={`${styles.corner} ${styles.topRight}`} />
      <div className={`${styles.corner} ${styles.bottomLeft}`} />
      <div className={`${styles.corner} ${styles.bottomRight}`} />

      <div className={styles.content}>
        {/* Animated connection ring */}
        <div className={styles.ringContainer}>
          <div className={styles.outerRing} data-connected={connected}>
            <div className={styles.pulseRing} />
            <div className={styles.innerRing} />
          </div>
          <svg
            className={styles.logo}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 2L4 9v14l12 7 12-7V9L16 2z"
              fill={connected ? '#ff6d5a' : '#ef4444'}
              fillOpacity={0.95}
            />
            <circle cx="10" cy="16" r="2.5" fill="white" fillOpacity={0.95} />
            <circle cx="22" cy="16" r="2.5" fill="white" fillOpacity={0.95} />
            <circle cx="16" cy="10" r="2" fill="white" fillOpacity={0.7} />
            <circle cx="16" cy="22" r="2" fill="white" fillOpacity={0.7} />
            <line x1="12.5" y1="16" x2="19.5" y2="16" stroke="white" strokeWidth="1.5" strokeOpacity={0.9} />
            <line x1="16" y1="12" x2="16" y2="20" stroke="white" strokeWidth="1" strokeOpacity={0.6} />
          </svg>
        </div>

        <div className={styles.info}>
          <div className={styles.statusRow}>
            <span className={styles.label}>n8n</span>
            <span className={`${styles.badge} ${styles[status]}`}>
              {status.toUpperCase()}
            </span>
          </div>
          <div className={styles.connectionRow}>
            <div className={styles.dot} data-connected={connected} />
            <span className={styles.connectionText}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {version && (
            <div className={styles.version}>v{version}</div>
          )}
          {message && !connected && (
            <div className={styles.error}>{message}</div>
          )}
          <div className={styles.timestamp}>
            Last check: {formatTime(lastChecked)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConnectionStatus;
