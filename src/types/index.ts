// ============================================
// SwjshAlgoKnife — Canonical Type Definitions
// ============================================
// All shared types live here. Import from '@/types'.
// DB schema, API payloads, and components should all reference these.

// --- Database Row Types (match SQLite schema exactly) ---

export interface Trade {
    id: number;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entry_price: number;
    exit_price?: number;
    size: number;
    strategy: string;
    status: 'OPEN' | 'CLOSED' | 'WIN' | 'LOSS' | 'BE';
    pnl?: number;
    notes?: string;
    entry_date: string;
    exit_date?: string;
    screenshot_url?: string;
    created_at?: string;
}

export interface SignalRow {
    id: number;
    timestamp: string;
    symbol: string;
    strategy: string;
    action: string;
    price: number;
    payload?: string;
    processed: number; // 0 or 1
}

export interface JournalEntry {
    date: string; // PRIMARY KEY, YYYY-MM-DD
    daily_pnl: number;
    mood?: string;
    notes?: string;
    tags?: string;
    created_at?: string;
}

export interface Setting {
    key: string;
    value: string;
    updated_at?: string;
}

// --- Engine Types ---

export type MarketCategory = 'OPTIONS' | 'CRYPTO' | 'FOREX' | 'FUTURES';

export type SignalAction = 'BUY' | 'SELL' | 'EXIT' | 'LONG' | 'SHORT';

export interface Signal {
    id?: number;
    timestamp: string;
    symbol: string;
    action: SignalAction;
    price: number;
    strategy: string;
    notes?: string;
}

// --- Agent Types (API response shape from /api/agents) ---

export interface AgentPerformance {
    win_rate: number;
    total_pnl: number;
    trades: number;
}

export interface AgentMeta {
    name: string;
    type: string;
    avatar?: string;
    profile_path?: string;
    strategy?: string;
    capital?: number;
    risk?: number;
}

export interface AgentOrder {
    created_at?: string;
    closed_at?: string;
    type?: string;    // 'DEMAND' | 'SUPPLY'
    side?: string;    // 'LONG' | 'SHORT'
    ticker: string;
    entry: number;
    exit?: number;
    stop?: number;
    pnl?: number;
    status?: string;
}

export interface AgentData {
    last_updated: string;
    status: string;
    active_pairs: number;
    total_zones_found: number;
    performance: AgentPerformance;
    pending_orders: AgentOrder[];
    active_trades: AgentOrder[];
    closed_trades: AgentOrder[];
    live_signals?: SignalRow[];
    meta: AgentMeta;
}

// --- Webhook Payload ---

export interface WebhookPayload {
    symbol: string;
    action: string;
    price?: number;
    strategy?: string;
    notes?: string;
}
