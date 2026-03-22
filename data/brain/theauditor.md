# TheAuditor

---
tags: #review #ai #validation
status: 📘 Reference
---

## Overview

**TheAuditor** is a fact-checking system that validates [[TheProfessor]]'s trade reviews for accuracy and consistency.

**Purpose**: Ensure reviews are objective and based on accurate market data.

**File**: `src/lib/engine/local_runner/TheAuditor.ts`

---

## What TheAuditor Does

1. **Verifies market context** - Was the S/R level actually there?
2. **Validates grading logic** - Was the grade appropriate?
3. **Checks for bias** - Is TheProfessor being too harsh/lenient?
4. **Flags inconsistencies** - Same setup, different grades?
5. **Adds audit notes** - Additional observations

---

## Audit Criteria

### Data Accuracy

- Market prices at entry/exit time
- Support/resistance levels existed
- Trend direction was correct
- Volume spike claims verified

### Grading Consistency

- Similar trades graded similarly
- Grade rationale matches evidence
- No unexplained grade variance

### Pattern Detection

- Recurring grading errors
- Systematic bias (too many A's or F's)
- Missing context in reviews

---

## Implementation

```typescript
// src/lib/engine/local_runner/TheAuditor.ts

interface AuditResult {
  review_id: string;
  verified: boolean;
  accuracy_score: number;  // 0-100
  issues: AuditIssue[];
  notes: string[];
  timestamp: string;
}

interface AuditIssue {
  type: 'data_error' | 'grading_error' | 'inconsistency' | 'bias';
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: string;
}

export class TheAuditor {
  async auditReview(
    review: TradeReview,
    trade: Trade,
    historicalData: Bar[]
  ): Promise<AuditResult> {
    const issues: AuditIssue[] = [];
    const notes: string[] = [];

    // 1. Verify market data
    const dataAccuracy = await this.verifyMarketData(trade, historicalData);
    if (!dataAccuracy.valid) {
      issues.push({
        type: 'data_error',
        severity: 'high',
        description: 'Market context data inaccurate',
        evidence: dataAccuracy.details
      });
    }

    // 2. Verify S/R levels existed
    const srValid = this.verifySupportResistance(
      review.marketContext,
      historicalData
    );
    if (!srValid) {
      issues.push({
        type: 'data_error',
        severity: 'medium',
        description: 'Referenced S/R level not found in data',
        evidence: 'No swing point within 0.2% of claimed level'
      });
    }

    // 3. Check grading consistency
    const consistency = await this.checkGradingConsistency(review, trade);
    if (!consistency.consistent) {
      issues.push({
        type: 'inconsistency',
        severity: 'medium',
        description: consistency.reason,
        evidence: consistency.comparisons
      });
    }

    // 4. Check for bias
    const biasCheck = await this.checkBias(review);
    if (biasCheck.biasDetected) {
      issues.push({
        type: 'bias',
        severity: 'low',
        description: biasCheck.biasType,
        evidence: biasCheck.evidence
      });
    }

    // 5. Add observations
    notes.push(...this.generateObservations(review, trade, historicalData));

    // Calculate accuracy score
    const accuracyScore = this.calculateAccuracyScore(issues);

    return {
      review_id: `${review.trade_id}-${review.timestamp}`,
      verified: issues.filter(i => i.severity === 'high').length === 0,
      accuracy_score: accuracyScore,
      issues,
      notes,
      timestamp: new Date().toISOString()
    };
  }

  private async verifyMarketData(trade: Trade, bars: Bar[]): Promise<ValidationResult> {
    // Find bar at entry time
    const entryBar = bars.find(b =>
      Math.abs(new Date(b.timestamp).getTime() - new Date(trade.entry_time).getTime()) < 60000
    );

    if (!entryBar) {
      return { valid: false, details: 'Entry bar not found in data' };
    }

    // Verify price was within bar range
    if (trade.entry_price < entryBar.low || trade.entry_price > entryBar.high) {
      return {
        valid: false,
        details: `Entry price ${trade.entry_price} outside bar range ${entryBar.low}-${entryBar.high}`
      };
    }

    return { valid: true, details: 'Market data verified' };
  }

  private verifySupportResistance(context: MarketContext, bars: Bar[]): boolean {
    // Find swing highs/lows in data
    const swings = this.findSwingPoints(bars);

    // Check if claimed S/R levels exist
    for (const level of context.support_levels || []) {
      const exists = swings.some(s => Math.abs(s.price - level) / level < 0.002);
      if (!exists) return false;
    }

    return true;
  }

  private async checkGradingConsistency(
    review: TradeReview,
    trade: Trade
  ): Promise<ConsistencyResult> {
    // Get similar past trades
    const similarTrades = await this.getSimilarTrades(trade);

    // Compare grades
    for (const similar of similarTrades) {
      const gradeDiff = this.gradeToNumber(review.overall_grade) -
                        this.gradeToNumber(similar.review.overall_grade);

      // If very similar trade but different grade
      if (similar.similarity > 0.9 && Math.abs(gradeDiff) > 1) {
        return {
          consistent: false,
          reason: 'Similar trade graded differently',
          comparisons: `This: ${review.overall_grade}, Similar: ${similar.review.overall_grade}`
        };
      }
    }

    return { consistent: true };
  }

  private async checkBias(review: TradeReview): Promise<BiasResult> {
    // Get recent reviews
    const recentReviews = await this.getRecentReviews(50);

    // Calculate grade distribution
    const gradeCount = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const r of recentReviews) {
      gradeCount[r.overall_grade]++;
    }

    // Check for bias patterns
    const totalReviews = recentReviews.length;
    const aRate = gradeCount.A / totalReviews;
    const fRate = gradeCount.F / totalReviews;

    if (aRate > 0.4) {
      return {
        biasDetected: true,
        biasType: 'positive_bias',
        evidence: `${(aRate * 100).toFixed(0)}% A grades (expected ~20%)`
      };
    }

    if (fRate > 0.3) {
      return {
        biasDetected: true,
        biasType: 'negative_bias',
        evidence: `${(fRate * 100).toFixed(0)}% F grades (expected ~10%)`
      };
    }

    return { biasDetected: false };
  }

  private generateObservations(
    review: TradeReview,
    trade: Trade,
    bars: Bar[]
  ): string[] {
    const observations: string[] = [];

    // Time of day observation
    const hour = new Date(trade.entry_time).getHours();
    if (hour < 10) {
      observations.push('Trade during first 30 minutes - typically higher volatility');
    }

    // Day of week
    const day = new Date(trade.entry_time).getDay();
    if (day === 1) {
      observations.push('Monday trade - watch for weekend gap effects');
    }
    if (day === 5) {
      observations.push('Friday trade - watch for position unwinding');
    }

    // Strategy-specific
    if (trade.strategy === 'ORB' && review.entry_grade === 'A') {
      observations.push('Excellent ORB execution - range was respected');
    }

    return observations;
  }

  private calculateAccuracyScore(issues: AuditIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'high': score -= 30; break;
        case 'medium': score -= 15; break;
        case 'low': score -= 5; break;
      }
    }

    return Math.max(0, score);
  }

  private gradeToNumber(grade: string): number {
    const map = { A: 5, B: 4, C: 3, D: 2, F: 1 };
    return map[grade] || 0;
  }
}
```

---

## Audit Storage

Audits are stored alongside reviews in `agents_db.json`:

```json
{
  "pivot-pete": {
    "reviews": [...],
    "audits": [
      {
        "review_id": "123-2026-03-15T16:00:00Z",
        "verified": true,
        "accuracy_score": 95,
        "issues": [],
        "notes": [
          "Trade during first 30 minutes - typically higher volatility",
          "Good entry timing confirmed by data"
        ],
        "timestamp": "2026-03-15T16:05:00Z"
      }
    ]
  }
}
```

---

## Audit Triggers

Audits run automatically:

1. **After every review** - Immediate verification
2. **Daily batch** - Re-audit all reviews from day
3. **On demand** - Manual trigger via dashboard

---

## Dashboard Integration

Audit results visible in `/agents/[id]`:

- ✅ Verified reviews (green check)
- ⚠️ Issues detected (yellow warning)
- ❌ Failed audit (red X)
- Audit notes expandable
- Accuracy score displayed

---

## Handling Audit Failures

When audit finds issues:

1. **High severity** - Review marked for human inspection
2. **Medium severity** - Note added, review adjusted
3. **Low severity** - Logged for pattern analysis

---

## Related Pages

- [[TheProfessor]] - Trade reviewer
- [[Agent System]] - Where audits are stored
- [[Trade Execution]] - Trades being audited
- [[Data Flow]] - How audit data flows
