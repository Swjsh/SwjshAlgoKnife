'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  DollarSign, Server, Zap, Globe, RefreshCw,
  TrendingDown, AlertTriangle, CheckCircle, Clock,
  Shield, ChevronDown, ChevronUp,
} from 'lucide-react';
import styles from './costs.module.css';

interface CostItem {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  monthlyCost: number;
  annualCost: number;
  isVariable: boolean;
  costRange?: [number, number];
  notes?: string;
  lastChecked: string;
}

interface Optimization {
  id: string;
  title: string;
  savings: number;
  effort: 'low' | 'medium' | 'high';
  description: string;
}

interface CostAudit {
  generatedAt: string;
  nextRefresh: string;
  totalMonthly: number;
  totalAnnual: number;
  breakdown: {
    subscriptions: number;
    infrastructure: number;
    apis: number;
    domains: number;
  };
  items: CostItem[];
  freeServices: CostItem[];
  futureRisks: CostItem[];
  optimizations: Optimization[];
}

const REFRESH_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours in ms

export default function CostsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<CostAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showFree, setShowFree] = useState(false);
  const [showFuture, setShowFuture] = useState(false);

  const fetchCosts = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/costs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const audit: CostAudit = await res.json();
      setData(audit);
      setLastFetched(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cost data');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    fetchCosts();
    const interval = setInterval(fetchCosts, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loading, user, router, fetchCosts]);

  if (loading || !data) {
    return (
      <div className={styles.loadingWrap}>
        <RefreshCw size={24} className={styles.spinner} />
        <span>Loading cost data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorWrap}>
        <AlertTriangle size={24} />
        <span>{error}</span>
        <button onClick={fetchCosts} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  const maxMonthlyCost = Math.max(...data.items.map(i => i.monthlyCost));

  // Donut chart segments
  const segments = [
    { label: 'Subscriptions', value: data.breakdown.subscriptions, color: '#a855f7' },
    { label: 'Infrastructure', value: data.breakdown.infrastructure, color: '#06b6d4' },
    { label: 'APIs', value: data.breakdown.apis, color: '#f59e0b' },
    { label: 'Domain', value: data.breakdown.domains, color: '#22c55e' },
  ].filter(s => s.value > 0);

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let cumulativePercent = 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cost Audit</h1>
          <p className={styles.pageSubtitle}>
            Live infrastructure spend — refreshes every 2 hours
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.lastUpdated}>
            <Clock size={13} />
            <span>
              {lastFetched
                ? `Updated ${lastFetched.toLocaleTimeString()}`
                : 'Loading...'}
            </span>
          </div>
          <button
            onClick={fetchCosts}
            className={styles.refreshBtn}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? styles.spinner : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.cardIcon} style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
            <DollarSign size={20} />
          </div>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>Monthly Total</span>
            <span className={styles.cardValue} style={{ color: '#f87171' }}>
              ${data.totalMonthly.toFixed(2)}
            </span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.cardIcon} style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
            <DollarSign size={20} />
          </div>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>Annual Total</span>
            <span className={styles.cardValue} style={{ color: '#a855f7' }}>
              ${data.totalAnnual.toFixed(2)}
            </span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.cardIcon} style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
            <CheckCircle size={20} />
          </div>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>Free Services</span>
            <span className={styles.cardValue} style={{ color: '#22c55e' }}>
              {data.freeServices.length}
            </span>
          </div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.cardIcon} style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}>
            <TrendingDown size={20} />
          </div>
          <div className={styles.cardBody}>
            <span className={styles.cardLabel}>Possible Savings</span>
            <span className={styles.cardValue} style={{ color: '#06b6d4' }}>
              ${data.optimizations.reduce((s, o) => s + o.savings, 0)}/mo
            </span>
          </div>
        </div>
      </div>

      {/* Main content: Chart + Paid breakdown */}
      <div className={styles.mainGrid}>
        {/* Donut Chart */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Spend Distribution</h2>
          <div className={styles.donutWrap}>
            <svg viewBox="0 0 42 42" className={styles.donutSvg}>
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="3.5" />
              {segments.map((seg) => {
                const pct = (seg.value / total) * 100;
                const offset = 25 - cumulativePercent;
                cumulativePercent += pct;
                return (
                  <circle
                    key={seg.label}
                    cx="21" cy="21" r="15.915"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="3.5"
                    strokeDasharray={`${pct} ${100 - pct}`}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                  />
                );
              })}
              <text x="21" y="19.5" textAnchor="middle" fill="#e2e8f0" fontSize="4.5" fontWeight="800">
                ${Math.round(data.totalMonthly)}
              </text>
              <text x="21" y="23.5" textAnchor="middle" fill="#64748b" fontSize="2">
                /month
              </text>
            </svg>
            <div className={styles.legend}>
              {segments.map((seg) => (
                <div key={seg.label} className={styles.legendRow}>
                  <div className={styles.legendSwatch} style={{ background: seg.color }} />
                  <span className={styles.legendLabel}>{seg.label}</span>
                  <span className={styles.legendValue}>${seg.value.toFixed(2)}</span>
                  <span className={styles.legendPct}>
                    {((seg.value / total) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Paid Services Bars */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Active Costs</h2>
          <div className={styles.barList}>
            {data.items
              .sort((a, b) => b.monthlyCost - a.monthlyCost)
              .map((item) => {
                const pct = (item.monthlyCost / maxMonthlyCost) * 100;
                const barColor =
                  item.category === 'subscription' ? '#a855f7' :
                  item.category === 'api' ? '#f59e0b' :
                  item.category === 'domain' ? '#22c55e' :
                  '#06b6d4';
                return (
                  <div key={item.id} className={styles.barRow}>
                    <div className={styles.barMeta}>
                      <span className={styles.barName}>{item.name}</span>
                      <span className={styles.barDesc}>{item.description}</span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${Math.max(pct, 2)}%`, background: barColor }}
                      />
                    </div>
                    <span className={styles.barAmount}>
                      {item.isVariable ? '~' : ''}${item.monthlyCost.toFixed(2)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Optimization Suggestions */}
      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>
          <TrendingDown size={18} style={{ color: '#22c55e' }} />
          Optimization Opportunities
        </h2>
        <div className={styles.optGrid}>
          {data.optimizations.map((opt) => (
            <div key={opt.id} className={styles.optCard}>
              <div className={styles.optHeader}>
                <span className={styles.optTitle}>{opt.title}</span>
                <span className={styles.optSavings}>-${opt.savings}/mo</span>
              </div>
              <p className={styles.optDesc}>{opt.description}</p>
              <div className={styles.optFooter}>
                <span className={`${styles.effortBadge} ${styles[`effort_${opt.effort}`]}`}>
                  {opt.effort} effort
                </span>
                <span className={styles.optAnnual}>
                  ${opt.savings * 12}/yr saved
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible: Free Services */}
      <div className={styles.panel}>
        <button
          className={styles.collapseBtn}
          onClick={() => setShowFree(!showFree)}
        >
          <CheckCircle size={16} style={{ color: '#22c55e' }} />
          <span>Free Services ({data.freeServices.length})</span>
          {showFree ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showFree && (
          <div className={styles.serviceGrid}>
            {data.freeServices.map((svc) => (
              <div key={svc.id} className={styles.freeChip}>
                <CheckCircle size={13} style={{ color: '#22c55e' }} />
                <div>
                  <span className={styles.chipName}>{svc.name}</span>
                  <span className={styles.chipDesc}>{svc.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible: Future / Potential Costs */}
      <div className={styles.panel}>
        <button
          className={styles.collapseBtn}
          onClick={() => setShowFuture(!showFuture)}
        >
          <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
          <span>Potential Future Costs ({data.futureRisks.length})</span>
          {showFuture ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showFuture && (
          <div className={styles.futureList}>
            {data.futureRisks.map((item) => (
              <div key={item.id} className={styles.futureRow}>
                <div>
                  <span className={styles.futureName}>{item.name}</span>
                  <span className={styles.futureDesc}>{item.description}</span>
                </div>
                <span className={styles.futureCost}>
                  {item.monthlyCost > 0 ? `$${item.monthlyCost}/mo` : 'Variable'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OpenClaw API info */}
      <div className={styles.apiInfoBar}>
        <Shield size={14} />
        <span>
          API endpoint: <code>/api/admin/costs</code> — available for OpenClaw monitoring.
          Cached 2hr. No auth required (add <code>x-api-key</code> header when ready).
        </span>
      </div>
    </div>
  );
}
