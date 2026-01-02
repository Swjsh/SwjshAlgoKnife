
export interface TradeReview {
    id: string;
    timestamp: string;
    target_agent: string;
    grade: 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
    observation: string;
    critique: string;
    action_item: string;
}

export interface TradeData {
    ticker: string;
    entry: number;
    exit: number;
    stop_loss: number;
    type: 'DEMAND' | 'SUPPLY';
    pnl: number;
    duration_minutes: number;
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
            if (rr >= 2.0) { // Assuming they AIMED for 2.0 but lost
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

        const review: TradeReview = {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toISOString(),
            target_agent: agentName,
            grade,
            observation: `${isWin ? 'Won' : 'Lost'} ${trade.ticker} trade ($${trade.pnl.toFixed(2)}).`,
            critique,
            action_item: actionItem
        };

        // NOTE: This review will be automatically sent to The Auditor for fact-checking
        // The Auditor will verify:
        // - Entry/exit prices match historical data
        // - Market events during trade window
        // - PnL calculation accuracy
        // See: scripts/auditor_engine.py for verification logic

        return review;
    }
}
