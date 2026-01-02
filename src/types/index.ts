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
}
