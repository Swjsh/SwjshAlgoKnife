#!/usr/bin/env npx tsx
/**
 * Agent Proxy — WebSocket-based agent proxy for overnight research terminals
 *
 * Connects Claude Code terminal sessions to the WebSocket server,
 * enabling bidirectional communication for overnight research.
 *
 * Usage:
 *   npx tsx scripts/agent-proxy.ts \
 *     --agent overnight-improver \
 *     --ws-url ws://localhost:3001 \
 *     --interactive \
 *     --prompt-file ".claude/overnight/terminal_1_prompt.md" \
 *     --init-message "You are the IMPROVER agent..."
 *
 * CLI Arguments:
 *   --agent          Agent identifier (e.g., overnight-improver, overnight-backtester)
 *   --ws-url         WebSocket server URL (default: ws://localhost:3001)
 *   --interactive    Enable stdin/stdout relay mode
 *   --prompt-file    Path to the prompt file to send as initial context
 *   --init-message   Initial message to send after prompt file
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { WebSocket, RawData } from 'ws';

// ============================================================================
// Types
// ============================================================================

interface AgentProxyConfig {
  agent: string;
  wsUrl: string;
  interactive: boolean;
  promptFile: string | null;
  initMessage: string | null;
}

interface WebSocketMessage {
  type: string;
  agent?: string;
  content?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface ProxyState {
  connected: boolean;
  reconnectAttempts: number;
  lastHeartbeat: number;
  terminalNumber: number;
}

// ============================================================================
// Constants
// ============================================================================

const ROOT = process.cwd();
const OVERNIGHT_DIR = path.join(ROOT, '.claude', 'overnight');
const STOP_SIGNAL_FILE = path.join(OVERNIGHT_DIR, 'STOP');

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 30000;
const STOP_CHECK_INTERVAL_MS = 5000;

// ============================================================================
// CLI Argument Parser
// ============================================================================

function parseArgs(argv: string[]): AgentProxyConfig {
  const config: AgentProxyConfig = {
    agent: 'overnight-agent',
    wsUrl: 'ws://localhost:3001',
    interactive: false,
    promptFile: null,
    initMessage: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const nextArg = argv[i + 1];

    switch (arg) {
      case '--agent':
        if (nextArg && !nextArg.startsWith('--')) {
          config.agent = nextArg;
          i++;
        }
        break;
      case '--ws-url':
        if (nextArg && !nextArg.startsWith('--')) {
          config.wsUrl = nextArg;
          i++;
        }
        break;
      case '--interactive':
        config.interactive = true;
        break;
      case '--prompt-file':
        if (nextArg && !nextArg.startsWith('--')) {
          config.promptFile = nextArg;
          i++;
        }
        break;
      case '--init-message':
        if (nextArg && !nextArg.startsWith('--')) {
          config.initMessage = nextArg;
          i++;
        }
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
Agent Proxy - WebSocket relay for overnight research terminals

Usage:
  npx tsx scripts/agent-proxy.ts [options]

Options:
  --agent <name>       Agent identifier (default: overnight-agent)
  --ws-url <url>       WebSocket server URL (default: ws://localhost:3001)
  --interactive        Enable stdin/stdout relay mode
  --prompt-file <path> Path to prompt file to send as initial context
  --init-message <msg> Initial message to send after prompt
  --help, -h           Show this help message

Examples:
  npx tsx scripts/agent-proxy.ts --agent overnight-improver --interactive
  npx tsx scripts/agent-proxy.ts --agent overnight-backtester --prompt-file prompts/backtest.md
`);
}

// ============================================================================
// Logger
// ============================================================================

class Logger {
  private logFile: string;
  private enabled: boolean;

  constructor(terminalNumber: number) {
    this.logFile = path.join(OVERNIGHT_DIR, `terminal_${terminalNumber}_log.txt`);
    this.enabled = true;
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    try {
      if (!fs.existsSync(OVERNIGHT_DIR)) {
        fs.mkdirSync(OVERNIGHT_DIR, { recursive: true });
      }
    } catch {
      this.enabled = false;
    }
  }

  log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}`;

    // Always log to console
    if (level === 'ERROR') {
      console.error(line);
    } else {
      console.log(line);
    }

    // Write to log file
    if (this.enabled) {
      try {
        fs.appendFileSync(this.logFile, line + '\n');
      } catch {
        // Silently fail file writes
      }
    }
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  warn(message: string): void {
    this.log('WARN', message);
  }

  error(message: string): void {
    this.log('ERROR', message);
  }

  debug(message: string): void {
    this.log('DEBUG', message);
  }
}

// ============================================================================
// Terminal Number Extractor
// ============================================================================

function extractTerminalNumber(agentName: string): number {
  // Pattern: overnight-<role>
  // Map roles to terminal numbers
  const roleToTerminal: Record<string, number> = {
    'overnight-improver': 1,
    'overnight-backtester': 2,
    'overnight-researcher': 3,
    'overnight-brain-updater': 4,
    'overnight-security-auditor': 5,
    'overnight-integration-tester': 6,
    'overnight-intel-aggregator': 7,
    'overnight-devops-optimizer': 8,
  };

  // Check for exact match
  const normalizedName = agentName.toLowerCase();
  if (roleToTerminal[normalizedName]) {
    return roleToTerminal[normalizedName];
  }

  // Try to extract number from name
  const match = agentName.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Default to 0 for unknown agents
  return 0;
}

// ============================================================================
// Stop Signal Checker
// ============================================================================

function checkStopSignal(): boolean {
  try {
    return fs.existsSync(STOP_SIGNAL_FILE);
  } catch {
    return false;
  }
}

// ============================================================================
// WebSocket Agent Proxy
// ============================================================================

class AgentProxy {
  private config: AgentProxyConfig;
  private ws: WebSocket | null = null;
  private state: ProxyState;
  private logger: Logger;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stopCheckTimer: NodeJS.Timeout | null = null;
  private rl: readline.Interface | null = null;
  private shuttingDown = false;

  constructor(config: AgentProxyConfig) {
    this.config = config;
    this.state = {
      connected: false,
      reconnectAttempts: 0,
      lastHeartbeat: Date.now(),
      terminalNumber: extractTerminalNumber(config.agent),
    };
    this.logger = new Logger(this.state.terminalNumber);
  }

  async start(): Promise<void> {
    this.logger.info(`Starting Agent Proxy: ${this.config.agent}`);
    this.logger.info(`WebSocket URL: ${this.config.wsUrl}`);
    this.logger.info(`Terminal Number: ${this.state.terminalNumber}`);
    this.logger.info(`Interactive Mode: ${this.config.interactive}`);

    // Setup graceful shutdown handlers
    this.setupShutdownHandlers();

    // Start stop signal checker
    this.startStopChecker();

    // Connect to WebSocket
    await this.connect();

    // Setup interactive mode if enabled
    if (this.config.interactive) {
      this.setupInteractiveMode();
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info('Connecting to WebSocket server...');

      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.on('open', () => {
          this.handleOpen();
          resolve();
        });

        this.ws.on('message', (data: RawData) => {
          this.handleMessage(data);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.handleClose(code, reason.toString());
        });

        this.ws.on('error', (error: Error) => {
          this.handleError(error);
          if (!this.state.connected) {
            reject(error);
          }
        });

        this.ws.on('ping', () => {
          this.ws?.pong();
        });
      } catch (error) {
        this.logger.error(`Failed to create WebSocket: ${error}`);
        reject(error);
      }
    });
  }

  private handleOpen(): void {
    this.state.connected = true;
    this.state.reconnectAttempts = 0;
    this.state.lastHeartbeat = Date.now();
    this.logger.info('Connected to WebSocket server');

    // Send identification message
    this.send({
      type: 'identify',
      agent: this.config.agent,
      timestamp: new Date().toISOString(),
      terminal: this.state.terminalNumber,
    });

    // Start heartbeat
    this.startHeartbeat();

    // Send initial content if provided
    this.sendInitialContent();
  }

  private async sendInitialContent(): Promise<void> {
    // Send prompt file content
    if (this.config.promptFile) {
      try {
        const promptPath = path.isAbsolute(this.config.promptFile)
          ? this.config.promptFile
          : path.join(ROOT, this.config.promptFile);

        if (fs.existsSync(promptPath)) {
          const content = fs.readFileSync(promptPath, 'utf-8');
          this.logger.info(`Sending prompt file: ${promptPath}`);

          this.send({
            type: 'context',
            agent: this.config.agent,
            content: content,
            source: 'prompt-file',
            timestamp: new Date().toISOString(),
          });
        } else {
          this.logger.warn(`Prompt file not found: ${promptPath}`);
        }
      } catch (error) {
        this.logger.error(`Failed to read prompt file: ${error}`);
      }
    }

    // Send init message
    if (this.config.initMessage) {
      // Small delay to ensure prompt file is processed first
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.logger.info('Sending init message');
      this.send({
        type: 'message',
        agent: this.config.agent,
        content: this.config.initMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleMessage(data: RawData): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      this.state.lastHeartbeat = Date.now();

      switch (message.type) {
        case 'heartbeat':
        case 'pong':
          // Heartbeat response, update state
          break;

        case 'message':
        case 'response':
          // Output to stdout for interactive relay
          if (message.content) {
            console.log(message.content);
          }
          break;

        case 'command':
          this.handleCommand(message);
          break;

        case 'error':
          this.logger.error(`Server error: ${message.content || 'Unknown error'}`);
          break;

        case 'permission_request':
          // Auto-approve for overnight sessions (non-destructive)
          this.logger.info(`Permission requested: ${message.content}`);
          this.send({
            type: 'permission_response',
            agent: this.config.agent,
            approved: true,
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          this.logger.debug(`Received message type: ${message.type}`);
      }
    } catch {
      // Non-JSON message, output raw
      console.log(data.toString());
    }
  }

  private handleCommand(message: WebSocketMessage): void {
    const command = message.content?.toLowerCase();

    switch (command) {
      case 'stop':
      case 'shutdown':
        this.logger.info('Received shutdown command');
        this.shutdown();
        break;

      case 'status':
        this.send({
          type: 'status',
          agent: this.config.agent,
          content: JSON.stringify({
            connected: this.state.connected,
            terminal: this.state.terminalNumber,
            uptime: Date.now() - this.state.lastHeartbeat,
          }),
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        this.logger.debug(`Unknown command: ${command}`);
    }
  }

  private handleClose(code: number, reason: string): void {
    this.state.connected = false;
    this.stopHeartbeat();
    this.logger.warn(`WebSocket closed: code=${code}, reason=${reason}`);

    if (!this.shuttingDown) {
      this.attemptReconnect();
    }
  }

  private handleError(error: Error): void {
    this.logger.error(`WebSocket error: ${error.message}`);
  }

  private attemptReconnect(): void {
    if (this.state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Exiting.`);
      this.shutdown(1);
      return;
    }

    if (checkStopSignal()) {
      this.logger.info('Stop signal detected. Skipping reconnection.');
      this.shutdown();
      return;
    }

    this.state.reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this.state.reconnectAttempts - 1);
    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.state.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.logger.error(`Reconnection failed: ${error}`);
        this.attemptReconnect();
      }
    }, delay);
  }

  private send(message: WebSocketMessage): void {
    if (this.ws && this.state.connected) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.logger.error(`Failed to send message: ${error}`);
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.state.connected) {
        this.send({
          type: 'heartbeat',
          agent: this.config.agent,
          timestamp: new Date().toISOString(),
        });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startStopChecker(): void {
    this.stopCheckTimer = setInterval(() => {
      if (checkStopSignal()) {
        this.logger.info('Stop signal detected. Initiating graceful shutdown.');
        this.shutdown();
      }
    }, STOP_CHECK_INTERVAL_MS);
  }

  private stopStopChecker(): void {
    if (this.stopCheckTimer) {
      clearInterval(this.stopCheckTimer);
      this.stopCheckTimer = null;
    }
  }

  private setupInteractiveMode(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on('line', (line: string) => {
      if (!line.trim()) return;

      // Check for special commands
      if (line.startsWith('/')) {
        this.handleLocalCommand(line);
        return;
      }

      // Send as message to WebSocket
      this.send({
        type: 'message',
        agent: this.config.agent,
        content: line,
        timestamp: new Date().toISOString(),
      });
    });

    this.rl.on('close', () => {
      this.logger.info('Stdin closed');
      this.shutdown();
    });
  }

  private handleLocalCommand(command: string): void {
    const cmd = command.slice(1).toLowerCase().trim();

    switch (cmd) {
      case 'quit':
      case 'exit':
        this.shutdown();
        break;

      case 'status':
        console.log(`Agent: ${this.config.agent}`);
        console.log(`Connected: ${this.state.connected}`);
        console.log(`Terminal: ${this.state.terminalNumber}`);
        console.log(`Reconnect Attempts: ${this.state.reconnectAttempts}`);
        break;

      case 'reconnect':
        this.ws?.close();
        break;

      case 'help':
        console.log('Local commands:');
        console.log('  /quit, /exit - Shutdown the proxy');
        console.log('  /status - Show connection status');
        console.log('  /reconnect - Force reconnection');
        console.log('  /help - Show this help');
        break;

      default:
        console.log(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  }

  private setupShutdownHandlers(): void {
    const gracefulShutdown = (signal: string) => {
      this.logger.info(`Received ${signal}. Shutting down...`);
      this.shutdown();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  private shutdown(exitCode: number = 0): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    this.logger.info('Shutting down Agent Proxy...');

    // Stop timers
    this.stopHeartbeat();
    this.stopStopChecker();

    // Send disconnect message
    if (this.state.connected) {
      this.send({
        type: 'disconnect',
        agent: this.config.agent,
        timestamp: new Date().toISOString(),
      });
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Agent shutdown');
    }

    // Close readline
    if (this.rl) {
      this.rl.close();
    }

    this.logger.info('Agent Proxy shutdown complete');

    // Give time for final log writes
    setTimeout(() => {
      process.exit(exitCode);
    }, 100);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs(process.argv);

  console.log('========================================');
  console.log('  Agent Proxy for Overnight Research');
  console.log('========================================');
  console.log(`Agent: ${config.agent}`);
  console.log(`WebSocket: ${config.wsUrl}`);
  console.log('========================================\n');

  const proxy = new AgentProxy(config);

  try {
    await proxy.start();
  } catch (error) {
    console.error(`Failed to start Agent Proxy: ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
