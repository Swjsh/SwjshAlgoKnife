/**
 * Alpaca Paper Trading REST API Client
 *
 * Handles equity order submission and position management via Alpaca paper account.
 * Docs: https://docs.alpaca.markets/reference
 */

export interface AlpacaConfig {
    apiKeyId: string;
    apiSecretKey: string;
    baseUrl: string; // https://paper-api.alpaca.markets for paper
}

export interface AlpacaOrder {
    id: string;
    client_order_id: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: string;
    filled_qty: string;
    filled_avg_price: string | null;
    status: string;
    type: string;
    time_in_force: string;
    submitted_at: string;
    filled_at: string | null;
}

export interface AlpacaPosition {
    symbol: string;
    qty: string;
    side: string;
    avg_entry_price: string;
    market_value: string;
    unrealized_pl: string;
    current_price: string;
}

export interface AlpacaAccount {
    id: string;
    account_number: string;
    status: string;
    currency: string;
    cash: string;
    portfolio_value: string;
    buying_power: string;
    pattern_day_trader: boolean;
}

export class AlpacaClient {
    private baseUrl: string;
    private headers: HeadersInit;

    constructor(config: AlpacaConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // strip trailing slash
        this.headers = {
            'APCA-API-KEY-ID': config.apiKeyId,
            'APCA-API-SECRET-KEY': config.apiSecretKey,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Create client from environment variables
     */
    static fromEnv(): AlpacaClient {
        const apiKeyId = process.env.APCA_API_KEY_ID;
        const apiSecretKey = process.env.APCA_API_SECRET_KEY;
        const baseUrl = process.env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets';

        if (!apiKeyId || !apiSecretKey) {
            throw new Error('APCA_API_KEY_ID and APCA_API_SECRET_KEY must be set in environment');
        }

        return new AlpacaClient({ apiKeyId, apiSecretKey, baseUrl });
    }

    /**
     * Get account details (balance, buying power, status)
     */
    async getAccount(): Promise<AlpacaAccount> {
        const response = await fetch(`${this.baseUrl}/v2/account`, {
            headers: this.headers,
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Alpaca API error ${response.status}: ${body}`);
        }

        return response.json();
    }

    /**
     * Submit a market order
     * Returns the order object with ID for tracking
     */
    async submitOrder(params: {
        symbol: string;
        qty: number;
        side: 'buy' | 'sell';
        type?: 'market' | 'limit' | 'stop' | 'stop_limit';
        time_in_force?: 'day' | 'gtc' | 'ioc' | 'fok';
        limit_price?: number;
        stop_price?: number;
    }): Promise<AlpacaOrder> {
        const orderPayload = {
            symbol: params.symbol,
            qty: params.qty.toString(),
            side: params.side,
            type: params.type || 'market',
            time_in_force: params.time_in_force || 'day',
            ...(params.limit_price && { limit_price: params.limit_price.toString() }),
            ...(params.stop_price && { stop_price: params.stop_price.toString() }),
        };

        console.log(`[Alpaca] Submitting order:`, JSON.stringify(orderPayload));

        const response = await fetch(`${this.baseUrl}/v2/orders`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(orderPayload),
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Alpaca order error ${response.status}: ${body}`);
        }

        const order: AlpacaOrder = await response.json();
        console.log(`[Alpaca] Order submitted: ${order.id} - ${order.status}`);
        return order;
    }

    /**
     * Get a specific order by ID
     */
    async getOrder(orderId: string): Promise<AlpacaOrder> {
        const response = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
            headers: this.headers,
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Alpaca API error ${response.status}: ${body}`);
        }

        return response.json();
    }

    /**
     * Get an open position for a symbol
     */
    async getPosition(symbol: string): Promise<AlpacaPosition | null> {
        const response = await fetch(`${this.baseUrl}/v2/positions/${symbol}`, {
            headers: this.headers,
        });

        if (response.status === 404) {
            return null; // No open position
        }

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Alpaca API error ${response.status}: ${body}`);
        }

        return response.json();
    }

    /**
     * Get all open positions
     */
    async getAllPositions(): Promise<AlpacaPosition[]> {
        const response = await fetch(`${this.baseUrl}/v2/positions`, {
            headers: this.headers,
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Alpaca API error ${response.status}: ${body}`);
        }

        return response.json();
    }

    /**
     * Close a position by symbol (liquidate all shares)
     */
    async closePosition(symbol: string): Promise<AlpacaOrder> {
        const response = await fetch(`${this.baseUrl}/v2/positions/${symbol}`, {
            method: 'DELETE',
            headers: this.headers,
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Alpaca close error ${response.status}: ${body}`);
        }

        return response.json();
    }

    /**
     * Cancel an open order
     */
    async cancelOrder(orderId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
            method: 'DELETE',
            headers: this.headers,
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Alpaca cancel error ${response.status}: ${body}`);
        }
    }

    /**
     * Check if market is open right now
     */
    async isMarketOpen(): Promise<boolean> {
        const response = await fetch(`${this.baseUrl}/v2/clock`, {
            headers: this.headers,
        });

        if (!response.ok) {
            return false;
        }

        const clock = await response.json();
        return clock.is_open;
    }

    /**
     * Test connection to Alpaca API
     */
    async testConnection(): Promise<boolean> {
        try {
            const account = await this.getAccount();
            console.log(`✅ Alpaca connected: ${account.account_number}, Cash: $${account.cash}, Status: ${account.status}`);
            return true;
        } catch (error) {
            console.error('❌ Alpaca connection failed:', error);
            return false;
        }
    }
}

// Singleton instance for app-wide use (backward compatibility)
let clientInstance: AlpacaClient | null = null;

export function getAlpacaClient(): AlpacaClient {
    if (!clientInstance) {
        clientInstance = AlpacaClient.fromEnv();
    }
    return clientInstance;
}

/**
 * Create Alpaca client from database-stored credentials
 * Used for multi-tenant support where each user has their own broker config
 */
export function createAlpacaClientFromConfig(config: {
    apiKeyId: string;
    apiSecretKey: string;
    environment: 'PAPER' | 'LIVE';
}): AlpacaClient {
    const baseUrl = config.environment === 'LIVE'
        ? 'https://api.alpaca.markets'
        : 'https://paper-api.alpaca.markets';

    return new AlpacaClient({
        apiKeyId: config.apiKeyId,
        apiSecretKey: config.apiSecretKey,
        baseUrl,
    });
}

export default AlpacaClient;
