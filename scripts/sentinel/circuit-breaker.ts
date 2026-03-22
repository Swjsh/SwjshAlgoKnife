/**
 * SENTINEL Circuit Breaker Manager
 *
 * Implements the circuit breaker pattern to prevent cascading failures.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

import * as fs from 'fs';
import * as path from 'path';

// Types
export enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, no requests
  HALF_OPEN = 'half-open' // Testing recovery
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures to trip (default: 3)
  cooldownMs: number;          // Time in OPEN before HALF_OPEN (default: 60000)
  halfOpenSuccessThreshold: number; // Successes in HALF_OPEN to close (default: 3)
  maxOpenTimeMs?: number;      // Force HALF_OPEN after this time (default: 300000)
}

export interface CircuitBreakerState {
  connectionId: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;        // For HALF_OPEN tracking
  lastFailure: string | null;
  lastSuccess: string | null;
  lastStateChange: string;
  cooldownUntil: string | null;
  tripCount: number;           // Total times circuit has tripped
  config: CircuitBreakerConfig;
}

export interface CircuitBreakerEvent {
  timestamp: string;
  connectionId: string;
  previousState: CircuitState;
  newState: CircuitState;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface CircuitBreakerStore {
  version: string;
  lastUpdated: string;
  breakers: Record<string, CircuitBreakerState>;
  events: CircuitBreakerEvent[];
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownMs: 60000,
  halfOpenSuccessThreshold: 3,
  maxOpenTimeMs: 300000,
};

const MAX_EVENTS = 100;

export class CircuitBreakerManager {
  private store: CircuitBreakerStore;
  private storePath: string;
  private eventListeners: ((event: CircuitBreakerEvent) => void)[] = [];

  constructor(storePath: string = 'data/sentinel/circuit-breakers.json') {
    this.storePath = storePath;
    this.store = this.loadStore();
  }

  private loadStore(): CircuitBreakerStore {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Failed to load circuit breaker store: ${error}`);
    }

    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      breakers: {},
      events: [],
    };
  }

  private saveStore(): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.store.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2));
    } catch (error) {
      console.error(`Failed to save circuit breaker store: ${error}`);
    }
  }

  private getOrCreateBreaker(connectionId: string, config?: Partial<CircuitBreakerConfig>): CircuitBreakerState {
    if (!this.store.breakers[connectionId]) {
      this.store.breakers[connectionId] = {
        connectionId,
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailure: null,
        lastSuccess: null,
        lastStateChange: new Date().toISOString(),
        cooldownUntil: null,
        tripCount: 0,
        config: { ...DEFAULT_CONFIG, ...config },
      };
      this.saveStore();
    }
    return this.store.breakers[connectionId];
  }

  private emitEvent(event: CircuitBreakerEvent): void {
    // Add to store
    this.store.events.push(event);
    if (this.store.events.length > MAX_EVENTS) {
      this.store.events = this.store.events.slice(-MAX_EVENTS);
    }

    // Notify listeners
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`Event listener error: ${error}`);
      }
    }
  }

  private transitionState(
    breaker: CircuitBreakerState,
    newState: CircuitState,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    const previousState = breaker.state;
    if (previousState === newState) return;

    const event: CircuitBreakerEvent = {
      timestamp: new Date().toISOString(),
      connectionId: breaker.connectionId,
      previousState,
      newState,
      reason,
      metadata,
    };

    breaker.state = newState;
    breaker.lastStateChange = event.timestamp;

    if (newState === CircuitState.OPEN) {
      breaker.tripCount++;
      breaker.cooldownUntil = new Date(Date.now() + breaker.config.cooldownMs).toISOString();
      breaker.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      breaker.cooldownUntil = null;
      breaker.successCount = 0;
    } else if (newState === CircuitState.CLOSED) {
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.cooldownUntil = null;
    }

    this.emitEvent(event);
    this.saveStore();

    console.log(
      `[CircuitBreaker] ${breaker.connectionId}: ${previousState} → ${newState} (${reason})`
    );
  }

  /**
   * Record a successful operation
   */
  recordSuccess(connectionId: string, config?: Partial<CircuitBreakerConfig>): CircuitBreakerState {
    const breaker = this.getOrCreateBreaker(connectionId, config);
    const now = new Date().toISOString();

    breaker.lastSuccess = now;

    switch (breaker.state) {
      case CircuitState.CLOSED:
        // Reset failure count on success
        if (breaker.failureCount > 0) {
          breaker.failureCount = 0;
          this.saveStore();
        }
        break;

      case CircuitState.HALF_OPEN:
        breaker.successCount++;
        if (breaker.successCount >= breaker.config.halfOpenSuccessThreshold) {
          this.transitionState(breaker, CircuitState.CLOSED, 'Recovery confirmed', {
            successCount: breaker.successCount,
          });
        } else {
          this.saveStore();
        }
        break;

      case CircuitState.OPEN:
        // Shouldn't happen in OPEN state, but handle gracefully
        console.warn(`[CircuitBreaker] Success recorded while ${connectionId} is OPEN`);
        break;
    }

    return breaker;
  }

  /**
   * Record a failed operation
   */
  recordFailure(connectionId: string, error?: string, config?: Partial<CircuitBreakerConfig>): CircuitBreakerState {
    const breaker = this.getOrCreateBreaker(connectionId, config);
    const now = new Date().toISOString();

    breaker.lastFailure = now;
    breaker.failureCount++;

    switch (breaker.state) {
      case CircuitState.CLOSED:
        if (breaker.failureCount >= breaker.config.failureThreshold) {
          this.transitionState(breaker, CircuitState.OPEN, 'Failure threshold exceeded', {
            failureCount: breaker.failureCount,
            threshold: breaker.config.failureThreshold,
            error,
          });
        } else {
          this.saveStore();
        }
        break;

      case CircuitState.HALF_OPEN:
        // Any failure in HALF_OPEN immediately trips back to OPEN
        this.transitionState(breaker, CircuitState.OPEN, 'Failure during recovery test', {
          error,
        });
        break;

      case CircuitState.OPEN:
        // Already open, just update failure info
        this.saveStore();
        break;
    }

    return breaker;
  }

  /**
   * Check if a connection should allow requests
   */
  canRequest(connectionId: string, config?: Partial<CircuitBreakerConfig>): boolean {
    const breaker = this.getOrCreateBreaker(connectionId, config);
    const now = Date.now();

    switch (breaker.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if cooldown has expired
        if (breaker.cooldownUntil) {
          const cooldownEnd = new Date(breaker.cooldownUntil).getTime();
          if (now >= cooldownEnd) {
            this.transitionState(breaker, CircuitState.HALF_OPEN, 'Cooldown expired');
            return true;
          }
        }

        // Check if max open time has been exceeded
        if (breaker.config.maxOpenTimeMs) {
          const openSince = new Date(breaker.lastStateChange).getTime();
          if (now - openSince >= breaker.config.maxOpenTimeMs) {
            this.transitionState(breaker, CircuitState.HALF_OPEN, 'Max open time exceeded');
            return true;
          }
        }

        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests in HALF_OPEN
        return true;
    }
  }

  /**
   * Get the current state of a circuit breaker
   */
  getState(connectionId: string): CircuitBreakerState | undefined {
    return this.store.breakers[connectionId];
  }

  /**
   * Get all circuit breakers
   */
  getAllBreakers(): Record<string, CircuitBreakerState> {
    return { ...this.store.breakers };
  }

  /**
   * Get all breakers in a specific state
   */
  getBreakersByState(state: CircuitState): CircuitBreakerState[] {
    return Object.values(this.store.breakers).filter(b => b.state === state);
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 20): CircuitBreakerEvent[] {
    return this.store.events.slice(-limit);
  }

  /**
   * Force a circuit breaker to a specific state (for admin/debugging)
   */
  forceState(connectionId: string, state: CircuitState, reason: string = 'Manual override'): void {
    const breaker = this.getOrCreateBreaker(connectionId);
    this.transitionState(breaker, state, reason, { manual: true });
  }

  /**
   * Reset a circuit breaker to CLOSED state
   */
  reset(connectionId: string): void {
    this.forceState(connectionId, CircuitState.CLOSED, 'Manual reset');
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const connectionId of Object.keys(this.store.breakers)) {
      this.reset(connectionId);
    }
  }

  /**
   * Add an event listener for state changes
   */
  onStateChange(listener: (event: CircuitBreakerEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    total: number;
    closed: number;
    open: number;
    halfOpen: number;
    totalTrips: number;
    recentEvents: number;
  } {
    const breakers = Object.values(this.store.breakers);
    return {
      total: breakers.length,
      closed: breakers.filter(b => b.state === CircuitState.CLOSED).length,
      open: breakers.filter(b => b.state === CircuitState.OPEN).length,
      halfOpen: breakers.filter(b => b.state === CircuitState.HALF_OPEN).length,
      totalTrips: breakers.reduce((sum, b) => sum + b.tripCount, 0),
      recentEvents: this.store.events.length,
    };
  }

  /**
   * Check and update all circuit breakers (call periodically)
   */
  tick(): void {
    const now = Date.now();

    for (const breaker of Object.values(this.store.breakers)) {
      if (breaker.state === CircuitState.OPEN && breaker.cooldownUntil) {
        const cooldownEnd = new Date(breaker.cooldownUntil).getTime();
        if (now >= cooldownEnd) {
          this.transitionState(breaker, CircuitState.HALF_OPEN, 'Cooldown expired (tick)');
        }
      }
    }
  }
}

// Export singleton for convenience
let defaultManager: CircuitBreakerManager | null = null;

export function getCircuitBreakerManager(storePath?: string): CircuitBreakerManager {
  if (!defaultManager) {
    defaultManager = new CircuitBreakerManager(storePath);
  }
  return defaultManager;
}

// CLI main
export async function main() {
  const manager = new CircuitBreakerManager();

  console.log('\n=== SENTINEL CIRCUIT BREAKER STATUS ===\n');

  const summary = manager.getSummary();
  console.log(`Total breakers: ${summary.total}`);
  console.log(`  CLOSED:    ${summary.closed}`);
  console.log(`  OPEN:      ${summary.open}`);
  console.log(`  HALF-OPEN: ${summary.halfOpen}`);
  console.log(`Total trips: ${summary.totalTrips}`);

  const openBreakers = manager.getBreakersByState(CircuitState.OPEN);
  if (openBreakers.length > 0) {
    console.log('\n--- OPEN CIRCUITS ---\n');
    for (const breaker of openBreakers) {
      console.log(`[OPEN] ${breaker.connectionId}`);
      console.log(`  Failures: ${breaker.failureCount}`);
      console.log(`  Last failure: ${breaker.lastFailure}`);
      console.log(`  Cooldown until: ${breaker.cooldownUntil}`);
      console.log(`  Trip count: ${breaker.tripCount}`);
    }
  }

  const halfOpenBreakers = manager.getBreakersByState(CircuitState.HALF_OPEN);
  if (halfOpenBreakers.length > 0) {
    console.log('\n--- HALF-OPEN CIRCUITS ---\n');
    for (const breaker of halfOpenBreakers) {
      console.log(`[HALF-OPEN] ${breaker.connectionId}`);
      console.log(`  Successes: ${breaker.successCount}/${breaker.config.halfOpenSuccessThreshold}`);
      console.log(`  Last success: ${breaker.lastSuccess}`);
    }
  }

  console.log('\n--- RECENT EVENTS ---\n');
  const events = manager.getRecentEvents(10);
  for (const event of events) {
    console.log(`${event.timestamp}: ${event.connectionId} ${event.previousState} → ${event.newState}`);
    console.log(`  Reason: ${event.reason}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
