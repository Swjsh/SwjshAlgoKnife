/**
 * Database Health Check Module
 *
 * Provides health metrics for SQLite database:
 * - Connectivity status
 * - Transaction latency
 * - File integrity
 * - Table statistics
 *
 * PULSE-11: Add Database Connection Pool Health Check
 */

import fs from 'fs';
import { DATABASE_PATH } from './dataPaths';
import db from './db';

export interface DbHealthStatus {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'ERROR';
    connectivity: {
        connected: boolean;
        latencyMs: number;
        lastCheck: string;
    };
    file: {
        exists: boolean;
        path: string;
        sizeBytes: number;
        sizeMB: number;
        readable: boolean;
        writable: boolean;
    };
    tables: {
        name: string;
        rowCount: number;
    }[];
    warnings: string[];
}

// Latency thresholds for status classification
const LATENCY_THRESHOLDS = {
    HEALTHY: 50,     // <50ms is healthy
    DEGRADED: 200,   // 50-200ms is degraded
    // >200ms is unhealthy
};

// File size warnings
const SIZE_THRESHOLDS = {
    WARNING_MB: 500,   // Warn if DB >500MB
    CRITICAL_MB: 1000, // Critical if DB >1GB
};

/**
 * Check database file status
 */
function checkFileHealth(): DbHealthStatus['file'] {
    const dbPath = DATABASE_PATH;

    try {
        const stats = fs.statSync(dbPath);
        const sizeBytes = stats.size;
        const sizeMB = Math.round(sizeBytes / 1024 / 1024 * 10) / 10;

        // Check read/write permissions
        let readable = false;
        let writable = false;
        try {
            fs.accessSync(dbPath, fs.constants.R_OK);
            readable = true;
        } catch { /* not readable */ }
        try {
            fs.accessSync(dbPath, fs.constants.W_OK);
            writable = true;
        } catch { /* not writable */ }

        return {
            exists: true,
            path: dbPath,
            sizeBytes,
            sizeMB,
            readable,
            writable,
        };
    } catch (error) {
        return {
            exists: false,
            path: dbPath,
            sizeBytes: 0,
            sizeMB: 0,
            readable: false,
            writable: false,
        };
    }
}

/**
 * Check database connectivity and measure latency
 */
function checkConnectivity(): DbHealthStatus['connectivity'] {
    const startTime = Date.now();

    try {
        // Simple query to test connectivity
        const result = db.prepare('SELECT 1 as test').get();
        const latencyMs = Date.now() - startTime;

        return {
            connected: result?.test === 1,
            latencyMs,
            lastCheck: new Date().toISOString(),
        };
    } catch (error) {
        return {
            connected: false,
            latencyMs: Date.now() - startTime,
            lastCheck: new Date().toISOString(),
        };
    }
}

/**
 * Get row counts for core tables
 */
function getTableStats(): DbHealthStatus['tables'] {
    const tables = ['trades', 'signals', 'journal_entries', 'settings', 'intel_signals'];
    const stats: DbHealthStatus['tables'] = [];

    for (const table of tables) {
        try {
            const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
            stats.push({
                name: table,
                rowCount: result?.count ?? 0,
            });
        } catch {
            stats.push({
                name: table,
                rowCount: -1, // -1 indicates error reading table
            });
        }
    }

    return stats;
}

/**
 * Run full database health check
 */
export function checkDbHealth(): DbHealthStatus {
    const warnings: string[] = [];

    // Check file health
    const file = checkFileHealth();
    if (!file.exists) {
        return {
            status: 'ERROR',
            connectivity: { connected: false, latencyMs: 0, lastCheck: new Date().toISOString() },
            file,
            tables: [],
            warnings: ['Database file does not exist'],
        };
    }
    if (!file.readable) {
        warnings.push('Database file is not readable');
    }
    if (!file.writable) {
        warnings.push('Database file is not writable - may cause issues');
    }
    if (file.sizeMB > SIZE_THRESHOLDS.CRITICAL_MB) {
        warnings.push(`Database file exceeds ${SIZE_THRESHOLDS.CRITICAL_MB}MB - consider cleanup`);
    } else if (file.sizeMB > SIZE_THRESHOLDS.WARNING_MB) {
        warnings.push(`Database file exceeds ${SIZE_THRESHOLDS.WARNING_MB}MB`);
    }

    // Check connectivity
    const connectivity = checkConnectivity();
    if (!connectivity.connected) {
        return {
            status: 'ERROR',
            connectivity,
            file,
            tables: [],
            warnings: [...warnings, 'Cannot connect to database'],
        };
    }

    // Check latency
    if (connectivity.latencyMs > LATENCY_THRESHOLDS.DEGRADED) {
        warnings.push(`High query latency: ${connectivity.latencyMs}ms`);
    }

    // Get table stats
    const tables = getTableStats();
    const failedTables = tables.filter(t => t.rowCount === -1);
    if (failedTables.length > 0) {
        warnings.push(`Failed to read tables: ${failedTables.map(t => t.name).join(', ')}`);
    }

    // Determine overall status
    let status: DbHealthStatus['status'] = 'HEALTHY';
    if (!connectivity.connected || !file.readable) {
        status = 'ERROR';
    } else if (
        connectivity.latencyMs > LATENCY_THRESHOLDS.DEGRADED ||
        !file.writable ||
        failedTables.length > 0
    ) {
        status = 'UNHEALTHY';
    } else if (
        connectivity.latencyMs > LATENCY_THRESHOLDS.HEALTHY ||
        file.sizeMB > SIZE_THRESHOLDS.WARNING_MB
    ) {
        status = 'DEGRADED';
    }

    return {
        status,
        connectivity,
        file,
        tables,
        warnings,
    };
}
