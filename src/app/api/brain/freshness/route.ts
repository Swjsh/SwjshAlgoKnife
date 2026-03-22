import { NextResponse, NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { requireAdmin } from '@/lib/adminGuard';

const FRESHNESS_FILE = path.join(process.cwd(), 'data', 'brain', 'doc-freshness.json');
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'doc-freshness.ts');
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// Interfaces matching what the DocFreshnessWidget expects
interface StaleFile {
  name: string;
  path: string;
  category: string;
  priority: string;
  exists: boolean;
  modified: string | null;
  ageMs: number | null;
  ageDays: number | null;
  ageRelative: string;
  stale: boolean;
  staleDays: number;
  size: number;
}

interface CategorySummary {
  label: string;
  total: number;
  fresh: number;
  stale: number;
  missing: number;
  priority: string;
}

interface FreshnessData {
  healthStatus: "healthy" | "warning" | "critical";
  totalFiles: number;
  freshCount: number;
  staleCount: number;
  categories: Record<string, CategorySummary>;
  staleFiles: StaleFile[];
  lastScanned: string;
  healthScore: number;
}

/**
 * Check if the cached freshness data is older than 1 hour
 */
function isCacheStale(): boolean {
  try {
    if (!fs.existsSync(FRESHNESS_FILE)) {
      return true;
    }
    const stat = fs.statSync(FRESHNESS_FILE);
    const ageMs = Date.now() - stat.mtime.getTime();
    return ageMs > CACHE_MAX_AGE_MS;
  } catch {
    return true;
  }
}

/**
 * Run the freshness scan script and wait for completion
 */
function runFreshnessScan(): Promise<void> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npxCmd = isWindows ? 'npx.cmd' : 'npx';

    const child = spawn(npxCmd, ['tsx', SCRIPT_PATH], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows,
    });

    let stderr = '';

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Freshness scan failed with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('Freshness scan timed out'));
    }, 30000);
  });
}

// Category labels and priority mapping
const CATEGORY_CONFIG: Record<string, { label: string; priority: string }> = {
  brain: { label: 'Brain', priority: 'high' },
  docs: { label: 'Docs', priority: 'medium' },
  library: { label: 'Library', priority: 'medium' },
  root: { label: 'Root', priority: 'high' },
};

/**
 * Format relative age string from days
 */
function formatAgeRelative(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return '1 month ago';
  return `${Math.floor(days / 30)} months ago`;
}

/**
 * Determine priority based on staleness
 */
function getFilePriority(daysSinceModified: number, staleThreshold: number): string {
  if (daysSinceModified < staleThreshold) return 'normal';
  if (daysSinceModified < staleThreshold * 1.5) return 'warning';
  return 'critical';
}

/**
 * Calculate health status based on stale count
 */
function calculateHealthStatus(staleCount: number, totalFiles: number): "healthy" | "warning" | "critical" {
  if (staleCount === 0) return 'healthy';
  const staleRatio = staleCount / totalFiles;
  if (staleRatio <= 0.1) return 'warning'; // up to 10% stale = warning
  return 'critical'; // more than 10% stale = critical
}

/**
 * Read and transform the freshness data to match the widget's expected format
 */
function readFreshnessData(): FreshnessData {
  try {
    const rawData = JSON.parse(fs.readFileSync(FRESHNESS_FILE, 'utf-8'));

    const totalFiles = rawData.summary?.totalFiles || 0;
    const staleCount = rawData.summary?.staleCount || 0;
    const freshCount = rawData.summary?.freshCount || (totalFiles - staleCount);

    // Calculate health score as percentage of fresh files
    const healthScore = totalFiles > 0 ? Math.round((freshCount / totalFiles) * 100) : 100;

    // Determine health status
    const healthStatus = calculateHealthStatus(staleCount, totalFiles);

    // Transform categories to include label, fresh, missing, priority
    const categories: Record<string, CategorySummary> = {};
    if (rawData.summary?.byCategory) {
      for (const [key, value] of Object.entries(rawData.summary.byCategory)) {
        const v = value as { total: number; stale: number };
        const config = CATEGORY_CONFIG[key] || { label: key, priority: 'medium' };
        categories[key] = {
          label: config.label,
          total: v.total,
          fresh: v.total - v.stale,
          stale: v.stale,
          missing: 0, // We don't track missing files currently
          priority: config.priority,
        };
      }
    }

    // Transform stale files to match StaleFile interface
    const staleFiles: StaleFile[] = (rawData.files || [])
      .filter((f: { isStale: boolean }) => f.isStale)
      .map((f: {
        relativePath: string;
        lastModified: string;
        lastModifiedTimestamp: number;
        daysSinceModified: number;
        fileSize: number;
        category: string;
        staleThresholdDays: number;
      }) => {
        const now = Date.now();
        const modifiedTime = f.lastModifiedTimestamp || new Date(f.lastModified).getTime();
        const ageMs = now - modifiedTime;
        const fileName = f.relativePath.split('/').pop() || f.relativePath;

        return {
          name: fileName,
          path: f.relativePath,
          category: f.category,
          priority: getFilePriority(f.daysSinceModified, f.staleThresholdDays),
          exists: true, // If it's in the list, it exists
          modified: f.lastModified,
          ageMs: ageMs,
          ageDays: f.daysSinceModified,
          ageRelative: formatAgeRelative(f.daysSinceModified),
          stale: true,
          staleDays: f.daysSinceModified - f.staleThresholdDays,
          size: f.fileSize,
        };
      })
      .sort((a: StaleFile, b: StaleFile) => (b.ageDays || 0) - (a.ageDays || 0));

    return {
      healthStatus,
      totalFiles,
      freshCount,
      staleCount,
      categories,
      staleFiles,
      lastScanned: rawData.scanTimestamp || new Date().toISOString(),
      healthScore,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error reading freshness data';
    console.error('[freshness] Error reading data:', message);

    // Return a valid but empty FreshnessData object
    return {
      healthStatus: 'critical',
      totalFiles: 0,
      freshCount: 0,
      staleCount: 0,
      categories: {},
      staleFiles: [],
      lastScanned: new Date().toISOString(),
      healthScore: 0,
    };
  }
}

/**
 * GET /api/brain/freshness
 *
 * Returns cached freshness data if available and less than 1 hour old.
 * Otherwise, runs the freshness scan first and returns the new data.
 * Returns FreshnessData directly (not wrapped in {success, data}).
 */
export async function GET(request: NextRequest) {
  // Admin-only access
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.authorized) {
    return adminCheck.error!;
  }

  try {
    // Check if we need to run a fresh scan
    if (isCacheStale()) {
      console.log('[freshness] Cache stale or missing, running scan...');
      await runFreshnessScan();
    }

    const freshnessData = readFreshnessData();
    return NextResponse.json(freshnessData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[freshness] GET error:', message);

    // Return a valid but empty FreshnessData object on error
    const errorData: FreshnessData = {
      healthStatus: 'critical',
      totalFiles: 0,
      freshCount: 0,
      staleCount: 0,
      categories: {},
      staleFiles: [],
      lastScanned: new Date().toISOString(),
      healthScore: 0,
    };

    return NextResponse.json(errorData, { status: 500 });
  }
}

/**
 * POST /api/brain/freshness
 *
 * Forces a fresh scan regardless of cache age and returns the updated data.
 * Returns FreshnessData directly (not wrapped in {success, data}).
 */
export async function POST(request: NextRequest) {
  // Admin-only access
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.authorized) {
    return adminCheck.error!;
  }

  try {
    console.log('[freshness] Force scan requested...');
    await runFreshnessScan();

    const freshnessData = readFreshnessData();
    return NextResponse.json(freshnessData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[freshness] POST error:', message);

    // Return a valid but empty FreshnessData object on error
    const errorData: FreshnessData = {
      healthStatus: 'critical',
      totalFiles: 0,
      freshCount: 0,
      staleCount: 0,
      categories: {},
      staleFiles: [],
      lastScanned: new Date().toISOString(),
      healthScore: 0,
    };

    return NextResponse.json(errorData, { status: 500 });
  }
}
