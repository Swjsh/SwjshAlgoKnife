// ═══════════════════════════════════════════════════════════════
// WHALE FLOW TRACKER — Pure TypeScript Service
// Tracks large transfers via Etherscan/Whale Alert APIs,
// computes net exchange flows, publishes to Intel Bus,
// and feeds RegimeDetector + KillSwitch.
// ═══════════════════════════════════════════════════════════════

import intelBus from '../bus';
import { notifyIntelSignal } from '../../notifications/discord';
import { RegimeDetector } from '../../engine/risk/RegimeDetector';
import { KillSwitch } from '../../engine/risk/KillSwitch';
import type { IntelSignal } from '../types';
import {
    WhaleTransfer,
    WhaleFlowSnapshot,
    WhaleFlowConfig,
    WhaleFlowType,
    DEFAULT_WHALE_CONFIG,
    KNOWN_EXCHANGE_ADDRESSES,
} from './types';

export class WhaleFlowService {
    private config: WhaleFlowConfig;
    private transfers: WhaleTransfer[] = [];
    private computeTimer: ReturnType<typeof setInterval> | null = null;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private signalsPublished = 0;
    private lastPollBlock = 0;

    constructor(config?: Partial<WhaleFlowConfig>) {
        this.config = { ...DEFAULT_WHALE_CONFIG, ...config };
    }

    start(): void {
        console.log('🐋 [Whale Flow] Starting whale flow tracker...');

        // Initial poll
        this.pollTransfers();

        // Poll for new transfers
        this.pollTimer = setInterval(() => {
            this.pollTransfers();
        }, this.config.pollIntervalMs);

        // Compute snapshots on interval
        this.computeTimer = setInterval(() => {
            this.computeAndPublish();
        }, this.config.computeIntervalMs);

        // Heartbeat every 60s
        this.heartbeatTimer = setInterval(() => {
            intelBus.heartbeat('whale', this.signalsPublished);
        }, 60 * 1000);

        intelBus.heartbeat('whale', 0);
    }

    stop(): void {
        if (this.pollTimer) clearInterval(this.pollTimer);
        if (this.computeTimer) clearInterval(this.computeTimer);
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        console.log('🐋 [Whale Flow] Stopped.');
    }

    /**
     * Poll Etherscan for recent large transfers.
     * Uses the ERC-20 token transfer endpoint for USDT/USDC
     * and normal tx endpoint for large ETH moves.
     */
    private async pollTransfers(): Promise<void> {
        const apiKey = process.env.ETHERSCAN_API_KEY || '';
        const baseUrl = 'https://api.etherscan.io/api';

        try {
            // Poll large ETH transfers from known exchange wallets
            for (const addr of Array.from(KNOWN_EXCHANGE_ADDRESSES).slice(0, 5)) {
                const params = new URLSearchParams({
                    module: 'account',
                    action: 'txlist',
                    address: addr,
                    startblock: String(this.lastPollBlock || 0),
                    endblock: '99999999',
                    sort: 'desc',
                    page: '1',
                    offset: '20',
                    apikey: apiKey,
                });

                const response = await fetch(`${baseUrl}?${params}`, {
                    signal: AbortSignal.timeout(15000),
                });
                const data = await response.json();

                if (data.status === '1' && Array.isArray(data.result)) {
                    for (const tx of data.result) {
                        const valueEth = parseInt(tx.value || '0') / 1e18;
                        // Quick USD estimate (we'll use a rough price)
                        const ethPrice = 3000; // Rough estimate, good enough for threshold
                        const amountUsd = valueEth * ethPrice;

                        if (amountUsd < this.config.minTransferUsd) continue;

                        const fromAddr = (tx.from || '').toLowerCase();
                        const toAddr = (tx.to || '').toLowerCase();

                        const transfer: WhaleTransfer = {
                            hash: tx.hash,
                            chain: 'ETH',
                            from: fromAddr,
                            to: toAddr,
                            token: 'ETH',
                            amountUsd,
                            timestamp: parseInt(tx.timeStamp) * 1000,
                            fromLabel: this.labelAddress(fromAddr),
                            toLabel: this.labelAddress(toAddr),
                            flowType: this.classifyFlow(fromAddr, toAddr),
                        };

                        // Dedup by hash
                        if (!this.transfers.some(t => t.hash === transfer.hash)) {
                            this.transfers.push(transfer);
                        }
                    }

                    // Track latest block
                    if (data.result.length > 0) {
                        const maxBlock = Math.max(...data.result.map((tx: any) => parseInt(tx.blockNumber)));
                        this.lastPollBlock = Math.max(this.lastPollBlock, maxBlock);
                    }
                }

                // Rate limit: 200ms between calls
                await new Promise(r => setTimeout(r, 200));
            }

            // Prune old transfers outside window
            const cutoff = Date.now() - this.config.windowMs;
            this.transfers = this.transfers.filter(t => t.timestamp > cutoff);

            console.log(`🐋 [Whale Flow] ${this.transfers.length} transfers in window`);

        } catch (e: any) {
            console.error(`🐋 [Whale Flow] Poll error: ${e.message}`);
        }
    }

    /**
     * Compute flow snapshot and publish signals if thresholds are met.
     */
    private computeAndPublish(): void {
        if (this.transfers.length === 0) return;

        // Group by token/symbol
        const symbolMap = new Map<string, WhaleTransfer[]>();
        for (const tx of this.transfers) {
            const symbol = this.tokenToSymbol(tx.token);
            const list = symbolMap.get(symbol) || [];
            list.push(tx);
            symbolMap.set(symbol, list);
        }

        for (const [symbol, txs] of symbolMap) {
            const snapshot = this.computeSnapshot(symbol, txs);

            // Feed into RegimeDetector
            RegimeDetector.ingestWhaleFlow(symbol, snapshot.netFlowUsd, snapshot.transferCount);

            // Check panic threshold for kill switch
            if (snapshot.panicScore >= 0.8 && snapshot.inflowUsd >= this.config.panicThresholdUsd) {
                console.log(`🚨 [Whale Flow] PANIC detected: $${(snapshot.inflowUsd / 1e6).toFixed(1)}M flowing to exchanges`);
                KillSwitch.globalHalt(
                    `Whale panic: $${(snapshot.inflowUsd / 1e6).toFixed(1)}M exchange inflow in ${this.config.windowMs / 60000}min`
                );
            }

            // Publish intel signal if threshold met
            if (Math.abs(snapshot.netFlowUsd) >= this.config.signalThresholdUsd) {
                const direction = snapshot.netFlowUsd > 0 ? 'BEARISH' : 'BULLISH';
                const confidence = Math.min(0.9, 0.4 + (Math.abs(snapshot.netFlowUsd) / 50_000_000) * 0.5);

                const signal: IntelSignal = {
                    source: 'WHALE_FLOW',
                    symbol,
                    direction,
                    confidence,
                    summary: `Net ${direction === 'BEARISH' ? 'inflow' : 'outflow'} $${(Math.abs(snapshot.netFlowUsd) / 1e6).toFixed(1)}M (${snapshot.transferCount} txs)`,
                    payload: {
                        netFlowUsd: snapshot.netFlowUsd,
                        inflowUsd: snapshot.inflowUsd,
                        outflowUsd: snapshot.outflowUsd,
                        transferCount: snapshot.transferCount,
                        largestTransferUsd: snapshot.largestTransferUsd,
                        panicScore: snapshot.panicScore,
                    },
                };

                intelBus.publish(signal);
                this.signalsPublished++;

                notifyIntelSignal({
                    source: signal.source,
                    symbol: signal.symbol,
                    direction: signal.direction,
                    confidence: signal.confidence,
                    summary: signal.summary,
                }).catch(() => {});

                console.log(`🐋 [Whale Flow] SIGNAL: ${direction} ${symbol} conf=${confidence.toFixed(2)}`);
            }
        }
    }

    /**
     * Compute a flow snapshot for a given symbol's transfers.
     */
    private computeSnapshot(symbol: string, txs: WhaleTransfer[]): WhaleFlowSnapshot {
        let inflowUsd = 0;
        let outflowUsd = 0;
        let largestTransferUsd = 0;

        for (const tx of txs) {
            if (tx.flowType === 'EXCHANGE_INFLOW') {
                inflowUsd += tx.amountUsd;
            } else if (tx.flowType === 'EXCHANGE_OUTFLOW') {
                outflowUsd += tx.amountUsd;
            }
            largestTransferUsd = Math.max(largestTransferUsd, tx.amountUsd);
        }

        const netFlowUsd = inflowUsd - outflowUsd; // Positive = net inflow (bearish)

        // Panic score: how rapidly are funds flowing to exchanges?
        // Based on inflow velocity and magnitude
        const windowMinutes = this.config.windowMs / 60000;
        const inflowRate = inflowUsd / windowMinutes; // USD/min
        const panicScore = Math.min(1.0, inflowRate / (this.config.panicThresholdUsd / windowMinutes));

        return {
            symbol,
            windowMs: this.config.windowMs,
            netFlowUsd,
            inflowUsd,
            outflowUsd,
            transferCount: txs.length,
            largestTransferUsd,
            panicScore,
            timestamp: Date.now(),
        };
    }

    /**
     * Classify a transfer as exchange inflow, outflow, or whale-to-whale.
     */
    private classifyFlow(from: string, to: string): WhaleFlowType {
        const fromIsExchange = KNOWN_EXCHANGE_ADDRESSES.has(from);
        const toIsExchange = KNOWN_EXCHANGE_ADDRESSES.has(to);

        if (!fromIsExchange && toIsExchange) return 'EXCHANGE_INFLOW';
        if (fromIsExchange && !toIsExchange) return 'EXCHANGE_OUTFLOW';
        if (!fromIsExchange && !toIsExchange) return 'WHALE_TO_WHALE';
        return 'UNKNOWN'; // exchange-to-exchange (internal)
    }

    private labelAddress(addr: string): string {
        if (KNOWN_EXCHANGE_ADDRESSES.has(addr)) return 'Exchange';
        return addr.slice(0, 8) + '...';
    }

    private tokenToSymbol(token: string): string {
        const map: Record<string, string> = {
            ETH: 'ETHUSD',
            BTC: 'BTCUSD',
            SOL: 'SOLUSD',
            USDT: 'STABLECOIN',
            USDC: 'STABLECOIN',
        };
        return map[token.toUpperCase()] || `${token.toUpperCase()}USD`;
    }
}
