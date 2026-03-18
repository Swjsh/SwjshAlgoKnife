import db from '../db';
import { Signal } from './types';
import { RiskManager, RiskParams } from './risk';
import { RiskEngine } from './risk/RiskEngine';
import intelBus from '../intel/bus';
import { db as cloudDb } from '../firebase';
import { ref, set, update } from "firebase/database";
import { getAlpacaClient, createAlpacaClientFromConfig, AlpacaClient } from '../broker/alpaca';
import { getOandaClient } from '../broker/oanda';
import { TheProfessor } from './local_runner/TheProfessor';
import {
    notifySignalReceived,
    notifyTradeFilled,
    notifyTradeClosed,
    notifyProfessorGrade,
    notifySystemAlert,
    notifyIntelDecision,
} from '../notifications/discord';
import { prisma } from '../prisma';
import { decryptSecret, EncryptedData } from '../encryption';

const CLOUD_SYNC_ENABLED = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const ALPACA_ENABLED     = !!(process.env.APCA_API_KEY_ID && process.env.APCA_API_SECRET_KEY);
const OANDA_ENABLED      = !!(process.env.OANDA_API_TOKEN && process.env.OANDA_ACCOUNT_ID);

// Detect whether a symbol is a forex pair by format (e.g. EURUSD, EUR_USD, EUR/USD)
function isFxSymbol(symbol: string): boolean {
    const cleaned = symbol.replace(/[/_]/g, '').toUpperCase();
    const FX_CURRENCIES = ['EUR', 'GBP', 'USD', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF', 'HKD', 'SGD', 'NOK', 'SEK'];
    if (cleaned.length !== 6) return false;
    const base = cleaned.slice(0, 3);
    const quote = cleaned.slice(3, 6);
    return FX_CURRENCIES.includes(base) && FX_CURRENCIES.includes(quote);
}

// Detect whether a symbol is a crypto asset
const CRYPTO_BASES = ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP', 'BNB', 'AVAX', 'DOT', 'MATIC', 'LTC', 'LINK', 'UNI'];
function isCryptoSymbol(symbol: string): boolean {
    const s = symbol.replace(/[/_\-]/g, '').toUpperCase();
    return CRYPTO_BASES.some(c => s.startsWith(c));
}

// Normalise crypto symbol to Alpaca format (BTCUSD / BTC-USD → BTC/USD)
function toAlpacaCryptoSymbol(symbol: string): string {
    const s = symbol.replace(/[/_\-]/g, '').toUpperCase();
    const base = CRYPTO_BASES.find(c => s.startsWith(c));
    if (!base) return symbol;
    return `${base}/USD`;
}

// Normalise symbol to OANDA format (EURUSD → EUR_USD)
function toOandaSymbol(symbol: string): string {
    const cleaned = symbol.replace(/[/_]/g, '').toUpperCase();
    return `${cleaned.slice(0, 3)}_${cleaned.slice(3, 6)}`;
}

export class TradeExecutor {
    private riskParams: RiskParams;
    private userAlpacaClient: AlpacaClient | null = null;
    private userBrokerEnvironment: 'PAPER' | 'LIVE' = 'PAPER';

    constructor(riskParams: RiskParams = { accountBalance: 10000, riskPerTradePercent: 1 }) {
        this.riskParams = riskParams;
    }

    /**
     * Get Alpaca client for this execution context.
     * Uses user-specific credentials from database if userId provided, otherwise falls back to env vars.
     */
    private async getAlpacaClientForUser(): Promise<{ client: AlpacaClient; enabled: boolean; environment: 'PAPER' | 'LIVE' }> {
        // If we already loaded the user's client, reuse it
        if (this.userAlpacaClient) {
            return { client: this.userAlpacaClient, enabled: true, environment: this.userBrokerEnvironment };
        }

        // If userId is provided, try to load from database
        if (this.riskParams.userId) {
            try {
                const brokerConfig = await prisma.brokerConfig.findFirst({
                    where: {
                        userId: this.riskParams.userId,
                        broker: 'ALPACA',
                        isActive: true,
                        connectionStatus: 'CONNECTED',
                    },
                    orderBy: { isPrimary: 'desc' },
                });

                if (brokerConfig && brokerConfig.apiKeyEncrypted && brokerConfig.apiSecretEncrypted) {
                    // Parse encryption metadata from combined field: keyIv:keyAuthTag:secretIv:secretAuthTag
                    const ivParts = brokerConfig.encryptionIv.split(':');
                    if (ivParts.length < 4) {
                        console.error('[Executor] Invalid encryptionIv format');
                        return { client: getAlpacaClient(), enabled: ALPACA_ENABLED, environment: 'PAPER' };
                    }

                    const [keyIv, keyAuthTag, secretIv, secretAuthTag] = ivParts;

                    // Decrypt credentials
                    const apiKeyId = decryptSecret({
                        encrypted: brokerConfig.apiKeyEncrypted,
                        iv: keyIv,
                        authTag: keyAuthTag,
                    });
                    const apiSecretKey = decryptSecret({
                        encrypted: brokerConfig.apiSecretEncrypted,
                        iv: secretIv,
                        authTag: secretAuthTag,
                    });

                    this.userBrokerEnvironment = brokerConfig.environment as 'PAPER' | 'LIVE';
                    this.userAlpacaClient = createAlpacaClientFromConfig({
                        apiKeyId,
                        apiSecretKey,
                        environment: this.userBrokerEnvironment,
                    });

                    return { client: this.userAlpacaClient, enabled: true, environment: this.userBrokerEnvironment };
                }
            } catch (error) {
                console.error('[Executor] Failed to load user broker config:', error);
            }
        }

        // Fallback to env vars
        if (ALPACA_ENABLED) {
            return { client: getAlpacaClient(), enabled: true, environment: 'PAPER' };
        }

        return { client: getAlpacaClient(), enabled: false, environment: 'PAPER' };
    }

    async processSignal(signal: Signal) {
        console.log(`[Executor] Processing: ${signal.action} ${signal.symbol} @ $${signal.price} via ${signal.strategy}`);

        // Notify Discord of incoming signal
        notifySignalReceived({
            symbol:   signal.symbol,
            action:   signal.action,
            price:    signal.price,
            strategy: signal.strategy,
        }).catch(() => {}); // fire-and-forget, never block on Discord

        if (signal.action === 'EXIT' || signal.action === 'FLAT') {
            return this.closePosition(signal);
        }

        const action    = signal.action.toUpperCase();
        const direction = (action === 'BUY' || action === 'LONG') ? 'LONG' : 'SHORT';
        const isFX      = isFxSymbol(signal.symbol);
        const isCrypto  = !isFX && isCryptoSymbol(signal.symbol);

        // ── RiskEngine Gate (includes Intel Score) ──────────────────────────
        const riskDecision = RiskEngine.canOpenTrade(
            signal.strategy || 'default',
            { ticker: signal.symbol, entry: signal.price, stop: signal.stopLoss || 0, side: direction, agentId: signal.strategy || 'default' },
            this.riskParams.accountBalance,
        );

        if (!riskDecision.allowed) {
            console.log(`🛡️ [Executor] BLOCKED by RiskEngine: ${riskDecision.reason}`);
            notifyIntelDecision({
                symbol: signal.symbol,
                direction,
                decision: 'BLOCKED',
                reason: riskDecision.reason,
                sizeMultiplier: riskDecision.sizeMultiplier,
                intelScore: riskDecision.intelScore,
            }).catch(() => {});
            return;
        }

        // Log intel decision for tracking
        if (riskDecision.intelScore) {
            notifyIntelDecision({
                symbol: signal.symbol,
                direction,
                decision: riskDecision.sizeMultiplier >= 1.0 ? 'CONFIRMED' : 'REDUCED',
                reason: riskDecision.reason,
                sizeMultiplier: riskDecision.sizeMultiplier,
                intelScore: riskDecision.intelScore,
            }).catch(() => {});
        }

        // ── Position Sizing (with Intel Multiplier) ─────────────────────────
        // Use stop-loss from signal if provided, otherwise fixed-risk fallback
        const rawSize = signal.stopLoss
            ? RiskManager.calculatePositionSize(this.riskParams, signal.price, signal.stopLoss)
            : RiskManager.calculateFixedSize(this.riskParams, signal.price, 1);

        // Apply intel-based size multiplier from RiskEngine
        const size = rawSize * riskDecision.sizeMultiplier;

        // RiskManager returns units already (coins for crypto, shares for equity, units for FX)
        // For crypto: round to 4 decimal places, minimum 0.001 coins (~$80 at BTC prices, above Alpaca's $10 min)
        // For equities: whole shares minimum 1
        // For FX: round to whole units
        const qty = isFX      ? Math.round(size)
                  : isCrypto  ? Math.max(0.001, parseFloat(size.toFixed(4)))
                  : Math.max(1, Math.floor(size));

        try {
            // ── Step 1: Record intent in SQLite ───────────────────────────────
            const tradeEntry = {
                symbol:      signal.symbol,
                direction,
                entry_price: signal.price,
                size:        qty,
                strategy:    signal.strategy,
                status:      'OPEN',
                entry_date:  new Date().toISOString(),
                notes:       'Pending broker fill...',
            };

            // Capture intel score snapshot at trade entry for attribution
            const intelSnap = intelBus.score(signal.symbol, direction);

            const result = db.prepare(`
                INSERT INTO trades (symbol, direction, entry_price, size, strategy, status, entry_date, notes, intel_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                tradeEntry.symbol, tradeEntry.direction, tradeEntry.entry_price,
                tradeEntry.size, tradeEntry.strategy, tradeEntry.status,
                tradeEntry.entry_date, tradeEntry.notes,
                JSON.stringify(intelSnap)
            );
            const tradeId = result.lastInsertRowid;

            // ── Step 2: Submit to Broker ──────────────────────────────────────
            if (isFX && OANDA_ENABLED) {
                await this._openOanda(signal, direction, qty, tradeId);
            } else if (isCrypto || !isFX) {
                // Check if user has Alpaca or if env vars are set
                const { enabled: alpacaEnabled } = await this.getAlpacaClientForUser();
                if (alpacaEnabled) {
                    await this._openAlpaca(signal, direction, qty, tradeId, isCrypto);
                } else {
                    // Journal-only fallback
                    db.prepare(`UPDATE trades SET status = 'OPEN', notes = ? WHERE id = ?`)
                      .run(`Paper only — no Alpaca broker configured`, tradeId);
                    console.log(`[Executor] (PAPER ONLY) ${direction} ${qty} ${signal.symbol} @ ${signal.price}`);
                }
            } else {
                // Journal-only fallback (no broker configured for this market)
                db.prepare(`UPDATE trades SET status = 'OPEN', notes = ? WHERE id = ?`)
                  .run(`Paper only — no broker for ${isFX ? 'FX' : 'equity'}`, tradeId);
                console.log(`[Executor] (PAPER ONLY) ${direction} ${qty} ${signal.symbol} @ ${signal.price}`);
            }

            // ── Cloud Sync ────────────────────────────────────────────────────
            if (CLOUD_SYNC_ENABLED && cloudDb) {
                set(ref(cloudDb, `trades/${tradeId}`), { id: tradeId, ...tradeEntry })
                    .catch(e => console.error('[Firebase]', e));
            }

        } catch (error: any) {
            console.error(`[Executor] Failed to open trade:`, error);
            notifySystemAlert(`Trade open failed for ${signal.symbol}: ${error.message}`, 'error').catch(() => {});
        }
    }

    // ── OANDA Entry ──────────────────────────────────────────────────────────
    private async _openOanda(signal: Signal, direction: 'LONG' | 'SHORT', units: number, tradeId: bigint | number) {
        const oandaSymbol = toOandaSymbol(signal.symbol);
        // OANDA: positive units = buy, negative = sell
        const signedUnits = direction === 'LONG' ? units : -units;

        try {
            const oanda = getOandaClient();
            const order = await oanda.placeMarketOrder(
                oandaSymbol,
                signedUnits,
                signal.stopLoss,
                signal.takeProfit,
            );

            db.prepare(`UPDATE trades SET status = 'OPEN', notes = ? WHERE id = ?`)
              .run(`OANDA Order: ${order.orderId} | Trade: ${order.tradeId}`, tradeId);

            console.log(`[Executor] ✅ OANDA FILL: ${direction} ${units} ${oandaSymbol} (Order: ${order.orderId})`);

            notifyTradeFilled({
                symbol:    signal.symbol,
                direction,
                fillPrice: signal.price,
                qty:       units,
                orderId:   order.tradeId || order.orderId,
                broker:    'OANDA Practice',
                strategy:  signal.strategy,
            }).catch(() => {});
        } catch (err: any) {
            db.prepare(`UPDATE trades SET status = 'LOSS', notes = ? WHERE id = ?`)
              .run(`BROKER_ERROR (OANDA): ${err.message}`, tradeId);
            console.error(`[Executor] ❌ OANDA failed: ${err.message}`);
            notifySystemAlert(`OANDA order failed — ${signal.symbol}: ${err.message}`, 'error').catch(() => {});
        }
    }

    // ── Alpaca Entry ─────────────────────────────────────────────────────────
    private async _openAlpaca(signal: Signal, direction: 'LONG' | 'SHORT', shares: number, tradeId: bigint | number, isCrypto = false) {
        const side = direction === 'LONG' ? 'buy' : 'sell';
        // Crypto on Alpaca: must use 'gtc' (not 'day'), symbol must be 'BTC/USD' format
        const alpacaSymbol = isCrypto ? toAlpacaCryptoSymbol(signal.symbol) : signal.symbol;
        const tif          = isCrypto ? 'gtc' : 'day';
        try {
            // Use user-specific client if available
            const { client: alpaca, environment } = await this.getAlpacaClientForUser();
            const order   = await alpaca.submitOrder({ symbol: alpacaSymbol, qty: shares, side, type: 'market', time_in_force: tif });
            const fillPrice = order.filled_avg_price && parseFloat(order.filled_avg_price) > 0
                ? parseFloat(order.filled_avg_price) : signal.price;
            // filled_qty may be "0" while order is pending_new — fall back to requested qty
            const filledQty = order.filled_qty && parseFloat(order.filled_qty) > 0
                ? parseFloat(order.filled_qty) : shares;

            db.prepare(`UPDATE trades SET status = 'OPEN', entry_price = ?, size = ?, notes = ? WHERE id = ?`)
              .run(fillPrice, filledQty, `Alpaca Order: ${order.id} | Status: ${order.status}`, tradeId);

            console.log(`[Executor] ✅ ALPACA FILL: ${side.toUpperCase()} ${filledQty} ${signal.symbol} @ $${fillPrice}`);

            const brokerName = environment === 'LIVE' ? 'Alpaca Live' : 'Alpaca Paper';
            notifyTradeFilled({
                symbol:    signal.symbol,
                direction,
                fillPrice,
                qty:       filledQty,
                orderId:   order.id,
                broker:    brokerName,
                strategy:  signal.strategy,
            }).catch(() => {});
        } catch (err: any) {
            db.prepare(`UPDATE trades SET status = 'LOSS', notes = ? WHERE id = ?`)
              .run(`BROKER_ERROR (Alpaca): ${err.message}`, tradeId);
            console.error(`[Executor] ❌ Alpaca failed: ${err.message}`);
            notifySystemAlert(`Alpaca order failed — ${signal.symbol}: ${err.message}`, 'error').catch(() => {});
        }
    }

    // ── Close Position ───────────────────────────────────────────────────────
    private async closePosition(signal: Signal) {
        try {
            const openTrade = db.prepare(`
                SELECT * FROM trades
                WHERE symbol = ? AND status = 'OPEN'
                ORDER BY entry_date DESC LIMIT 1
            `).get(signal.symbol) as any;

            if (!openTrade) {
                console.log(`[Executor] No open position for ${signal.symbol}`);
                return;
            }

            const isFX          = isFxSymbol(signal.symbol);
            const isCrypto      = !isFX && isCryptoSymbol(signal.symbol);
            let   brokerExitPrice = signal.price;

            // Close on broker
            let brokerEnvironment: 'PAPER' | 'LIVE' = 'PAPER';
            if (isFX && OANDA_ENABLED) {
                try {
                    const oanda = getOandaClient();
                    await oanda.closePosition(toOandaSymbol(signal.symbol));
                    console.log(`[Executor] ✅ OANDA position closed: ${signal.symbol}`);
                } catch (err: any) {
                    console.error(`[Executor] ⚠️ OANDA close failed: ${err.message}`);
                }
            } else if (isCrypto || !isFX) {
                // Try user-specific client, fallback to env vars
                const { client: alpaca, enabled, environment } = await this.getAlpacaClientForUser();
                brokerEnvironment = environment;
                if (enabled) {
                    try {
                        const alpacaSym  = isCrypto ? toAlpacaCryptoSymbol(signal.symbol) : signal.symbol;
                        const closeOrder = await alpaca.closePosition(alpacaSym);
                        if (closeOrder.filled_avg_price) brokerExitPrice = parseFloat(closeOrder.filled_avg_price);
                        console.log(`[Executor] ✅ Alpaca position closed: ${signal.symbol} @ $${brokerExitPrice}`);
                    } catch (err: any) {
                        console.error(`[Executor] ⚠️ Alpaca close failed: ${err.message}`);
                    }
                }
            }

            // ── PnL Calculation ───────────────────────────────────────────────
            const exitPrice  = brokerExitPrice;
            const priceDiff  = openTrade.direction === 'LONG'
                ? exitPrice - openTrade.entry_price
                : openTrade.entry_price - exitPrice;

            let pnl: number;
            if (isFX) {
                // FX: priceDiff * units (OANDA units already in base currency)
                const isJPY = exitPrice > 50;
                pnl = isJPY
                    ? (priceDiff * openTrade.size) / exitPrice
                    : priceDiff * openTrade.size;
            } else {
                // Equities / crypto: simple price diff * shares
                pnl = priceDiff * openTrade.size;
            }

            const status    = pnl >= 0 ? 'WIN' : 'LOSS';
            const exitDate  = new Date().toISOString();
            const entryTime = new Date(openTrade.entry_date).getTime();
            const durationMinutes = (Date.now() - entryTime) / 60000;

            db.prepare(`
                UPDATE trades
                SET exit_price = ?, exit_date = ?, status = ?, pnl = ?, notes = ?
                WHERE id = ?
            `).run(exitPrice, exitDate, status, pnl, `Closed by signal: ${signal.notes || 'Auto-exit'}`, openTrade.id);

            const broker = (isFX && OANDA_ENABLED)
                ? 'OANDA Practice'
                : (brokerEnvironment === 'LIVE' ? 'Alpaca Live' : (ALPACA_ENABLED || this.userAlpacaClient ? 'Alpaca Paper' : 'Paper Only'));

            console.log(`[Executor] Trade Closed: ${openTrade.symbol} PnL: $${pnl.toFixed(2)} (${status})`);

            // ── Discord: trade closed ─────────────────────────────────────────
            notifyTradeClosed({
                symbol:          openTrade.symbol,
                direction:       openTrade.direction,
                entryPrice:      openTrade.entry_price,
                exitPrice,
                pnl,
                status:          status as 'WIN' | 'LOSS' | 'BE',
                strategy:        openTrade.strategy,
                broker,
                durationMinutes,
            }).catch(() => {});

            // ── Professor grades the trade (with intel attribution) ──────────
            // Parse intel snapshot stored at trade entry
            let intelSnapshot = null;
            try {
                if (openTrade.intel_snapshot) {
                    intelSnapshot = typeof openTrade.intel_snapshot === 'string'
                        ? JSON.parse(openTrade.intel_snapshot)
                        : openTrade.intel_snapshot;
                }
            } catch { /* Malformed snapshot — grade without it */ }

            const review = TheProfessor.gradeTrade('TradingView Webhook', {
                ticker:           openTrade.symbol,
                entry:            openTrade.entry_price,
                exit:             exitPrice,
                stop_loss:        signal.stopLoss ?? (openTrade.direction === 'LONG'
                    ? openTrade.entry_price * 0.99
                    : openTrade.entry_price * 1.01),
                type:             openTrade.direction === 'LONG' ? 'DEMAND' : 'SUPPLY',
                pnl,
                duration_minutes: durationMinutes,
                intel_snapshot:   intelSnapshot,
            });

            console.log(`[Professor] Grade: ${review.grade} — ${review.critique}`);

            // ── Discord: Professor grade ──────────────────────────────────────
            notifyProfessorGrade({
                target_agent: 'TradingView Webhook',
                grade:        review.grade,
                observation:  review.observation,
                critique:     review.critique,
                action_item:  review.action_item,
                symbol:       openTrade.symbol,
                pnl,
            }).catch(() => {});

            // ── Cloud Sync ────────────────────────────────────────────────────
            if (CLOUD_SYNC_ENABLED && cloudDb) {
                update(ref(cloudDb, `trades/${openTrade.id}`), {
                    exit_price: exitPrice, exit_date: exitDate, status, pnl,
                    notes: `Closed by signal: ${signal.notes || 'Auto-exit'}`,
                }).catch(e => console.error('[Firebase]', e));
            }

        } catch (error: any) {
            console.error(`[Executor] Failed to close trade:`, error);
            notifySystemAlert(`Trade close failed for ${signal.symbol}: ${error.message}`, 'error').catch(() => {});
        }
    }
}
