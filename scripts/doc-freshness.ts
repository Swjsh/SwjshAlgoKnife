/**
 * Documentation Freshness Tracker
 *
 * Scans all documentation locations (including Obsidian vault source files)
 * and tracks freshness metadata.
 * Outputs both JSON and Markdown reports.
 *
 * Usage: npx tsx scripts/doc-freshness.ts
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Configuration
const PROJECT_ROOT = 'C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife';
const OBSIDIAN_VAULT = 'C:\\Users\\jackw\\Documents\\ObsidianVaults\\SwjshAK-Brain';
const OUTPUT_JSON = path.join(PROJECT_ROOT, 'data', 'brain', 'doc-freshness.json');
const OUTPUT_MD = path.join(PROJECT_ROOT, 'data', 'brain', 'doc-freshness-report.md');

// Stale thresholds in days
const STALE_THRESHOLDS: Record<DocCategory, number> = {
  obsidian: 7,    // Source of truth - should be freshest
  brain: 14,      // Synced copies - slightly more lenient
  docs: 30,
  library: 30,
  root: 30,
};

// Documentation locations to scan
// Note: Obsidian vault is the SOURCE, brain is the SYNCED COPY
const DOC_LOCATIONS: Array<{ pattern: string; category: DocCategory; basePath?: string }> = [
  // Obsidian vault (SOURCE of truth)
  { pattern: '**/*.md', category: 'obsidian', basePath: OBSIDIAN_VAULT },
  // Repository documentation
  { pattern: 'data/brain/**/*.md', category: 'brain' },
  { pattern: 'docs/**/*.md', category: 'docs' },
  { pattern: 'Library/**/*.md', category: 'library' },
  { pattern: 'CLAUDE.md', category: 'root' },
  { pattern: 'README.md', category: 'root' },
];

// Types
type DocCategory = 'obsidian' | 'brain' | 'docs' | 'library' | 'root';

interface DocFile {
  absolutePath: string;
  relativePath: string;
  displayPath: string;  // User-friendly path for display
  lastModified: string;
  lastModifiedTimestamp: number;
  contentHash: string;
  fileSize: number;
  isStale: boolean;
  staleThresholdDays: number;
  daysSinceModified: number;
  category: DocCategory;
}

interface StaleSummary {
  category: DocCategory;
  count: number;
  files: string[];
}

interface FreshnessReport {
  scanTimestamp: string;
  projectRoot: string;
  obsidianVault: string;
  summary: {
    totalFiles: number;
    staleCount: number;
    freshCount: number;
    oldestFile: { path: string; date: string; daysSinceModified: number } | null;
    newestFile: { path: string; date: string; daysSinceModified: number } | null;
    byCategory: Record<DocCategory, { total: number; stale: number }>;
  };
  staleFilesByCategory: StaleSummary[];
  files: DocFile[];
}

/**
 * Compute SHA-256 hash of file content
 */
function computeHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate days since a timestamp
 */
function daysSince(timestamp: number): number {
  const now = Date.now();
  const diffMs = now - timestamp;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Recursively find all files matching a glob-like pattern
 * Supports ** for recursive and * for single directory level
 */
function findFiles(basePath: string, pattern: string): string[] {
  const results: string[] = [];

  // Check if base path exists
  if (!fs.existsSync(basePath)) {
    console.log(`  Warning: Base path does not exist: ${basePath}`);
    return results;
  }

  // Handle simple file patterns (no wildcards in path)
  if (!pattern.includes('*')) {
    const fullPath = path.join(basePath, pattern);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      results.push(fullPath);
    }
    return results;
  }

  const parts = pattern.split(/[/\\]/);

  function walkDir(currentPath: string, patternIndex: number): void {
    if (patternIndex >= parts.length) {
      return;
    }

    const currentPattern = parts[patternIndex];
    const isLast = patternIndex === parts.length - 1;

    if (!fs.existsSync(currentPath)) {
      return;
    }

    const stat = fs.statSync(currentPath);
    if (!stat.isDirectory()) {
      return;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (err) {
      // Skip directories we can't read
      return;
    }

    // Skip hidden directories (.obsidian, .git, etc.)
    entries = entries.filter(e => !e.name.startsWith('.'));

    // Skip Templates folder in Obsidian vault
    if (basePath === OBSIDIAN_VAULT) {
      entries = entries.filter(e => e.name !== 'Templates');
    }

    if (currentPattern === '**') {
      // Match zero or more directories
      // Try matching the rest of the pattern at this level
      walkDir(currentPath, patternIndex + 1);

      // Also recurse into subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walkDir(path.join(currentPath, entry.name), patternIndex);
        }
      }
    } else if (currentPattern.includes('*')) {
      // Wildcard match (e.g., *.md)
      const regex = new RegExp('^' + currentPattern.replace(/\*/g, '.*') + '$');

      for (const entry of entries) {
        if (regex.test(entry.name)) {
          const entryPath = path.join(currentPath, entry.name);
          if (isLast && entry.isFile()) {
            results.push(entryPath);
          } else if (!isLast && entry.isDirectory()) {
            walkDir(entryPath, patternIndex + 1);
          }
        }
      }
    } else {
      // Exact match
      const entryPath = path.join(currentPath, currentPattern);
      if (fs.existsSync(entryPath)) {
        const entryStat = fs.statSync(entryPath);
        if (isLast && entryStat.isFile()) {
          results.push(entryPath);
        } else if (!isLast && entryStat.isDirectory()) {
          walkDir(entryPath, patternIndex + 1);
        }
      }
    }
  }

  walkDir(basePath, 0);
  return results;
}

/**
 * Process a single documentation file
 */
function processFile(filePath: string, category: DocCategory, basePath: string): DocFile {
  const stat = fs.statSync(filePath);
  const lastModifiedTimestamp = stat.mtimeMs;
  const daysSinceModified = daysSince(lastModifiedTimestamp);
  const staleThresholdDays = STALE_THRESHOLDS[category];

  // Calculate relative path based on the base path
  const relativePath = path.relative(basePath, filePath).replace(/\\/g, '/');

  // Create a user-friendly display path
  let displayPath: string;
  if (category === 'obsidian') {
    displayPath = `[Obsidian] ${relativePath}`;
  } else {
    displayPath = relativePath;
  }

  return {
    absolutePath: filePath,
    relativePath,
    displayPath,
    lastModified: new Date(lastModifiedTimestamp).toISOString(),
    lastModifiedTimestamp,
    contentHash: computeHash(filePath),
    fileSize: stat.size,
    isStale: daysSinceModified > staleThresholdDays,
    staleThresholdDays,
    daysSinceModified,
    category,
  };
}

/**
 * Generate the markdown report
 */
function generateMarkdownReport(report: FreshnessReport): string {
  const lines: string[] = [];

  lines.push('# Documentation Freshness Report');
  lines.push('');
  lines.push(`**Scanned**: ${new Date(report.scanTimestamp).toLocaleString()}`);
  lines.push(`**Project Root**: ${report.projectRoot}`);
  lines.push(`**Obsidian Vault**: ${report.obsidianVault}`);
  lines.push('');

  // Summary Section
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Files | ${report.summary.totalFiles} |`);
  lines.push(`| Fresh Files | ${report.summary.freshCount} |`);
  lines.push(`| Stale Files | ${report.summary.staleCount} |`);
  if (report.summary.oldestFile) {
    lines.push(`| Oldest File | ${report.summary.oldestFile.path} (${report.summary.oldestFile.daysSinceModified} days) |`);
  }
  if (report.summary.newestFile) {
    lines.push(`| Newest File | ${report.summary.newestFile.path} (${report.summary.newestFile.daysSinceModified} days) |`);
  }
  lines.push('');

  // Category Breakdown
  lines.push('## By Category');
  lines.push('');
  lines.push('| Category | Total | Stale | Threshold | Description |');
  lines.push('|----------|-------|-------|-----------|-------------|');

  const categoryDescriptions: Record<DocCategory, string> = {
    obsidian: 'Source of truth (Obsidian vault)',
    brain: 'Synced copies in repo',
    docs: 'Project documentation',
    library: 'Library/agent souls',
    root: 'Root-level docs',
  };

  for (const cat of Object.keys(report.summary.byCategory) as DocCategory[]) {
    const data = report.summary.byCategory[cat];
    if (data.total === 0) continue; // Skip empty categories
    const threshold = STALE_THRESHOLDS[cat];
    const staleIcon = data.stale > 0 ? ' ⚠️' : '';
    const desc = categoryDescriptions[cat] || '';
    lines.push(`| ${cat} | ${data.total} | ${data.stale}${staleIcon} | ${threshold} days | ${desc} |`);
  }
  lines.push('');

  // Stale Files Section
  if (report.summary.staleCount > 0) {
    lines.push('## Stale Files (Need Attention)');
    lines.push('');
    lines.push('> Files that have not been updated within their category threshold.');
    lines.push('');

    for (const staleSummary of report.staleFilesByCategory) {
      if (staleSummary.count > 0) {
        lines.push(`### ${staleSummary.category} (${staleSummary.count} files)`);
        lines.push('');
        for (const filePath of staleSummary.files) {
          const file = report.files.find(f => f.displayPath === filePath);
          if (file) {
            lines.push(`- **${filePath}** - ${file.daysSinceModified} days old`);
          }
        }
        lines.push('');
      }
    }
  } else {
    lines.push('## Stale Files');
    lines.push('');
    lines.push('All documentation is fresh.');
    lines.push('');
  }

  // Source Sync Status
  lines.push('## Obsidian → Repo Sync Status');
  lines.push('');
  lines.push('Comparing Obsidian source files to their synced copies in `data/brain/`:');
  lines.push('');

  const obsidianFiles = report.files.filter(f => f.category === 'obsidian');
  const brainFiles = report.files.filter(f => f.category === 'brain');

  // Check for files that exist in Obsidian but not in brain (by content hash or similar names)
  const brainHashes = new Set(brainFiles.map(f => f.contentHash));
  const syncedCount = obsidianFiles.filter(f => brainHashes.has(f.contentHash)).length;
  const unsyncedCount = obsidianFiles.length - syncedCount;

  lines.push(`| Status | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Obsidian files | ${obsidianFiles.length} |`);
  lines.push(`| Synced to repo | ${brainFiles.length} |`);
  lines.push(`| Matching content | ${syncedCount} |`);
  lines.push(`| Potentially out of sync | ${unsyncedCount} |`);
  lines.push('');

  // All Files List (grouped by category)
  lines.push('## All Files by Category');
  lines.push('');

  const categories = [...new Set(report.files.map(f => f.category))];

  for (const cat of categories) {
    const catFiles = report.files.filter(f => f.category === cat);
    if (catFiles.length === 0) continue;

    lines.push(`### ${cat} (${catFiles.length} files)`);
    lines.push('');
    lines.push('| File | Days Old | Status | Size |');
    lines.push('|------|----------|--------|------|');

    // Sort by days since modified (oldest first)
    const sortedFiles = [...catFiles].sort((a, b) => b.daysSinceModified - a.daysSinceModified);

    // Limit to first 50 files per category to keep report manageable
    const displayFiles = sortedFiles.slice(0, 50);
    const hiddenCount = sortedFiles.length - displayFiles.length;

    for (const file of displayFiles) {
      const status = file.isStale ? 'STALE' : 'OK';
      const statusIcon = file.isStale ? '⚠️' : '✅';
      const sizeKb = (file.fileSize / 1024).toFixed(1);
      const displayName = file.category === 'obsidian' ? file.relativePath : file.displayPath;
      lines.push(`| ${displayName} | ${file.daysSinceModified} | ${statusIcon} ${status} | ${sizeKb} KB |`);
    }

    if (hiddenCount > 0) {
      lines.push(`| ... and ${hiddenCount} more files | | | |`);
    }

    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by `scripts/doc-freshness.ts`*');

  return lines.join('\n');
}

/**
 * Main function
 */
function run(): void {
  console.log('Documentation Freshness Tracker');
  console.log('================================\n');
  console.log(`Project Root: ${PROJECT_ROOT}`);
  console.log(`Obsidian Vault: ${OBSIDIAN_VAULT}`);
  console.log('');

  const allFiles: DocFile[] = [];

  // Scan each documentation location
  for (const location of DOC_LOCATIONS) {
    const basePath = location.basePath || PROJECT_ROOT;
    console.log(`Scanning: ${location.category} - ${location.pattern}`);
    console.log(`  Base: ${basePath}`);

    const files = findFiles(basePath, location.pattern);
    console.log(`  Found ${files.length} files`);

    for (const filePath of files) {
      allFiles.push(processFile(filePath, location.category, basePath));
    }
  }

  console.log(`\nTotal files found: ${allFiles.length}\n`);

  // Calculate summary stats
  const staleFiles = allFiles.filter(f => f.isStale);
  const freshFiles = allFiles.filter(f => !f.isStale);

  // Find oldest and newest
  const sortedByAge = [...allFiles].sort((a, b) => b.daysSinceModified - a.daysSinceModified);
  const oldestFile = sortedByAge[0] || null;
  const newestFile = sortedByAge[sortedByAge.length - 1] || null;

  // Category breakdown
  const byCategory: Record<DocCategory, { total: number; stale: number }> = {
    obsidian: { total: 0, stale: 0 },
    brain: { total: 0, stale: 0 },
    docs: { total: 0, stale: 0 },
    library: { total: 0, stale: 0 },
    root: { total: 0, stale: 0 },
  };

  for (const file of allFiles) {
    byCategory[file.category].total++;
    if (file.isStale) {
      byCategory[file.category].stale++;
    }
  }

  // Stale files by category
  const staleFilesByCategory: StaleSummary[] = (Object.keys(byCategory) as DocCategory[]).map(cat => ({
    category: cat,
    count: byCategory[cat].stale,
    files: staleFiles.filter(f => f.category === cat).map(f => f.displayPath),
  }));

  // Build the report
  const report: FreshnessReport = {
    scanTimestamp: new Date().toISOString(),
    projectRoot: PROJECT_ROOT,
    obsidianVault: OBSIDIAN_VAULT,
    summary: {
      totalFiles: allFiles.length,
      staleCount: staleFiles.length,
      freshCount: freshFiles.length,
      oldestFile: oldestFile ? {
        path: oldestFile.displayPath,
        date: oldestFile.lastModified,
        daysSinceModified: oldestFile.daysSinceModified,
      } : null,
      newestFile: newestFile ? {
        path: newestFile.displayPath,
        date: newestFile.lastModified,
        daysSinceModified: newestFile.daysSinceModified,
      } : null,
      byCategory,
    },
    staleFilesByCategory,
    files: allFiles,
  };

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_JSON);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write JSON report
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2));
  console.log(`JSON report saved: ${OUTPUT_JSON}`);

  // Write Markdown report
  const markdownReport = generateMarkdownReport(report);
  fs.writeFileSync(OUTPUT_MD, markdownReport);
  console.log(`Markdown report saved: ${OUTPUT_MD}`);

  // Print summary
  console.log('\n--- Summary ---');
  console.log(`Total Files: ${report.summary.totalFiles}`);
  console.log(`Fresh: ${report.summary.freshCount}`);
  console.log(`Stale: ${report.summary.staleCount}`);

  console.log('\nBy category:');
  for (const cat of Object.keys(byCategory) as DocCategory[]) {
    const data = byCategory[cat];
    if (data.total > 0) {
      const staleNote = data.stale > 0 ? ` (${data.stale} stale)` : '';
      console.log(`  ${cat}: ${data.total} files${staleNote}`);
    }
  }

  if (report.summary.staleCount > 0) {
    console.log('\nStale files by category:');
    for (const summary of staleFilesByCategory) {
      if (summary.count > 0) {
        console.log(`  ${summary.category}: ${summary.count} files`);
      }
    }
  }

  if (report.summary.oldestFile) {
    console.log(`\nOldest: ${report.summary.oldestFile.path} (${report.summary.oldestFile.daysSinceModified} days)`);
  }
  if (report.summary.newestFile) {
    console.log(`Newest: ${report.summary.newestFile.path} (${report.summary.newestFile.daysSinceModified} days)`);
  }
}

run();
