import { useState, useEffect, useCallback, useRef } from 'react';

interface Ticket {
  key: string;
  summary: string;
  status: string;
  priority: string;
  updated: string;
}

interface AgentTickets {
  done: Ticket | null;
  inProgress: Ticket | null;
  next: Ticket | null;
}

interface JiraTicketsState {
  tickets: Record<string, AgentTickets>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refetch: () => Promise<void>;
}

const POLL_INTERVAL_MS = 60000; // 60 seconds

export function useJiraTickets(): JiraTicketsState {
  const [tickets, setTickets] = useState<Record<string, AgentTickets>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchTickets = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/jira/tickets');

      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (isMountedRef.current) {
        // API returns { agents: {...}, lastUpdated: ... }
        setTickets(data.agents ?? data.tickets ?? data);
        setLastUpdated(data.lastUpdated ?? new Date().toISOString());
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching Jira tickets';
        setError(errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch on mount
    fetchTickets();

    // Set up polling interval
    intervalRef.current = setInterval(fetchTickets, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchTickets]);

  return {
    tickets,
    isLoading,
    error,
    lastUpdated,
    refetch: fetchTickets,
  };
}
