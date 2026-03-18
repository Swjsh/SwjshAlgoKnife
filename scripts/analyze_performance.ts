import fs from 'fs';
import path from 'path';

const INPUT_FILE = 'C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife\\data\\parsed_trades.json';
const OUTPUT_FILE = 'C:\\Users\\jackw\\Desktop\\SwjshAlgoKnife\\data\\position_analysis.json';

interface ParsedTrade {
    contract: string;
    underlying: string;
    expiry: string;
    type: 'CALL' | 'PUT';
    strike: number;
    side: 'BUY' | 'SELL';
    status: string;
    filledQty: number;
    totalQty: number;
    price: number;
    avgPrice: number;
    placedTime: string;
    filledTime: string;
    year: number;
}

interface Position {
    contract: string;
    underlying: string;
    expiry: string;
    type: 'CALL' | 'PUT';
    strike: number;
    entries: any[];
    exits: any[];
    qtyOpen: number;
    totalQty: number;
    pnl: number;
    entryTime: string;
    exitTime: string | null;
    durationMinutes: number | null;
    isOpen: boolean;
}

function parseDate(dateStr: string): Date {
    // Webull format: 12/31/2021 10:50:57 EST
    // Simple split for now, can use date-fns if needed
    const [datePortion, timePortion, tz] = dateStr.split(' ');
    const [m, d, y] = datePortion.split('/');
    return new Date(`${y}-${m}-${d}T${timePortion}`);
}

function run() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error("Input file not found");
        return;
    }

    const trades: ParsedTrade[] = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

    // Sort by filled time (ascending)
    trades.sort((a, b) => parseDate(a.filledTime).getTime() - parseDate(b.filledTime).getTime());

    const completedPositions: any[] = [];
    const openPositions: Map<string, any[]> = new Map(); // contract -> array of open lots

    for (const trade of trades) {
        const contract = trade.contract;
        const side = trade.side;
        const qty = trade.filledQty;
        const price = trade.avgPrice;

        if (!openPositions.has(contract)) {
            openPositions.set(contract, []);
        }

        const activeLots = openPositions.get(contract)!;

        // Check if this trade closes existing opposite lots
        let remainingQty = qty;

        // Determine if this is an "opening" or "closing" move based on existing holdings
        // For simplicity, we assume FIFO matching
        if (activeLots.length > 0 && activeLots[0].side !== side) {
            // Closing existing position
            while (remainingQty > 0 && activeLots.length > 0) {
                const lot = activeLots[0];
                const matchQty = Math.min(remainingQty, lot.qty);

                // Calculate PnL for this matched lot
                // PnL = (SellPrice - BuyPrice) * Qty * 100
                const buyPrice = side === 'SELL' ? lot.price : price;
                const sellPrice = side === 'SELL' ? price : lot.price;
                const lotPnl = (sellPrice - buyPrice) * matchQty * 100;

                const entryDate = parseDate(lot.time);
                const exitDate = parseDate(trade.filledTime);
                const durationMs = exitDate.getTime() - entryDate.getTime();

                completedPositions.push({
                    contract: contract,
                    underlying: trade.underlying,
                    type: trade.type,
                    strike: trade.strike,
                    expiry: trade.expiry,
                    qty: matchQty,
                    entryPrice: buyPrice,
                    exitPrice: sellPrice,
                    pnl: lotPnl,
                    entryTime: lot.time,
                    exitTime: trade.filledTime,
                    durationMinutes: Math.round(durationMs / 60000),
                    side: lot.side === 'BUY' ? 'LONG' : 'SHORT'
                });

                remainingQty -= matchQty;
                lot.qty -= matchQty;
                if (lot.qty <= 0) {
                    activeLots.shift();
                }
            }
        }

        // If there's still quantity remaining, it opens a new position lot
        if (remainingQty > 0) {
            activeLots.push({
                side: side,
                qty: remainingQty,
                price: price,
                time: trade.filledTime
            });
        }
    }

    // Report Summary
    const stats = {
        totalTrades: completedPositions.length,
        winningTrades: completedPositions.filter(p => p.pnl > 0).length,
        totalPnl: completedPositions.reduce((sum, p) => sum + p.pnl, 0),
        avgDuration: completedPositions.reduce((sum, p) => sum + p.durationMinutes, 0) / completedPositions.length,
    };

    const result = {
        stats,
        positions: completedPositions,
        unclosed: Array.from(openPositions.entries())
            .filter(([_, lots]) => lots.length > 0)
            .map(([contract, lots]) => ({ contract, lots }))
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n--- Analysis Complete ---`);
    console.log(`Total Trades matched: ${stats.totalTrades}`);
    console.log(`Total Realized PnL: $${stats.totalPnl.toFixed(2)}`);
    console.log(`Win Rate: ${((stats.winningTrades / stats.totalTrades) * 100).toFixed(1)}%`);
    console.log(`Avg Hold Time: ${stats.avgDuration.toFixed(1)} minutes`);
    console.log(`Output saved to: ${OUTPUT_FILE}`);
}

run();
