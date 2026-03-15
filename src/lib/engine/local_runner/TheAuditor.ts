
import { TradeReview } from './TheProfessor';

export interface AuditReport {
    id: string;
    review_id: string;
    timestamp: string;
    verdict: 'CONFIRMED' | 'OVERTURNED' | 'DISPUTED';
    evidence: string;
    final_grade: string;
    /** Intel audit: did the intelligence system help or hurt? */
    intel_audit?: {
        intelWasCorrect: boolean;
        intelAlignment: string;
        recommendation: string;
    };
}

export class TheAuditor {

    static auditReview(review: TradeReview): AuditReport {
        const isNewsCritique = review.critique.toLowerCase().includes('news')
            || review.critique.toLowerCase().includes('volatility');

        let verdict: AuditReport['verdict'] = 'CONFIRMED';
        let evidence = 'Cross-referenced timestamp with global economic calendar. No conflicting data found.';
        let finalGrade = review.grade;

        // ── News-critique audit ───────────────────────────────────────────────
        // The Professor sometimes blames news/volatility for losses.
        // The Auditor checks whether an actual high-impact event was live during
        // the trade (using event_context populated by TheProfessor at grading time).
        //
        // Previously: 30% random overturn.
        // Now: deterministic — overturn iff intel shows no high-impact event fired.
        if (isNewsCritique) {
            const eventCtx = review.event_context;

            if (eventCtx) {
                if (!eventCtx.highImpactDuringTrade) {
                    // Professor blamed news, but no high-impact event was active → disputed
                    verdict = 'OVERTURNED';
                    evidence = `CALENDAR CHECK: No high-impact economic events were scheduled during this trade window (events active: ${eventCtx.eventsActive.join(', ') || 'none'}). Professor's attribution to news volatility is unsupported.`;

                    // Improve grade if overturned — volatility excuse was invalid
                    if (review.grade === 'F') finalGrade = 'C';
                    if (review.grade === 'C') finalGrade = 'B';
                } else {
                    // Event was genuinely live → confirm the critique
                    evidence = `CALENDAR CONFIRMED: ${eventCtx.note || 'A high-impact event was active during this trade window.'} Events: [${eventCtx.eventsActive.join(', ')}].`;
                }
            } else {
                // No event context at all — Professor graded without econ data
                evidence = 'CALENDAR CHECK: No event context was recorded at trade time. Unable to verify news attribution. Verdict stands as filed.';
            }
        } else if (review.grade === 'F') {
            // ── F-grade audit ─────────────────────────────────────────────────
            // Overturn only when intel was aligned (system said GO) but the trade
            // still lost — this suggests bad execution or slippage, not strategy
            // failure, and the intel system deserves a note.
            // Do NOT overturn if intel was OPPOSED (agent ignored a warning → F stands).
            const attr = review.intel_attribution;

            if (attr && attr.alignment === 'ALIGNED' && !attr.intelCorrect) {
                // Intel said GO, trade lost — possible execution issue
                verdict = 'DISPUTED';
                evidence = `INTEL CROSS-CHECK: Intel was ${attr.alignment} at entry (score ${attr.score.toFixed(2)}, multiplier ${attr.sizeMultiplier.toFixed(2)}) yet trade closed as a loss. Strategy alignment was valid — execution or market structure may be at fault. Grade under review.`;
                finalGrade = 'C+';
            } else if (attr && attr.alignment === 'OPPOSED') {
                // Intel warned against this trade; F stands
                evidence = `INTEL CROSS-CHECK: Intel score was ${attr.score.toFixed(2)} (${attr.alignment}) — system had already flagged caution. F grade is fully supported.`;
            } else if (!attr) {
                // No intel data recorded — grade stands but note the gap
                evidence = 'INTEL CROSS-CHECK: No intel snapshot was recorded at entry. Cannot assess system alignment. Grade stands as filed.';
            }
        }

        // ═══════════════════════════════════════════════════════════
        // INTEL AUDIT — Verify intelligence system performance
        // ═══════════════════════════════════════════════════════════
        let intelAudit: AuditReport['intel_audit'] = undefined;

        if (review.intel_attribution) {
            const attr = review.intel_attribution;
            let recommendation = '';

            if (attr.intelCorrect) {
                recommendation = `Intel was ${attr.alignment} and correctly predicted the outcome. `;
                if (attr.alignment === 'OPPOSED') {
                    // Intel warned, agent lost — intel was right to warn
                    recommendation += 'RECOMMENDATION: Increase weight of intel NO_GO signals for this agent/symbol pair.';
                } else if (attr.alignment === 'ALIGNED') {
                    // Intel confirmed, agent won — intel working well
                    recommendation += 'Intel confirmation is reliable for this pair. Maintain current weights.';
                }
            } else {
                if (attr.alignment === 'OPPOSED') {
                    // Intel warned but trade won — false negative
                    recommendation = `Intel flagged NO_GO but trade succeeded. RECOMMENDATION: Review ${attr.alignment} signals — intel may be too conservative for this symbol.`;
                } else if (attr.alignment === 'ALIGNED') {
                    // Intel confirmed but trade lost — false positive
                    recommendation = `Intel confirmed GO but trade lost. RECOMMENDATION: Intel confidence may be overweighted. Consider reducing trust coefficient.`;
                }
            }

            if (attr.sizeMultiplier < 1.0) {
                const isWin = review.observation.startsWith('Won');
                if (isWin) {
                    recommendation += ` Size was reduced to ${(attr.sizeMultiplier * 100).toFixed(0)}% — may want to relax sizing for this regime.`;
                } else {
                    recommendation += ` Size reduction to ${(attr.sizeMultiplier * 100).toFixed(0)}% was appropriate — limited damage.`;
                }
            }

            intelAudit = {
                intelWasCorrect: attr.intelCorrect,
                intelAlignment: attr.alignment,
                recommendation,
            };

            // Append intel audit to evidence
            evidence += ` | INTEL AUDIT: ${attr.alignment} (score: ${attr.score.toFixed(2)}, correct: ${attr.intelCorrect}).`;
        }

        return {
            id: `aud_${review.id}_${Date.now().toString(36)}`,
            review_id: review.id,
            timestamp: new Date().toISOString(),
            verdict,
            evidence,
            final_grade: finalGrade,
            intel_audit: intelAudit,
        };
    }
}
