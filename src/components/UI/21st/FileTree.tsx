'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import styles from './FileTree.module.css';

/* ───────── Types ───────── */
export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  extension?: string;
  children?: FileNode[];
  badge?: string;          // Optional badge text (e.g. "LIVE", "NEW")
  badgeColor?: string;     // Optional badge color
}

interface FileTreeProps {
  data: FileNode[];
  className?: string;
  title?: string;
  defaultOpen?: boolean;   // Whether top-level folders start expanded (default: false)
}

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  defaultOpen?: boolean;
}

/* ───────── Extension → color mapping (cyber-industrial palette) ───────── */
const EXT_COLORS: Record<string, string> = {
  tsx: '#06b6d4',   // cyan
  ts:  '#3b82f6',   // blue
  jsx: '#22c55e',   // green
  js:  '#f59e0b',   // amber
  py:  '#a855f7',   // purple
  css: '#ec4899',   // pink
  json:'#fbbf24',   // yellow
  md:  '#94a3b8',   // slate
  sql: '#ef4444',   // red
  svg: '#06b6d4',   // cyan
  png: '#22c55e',   // green
  yml: '#f59e0b',   // amber
  yaml:'#f59e0b',
  env: '#ef4444',   // red
  sh:  '#10b981',   // emerald
  ps1: '#3b82f6',   // blue
};

const getExtColor = (ext?: string) => EXT_COLORS[ext || ''] || '#64748b';

/* ───────── File icon SVG ───────── */
function FileIcon({ extension }: { extension?: string }) {
  const color = getExtColor(extension);
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.fileIcon}>
      <path
        d="M3 1.5A1.5 1.5 0 014.5 0h4.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V14.5A1.5 1.5 0 0112 16H4.5A1.5 1.5 0 013 14.5v-13z"
        fill={color}
        opacity="0.15"
      />
      <path
        d="M3 1.5A1.5 1.5 0 014.5 0h4.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V14.5A1.5 1.5 0 0112 16H4.5A1.5 1.5 0 013 14.5v-13z"
        stroke={color}
        strokeWidth="1"
        fill="none"
      />
      <path d="M9 0v3.5A1.5 1.5 0 0010.5 5H14" stroke={color} strokeWidth="0.8" fill="none" opacity="0.5" />
    </svg>
  );
}

/* ───────── Folder icon SVG ───────── */
function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.folderIcon}>
      {open ? (
        <>
          <path d="M1 3.5A1.5 1.5 0 012.5 2h3.172a1 1 0 01.707.293L7.5 3.414a1 1 0 00.707.293H13.5A1.5 1.5 0 0115 5.207V6H2.5A1.5 1.5 0 001 4.5V3.5z" fill="#f59e0b" opacity="0.3" />
          <path d="M1 6h12.5a1.5 1.5 0 011.414 2.002l-1.5 4.21A1.5 1.5 0 0112 13.5H3.5A1.5 1.5 0 012.086 12.21L.586 8.002A1.5 1.5 0 012 6z" fill="#f59e0b" opacity="0.2" stroke="#f59e0b" strokeWidth="0.8" />
        </>
      ) : (
        <path
          d="M2.5 2A1.5 1.5 0 001 3.5v9A1.5 1.5 0 002.5 14h11a1.5 1.5 0 001.5-1.5V5.207a1.5 1.5 0 00-1.5-1.5H8.207a1 1 0 01-.707-.293L6.379 2.293A1 1 0 005.672 2H2.5z"
          fill="#f59e0b"
          opacity="0.2"
          stroke="#f59e0b"
          strokeWidth="0.8"
        />
      )}
    </svg>
  );
}

/* ───────── Chevron ───────── */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={cn(styles.chevron, open && styles.chevronOpen)}
    >
      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────── Tree Node ───────── */
function FileTreeNode({ node, depth, defaultOpen = false }: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isFolder = node.type === 'folder';

  return (
    <div className={styles.nodeWrapper}>
      <div
        className={cn(styles.node, isFolder && styles.nodeFolder)}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => isFolder && setIsOpen(!isOpen)}
      >
        {/* Guide line */}
        {depth > 0 && (
          <div className={styles.guideLine} style={{ left: `${depth * 20 - 2}px` }} />
        )}

        {/* Chevron for folders */}
        {isFolder ? (
          <Chevron open={isOpen} />
        ) : (
          <span className={styles.chevronSpacer} />
        )}

        {/* Icon */}
        {isFolder ? <FolderIcon open={isOpen} /> : <FileIcon extension={node.extension} />}

        {/* Name */}
        <span className={styles.nodeName} style={!isFolder ? { color: getExtColor(node.extension) } : undefined}>
          {node.name}
        </span>

        {/* Extension badge */}
        {!isFolder && node.extension && (
          <span className={styles.extBadge} style={{ color: getExtColor(node.extension), borderColor: `${getExtColor(node.extension)}33` }}>
            .{node.extension}
          </span>
        )}

        {/* Optional badge */}
        {node.badge && (
          <span className={styles.badge} style={{ backgroundColor: `${node.badgeColor || '#06b6d4'}22`, color: node.badgeColor || '#06b6d4', borderColor: `${node.badgeColor || '#06b6d4'}44` }}>
            {node.badge}
          </span>
        )}
      </div>

      {/* Children */}
      {isFolder && isOpen && node.children && (
        <div className={styles.children}>
          {node.children.map((child, idx) => (
            <FileTreeNode key={`${child.name}-${idx}`} node={child} depth={depth + 1} defaultOpen={defaultOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── FileTree Component ───────── */
export default function FileTree({ data, className, title, defaultOpen = false }: FileTreeProps) {
  return (
    <div className={cn(styles.container, className)}>
      {/* macOS-style title bar */}
      <div className={styles.titleBar}>
        <div className={styles.trafficLights}>
          <span className={styles.tlRed} />
          <span className={styles.tlYellow} />
          <span className={styles.tlGreen} />
        </div>
        <span className={styles.titleText}>{title || 'explorer'}</span>
      </div>

      {/* Tree */}
      <div className={styles.treeBody}>
        {data.map((node, idx) => (
          <FileTreeNode key={`${node.name}-${idx}`} node={node} depth={0} defaultOpen={defaultOpen} />
        ))}
      </div>
    </div>
  );
}
