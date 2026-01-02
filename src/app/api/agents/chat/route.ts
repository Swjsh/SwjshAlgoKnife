
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const logPath = path.join(process.cwd(), 'data', 'agent_logs.json');

    // Base personas (matching the scripts)
    const personas: any = {
        'fx': { name: 'Swjsh FX', avatar: '/avatars/fx.png' },
        'crypto': { name: 'Bitcoin Bob', avatar: '/avatars/crypto.png' },
        'spx': { name: 'SPX Sniper', avatar: '/avatars/spx.png' },
        'futures': { name: 'Pivot Pete', avatar: '/avatars/futures.png' }
    };

    try {
        let logs = [];
        if (fs.existsSync(logPath)) {
            logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        }

        // Attach persona info to each log message
        const enrichedLogs = logs.map((log: any) => ({
            ...log,
            persona: personas[log.agentId] || { name: 'Unknown Agent', avatar: '/avatars/fx.png' }
        }));

        return NextResponse.json(enrichedLogs);
    } catch (error) {
        console.error('Error reading agent logs:', error);
        return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
    }
}
