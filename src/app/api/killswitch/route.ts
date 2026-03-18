import { NextRequest, NextResponse } from 'next/server';
import { KillSwitch } from '@/lib/engine/risk/KillSwitch';
import { withApiHandler, auditLog, apiLog } from '@/lib/api-utils';

/**
 * KillSwitch API Routes
 *
 * POST /api/killswitch - Triggers or resets global emergency halt (requires auth)
 * GET /api/killswitch - Gets current KillSwitch state (requires auth)
 */

export const POST = withApiHandler(
  {
    requireAuth: true,
    rateLimit: { max: 10, windowSeconds: 60 },
    maxBodySize: 4096,
  },
  async ({ user, req }) => {
    try {
      const body = await req.json();
      const { action, agentId, reason } = body;

      // Validate action
      if (!action || !['trigger', 'reset'].includes(action)) {
        apiLog('warn', '/api/killswitch', 'Invalid action', {
          userId: user?.id,
          action,
        });
        return NextResponse.json(
          { error: 'Invalid action. Use "trigger" or "reset".' },
          { status: 400 }
        );
      }

      if (action === 'trigger') {
        if (agentId === 'global' || !agentId) {
          // Global halt
          KillSwitch.globalHalt(reason || 'Manual emergency halt triggered');

          apiLog('info', '/api/killswitch', 'Global KillSwitch activated', {
            userId: user?.id,
            reason: reason || 'Manual emergency halt triggered',
          });

          await auditLog(
            user!.id,
            'killswitch.global.trigger',
            'KillSwitch',
            null,
            'SUCCESS',
            req,
            { reason: reason || 'Manual emergency halt triggered' }
          );

          return NextResponse.json({
            success: true,
            message: 'Global KillSwitch activated',
            isActive: true,
          });
        } else {
          // Agent-specific halt
          KillSwitch.trigger(agentId, reason || 'Manual halt', 'MANUAL');

          apiLog('info', '/api/killswitch', 'Agent KillSwitch activated', {
            userId: user?.id,
            agentId,
            reason: reason || 'Manual halt',
          });

          await auditLog(
            user!.id,
            'killswitch.agent.trigger',
            'KillSwitch',
            agentId,
            'SUCCESS',
            req,
            { agentId, reason: reason || 'Manual halt' }
          );

          return NextResponse.json({
            success: true,
            message: `KillSwitch activated for ${agentId}`,
            agentId,
            isActive: true,
          });
        }
      } else if (action === 'reset') {
        if (agentId === 'global' || !agentId) {
          // Reset global halt
          KillSwitch.resetGlobalHalt();

          apiLog('info', '/api/killswitch', 'Global KillSwitch reset', {
            userId: user?.id,
          });

          await auditLog(
            user!.id,
            'killswitch.global.reset',
            'KillSwitch',
            null,
            'SUCCESS',
            req,
            { action: 'reset', scope: 'global' }
          );

          return NextResponse.json({
            success: true,
            message: 'Global KillSwitch reset',
            isActive: false,
          });
        } else {
          // Reset agent-specific halt
          KillSwitch.reset(agentId, reason || 'Manual reset');

          apiLog('info', '/api/killswitch', 'Agent KillSwitch reset', {
            userId: user?.id,
            agentId,
          });

          await auditLog(
            user!.id,
            'killswitch.agent.reset',
            'KillSwitch',
            agentId,
            'SUCCESS',
            req,
            { agentId, reason: reason || 'Manual reset' }
          );

          return NextResponse.json({
            success: true,
            message: `KillSwitch reset for ${agentId}`,
            agentId,
            isActive: false,
          });
        }
      }

      // Should not reach here due to action validation above
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      apiLog('error', '/api/killswitch', 'KillSwitch API error', {
        userId: user?.id,
        error: errorMsg,
      });

      await auditLog(
        user!.id,
        'killswitch.error',
        'KillSwitch',
        null,
        'FAILURE',
        req,
        { error: errorMsg }
      );

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);

export const GET = withApiHandler(
  {
    requireAuth: true,
    rateLimit: { max: 60, windowSeconds: 60 },
  },
  async ({ user, req }) => {
    try {
      const { searchParams } = new URL(req.url);
      const agentId = searchParams.get('agentId');

      if (agentId) {
        // Get agent-specific state
        const state = KillSwitch.getState(agentId);
        const isTriggered = KillSwitch.isTriggered(agentId);

        apiLog('info', '/api/killswitch', 'Agent KillSwitch status requested', {
          userId: user?.id,
          agentId,
          isTriggered,
        });

        return NextResponse.json({
          agentId,
          ...state,
          isTriggered,
        });
      } else {
        // Get global state
        const isGlobalHaltActive = KillSwitch.isGlobalHaltActive();

        apiLog('info', '/api/killswitch', 'Global KillSwitch status requested', {
          userId: user?.id,
          isGlobalHaltActive,
        });

        return NextResponse.json({
          isGlobalHaltActive,
          message: isGlobalHaltActive ? 'Global halt is active' : 'System operational',
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      apiLog('error', '/api/killswitch', 'KillSwitch status error', {
        userId: user?.id,
        error: errorMsg,
      });

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);
