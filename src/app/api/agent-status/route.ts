
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const agentStatus = {
    last_updated: new Date().toISOString(),
    status: 'ACTIVE',
    active_pairs: 5,
    total_zones_found: 2,
    performance: {
        win_rate: 68,
        total_pnl: 1245.50,
        trades: 12
    },
    pending_orders: [
        {
            created_at: '2025-12-31 16:00:00',
            type: 'DEMAND',
            ticker: 'EURUSD',
            entry: 1.16632,
            stop_loss: 1.16527,
            status: 'PENDING'
        },
        {
            created_at: '2025-12-31 13:00:00',
            type: 'SUPPLY',
            ticker: 'USDCAD',
            entry: 1.39270,
            stop_loss: 1.39520,
            status: 'PENDING'
        }
    ],
    closed_trades: [
        {
            closed_at: '2025-12-31 10:15:00',
            type: 'DEMAND',
            ticker: 'GBPUSD',
            entry: 1.2540,
            exit: 1.2590,
            pnl: 450.00,
            status: 'WIN'
        },
        {
            closed_at: '2025-12-30 14:30:00',
            type: 'SUPPLY',
            ticker: 'USDJPY',
            entry: 148.50,
            exit: 148.80,
            pnl: -210.00,
            status: 'LOSS'
        },
        {
            closed_at: '2025-12-30 09:00:00',
            type: 'DEMAND',
            ticker: 'AUDUSD',
            entry: 0.6540,
            exit: 0.6580,
            pnl: 320.00,
            status: 'WIN'
        }
    ]
};

export async function GET() {
    return NextResponse.json(agentStatus);
}
