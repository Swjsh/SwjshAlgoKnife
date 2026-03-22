/**
 * SENTINEL Alert Manager
 *
 * Handles alert deduplication, maintenance windows, snooze options,
 * and severity-based routing.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Types
export type AlertSeverity = 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';
export type AlertStatus = 'firing' | 'acknowledged' | 'resolved' | 'snoozed';

export interface Alert {
  id: string;
  fingerprint: string;
  severity: AlertSeverity;
  source: string;
  title: string;
  description: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
  status: AlertStatus;
  acknowledgedBy?: string;
  snoozedUntil?: string;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface MaintenanceWindow {
  id: string;
  name: string;
  connections: string[];
  startTime: string;
  endTime: string;
  createdBy: string;
  reason: string;
  suppressAlerts: boolean;
}

export interface AlertStore {
  version: string;
  lastUpdated: string;
  alerts: Alert[];
  maintenanceWindows: MaintenanceWindow[];
  snoozedAlerts: Record<string, string>; // alertId -> snoozedUntil
}

export interface AlertDeduplicationConfig {
  windowSeconds: number;
  groupBy: string[];
  maxPerGroup: number;
}

export interface AlertRouting {
  severity: AlertSeverity;
  responseTime: string;
  notification: string[];
  autoHeal: boolean;
}

const DEFAULT_DEDUPLICATION: AlertDeduplicationConfig = {
  windowSeconds: 300, // 5 minutes
  groupBy: ['source', 'severity', 'fingerprint'],
  maxPerGroup: 1,
};

const ROUTING_CONFIG: AlertRouting[] = [
  { severity: 'GREEN', responseTime: '-', notification: [], autoHeal: false },
  { severity: 'YELLOW', responseTime: '1h', notification: ['jira'], autoHeal: true },
  { severity: 'RED', responseTime: '15m', notification: ['discord', 'jira'], autoHeal: true },
  { severity: 'CRITICAL', responseTime: 'immediate', notification: ['ceo', 'discord', 'jira'], autoHeal: true },
];

const SNOOZE_OPTIONS = [
  { label: '15 minutes', seconds: 900 },
  { label: '1 hour', seconds: 3600 },
  { label: '4 hours', seconds: 14400 },
  { label: 'Until resolved', seconds: -1 },
];

const MAX_ALERTS = 500;

export class AlertManager {
  private store: AlertStore;
  private storePath: string;
  private deduplication: AlertDeduplicationConfig;

  constructor(
    storePath: string = 'data/sentinel/alert-history.json',
    deduplication: AlertDeduplicationConfig = DEFAULT_DEDUPLICATION
  ) {
    this.storePath = storePath;
    this.deduplication = deduplication;
    this.store = this.loadStore();
  }

  private loadStore(): AlertStore {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Failed to load alert store: ${error}`);
    }

    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      alerts: [],
      maintenanceWindows: [],
      snoozedAlerts: {},
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
      console.error(`Failed to save alert store: ${error}`);
    }
  }

  private generateFingerprint(source: string, severity: AlertSeverity, title: string): string {
    const data = `${source}:${severity}:${title}`;
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 12);
  }

  private isInMaintenanceWindow(source: string): boolean {
    const now = Date.now();
    for (const window of this.store.maintenanceWindows) {
      const start = new Date(window.startTime).getTime();
      const end = new Date(window.endTime).getTime();
      if (now >= start && now <= end && window.suppressAlerts) {
        if (window.connections.includes(source) || window.connections.includes('*')) {
          return true;
        }
      }
    }
    return false;
  }

  private isDuplicate(fingerprint: string): Alert | null {
    const now = Date.now();
    const windowMs = this.deduplication.windowSeconds * 1000;

    for (const alert of this.store.alerts) {
      if (alert.fingerprint === fingerprint && alert.status === 'firing') {
        const lastSeen = new Date(alert.lastSeen).getTime();
        if (now - lastSeen < windowMs) {
          return alert;
        }
      }
    }
    return null;
  }

  /**
   * Create or update an alert
   */
  createAlert(
    source: string,
    severity: AlertSeverity,
    title: string,
    description: string,
    metadata?: Record<string, unknown>
  ): Alert | null {
    // Skip if GREEN severity
    if (severity === 'GREEN') {
      return null;
    }

    // Check maintenance window
    if (this.isInMaintenanceWindow(source) && severity !== 'CRITICAL') {
      console.log(`[AlertManager] Alert suppressed during maintenance: ${source}`);
      return null;
    }

    const fingerprint = this.generateFingerprint(source, severity, title);
    const now = new Date().toISOString();

    // Check for duplicate
    const existingAlert = this.isDuplicate(fingerprint);
    if (existingAlert) {
      // Update existing alert
      existingAlert.lastSeen = now;
      existingAlert.count++;
      existingAlert.description = description;
      if (metadata) {
        existingAlert.metadata = { ...existingAlert.metadata, ...metadata };
      }
      this.saveStore();
      console.log(`[AlertManager] Updated existing alert: ${fingerprint} (count: ${existingAlert.count})`);
      return existingAlert;
    }

    // Check if snoozed
    if (this.store.snoozedAlerts[fingerprint]) {
      const snoozedUntil = new Date(this.store.snoozedAlerts[fingerprint]).getTime();
      if (Date.now() < snoozedUntil) {
        console.log(`[AlertManager] Alert snoozed: ${fingerprint}`);
        return null;
      }
      // Snooze expired, remove it
      delete this.store.snoozedAlerts[fingerprint];
    }

    // Create new alert
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fingerprint,
      severity,
      source,
      title,
      description,
      firstSeen: now,
      lastSeen: now,
      count: 1,
      status: 'firing',
      metadata,
    };

    this.store.alerts.push(alert);

    // Trim alerts if too many
    if (this.store.alerts.length > MAX_ALERTS) {
      // Remove oldest resolved alerts first
      const resolved = this.store.alerts.filter(a => a.status === 'resolved');
      if (resolved.length > 0) {
        const toRemove = resolved.slice(0, this.store.alerts.length - MAX_ALERTS);
        for (const a of toRemove) {
          const idx = this.store.alerts.findIndex(x => x.id === a.id);
          if (idx >= 0) {
            this.store.alerts.splice(idx, 1);
          }
        }
      }
    }

    this.saveStore();
    console.log(`[AlertManager] Created alert: ${alert.id} (${severity})`);

    // Route the alert
    this.routeAlert(alert);

    return alert;
  }

  /**
   * Route alert based on severity
   */
  private routeAlert(alert: Alert): void {
    const routing = ROUTING_CONFIG.find(r => r.severity === alert.severity);
    if (!routing) return;

    console.log(`[AlertManager] Routing ${alert.severity} alert via: ${routing.notification.join(', ')}`);

    // In a real implementation, this would:
    // - Send to Discord webhook
    // - Create Jira ticket
    // - Page CEO for CRITICAL

    // For now, just log the routing
    for (const channel of routing.notification) {
      console.log(`  -> Would notify via ${channel}: ${alert.title}`);
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Alert | null {
    const alert = this.store.alerts.find(a => a.id === alertId);
    if (!alert) {
      return null;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = acknowledgedBy;
    this.saveStore();

    console.log(`[AlertManager] Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): Alert | null {
    const alert = this.store.alerts.find(a => a.id === alertId);
    if (!alert) {
      return null;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    this.saveStore();

    console.log(`[AlertManager] Alert resolved: ${alertId}`);
    return alert;
  }

  /**
   * Resolve alerts by fingerprint (when underlying issue is fixed)
   */
  resolveByFingerprint(fingerprint: string): number {
    let resolved = 0;
    for (const alert of this.store.alerts) {
      if (alert.fingerprint === fingerprint && alert.status === 'firing') {
        alert.status = 'resolved';
        alert.resolvedAt = new Date().toISOString();
        resolved++;
      }
    }
    if (resolved > 0) {
      this.saveStore();
      console.log(`[AlertManager] Resolved ${resolved} alerts by fingerprint: ${fingerprint}`);
    }
    return resolved;
  }

  /**
   * Snooze an alert
   */
  snoozeAlert(alertId: string, durationSeconds: number): Alert | null {
    const alert = this.store.alerts.find(a => a.id === alertId);
    if (!alert) {
      return null;
    }

    const snoozedUntil = durationSeconds === -1
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year = "until resolved"
      : new Date(Date.now() + durationSeconds * 1000).toISOString();

    alert.status = 'snoozed';
    alert.snoozedUntil = snoozedUntil;
    this.store.snoozedAlerts[alert.fingerprint] = snoozedUntil;
    this.saveStore();

    console.log(`[AlertManager] Alert snoozed: ${alertId} until ${snoozedUntil}`);
    return alert;
  }

  /**
   * Create a maintenance window
   */
  createMaintenanceWindow(
    name: string,
    connections: string[],
    startTime: string,
    endTime: string,
    createdBy: string,
    reason: string,
    suppressAlerts: boolean = true
  ): MaintenanceWindow {
    const window: MaintenanceWindow = {
      id: `maint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      connections,
      startTime,
      endTime,
      createdBy,
      reason,
      suppressAlerts,
    };

    this.store.maintenanceWindows.push(window);
    this.saveStore();

    console.log(`[AlertManager] Created maintenance window: ${window.id}`);
    return window;
  }

  /**
   * Delete a maintenance window
   */
  deleteMaintenanceWindow(windowId: string): boolean {
    const idx = this.store.maintenanceWindows.findIndex(w => w.id === windowId);
    if (idx >= 0) {
      this.store.maintenanceWindows.splice(idx, 1);
      this.saveStore();
      return true;
    }
    return false;
  }

  /**
   * Get active maintenance windows
   */
  getActiveMaintenanceWindows(): MaintenanceWindow[] {
    const now = Date.now();
    return this.store.maintenanceWindows.filter(w => {
      const start = new Date(w.startTime).getTime();
      const end = new Date(w.endTime).getTime();
      return now >= start && now <= end;
    });
  }

  /**
   * Get firing alerts
   */
  getFiringAlerts(): Alert[] {
    return this.store.alerts.filter(a => a.status === 'firing');
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.store.alerts.filter(a => a.severity === severity && a.status === 'firing');
  }

  /**
   * Get alerts by source
   */
  getAlertsBySource(source: string): Alert[] {
    return this.store.alerts.filter(a => a.source === source);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 20): Alert[] {
    return this.store.alerts.slice(-limit);
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.store.alerts.find(a => a.id === alertId);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    firing: number;
    acknowledged: number;
    snoozed: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
    maintenanceWindowsActive: number;
  } {
    const alerts = this.store.alerts;
    const firing = alerts.filter(a => a.status === 'firing');

    return {
      firing: firing.length,
      acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
      snoozed: alerts.filter(a => a.status === 'snoozed').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      bySeverity: {
        GREEN: 0,
        YELLOW: firing.filter(a => a.severity === 'YELLOW').length,
        RED: firing.filter(a => a.severity === 'RED').length,
        CRITICAL: firing.filter(a => a.severity === 'CRITICAL').length,
      },
      maintenanceWindowsActive: this.getActiveMaintenanceWindows().length,
    };
  }

  /**
   * Get snooze options
   */
  getSnoozeOptions(): typeof SNOOZE_OPTIONS {
    return SNOOZE_OPTIONS;
  }

  /**
   * Clean up old resolved alerts
   */
  cleanup(maxAgeDays: number = 30): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const before = this.store.alerts.length;

    this.store.alerts = this.store.alerts.filter(a => {
      if (a.status !== 'resolved') return true;
      const resolvedAt = new Date(a.resolvedAt || a.lastSeen).getTime();
      return resolvedAt > cutoff;
    });

    const removed = before - this.store.alerts.length;
    if (removed > 0) {
      this.saveStore();
      console.log(`[AlertManager] Cleaned up ${removed} old alerts`);
    }
    return removed;
  }
}

// CLI main
export async function main() {
  const manager = new AlertManager();

  console.log('\n=== SENTINEL ALERT MANAGER ===\n');

  const summary = manager.getSummary();
  console.log('--- Summary ---');
  console.log(`Firing: ${summary.firing}`);
  console.log(`Acknowledged: ${summary.acknowledged}`);
  console.log(`Snoozed: ${summary.snoozed}`);
  console.log(`Resolved: ${summary.resolved}`);
  console.log(`Maintenance windows: ${summary.maintenanceWindowsActive}`);

  console.log('\n--- By Severity ---');
  console.log(`CRITICAL: ${summary.bySeverity.CRITICAL}`);
  console.log(`RED: ${summary.bySeverity.RED}`);
  console.log(`YELLOW: ${summary.bySeverity.YELLOW}`);

  const firing = manager.getFiringAlerts();
  if (firing.length > 0) {
    console.log('\n--- Firing Alerts ---');
    for (const alert of firing) {
      console.log(`[${alert.severity}] ${alert.title}`);
      console.log(`  Source: ${alert.source}`);
      console.log(`  First seen: ${alert.firstSeen}`);
      console.log(`  Count: ${alert.count}`);
    }
  }

  const windows = manager.getActiveMaintenanceWindows();
  if (windows.length > 0) {
    console.log('\n--- Active Maintenance Windows ---');
    for (const window of windows) {
      console.log(`${window.name}`);
      console.log(`  Connections: ${window.connections.join(', ')}`);
      console.log(`  Until: ${window.endTime}`);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
