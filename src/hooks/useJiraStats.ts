import { useState, useEffect, useCallback, useRef } from 'react';

export interface AgentStats {
    done: number;
    inProgress: number;
    todo: number;
    total: number;
}

interface JiraStatsState {
    stats: Record<string, AgentStats>;
    isLoading: boolean;
    error: string | null;
    lastUpdated: string | null;
}

const POLL_INTERVAL_MS = 120000; // 2 minutes — ticket counts don't change rapidly

export function useJiraStats(): JiraStatsState {
    const [stats, setStats] = useState<Record<string, AgentStats>>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef<boolean>(true);

    const fetchStats = useCallback(async (): Promise<void> => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/jira/stats');

            if (!response.ok) {
                throw new Error(`Failed to fetch stats: ${response.status}`);
            }

            const data = await response.json();

            if (isMountedRef.current) {
                setStats(data.agents ?? {});
                setLastUpdated(data.lastUpdated ?? new Date().toISOString());
                setError(null);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        fetchStats();
        intervalRef.current = setInterval(fetchStats, POLL_INTERVAL_MS);

        return () => {
            isMountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [fetchStats]);

    return { stats, isLoading, error, lastUpdated };
}

export default useJiraStats;
