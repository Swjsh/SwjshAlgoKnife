import { useState, useEffect, useCallback, useRef } from 'react';

interface LoopState {
  running: boolean;
  currentProject: string | null;
  currentIssue: string | null;
  iterationCount: number;
  issuesCompleted: number;
  skillsLearned?: number;
  lastActivity?: string | null;
  errors?: string[];
}

interface UseJiraLoopResult {
  loopState: LoopState | null;
  isLoading: boolean;
  error: string | null;
  startLoop: (project?: string) => Promise<void>;
  stopLoop: () => Promise<void>;
  refetch: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30000; // 30 seconds

export function useJiraLoop(): UseJiraLoopResult {
  const [loopState, setLoopState] = useState<LoopState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchLoopState = useCallback(async (): Promise<void> => {
    try {
      // Don't set loading on poll - only on initial fetch
      if (loopState === null) {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch('/api/jira/loop');

      if (!response.ok) {
        throw new Error(`Failed to fetch loop status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (isMountedRef.current) {
        setLoopState(data);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching loop status';
        setError(errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [loopState]);

  const startLoop = useCallback(async (project?: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const body: { action: string; project?: string } = { action: 'start' };
      if (project) {
        body.project = project;
      }

      const response = await fetch('/api/jira/loop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? `Failed to start loop: ${response.status}`);
      }

      const data = await response.json();

      if (isMountedRef.current) {
        setLoopState(data.state ?? data);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error starting loop';
        setError(errorMessage);
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const stopLoop = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/jira/loop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'stop' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? `Failed to stop loop: ${response.status}`);
      }

      const data = await response.json();

      if (isMountedRef.current) {
        setLoopState(data.state ?? data);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error stopping loop';
        setError(errorMessage);
      }
      throw err;
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch on mount
    fetchLoopState();

    // Set up polling interval
    intervalRef.current = setInterval(fetchLoopState, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    loopState,
    isLoading,
    error,
    startLoop,
    stopLoop,
    refetch: fetchLoopState,
  };
}
