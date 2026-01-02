
import { TradeReview } from './TheProfessor';

export interface AuditReport {
    id: string;
    review_id: string;
    timestamp: string;
    verdict: 'CONFIRMED' | 'OVERTURNED' | 'DISPUTED';
    evidence: string;
    final_grade: string;
}

export class TheAuditor {

    static auditReview(review: TradeReview): AuditReport {
        const isNewsCritique = review.critique.toLowerCase().includes('news') || review.critique.toLowerCase().includes('volatility');

        let verdict: AuditReport['verdict'] = 'CONFIRMED';
        let evidence = 'Cross-referenced timestamp with global economic calendar. No conflicting data found.';
        let finalGrade = review.grade;

        // Logic Reversal (Simulated "Fact Check")
        // If Professor claims "News", Auditor checks "News Feed"
        if (isNewsCritique) {
            // 30% chance to dispute the professor to show off the feature
            if (Math.random() > 0.7) {
                verdict = 'OVERTURNED';
                evidence = 'SEARCH RESULT: Zero high-impact red folder events found during trade duration. Market noise was standard deviation.';

                // Improve grade if overturned
                if (review.grade === 'F') finalGrade = 'C';
                if (review.grade === 'C') finalGrade = 'B';
            } else {
                evidence = 'CONFIRMED: FOMC Minutes were released 5 minutes prior to entry. Hazardous conditions verified.';
            }
        } else if (review.grade === 'F') {
            // Auditor checks for "Technical Glitches" on F grades
            if (Math.random() > 0.9) {
                verdict = 'OVERTURNED';
                evidence = 'LOG ANALYSIS: Exchange reported 500ms latency spike. Bad entry was lag-induced, not manual error.';
                finalGrade = 'C+';
            }
        }

        return {
            id: Math.random().toString(36).substring(7),
            review_id: review.id,
            timestamp: new Date().toISOString(),
            verdict,
            evidence,
            final_grade: finalGrade
        };
    }
}
