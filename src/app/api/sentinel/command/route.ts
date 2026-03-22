/**
 * SENTINEL API - Command Endpoint
 *
 * POST /api/sentinel/command - Send commands to SENTINEL
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface CommandRequest {
  command: string;
  target?: string;
  args?: Record<string, unknown>;
}

interface CommandResponse {
  success: boolean;
  command: string;
  result?: unknown;
  error?: string;
  timestamp: string;
}

const VALID_COMMANDS = [
  'status',         // Get current status
  'health-check',   // Trigger immediate health check
  'compliance',     // Run compliance audit
  'reset-breaker',  // Reset a circuit breaker
  'run-playbook',   // Execute a playbook
  'pause',          // Pause SENTINEL monitoring
  'resume',         // Resume SENTINEL monitoring
] as const;

type ValidCommand = typeof VALID_COMMANDS[number];

function loadJsonFile<T>(filePath: string): T | null {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Failed to load ${filePath}:`, error);
  }
  return null;
}

function saveJsonFile(filePath: string, data: unknown): boolean {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Failed to save ${filePath}:`, error);
    return false;
  }
}

async function handleCommand(command: ValidCommand, target?: string, args?: Record<string, unknown>): Promise<CommandResponse> {
  const timestamp = new Date().toISOString();

  switch (command) {
    case 'status': {
      const health = loadJsonFile<{ overallScore: number; severity: string }>('data/sentinel/health-status.json');
      return {
        success: true,
        command,
        result: {
          overallHealth: health?.overallScore ?? 100,
          severity: health?.severity ?? 'GREEN',
          message: 'SENTINEL operational',
        },
        timestamp,
      };
    }

    case 'health-check': {
      // Queue a health check (in real implementation would trigger the checker)
      const commandFile = 'data/sentinel/pending-commands.json';
      const pending = loadJsonFile<{ commands: unknown[] }>(commandFile) || { commands: [] };
      pending.commands.push({ type: 'health-check', requestedAt: timestamp });
      saveJsonFile(commandFile, pending);

      return {
        success: true,
        command,
        result: { message: 'Health check queued' },
        timestamp,
      };
    }

    case 'compliance': {
      // Queue a compliance audit
      const commandFile = 'data/sentinel/pending-commands.json';
      const pending = loadJsonFile<{ commands: unknown[] }>(commandFile) || { commands: [] };
      pending.commands.push({ type: 'compliance', requestedAt: timestamp });
      saveJsonFile(commandFile, pending);

      return {
        success: true,
        command,
        result: { message: 'Compliance audit queued' },
        timestamp,
      };
    }

    case 'reset-breaker': {
      if (!target) {
        return {
          success: false,
          command,
          error: 'Target connection ID required',
          timestamp,
        };
      }

      const breakers = loadJsonFile<{
        breakers: Record<string, { state: string; failureCount: number }>;
      }>('data/sentinel/circuit-breakers.json');

      if (!breakers?.breakers?.[target]) {
        return {
          success: false,
          command,
          error: `Circuit breaker not found: ${target}`,
          timestamp,
        };
      }

      breakers.breakers[target].state = 'closed';
      breakers.breakers[target].failureCount = 0;
      saveJsonFile('data/sentinel/circuit-breakers.json', breakers);

      return {
        success: true,
        command,
        result: {
          connectionId: target,
          newState: 'closed',
          message: `Circuit breaker reset for ${target}`,
        },
        timestamp,
      };
    }

    case 'run-playbook': {
      if (!target) {
        return {
          success: false,
          command,
          error: 'Target playbook name required',
          timestamp,
        };
      }

      const connectionId = args?.connectionId as string;
      if (!connectionId) {
        return {
          success: false,
          command,
          error: 'Connection ID required in args',
          timestamp,
        };
      }

      // Queue playbook execution
      const commandFile = 'data/sentinel/pending-commands.json';
      const pending = loadJsonFile<{ commands: unknown[] }>(commandFile) || { commands: [] };
      pending.commands.push({
        type: 'run-playbook',
        playbook: target,
        connectionId,
        requestedAt: timestamp,
      });
      saveJsonFile(commandFile, pending);

      return {
        success: true,
        command,
        result: {
          playbook: target,
          connectionId,
          message: 'Playbook execution queued',
        },
        timestamp,
      };
    }

    case 'pause': {
      const stateFile = 'data/sentinel/state.json';
      const state = loadJsonFile<{ paused: boolean }>(stateFile) || { paused: false };
      state.paused = true;
      saveJsonFile(stateFile, state);

      return {
        success: true,
        command,
        result: { message: 'SENTINEL monitoring paused' },
        timestamp,
      };
    }

    case 'resume': {
      const stateFile = 'data/sentinel/state.json';
      const state = loadJsonFile<{ paused: boolean }>(stateFile) || { paused: false };
      state.paused = false;
      saveJsonFile(stateFile, state);

      return {
        success: true,
        command,
        result: { message: 'SENTINEL monitoring resumed' },
        timestamp,
      };
    }

    default:
      return {
        success: false,
        command,
        error: `Unknown command: ${command}`,
        timestamp,
      };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as CommandRequest;
    const { command, target, args } = body;

    if (!command) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Command is required',
          validCommands: VALID_COMMANDS,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!VALID_COMMANDS.includes(command as ValidCommand)) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: `Invalid command: ${command}`,
          validCommands: VALID_COMMANDS,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const result = await handleCommand(command as ValidCommand, target, args);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('SENTINEL command error:', error);
    return NextResponse.json(
      {
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Failed to execute command',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
