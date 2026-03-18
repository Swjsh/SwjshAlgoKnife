
import type { IntelScore } from '../../intel/types';
import { getCalendarState } from '../../intel/econ/calendar';
import type { EconEvent } from '../../intel/econ/types';

export interface TradeReview {
    id: string;
    timestamp: string;
    target_agent: string;
    grade: 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
    observation: string;
    critique: string;
    action_item: string;
    /** Intel attribution: what the intel system said at entry */
    intel_attribution?: {
        score: number;
        sizeMultiplier: number;
        reason: string;
        regime?: string;
        alignment: 'ALIGNED' | 'OPPOSED' | 'NEUTRAL';
        intelCorrect: boolean;
    };
    /** Economic event context during the trade window */
    event_context?: {
        eventsActive: string[];         // Event short titles active during trade
        highImpactDuringTrade: boolean; // Was a HIGH impact event live during trade?
        inBlackout: boolean;            // Was the trade opened in a blackout zone?
        note: string;                   // Summary of event impact on this trade
    };
}

export interface TradeData {
    ticker: string;
    entry: number;
    exit: number;
    stop_loss: number;
    type: 'DEMAND' | 'SUPPLY';
    pnl: number;
    duration_minutes: number;
    /** ISO timestamp of trade entry (used for event window lookup) */
    entry_time?: string;
    /** Intel snapshot captured at trade entry (optional, from intel_snapshot column) */
    intel_snapshot?: IntelScore | null;
}

export class TheProfessor {

    static gradeTrade(agentName: string, trade: TradeData): TradeReview {
        const risk = Math.abs(trade.entry - trade.stop_loss);
        const reward = Math.abs(trade.exit - trade.entry);
        const rr = risk > 0 ? reward / risk : 0;
        const isWin = trade.pnl > 0;

        // Grading Rubric
        let grade: TradeReview['grade'] = 'C';
        let critique = '';
        let actionItem = '';

        if (isWin) {
            if (rr >= 2.0) {
                grade = 'A';
                critique = `Excellent execution. Risk/Reward was ${rr.toFixed(2)}, exceeding the 2.0 gold standard.`;
                actionItem = 'Continue holding specifically for 2R targets.';
            } else if (rr >= 1.0) {
                grade = 'B';
                critique = `Solid win, but profits were cut short. R/R was only ${rr.toFixed(2)}.`;
                actionItem = 'Review exit strategy. Did you panic sell?';
            } else {
                grade = 'C+';
                critique = `Green is green, but this was lucky. R/R was poor (${rr.toFixed(2)}). Sustainable trading requires better math.`;
                actionItem = 'Do not take trades where target is less than 1.5R.';
            }
        } else {
            // Loss Logic
            if (rr >= 2.0) {
                grade = 'B-';
                critique = 'Good attempt. The structure was valid and R/R potential was there. Market just didn\'t agree today.';
                actionItem = 'No changes needed. Trust the probabilities.';
            } else if (trade.duration_minutes < 5) {
                grade = 'F';
                critique = 'Impulsive entry followed by immediate stop out? Smells like FOMO or trying to catch a falling knife.';
                actionItem = 'Mandatory 15-minute cool-down after distinct impulse moves.';
            } else {
                grade = 'C-';
                critique = 'Standard loss. Ensure stop placement wasn\'t too tight.';
                actionItem = 'Review 5m structure for safer stop placement.';
            }
        }

        // Specific Ticker Advice
        if (trade.ticker.includes('BTC') && trade.duration_minutes > 600) {
            critique += ' (Note: Holding Crypto longer than 10h is risky due to volatility)';
        }

        // ═══════════════════════════════════════════════════════════
        // INTEL ATTRIBUTION — Grade the intelligence system's contribution
        // ═══════════════════════════════════════════════════════════
        let intelAttribution: TradeReview['intel_attribution'] = undefined;

        if (trade.intel_snapshot) {
            const snap = trade.intel_snapshot;
            const tradeDirection = trade.type === 'DEMAND' ? 'LONG' : 'SHORT';

            // Was intel aligned with the trade direction?
            const alignment: 'ALIGNED' | 'OPPOSED' | 'NEUTRAL' =
                snap.score > 0.1 && tradeDirection === 'LONG'  ? 'ALIGNED' :
                snap.score < -0.1 && tradeDirection === 'SHORT' ? 'ALIGNED' :
                snap.score > 0.1 && tradeDirection === 'SHORT' ? 'OPPOSED' :
                snap.score < -0.1 && tradeDirection === 'LONG'  ? 'OPPOSED' :
                'NEUTRAL';

            // Did intel's prediction match the outcome?
            const intelCorrect =
                (alignment === 'ALIGNED' && isWin) ||
                (alignment === 'OPPOSED' && !isWin);

            intelAttribution = {
                score: snap.score,
                sizeMultiplier: snap.sizeMultiplier,
                reason: snap.reason,
                alignment,
                intelCorrect,
            };

            // Adjust critique based on intel alignment
            if (alignment === 'OPPOSED' && isWin) {
                critique += ` [INTEL NOTE: Intel was OPPOSED (score: ${snap.score.toFixed(2)}) but trade won — intel may be lagging or wrong here.]`;
                // Grade boost for winning against intel opposition
                if (grade === 'B') grade = 'B+';
                if (grade === 'C+') grade = 'B';
            } else if (alignment === 'ALIGNED' && !isWin) {
                critique += ` [INTEL NOTE: Intel CONFIRMED this direction (score: ${snap.score.toFixed(2)}) but trade lost — intel overconfidence or timing issue.]`;
            } else if (alignment === 'OPPOSED' && !isWin) {
                critique += ` [INTEL NOTE: Intel WARNED against this direction (score: ${snap.score.toFixed(2)}) — should have listened.]`;
                // Grade penalty for ignoring intel warning
                if (grade === 'C-') grade = 'D';
                actionItem += ' Consider respecting intel NO_GO signals.';
            } else if (alignment === 'ALIGNED' && isWin) {
                critique += ` [INTEL: Correctly confirmed ${tradeDirection} (score: ${snap.score.toFixed(2)}).]`;
            }

            // Size multiplier feedback
            if (snap.sizeMultiplier < 1.0 && isWin) {
                critique += ` Size was reduced to ${(snap.sizeMultiplier * 100).toFixed(0)}% — missed profits due to caution.`;
            } else if (snap.sizeMultiplier < 1.0 && !isWin) {
                critique += ` Size was wisely reduced to ${(snap.sizeMultiplier * 100).toFixed(0)}% — limited the damage.`;
            }
        }

        // ═══════════════════════════════════════════════════════════
        // ECONOMIC EVENT CONTEXT — Was this trade caught in an event window?
        // ═══════════════════════════════════════════════════════════
        let eventContext: TradeReview['event_context'] = undefined;

        try {
            const calState = getCalendarState();
            const entryTime = trade.entry_time ? new Date(trade.entry_time) : new Date();
            const exitTime  = new Date(entryTime.getTime() + trade.duration_minutes * 60000);

            // Find events that overlapped the trade window
            const relevantEvents: EconEvent[] = calState.weekEvents.filter(ev => {
                const eventAt = new Date(ev.scheduledAt);
                const blackoutStart = new Date(eventAt.getTime() - ev.blackoutBeforeMin * 60000);
                const blackoutEnd   = new Date(eventAt.getTime() + ev.blackoutAfterMin  * 60000);
                // Did the trade's time window overlap with this event's blackout zone?
                return (
                    ev.affectedSymbols.some(s => trade.ticker.includes(s.replace('USD','')) || trade.ticker.includes(s)) &&
                    entryTime < blackoutEnd && exitTime > blackoutStart
                );
            });

            if (relevantEvents.length > 0) {
                const highImpactEvents = relevantEvents.filter(e => e.impact === 'HIGH');
                const eventNames = relevantEvents.map(e => e.shortTitle);

                // Was the trade opened INSIDE a blackout window?
                const entryInBlackout = relevantEvents.some(ev => {
                    const eventAt = new Date(ev.scheduledAt);
                    const blackoutStart = new Date(eventAt.getTime() - ev.blackoutBeforeMin * 60000);
                    const blackoutEnd   = new Date(eventAt.getTime() + ev.blackoutAfterMin  * 60000);
                    return entryTime >= blackoutStart && entryTime <= blackoutEnd;
                });

                let eventNote = '';
                if (entryInBlackout && !isWin && highImpactEvents.length > 0) {
                    eventNote = `Trade entered during ${highImpactEvents.map(e => e.shortTitle).join(', ')} blackout window. High-impact events distort technical structure — this loss may be partially attributable to news volatility.`;
                    // Soften grade penalty if the event clearly caused the loss
                    if (grade === 'C-') { grade = 'C'; actionItem += ' Do not trade during HIGH-impact event windows.'; }
                    if (grade === 'F')  { grade = 'D'; actionItem += ' FOMC/NFP/CPI events override all technical setups.'; }
                    critique += ` ⚠️ [EVENT: Traded during ${highImpactEvents[0].shortTitle} — a scheduled ${highImpactEvents[0].impact}-impact release.]`;
                } else if (entryInBlackout && isWin && highImpactEvents.length > 0) {
                    eventNote = `Trade entered during ${highImpactEvents.map(e => e.shortTitle).join(', ')} window and WON — but this is high variance, not skill. Technical analysis breaks down during news; this outcome is partially luck.`;
                    // Cap grade — lucky event wins shouldn't get an A
                    if (grade === 'A') { grade = 'B+'; }
                    critique += ` ⚠️ [EVENT: Won during ${highImpactEvents[0].shortTitle} — high-variance event play, not pure technical execution.]`;
                } else if (relevantEvents.length > 0 && !entryInBlackout) {
                    eventNote = `Event (${eventNames.join(', ')}) occurred during the trade's holding period. Entry pre-dated the event — monitor for post-event follow-through.`;
                } else {
                    eventNote = `Trade overlapped with ${eventNames.join(', ')} data window.`;
                }

                eventContext = {
                    eventsActive: eventNames,
                    highImpactDuringTrade: highImpactEvents.length > 0,
                    inBlackout: entryInBlackout,
                    note: eventNote,
                };
            }
        } catch {
            // Calendar may not be initialized yet — skip event context silently
        }

        const review: TradeReview = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            target_agent: agentName,
            grade,
            observation: `${isWin ? 'Won' : 'Lost'} ${trade.ticker} trade ($${trade.pnl.toFixed(2)}).`,
            critique,
            action_item: actionItem,
            intel_attribution: intelAttribution,
            event_context: eventContext,
        };

        // NOTE: This review will be automatically sent to The Auditor for fact-checking
        // The Auditor will verify:
        // - Entry/exit prices match historical data
        // - Market events during trade window
        // - PnL calculation accuracy
        // - Intel attribution accuracy
        // See: scripts/auditor_engine.py for verification logic

        return review;
    }
}
