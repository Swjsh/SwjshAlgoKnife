import { NextRequest, NextResponse } from 'next/server';
import { KillSwitch } from '@/lib/engine/risk/KillSwitch';

/**
 * KillSwitch API Routes
 * 
 * POST /api/killswitch/trigger - Triggers global emergency halt
 * POST /api/killswitch/reset - Resets global halt
 * GET /api/killswitch/status - Gets current KillSwitch state
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, agentId, reason } = body;

        if (action === 'trigger') {
            if (agentId === 'global' || !agentId) {
                // Global halt
                KillSwitch.globalHalt(reason || 'Manual emergency halt triggered');
                return NextResponse.json({
                    success: true,
                    message: 'Global KillSwitch activated',
                    isActive: true
                });
            } else {
                // Agent-specific halt
                KillSwitch.trigger(agentId, reason || 'Manual halt', 'MANUAL');
                return NextResponse.json({
                    success: true,
                    message: `KillSwitch activated for ${agentId}`,
                    agentId,
                    isActive: true
                });
            }
        } else if (action === 'reset') {
            if (agentId === 'global' || !agentId) {
                // Reset global halt
                KillSwitch.resetGlobalHalt();
                return NextResponse.json({
                    success: true,
                    message: 'Global KillSwitch reset',
                    isActive: false
                });
            } else {
                // Reset agent-specific halt
                KillSwitch.reset(agentId, reason || 'Manual reset');
                return NextResponse.json({
                    success: true,
                    message: `KillSwitch reset for ${agentId}`,
                    agentId,
                    isActive: false
                });
            }
        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use "trigger" or "reset".' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('KillSwitch API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agentId');

        if (agentId) {
            // Get agent-specific state
            const state = KillSwitch.getState(agentId);
            const isTriggered = KillSwitch.isTriggered(agentId);
            return NextResponse.json({
                agentId,
                ...state,
                isTriggered
            });
        } else {
            // Get global state
            const isGlobalHaltActive = KillSwitch.isGlobalHaltActive();
            return NextResponse.json({
                isGlobalHaltActive,
                message: isGlobalHaltActive ? 'Global halt is active' : 'System operational'
            });
        }
    } catch (error) {
        console.error('KillSwitch status error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
