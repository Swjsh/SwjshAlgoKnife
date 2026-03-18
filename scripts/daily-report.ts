/**
 * Ce's Daily Report Generator
 * 
 * Queries OANDA account, today's trades from SQLite,
 * grades ungraded trades, outputs clean report.
 * 
 * Usage: npx tsx scripts/daily-report.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { OandaClient } from '../src/lib/broker/oanda';
import { TheProfessor, TradeData } from '../src/lib/engine/local_runner/TheProfessor';
import { TheAuditor } from '../src/lib/engine/local_runner/TheAuditor';

const Database = require('better-sqlite3');
const DB_PATH = path.join(process.cwd(), 'agent-trades.db');

async function generateReport(): Promise<string> {
  const lines: string[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  lines.push(`═══════════════════════════════════════════`);
  lines.push(`  Ce's Daily Trading Report`);
  lines.push(`  ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push(`═══════════════════════════════════════════\n`);

  // ─── OANDA Account Summary ──────────────────────────────
  try {
    const oanda = OandaClient.fromEnv();
    const summary = await oanda.getAccountSummary();

    lines.push(`📊 ACCOUNT SUMMARY`);
    lines.push(`  Balance:         $${summary.balance.toFixed(2)}`);
    lines.push(`  NAV:             $${summary.NAV.toFixed(2)}`);
    lines.push(`  Unrealized P&L:  $${summary.unrealizedPL.toFixed(2)}`);
    lines.push(`  Margin Used:     $${summary.marginUsed.toFixed(2)}`);
    lines.push(`  Margin Avail:    $${summary.marginAvailable.toFixed(2)}`);
    lines.push(`  Open Trades:     ${summary.openTradeCount}`);
    lines.push('');
  } catch (e: any) {
    lines.push(`⚠️ Could not fetch OANDA account: ${e.message}\n`);
  }

  // ─── Today's Trades from SQLite ─────────────────────────
  let db: any;
  try {
    db = new Database(DB_PATH, { readonly: false });
  } catch (e) {
    lines.push(`⚠️ No trade database found at ${DB_PATH}`);
    lines.push(`  Run the agent first to create it.\n`);
    return lines.join('\n');
  }

  try {
    const todayTrades = db.prepare(`
      SELECT * FROM agent_trades WHERE date(entry_time) = ? ORDER BY entry_time
    `).all(today);

    // Grade any ungraded trades
    const ungraded = todayTrades.filter((t: any) => !t.grade && t.status !== 'OPEN');
    for (const t of ungraded) {
      const tradeData: TradeData = {
        ticker: t.ticker,
        entry: t.entry_price,
        exit: t.exit_price,
        stop_loss: t.stop_loss,
        type: t.side === 'LONG' ? 'DEMAND' : 'SUPPLY',
        pnl: t.pnl || 0,
        duration_minutes: t.duration_minutes || 0,
      };
      const review = TheProfessor.gradeTrade('ce-fx-agent', tradeData);
      const audit = TheAuditor.auditReview(review);
      db.prepare(`UPDATE agent_trades SET grade=?, audit_verdict=? WHERE id=?`)
        .run(audit.final_grade, audit.verdict, t.id);
      t.grade = audit.final_grade;
      t.audit_verdict = audit.verdict;
    }

    // Refresh after grading
    const allToday = db.prepare(`
      SELECT * FROM agent_trades WHERE date(entry_time) = ? ORDER BY entry_time
    `).all(today);

    const closed = allToday.filter((t: any) => t.status !== 'OPEN');
    const open = allToday.filter((t: any) => t.status === 'OPEN');
    const wins = closed.filter((t: any) => (t.pnl || 0) > 0);
    const totalPnl = closed.reduce((s: number, t: any) => s + (t.pnl || 0), 0);

    lines.push(`📈 TODAY'S TRADES (${allToday.length} total)`);

    if (allToday.length === 0) {
      lines.push(`  No trades today.\n`);
    } else {
      lines.push(`  Closed: ${closed.length} | Open: ${open.length}`);
      lines.push(`  Wins: ${wins.length} / ${closed.length} (${closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(0) : 0}%)`);
      lines.push(`  Day PnL: $${totalPnl.toFixed(2)}`);
      lines.push('');

      // Trade detail table
      for (const t of allToday) {
        const statusIcon = t.status === 'OPEN' ? '🔵' : (t.pnl || 0) > 0 ? '🟢' : '🔴';
        const pnlStr = t.status === 'OPEN' ? 'open' : `$${(t.pnl || 0).toFixed(2)}`;
        const gradeStr = t.grade || '—';
        lines.push(`  ${statusIcon} ${t.side.padEnd(5)} ${t.ticker} @ ${t.entry_price.toFixed(5)} | ${pnlStr.padStart(10)} | Grade: ${gradeStr}`);
      }
      lines.push('');

      // Grade distribution
      const grades: Record<string, number> = {};
      closed.forEach((t: any) => { if (t.grade) grades[t.grade] = (grades[t.grade] || 0) + 1; });
      if (Object.keys(grades).length > 0) {
        lines.push(`  Grade Distribution: ${Object.entries(grades).sort().map(([g, c]) => `${g}(${c})`).join(' | ')}`);
        lines.push('');
      }
    }

    // ─── Weekly Stats ─────────────────────────────────────
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const weekTrades = db.prepare(`
      SELECT * FROM agent_trades WHERE date(entry_time) >= ? AND status != 'OPEN'
    `).all(weekAgo);

    if (weekTrades.length > 0) {
      const weekPnl = weekTrades.reduce((s: number, t: any) => s + (t.pnl || 0), 0);
      const weekWins = weekTrades.filter((t: any) => (t.pnl || 0) > 0);
      lines.push(`📅 7-DAY STATS`);
      lines.push(`  Trades: ${weekTrades.length} | Win Rate: ${((weekWins.length / weekTrades.length) * 100).toFixed(0)}% | PnL: $${weekPnl.toFixed(2)}`);
      lines.push('');
    }

  } catch (e: any) {
    lines.push(`⚠️ Error querying trades: ${e.message}\n`);
  } finally {
    db?.close();
  }

  lines.push(`═══════════════════════════════════════════`);
  lines.push(`  Generated: ${now.toISOString()}`);
  lines.push(`═══════════════════════════════════════════`);

  return lines.join('\n');
}

async function main() {
  const report = await generateReport();
  console.log(report);
}

main().catch(e => {
  console.error('💥 Report error:', e);
  process.exit(1);
});

export { generateReport };
