// ═══════════════════════════════════════════════════════════════
// SENTIMENT BRIDGE — Spawns Python sentiment service,
// parses AGENT_STATUS_UPDATE output, publishes to Intel Bus.
// Same pattern as agent_runner.ts Python process management.
// ═══════════════════════════════════════════════════════════════

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import intelBus from '../bus';
import { notifyIntelSignal } from '../../notifications/discord';
import type { IntelSignal } from '../types';

export class SentimentBridge {
    private process: ChildProcess | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private signalsPublished = 0;
    private restartCount = 0;
    private maxRestarts = 10;

    start(): void {
        console.log('📰 [Sentiment Bridge] Starting Python sentiment service...');
        this.spawnProcess();

        // Heartbeat every 60s
        this.heartbeatInterval = setInterval(() => {
            intelBus.heartbeat('sentiment', this.signalsPublished);
        }, 60 * 1000);

        intelBus.heartbeat('sentiment', 0);
    }

    stop(): void {
        if (this.process) {
            this.process.kill('SIGTERM');
            this.process = null;
        }
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        console.log('📰 [Sentiment Bridge] Stopped.');
    }

    private spawnProcess(): void {
        const scriptPath = path.join(process.cwd(), 'scripts', 'sentiment', 'service.py');

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
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('AGENT_STATUS_UPDATE:')) {
                    this.handleUpdate(line.substring('AGENT_STATUS_UPDATE:'.length));
                } else if (line.trim()) {
                    console.log(`📰 [Sentiment] ${line.trim()}`);
                }
            }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            if (msg) console.error(`📰 [Sentiment STDERR] ${msg}`);
        });

        this.process.on('exit', (code) => {
            console.warn(`📰 [Sentiment] Process exited with code ${code}`);
            if (this.restartCount < this.maxRestarts) {
                this.restartCount++;
                console.log(`📰 [Sentiment] Restarting in 30s (attempt ${this.restartCount}/${this.maxRestarts})...`);
                setTimeout(() => this.spawnProcess(), 30 * 1000);
            } else {
                console.error('📰 [Sentiment] Max restarts exceeded. Service stopped.');
            }
        });
    }

    private handleUpdate(json: string): void {
        try {
            const data = JSON.parse(json);

            // Heartbeat messages
            if (data.type === 'HEARTBEAT') {
                return;
            }

            // Intel signals
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
            console.error('[Sentiment Bridge] Failed to parse update:', e);
        }
    }
}
