// ═══════════════════════════════════════════════════════════════
// ON-CHAIN CONFLUENCE BRIDGE — Spawns Python on-chain service,
// parses AGENT_STATUS_UPDATE output, publishes to Intel Bus.
// Same pattern as sentiment/bridge.ts
// ═══════════════════════════════════════════════════════════════

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import intelBus from '../bus';
import { notifyIntelSignal } from '../../notifications/discord';
import type { IntelSignal } from '../types';

export class OnChainBridge {
    private process: ChildProcess | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private signalsPublished = 0;
    private restartCount = 0;
    private maxRestarts = 10;

    start(): void {
        console.log('⛓️ [OnChain Bridge] Starting Python on-chain service...');
        this.spawnProcess();

        // Heartbeat every 60s
        this.heartbeatInterval = setInterval(() => {
            intelBus.heartbeat('onchain', this.signalsPublished);
        }, 60 * 1000);

        intelBus.heartbeat('onchain', 0);
    }

    stop(): void {
        if (this.process) {
            this.process.kill('SIGTERM');
            this.process = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        console.log('⛓️ [OnChain Bridge] Stopped.');
    }

    private spawnProcess(): void {
        const scriptPath = path.join(process.cwd(), 'scripts', 'onchain', 'service.py');

        this.process = spawn('python', [scriptPath], {
            cwd: process.cwd(),
            env: { ...process.env },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        // Parse stdout for AGENT_STATUS_UPDATE lines
        let buffer = '';
        this.process.stdout?.on('data', (data: Buffer) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('AGENT_STATUS_UPDATE:')) {
                    this.handleUpdate(line.substring('AGENT_STATUS_UPDATE:'.length));
                } else if (line.trim()) {
                    console.log(`⛓️ [OnChain] ${line.trim()}`);
                }
            }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            if (msg) console.error(`⛓️ [OnChain STDERR] ${msg}`);
        });

        this.process.on('exit', (code) => {
            console.warn(`⛓️ [OnChain] Process exited with code ${code}`);
            if (this.restartCount < this.maxRestarts) {
                this.restartCount++;
                console.log(`⛓️ [OnChain] Restarting in 30s (attempt ${this.restartCount}/${this.maxRestarts})...`);
                setTimeout(() => this.spawnProcess(), 30 * 1000);
            } else {
                console.error('⛓️ [OnChain] Max restarts exceeded. Service stopped.');
            }
        });
    }

    private handleUpdate(json: string): void {
        try {
            const data = JSON.parse(json);

            if (data.type === 'HEARTBEAT') {
                return;
            }

            if (data.source && data.symbol && data.direction) {
                const signal: IntelSignal = {
                    source: data.source,
                    symbol: data.symbol,
                    direction: data.direction,
                    confidence: data.confidence || 0.5,
                    summary: data.summary || '',
                    payload: data.payload || {},
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
            }
        } catch (e) {
            console.error('[OnChain Bridge] Failed to parse update:', e);
        }
    }
}
