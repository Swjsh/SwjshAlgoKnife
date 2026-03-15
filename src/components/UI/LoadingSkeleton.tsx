'use client';

import React from 'react';
import styles from './LoadingSkeleton.module.css';

interface LoadingSkeletonProps {
  lines?: number;
  height?: string;
  width?: string;
  style?: React.CSSProperties;
}

export function LoadingSkeleton({
  lines = 3,
  height = '16px',
  width = '100%',
  style
}: LoadingSkeletonProps) {
  return (
    <div className={styles.skeletonContainer} style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={styles.skeletonLine}
          style={{
            height,
            width,
            marginBottom: index < lines - 1 ? '0.75rem' : undefined
          }}
        />
      ))}
    </div>
  );
}

export default LoadingSkeleton;
