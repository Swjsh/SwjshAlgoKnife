/**
 * Jira Health Check Module
 *
 * Calls the Python jira_health.py script to check Jira API connectivity.
 * Caches results for 5 minutes to avoid excessive API calls.
 *
 * PULSE-8: Add Jira connectivity to system health dashboard
 */

import { execSync } from 'child_process';
import path from 'path';

export interface JiraHealthStatus {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'ERROR';
    connected: boolean;
    latencyMs: number;
    lastCheck: string;
    user: string | null;
    baseUrl: string | null;
    error: string | null;
}

// Cache to avoid excessive API calls
let cachedResult: JiraHealthStatus | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check Jira API health by calling the Python script.
 * Results are cached for 5 minutes.
 */
export function checkJiraHealth(): JiraHealthStatus {
    const now = Date.now();

    // Return cached result if still fresh
    if (cachedResult && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return cachedResult;
    }

    try {
        // Determine Python executable
        const python = process.platform === 'win32' ? 'python' : 'python3';

        // Get script path relative to project root
        const scriptPath = path.join(process.cwd(), 'scripts', 'jira_health.py');

        // Execute Python script with timeout
        const output = execSync(`${python} "${scriptPath}"`, {
            encoding: 'utf8',
            timeout: 15000, // 15 second timeout
            windowsHide: true,
        });

        // Parse JSON output
        const result: JiraHealthStatus = JSON.parse(output.trim());

        // Update cache
        cachedResult = result;
        cacheTimestamp = now;

        return result;
    } catch (error: any) {
        // Return error status if script fails
        const errorResult: JiraHealthStatus = {
            status: 'ERROR',
            connected: false,
            latencyMs: 0,
            lastCheck: new Date().toISOString(),
            user: null,
            baseUrl: null,
            error: error.message || 'Failed to execute jira_health.py',
        };

        // Cache errors for 1 minute to avoid spam
        cachedResult = errorResult;
        cacheTimestamp = now - (CACHE_TTL_MS - 60000); // Cache for 1 min instead of 5

        return errorResult;
    }
}

/**
 * Force refresh the Jira health cache.
 */
export function refreshJiraHealth(): JiraHealthStatus {
    cachedResult = null;
    cacheTimestamp = 0;
    return checkJiraHealth();
}
