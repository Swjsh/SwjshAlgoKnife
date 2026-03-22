# TheProfessor

---
tags: #review #ai #trading
status: 📘 Reference
---

## Overview

**TheProfessor** is an AI-powered trade review system that grades completed trades on execution quality.

**Purpose**: Learn from every trade by analyzing what went right/wrong.

**File**: `src/lib/engine/local_runner/TheProfessor.ts`

---

## What TheProfessor Does

1. **Reviews closed trades** - Analyzes entry, exit, and management
2. **Assigns grades** - A, B, C, D, F based on execution quality
3. **Provides feedback** - Specific, actionable improvement suggestions
4. **Tracks patterns** - Identifies recurring mistakes

---

## Grading Criteria

### Entry Quality (30%)

| Grade | Criteria |
|-------|----------|
| A | Perfect entry at S/R, with confirmation |
| B | Good entry, slightly early/late |
| C | Average entry, missed optimal level |
| D | Poor entry, chased price |
| F | Terrible entry, against trend |

### Exit Quality (30%)

| Grade | Criteria |
|-------|----------|
| A | Exited at target or optimized trail |
| B | Good exit, left some profit |
| C | Average exit, took what market gave |
| D | Exited too early or held too long |
| F | Stopped out due to poor management |

### Risk Management (25%)

| Grade | Criteria |
|-------|----------|
| A | Perfect position size, appropriate stop |
| B | Good risk, slightly over/under sized |
| C | Acceptable risk within guidelines |
| D | Oversized or poor stop placement |
| F | Excessive risk, no stop |

### Trade Management (15%)

| Grade | Criteria |
|-------|----------|
| A | Optimal trail, scaled appropriately |
| B | Good management, small improvements possible |
| C | Basic management, followed plan |
| D | Poor management, deviated from plan |
| F | No management, let trade run wild |

---

## Implementation

```typescript
// src/lib/engine/local_runner/TheProfessor.ts

interface TradeReview {
  trade_id: number;
  overall_grade: string;
  entry_grade: string;
  exit_grade: string;
  risk_grade: string;
  management_grade: string;
  feedback: string[];
  lessons: string[];
  timestamp: string;
}

export class TheProfessor {
  async reviewTrade(trade: Trade, marketContext: MarketContext): Promise<TradeReview> {
    const entryGrade = this.gradeEntry(trade, marketContext);
    const exitGrade = this.gradeExit(trade, marketContext);
    const riskGrade = this.gradeRisk(trade);
    const managementGrade = this.gradeManagement(trade);

    const overallGrade = this.calculateOverall(
      entryGrade, exitGrade, riskGrade, managementGrade
    );

    const feedback = this.generateFeedback(trade, {
      entryGrade, exitGrade, riskGrade, managementGrade
    });

    const lessons = this.extractLessons(trade, feedback);

    return {
      trade_id: trade.id,
      overall_grade: overallGrade,
      entry_grade: entryGrade,
      exit_grade: exitGrade,
      risk_grade: riskGrade,
      management_grade: managementGrade,
      feedback,
      lessons,
      timestamp: new Date().toISOString()
    };
  }

  private gradeEntry(trade: Trade, context: MarketContext): string {
    const entryPrice = trade.entry_price;

    // Check if entry was at S/R level
    const nearSupport = context.support_levels.some(s =>
      Math.abs(entryPrice - s) / s < 0.002
    );
    const nearResistance = context.resistance_levels.some(r =>
      Math.abs(entryPrice - r) / r < 0.002
    );

    // Check trend alignment
    const withTrend = (trade.side === 'long' && context.trend === 'bullish') ||
                      (trade.side === 'short' && context.trend === 'bearish');

    // Score
    let score = 70;  // Base C grade
    if (nearSupport || nearResistance) score += 15;
    if (withTrend) score += 10;
    if (context.volume_spike) score += 5;

    return this.scoreToGrade(score);
  }

  private gradeExit(trade: Trade, context: MarketContext): string {
    if (!trade.exit_price) return 'N/A';

    const pnlPercent = (trade.exit_price - trade.entry_price) / trade.entry_price * 100;

    // Compare to potential move
    const potentialMove = context.high_of_day - context.low_of_day;
    const capturedMove = Math.abs(trade.exit_price - trade.entry_price);
    const captureRatio = capturedMove / potentialMove;

    let score = 60;
    if (pnlPercent > 0) score += 20;  // Profitable
    if (captureRatio > 0.5) score += 10;  // Captured half the move
    if (captureRatio > 0.8) score += 10;  // Captured most of move
    if (trade.exit_price === trade.takeProfit) score += 10;  // Hit target

    return this.scoreToGrade(score);
  }

  private gradeRisk(trade: Trade): string {
    // Check position size vs account
    const accountBalance = 10000;  // Would be dynamic
    const positionValue = trade.entry_price * trade.quantity;
    const positionPercent = positionValue / accountBalance * 100;

    let score = 70;

    // Ideal: 5-10% of account per position
    if (positionPercent >= 5 && positionPercent <= 10) score += 20;
    if (positionPercent > 20) score -= 30;  // Oversized

    // Check stop loss
    if (trade.stopLoss) {
      const stopDistance = Math.abs(trade.entry_price - trade.stopLoss) / trade.entry_price * 100;
      if (stopDistance >= 0.5 && stopDistance <= 2) score += 10;  // Reasonable stop
    } else {
      score -= 20;  // No stop = bad
    }

    return this.scoreToGrade(score);
  }

  private generateFeedback(trade: Trade, grades: Grades): string[] {
    const feedback: string[] = [];

    if (grades.entryGrade === 'A' || grades.entryGrade === 'B') {
      feedback.push('Entry was well-timed at a key level.');
    } else if (grades.entryGrade === 'D' || grades.entryGrade === 'F') {
      feedback.push('Entry appeared to chase price. Wait for pullbacks to support/resistance.');
    }

    if (trade.pnl && trade.pnl > 0) {
      feedback.push(`Profitable trade: +$${trade.pnl.toFixed(2)}`);
    } else if (trade.pnl && trade.pnl < 0) {
      feedback.push(`Loss of $${Math.abs(trade.pnl).toFixed(2)}. Review stop placement.`);
    }

    return feedback;
  }

  private extractLessons(trade: Trade, feedback: string[]): string[] {
    const lessons: string[] = [];

    // Pattern-based lessons
    if (trade.pnl < 0 && !trade.stopLoss) {
      lessons.push('Always set a stop-loss before entering.');
    }

    if (trade.strategy === 'ORB' && trade.entry_time.includes('09:')) {
      lessons.push('ORB entries in first 15 minutes are higher risk.');
    }

    return lessons;
  }

  private scoreToGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}
```

---

## Review Storage

Reviews are stored in `agents_db.json` under each agent:

```json
{
  "pivot-pete": {
    "reviews": [
      {
        "trade_id": 123,
        "overall_grade": "B",
        "entry_grade": "A",
        "exit_grade": "B",
        "risk_grade": "B",
        "management_grade": "C",
        "feedback": [
          "Entry was well-timed at support level",
          "Exited slightly early - could have captured more"
        ],
        "lessons": [
          "Consider trailing stop instead of fixed target"
        ],
        "timestamp": "2026-03-15T16:00:00Z"
      }
    ]
  }
}
```

---

## Dashboard Integration

Navigate to `/agents/[id]` to see trade reviews:

- Recent trade grades (A-F)
- Feedback per trade
- Patterns across trades
- Improvement suggestions

---

## Audit by TheAuditor

After TheProfessor grades, [[TheAuditor]] fact-checks:

1. Verifies market context was accurate
2. Confirms grading logic was applied correctly
3. Flags inconsistencies or errors
4. Adds audit notes to review

---

## Related Pages

- [[TheAuditor]] - Fact-checks reviews
- [[Agent System]] - Where reviews are stored
- [[Trade Execution]] - Trades being reviewed
- [[Pivot Pete]] - Example agent with reviews
