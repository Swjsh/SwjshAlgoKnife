// ═══════════════════════════════════════════════════════════════
// API ROUTE: /api/intel/calendar
// Returns live economic calendar state for UI and trade gating
//
// GET  /api/intel/calendar          → Full CalendarState
// GET  /api/intel/calendar?symbol=X → Symbol-specific recommendation
// POST /api/intel/calendar          → Force refresh from ForexFactory
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
    getCalendarState,
    getSymbolRecommendation,
    forceRefresh,
    startCalendarEngine,
    getTodayHighImpact,
    getEventsWithinMinutes,
} from '@/lib/intel/econ/calendar';

// Lazily start engine on first API hit (server-side singleton)
let engineStarted = false;

async function ensureEngine() {
    if (!engineStarted) {
        engineStarted = true;
        // Non-blocking start — don't await, let the first fetch run async
        startCalendarEngine().catch(err => {
            console.error('[CalendarRoute] Engine start failed:', err);
        });
        // Give it 2s to load before we return stale state
        await new Promise(r => setTimeout(r, 2000));
    }
}

// ─── GET /api/intel/calendar ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        await ensureEngine();

        const { searchParams } = new URL(req.url);
        const symbol = searchParams.get('symbol');
        const view   = searchParams.get('view');  // 'high' | 'next1h' | 'today' | 'full'

        // Symbol-specific recommendation
        if (symbol) {
            const rec = getSymbolRecommendation(symbol.toUpperCase());
            return NextResponse.json({ symbol: symbol.toUpperCase(), ...rec });
        }

        const state = getCalendarState();

        // Filtered views
        if (view === 'high') {
            return NextResponse.json({
                events: getTodayHighImpact(),
                source: state.source,
                lastFetched: state.lastFetched,
            });
        }

        if (view === 'next1h') {
            return NextResponse.json({
                events: getEventsWithinMinutes(60),
                source: state.source,
                lastFetched: state.lastFetched,
            });
        }

        if (view === 'today') {
            return NextResponse.json({
                events: state.todayEvents,
                activeWindows: state.activeWindows,
                nextEvent: state.nextEvent,
                minutesUntilNext: state.minutesUntilNext,
                overallRecommendation: state.overallRecommendation,
                source: state.source,
                lastFetched: state.lastFetched,
            });
        }

        // Full state (default)
        return NextResponse.json({
            // Today's schedule
            todayEvents: state.todayEvents,
            // Upcoming 24h
            upcomingEvents: state.upcomingEvents,
            // Active blackout / warning windows
            activeWindows: state.activeWindows,
            // Next scheduled event
            nextEvent: state.nextEvent,
            minutesUntilNext: state.minutesUntilNext === Infinity ? null : Math.round(state.minutesUntilNext),
            // Current fleet-wide recommendation
            overallRecommendation: state.overallRecommendation,
            // Data quality
            source: state.source,
            lastFetched: state.lastFetched,
            // Summary stats
            stats: {
                totalToday:     state.todayEvents.length,
                highImpactToday: state.todayEvents.filter(e => e.impact === 'HIGH').length,
                activeWindows:  state.activeWindows.length,
                inBlackout:     ['NO_TRADE', 'HOLD_NEW'].includes(state.overallRecommendation),
            },
        });
    } catch (err: any) {
        console.error('[CalendarRoute] GET error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ─── POST /api/intel/calendar (force refresh) ─────────────────────────────────

export async function POST(_req: NextRequest) {
    try {
        await ensureEngine();
        const state = await forceRefresh();
        return NextResponse.json({
            success: true,
            message: `Calendar refreshed — ${state.weekEvents.length} events loaded`,
            source: state.source,
            lastFetched: state.lastFetched,
            todayCount: state.todayEvents.length,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
