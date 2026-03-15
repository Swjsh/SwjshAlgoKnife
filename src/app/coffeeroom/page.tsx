'use client';

import React, { useState, useEffect } from 'react';
import {
    BookOpen, GraduationCap, Calendar, Coffee, Star,
    TrendingUp, AlertTriangle, CheckCircle, Clock,
    Zap, ChevronRight, ChevronLeft, AlertCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface ProfessorReview {
    trade_id?: string;
    agent?: string;
    grade?: string;
    summary?: string;
    homework?: string;
    timestamp?: string;
}

// ── Platform Tips ─────────────────────────────────────────────────────────────
const PLATFORM_TIPS = [
    {
        category: 'AGENTS',
        tag: 'ORB RUNNER',
        tagColor: '#06b6d4',
        title: 'How the Opening Range Breakout Works',
        body: 'ORB Runner watches the 15-minute window from 9:30–9:45 AM ET and locks the high and low as the "Opening Range." A close above the ORB High = long signal; below ORB Low = short. The NeverStoppedOut variant adds wide-range detection — if MNQ range exceeds 400pts, it flips to inverse mode (trades the range instead of the breakout). 15-min lockout enforced after every trade.',
    },
    {
        category: 'STRATEGY',
        tag: 'STERLING · FOREX',
        tagColor: '#a855f7',
        title: 'Sterling\'s Supply & Demand Zone Logic',
        body: 'Sterling builds a top-down map: Weekly → Daily → 4H → 1H → 30m. It only marks "fresh" zones — untested areas where institutions left pending orders. A zone that price has already returned to once is weakened. Entry is always a limit order at the zone edge (never market), stop below the base, targeting the next opposing zone. Minimum 1:3 RR required before any entry fires.',
    },
    {
        category: 'RISK',
        tag: 'RISK MGMT',
        tagColor: '#f59e0b',
        title: 'The 2-Consecutive-Loss Rule (Pivot Pete)',
        body: 'After two back-to-back losing trades, Pete hard-stops for the session. This isn\'t a soft suggestion — it\'s a coded shutoff. Research consistently shows decision quality degrades 30-40% after consecutive losses due to cortisol-driven cognition shifts. The system resets at the next session open. You can override it in Settings → Risk, but you\'ll owe The Professor an explanation.',
    },
    {
        category: 'PLATFORM',
        tag: 'PLATFORM GUIDE',
        tagColor: '#06b6d4',
        title: 'Reading the Agent Terminal',
        body: 'The Agents page streams live stdout from each Python subprocess. Green "ACTIVE" = scanning markets. The status badge cycles: WAITING → SIGNAL → TRADE. The chat panel lets you query any agent in natural language ("What setup are you watching on ES right now?"). Agent state — including all grades from The Professor — persists in agents_db.json between sessions.',
    },
    {
        category: 'STRATEGY',
        tag: 'BOBA · OPTIONS',
        tagColor: '#10b981',
        title: 'How Boba Reads Options Flow',
        body: 'Boba scans for unusual options prints: large block trades, sweep orders hitting multiple exchanges simultaneously, and IV spikes that precede price moves. The key divergence signal: smart money buying puts while price continues up = distribution. A valid Boba setup requires both flow confirmation AND a technical structure (S/R level, VWAP, or zone) at entry.',
    },
    {
        category: 'STRATEGY',
        tag: 'SPX SNIPER · 0DTE',
        tagColor: '#ef4444',
        title: 'SPX Sniper\'s 0DTE Mechanics',
        body: '0DTE options have maximum theta decay after 2 PM ET — every minute of hold time costs premium. Sniper uses VWAP as the trend filter (no longs below, no shorts above), then waits for a momentum burst (3+ consecutive ticks in one direction) as the entry trigger. Hold time is typically 30 seconds to 5 minutes. Hard cutoff at 3:30 PM ET — after that, spreads widen and you\'re fighting market maker pricing.',
    },
    {
        category: 'PLATFORM',
        tag: 'INTEL HUB',
        tagColor: '#a855f7',
        title: 'Using the Intel Hub for Context',
        body: 'The Intel Hub aggregates macro signals, sector rotation, and economic event context into a confidence-scored feed. Each item has a 0–100 confidence score. The Professor cross-references these when grading trades — if Intel was high-confidence bearish and you took a long, expect a note in your grade. Check Intel before each session, not after.',
    },
    {
        category: 'RISK',
        tag: 'POSITION SIZING',
        tagColor: '#f59e0b',
        title: 'The Position Sizing Formula',
        body: 'Formula: Position Size = (Account Balance × Risk%) ÷ Stop Distance. Example: $10,000 account, 1% risk, 20-point stop on ES = $100 ÷ $50/contract = 2 contracts max. The system calculates this automatically using your Settings → Account values (ACCOUNT_BALANCE and RISK_PER_TRADE). Manual overrides bypass this math and are logged for The Professor\'s review.',
    },
];

// ── Agent Quick-Reference Cards ───────────────────────────────────────────────
const AGENT_GUIDES = [
    {
        name: 'ORB Runner',
        market: 'MNQ FUTURES',
        color: '#06b6d4',
        status: 'ACTIVE',
        rules: [
            'Wait for 9:30–9:45 AM ORB formation',
            'Enter breakout or retest of ORB high/low',
            '15-min lockout enforced after each trade',
            'Walk away 3–10 min after entry — no micromanaging',
        ],
    },
    {
        name: 'Sterling',
        market: 'FOREX MAJORS',
        color: '#a855f7',
        status: 'ACTIVE',
        rules: [
            'Weekly → Daily → 4H top-down analysis only',
            'Fresh S&D zones only — no stale revisits',
            'Limit orders at zone edge, not market orders',
            'Minimum 1:3 RR — skip anything below',
        ],
    },
    {
        name: 'Pivot Pete',
        market: 'ES / NQ / GC',
        color: '#f59e0b',
        status: 'ACTIVE',
        rules: [
            'Wait for price at Monthly/Weekly/Daily pivot level',
            'Volume confirmation required before entry',
            '2 consecutive losses = session ends, no exceptions',
            'Target the next pivot level, not arbitrary TP',
        ],
    },
    {
        name: 'Boba',
        market: 'OPTIONS FLOW',
        color: '#10b981',
        status: 'ACTIVE',
        rules: [
            'Unusual flow (sweeps / blocks) must appear first',
            'Check IV context — expanding or collapsing?',
            'Never buy premium into expiration without catalyst',
            'Flow confirmation + technical level = full signal',
        ],
    },
    {
        name: 'SPX Sniper',
        market: 'SPX 0DTE',
        color: '#ef4444',
        status: 'ACTIVE',
        rules: [
            'VWAP = trend filter, no trades against it',
            'Momentum burst = 3+ ticks in direction = entry',
            'Hold time: seconds to 5 minutes maximum',
            'Hard stop: no new entries after 3:30 PM ET',
        ],
    },
    {
        name: 'Bitcoin Bob',
        market: 'CRYPTO',
        color: '#f97316',
        status: 'ACTIVE',
        rules: [
            'Volume profile at major historical S/R levels',
            'Watch for liquidation cascade setups',
            'Daily bias first — then 4H/1H entry refinement',
            'BTC dominance as sector rotation filter',
        ],
    },
];

// ── Upcoming Events (current week, high-impact only) ─────────────────────────
const UPCOMING_EVENTS = [
    { date: 'MON MAR 16', time: '8:30 AM', name: 'Empire State Mfg Index', impact: 'medium', note: 'NY manufacturing sentiment' },
    { date: 'TUE MAR 17', time: '8:30 AM', name: 'Retail Sales m/m', impact: 'high', note: 'Consumer spending — major mover' },
    { date: 'TUE MAR 17', time: '9:15 AM', name: 'Industrial Production', impact: 'medium', note: 'Factory output gauge' },
    { date: 'WED MAR 18', time: '2:00 PM', name: 'FOMC Rate Decision', impact: 'critical', note: 'All agents pause — high vol expected' },
    { date: 'WED MAR 18', time: '2:30 PM', name: 'Fed Press Conference', impact: 'critical', note: 'Powell speaks — SPX vol spike' },
    { date: 'THU MAR 19', time: '8:30 AM', name: 'Initial Jobless Claims', impact: 'medium', note: 'Weekly labor market check' },
    { date: 'FRI MAR 20', time: 'ALL DAY', name: 'Quad Witching Expiry', impact: 'high', note: 'Options/futures expiry — elevated vol' },
];

// ── Standing Lessons from The Professor ──────────────────────────────────────
const STANDING_LESSONS = [
    {
        grade: 'RULE',
        gradeColor: '#06b6d4',
        agent: 'ALL AGENTS',
        title: 'The First 5 Minutes Are Not For Trading',
        lesson: 'Every session opens with noise. Market makers are filling overnight orders, stops are being hunted, and the first candle is almost always deceptive. ORB Runner waits until 9:45 — not arbitrarily, but because 15 years of data shows the first 15 minutes are statistical garbage for directional bias. Patience at the open is a skill, not a personality trait.',
        homework: 'If you feel the urge to fade the open gap or jump in at 9:31, step away from the keyboard for exactly 15 minutes.',
    },
    {
        grade: 'DOCTRINE',
        gradeColor: '#a855f7',
        agent: 'STERLING · FOREX',
        title: 'A Zone You\'ve Already Visited Is a Tourist Trap',
        lesson: 'Supply and Demand zones operate on the logic of unfilled institutional orders. Once price returns to a zone and rejects, some of those orders are absorbed. A second visit faces 30-40% less institutional defense. Sterling is specifically tuned to skip "visited" zones. If you\'re manually trading and wonder why a Sterling-identified level didn\'t hold on revisit — now you know.',
        homework: 'Pull up your last 10 Forex trades. Were any entries at second-visit zones? Calculate win rate: fresh zones vs revisited.',
    },
    {
        grade: 'WARNING',
        gradeColor: '#f59e0b',
        agent: 'PIVOT PETE',
        title: 'The 2-Loss Rule Exists Because You Will Disagree With It',
        lesson: 'After two consecutive losses, your prefrontal cortex steps down and your amygdala steps up. You "know" the next trade will win. You see patterns that aren\'t there. Pete\'s session shutoff fires before your cognition catches up. The rule is not a suggestion — it is the lock on the gun cabinet, applied by someone who isn\'t in the emotional state you\'re currently in.',
        homework: 'Review your historical trade log. Find every losing streak that extended past 2. Count how many trades 3, 4, and 5 were profitable. The data is instructive.',
    },
    {
        grade: 'LESSON',
        gradeColor: '#ef4444',
        agent: 'SPX SNIPER',
        title: '0DTE After 3:30 PM ET Is Speculation, Not Trading',
        lesson: 'Theta decay in 0DTE options becomes exponential after 3:30 PM. The bid-ask spread widens. Market makers know you want a print before expiry and price that desperation into the premium. Any edge you identified in the morning setup is eroded by the cost of carry in the final hour. Sniper\'s hard cutoff at 3:30 is protecting your P&L from your impatience.',
        homework: 'Locate any 0DTE trades taken after 3:30 PM in your journal. Calculate the spread cost as a percentage of the trade\'s maximum potential profit.',
    },
];

// ── Pre-market Checklist ──────────────────────────────────────────────────────
const PRE_MARKET_CHECKLIST = [
    'Agents reporting ACTIVE — no crashed or stuck processes in terminal',
    'agents_db.json state is clean — no stale SIGNAL or TRADE locks from last session',
    'Daily P&L limit not already hit — system will self-halt if breached',
    'FOMC / NFP / CPI today? Confirm agents are aware and will pause during blackout',
    'Review The Professor\'s last batch of grades — any system-wide patterns flagged?',
    'No manual overrides left on from yesterday — risk params back to defaults',
];

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
    page:       { minHeight: '100vh', background: 'hsl(222 47% 11%)', color: 'white', padding: '28px 28px', fontFamily: 'inherit' },
    hero:       { textAlign: 'center', marginBottom: 36, paddingTop: 10 },
    heroIcon:   { fontSize: 40, marginBottom: 12 },
    heroTitle:  { fontSize: 26, fontWeight: 800, letterSpacing: '0.06em', marginBottom: 6 },
    heroSub:    { fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' },

    sectionLabel: { fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.14em', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, marginTop: 28 },

    panel:      { borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px 22px' },
    panelTitle: { fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase',
                  marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 },

    grid2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 0, alignItems: 'start' },
    grid3:      { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 0, alignItems: 'start' },

    // Professor
    profCard:   { borderRadius: 14, padding: '24px 26px', marginBottom: 14, position: 'relative', overflow: 'hidden' },
    profBadge:  { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6,
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 10 },
    profAgent:  { fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginBottom: 6, fontFamily: 'monospace' },
    profTitle:  { fontSize: 15, fontWeight: 700, marginBottom: 10, lineHeight: 1.35 },
    profBody:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.65 },
    profHW:     { marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                  border: '1px dashed rgba(255,255,255,0.1)', fontSize: 12, color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.5 },
    profNavBtn: { padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600 },

    // Events
    eventRow:   { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)' },
    eventDate:  { fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', minWidth: 52, letterSpacing: '0.04em', paddingTop: 2 },
    eventTime:  { fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', minWidth: 54, paddingTop: 1 },
    eventName:  { fontSize: 12, fontWeight: 600, marginBottom: 2 },
    eventNote:  { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

    // Tips
    tipCard:    { borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  padding: '18px 20px', display: 'flex', flexDirection: 'column' },
    tipTag:     { display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 9, fontWeight: 800,
                  letterSpacing: '0.1em', marginBottom: 8 },
    tipTitle:   { fontSize: 13, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 },
    tipBody:    { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 },

    // Agent guide cards
    agentCard:  { borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  padding: '16px 18px' },
    agentName:  { fontSize: 13, fontWeight: 700, marginBottom: 2 },
    agentMkt:   { fontSize: 9, letterSpacing: '0.1em', fontWeight: 700, marginBottom: 12 },
    agentRule:  { display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5 },
    agentDot:   { width: 4, height: 4, borderRadius: '50%', marginTop: 5, flexShrink: 0 },
    agentRuleTxt: { fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 },

    // Checklist
    checkRow:   { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer' },
    checkbox:   { width: 15, height: 15, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.2)',
                  flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    checkLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 },
    checkDone:  { fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'line-through', lineHeight: 1.4 },

    // Stats
    statRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)' },
    statLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
    statVal:    { fontSize: 13, fontWeight: 700, fontFamily: 'monospace' },

    // Focus timer
    timerDisp:  { fontSize: 36, fontFamily: 'monospace', fontWeight: 800, color: '#06b6d4', textAlign: 'center',
                  letterSpacing: '0.05em', marginBottom: 4 },
    timerLbl:   { fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', letterSpacing: '0.1em', marginBottom: 12 },
    timerRow:   { display: 'flex', gap: 6, justifyContent: 'center' },
    timerBtn:   { padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(6,182,212,0.25)',
                  background: 'rgba(6,182,212,0.1)', color: '#06b6d4', cursor: 'pointer', fontSize: 11, fontWeight: 700 },
    timerBtnAlt:{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11 },

    // Note
    textarea:   { width: '100%', minHeight: 90, padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 12, resize: 'vertical',
                  outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' },
    saveBtn:    { marginTop: 8, padding: '7px 16px', borderRadius: 7, background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer', fontSize: 11, fontWeight: 700 },
};

// ── Impact badge config ───────────────────────────────────────────────────────
function impactBadge(impact: string) {
    switch (impact) {
        case 'critical': return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', label: '⚡ CRITICAL' };
        case 'high':     return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: '● HIGH' };
        case 'medium':   return { color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)', label: '○ MEDIUM' };
        default:         return { color: 'rgba(255,255,255,0.3)', bg: 'transparent', border: 'rgba(255,255,255,0.1)', label: '· LOW' };
    }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CoffeeroomPage() {
    const [lessonIdx,    setLessonIdx]    = useState(0);
    const [tipIdx,       setTipIdx]       = useState(0);
    const [checks,       setChecks]       = useState<boolean[]>(Array(PRE_MARKET_CHECKLIST.length).fill(false));
    const [note,         setNote]         = useState('');
    const [noteSaved,    setNoteSaved]    = useState(false);
    const [journalCount, setJournalCount] = useState<number | null>(null);
    const [tradeCount,   setTradeCount]   = useState<number | null>(null);
    const [liveReviews,  setLiveReviews]  = useState<ProfessorReview[]>([]);
    const [timerSecs,    setTimerSecs]    = useState(25 * 60);
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerMode,    setTimerMode]    = useState<'work' | 'break'>('work');

    // Fetch data
    useEffect(() => {
        fetch('/api/journal').then(r => r.ok ? r.json() : null).then(d => {
            if (d) {
                setJournalCount((d.entries || []).length);
                setTradeCount((d.trades || []).length);
            }
        }).catch(() => {});

        fetch('/api/agents').then(r => r.ok ? r.json() : null).then(d => {
            if (d?.professor?.reviews?.length) {
                setLiveReviews(d.professor.reviews);
            }
        }).catch(() => {});
    }, []);

    // Pomodoro
    useEffect(() => {
        if (!timerRunning) return;
        const t = setInterval(() => {
            setTimerSecs(s => {
                if (s <= 1) {
                    setTimerRunning(false);
                    const next = timerMode === 'work' ? 'break' : 'work';
                    setTimerMode(next);
                    return next === 'work' ? 25 * 60 : 5 * 60;
                }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [timerRunning, timerMode]);

    const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    const resetTimer = () => { setTimerRunning(false); setTimerSecs(timerMode === 'work' ? 25 * 60 : 5 * 60); };

    const saveNote = async () => {
        if (!note.trim()) return;
        try {
            await fetch('/api/journal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'entry', date: new Date().toISOString().slice(0, 10), mood: 'neutral', notes: note }),
            });
            setNoteSaved(true);
            setTimeout(() => setNoteSaved(false), 2500);
        } catch {}
    };

    // Decide which lesson to show: live reviews first, then standing lessons
    const hasLive  = liveReviews.length > 0;
    const totalLessons = hasLive ? liveReviews.length : STANDING_LESSONS.length;
    const lessonSafe   = lessonIdx % totalLessons;
    const checkedCount = checks.filter(Boolean).length;
    const currentTip   = PLATFORM_TIPS[tipIdx % PLATFORM_TIPS.length];

    return (
        <div style={S.page}>

            {/* ── Hero ───────────────────────────────────────────────────── */}
            <div style={S.hero}>
                <div style={S.heroIcon}>☕</div>
                <div style={S.heroTitle}>COFFEE ROOM</div>
                <div style={S.heroSub}>LEARN · BRIEF · LEVEL UP</div>
            </div>

            {/* ── Professor's Desk ───────────────────────────────────────── */}
            <div style={S.sectionLabel}>
                <GraduationCap size={12} />
                THE PROFESSOR&apos;S DESK
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                    {lessonSafe + 1} / {totalLessons} · {hasLive ? 'LIVE GRADES' : 'STANDING RULES'}
                </span>
            </div>

            {hasLive ? (
                // Live review card
                (() => {
                    const r = liveReviews[lessonSafe];
                    const gradeColor = r.grade?.startsWith('A') ? '#10b981' : r.grade?.startsWith('B') ? '#06b6d4' : r.grade?.startsWith('C') ? '#f59e0b' : '#ef4444';
                    return (
                        <div style={{ ...S.profCard, background: `linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`, border: `1px solid rgba(255,255,255,0.1)` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ ...S.profBadge, background: `rgba(${gradeColor === '#10b981' ? '16,185,129' : gradeColor === '#06b6d4' ? '6,182,212' : gradeColor === '#f59e0b' ? '245,158,11' : '239,68,68'},0.15)`, color: gradeColor, border: `1px solid ${gradeColor}40` }}>
                                    GRADE: {r.grade}
                                </span>
                                {r.agent && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>{r.agent.toUpperCase()}</span>}
                            </div>
                            <div style={S.profBody}>{r.summary}</div>
                            {r.homework && <div style={S.profHW}><span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em' }}>HOMEWORK: </span>{r.homework}</div>}
                            {r.timestamp && <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>{new Date(r.timestamp).toLocaleDateString()}</div>}
                        </div>
                    );
                })()
            ) : (
                // Standing lesson card
                (() => {
                    const l = STANDING_LESSONS[lessonSafe];
                    return (
                        <div style={{ ...S.profCard, background: `linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))`, border: `1px solid rgba(255,255,255,0.1)` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <span style={{ ...S.profBadge, background: `${l.gradeColor}18`, color: l.gradeColor, border: `1px solid ${l.gradeColor}35` }}>
                                    {l.grade}
                                </span>
                                <span style={S.profAgent}>{l.agent}</span>
                            </div>
                            <div style={S.profTitle}>{l.title}</div>
                            <div style={S.profBody}>{l.lesson}</div>
                            <div style={S.profHW}>
                                <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em' }}>HOMEWORK: </span>
                                {l.homework}
                            </div>
                        </div>
                    );
                })()
            )}

            {/* Nav for lessons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                <button style={S.profNavBtn} onClick={() => setLessonIdx(i => (i - 1 + totalLessons) % totalLessons)}>
                    <ChevronLeft size={11} style={{ display: 'inline', marginRight: 3 }} />PREV
                </button>
                <button style={S.profNavBtn} onClick={() => setLessonIdx(i => (i + 1) % totalLessons)}>
                    NEXT<ChevronRight size={11} style={{ display: 'inline', marginLeft: 3 }} />
                </button>
                {[...Array(totalLessons)].map((_, i) => (
                    <div key={i} onClick={() => setLessonIdx(i)}
                        style={{ width: 6, height: 6, borderRadius: '50%', cursor: 'pointer', marginTop: 9, flexShrink: 0,
                                 background: i === lessonSafe ? '#06b6d4' : 'rgba(255,255,255,0.15)' }} />
                ))}
            </div>

            {/* ── Main Grid: Events + Tip ────────────────────────────────── */}
            <div style={S.grid2}>

                {/* Upcoming Events */}
                <div>
                    <div style={S.sectionLabel}>
                        <Calendar size={12} /> THIS WEEK&apos;S EVENTS
                    </div>
                    <div style={S.panel}>
                        {UPCOMING_EVENTS.map((ev, i) => {
                            const imp = impactBadge(ev.impact);
                            return (
                                <div key={i} style={{ ...S.eventRow, borderBottom: i === UPCOMING_EVENTS.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 54, gap: 1 }}>
                                        <span style={{ ...S.eventDate, fontSize: 8 }}>{ev.date}</span>
                                        <span style={{ ...S.eventTime, fontSize: 9 }}>{ev.time}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ ...S.eventName, color: ev.impact === 'critical' ? '#ef4444' : ev.impact === 'high' ? '#f59e0b' : 'rgba(255,255,255,0.85)' }}>
                                            {ev.name}
                                        </div>
                                        <div style={S.eventNote}>{ev.note}</div>
                                    </div>
                                    <div style={{ padding: '2px 7px', borderRadius: 5, background: imp.bg, border: `1px solid ${imp.border}`,
                                                  color: imp.color, fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}>
                                        {imp.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Platform Tip */}
                <div>
                    <div style={S.sectionLabel}>
                        <Zap size={12} /> PLATFORM TIP
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                            {(tipIdx % PLATFORM_TIPS.length) + 1} / {PLATFORM_TIPS.length}
                        </span>
                    </div>
                    <div style={S.tipCard}>
                        <div style={{ ...S.tipTag, background: `${currentTip.tagColor}18`, color: currentTip.tagColor, border: `1px solid ${currentTip.tagColor}30` }}>
                            {currentTip.tag}
                        </div>
                        <div style={S.tipTitle}>{currentTip.title}</div>
                        <div style={S.tipBody}>{currentTip.body}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                            <button style={S.profNavBtn} onClick={() => setTipIdx(i => (i - 1 + PLATFORM_TIPS.length) % PLATFORM_TIPS.length)}>
                                <ChevronLeft size={11} style={{ display: 'inline', marginRight: 2 }} />PREV
                            </button>
                            <button style={S.profNavBtn} onClick={() => setTipIdx(i => (i + 1) % PLATFORM_TIPS.length)}>
                                NEXT<ChevronRight size={11} style={{ display: 'inline', marginLeft: 2 }} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Agent Quick-Reference ─────────────────────────────────── */}
            <div style={S.sectionLabel}>
                <BookOpen size={12} /> AGENT QUICK-REFERENCE
            </div>
            <div style={{ ...S.grid3, marginBottom: 0 }}>
                {AGENT_GUIDES.map(ag => (
                    <div key={ag.name} style={{ ...S.agentCard, borderColor: `${ag.color}20` }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                            <div style={{ ...S.agentName, color: ag.color }}>{ag.name}</div>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', marginBottom: 1 }} />
                        </div>
                        <div style={{ ...S.agentMkt, color: `${ag.color}99` }}>{ag.market}</div>
                        {ag.rules.map((r, i) => (
                            <div key={i} style={S.agentRule}>
                                <div style={{ ...S.agentDot, background: ag.color }} />
                                <div style={S.agentRuleTxt}>{r}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* ── Bottom Row: Checklist | Note | Timer+Stats ─────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginTop: 28, alignItems: 'start' }}>

                {/* Pre-Market Checklist */}
                <div>
                    <div style={S.sectionLabel}>
                        <Star size={12} /> PRE-MARKET CHECKLIST
                        <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace',
                                       color: checkedCount === PRE_MARKET_CHECKLIST.length ? '#10b981' : '#f59e0b' }}>
                            {checkedCount}/{PRE_MARKET_CHECKLIST.length}
                        </span>
                    </div>
                    <div style={S.panel}>
                        {PRE_MARKET_CHECKLIST.map((item, i) => (
                            <div key={i} style={S.checkRow} onClick={() => setChecks(c => { const n = [...c]; n[i] = !n[i]; return n; })}>
                                <div style={{ ...S.checkbox, background: checks[i] ? '#10b981' : 'transparent', borderColor: checks[i] ? '#10b981' : 'rgba(255,255,255,0.18)' }}>
                                    {checks[i] && <span style={{ fontSize: 9, color: 'white' }}>✓</span>}
                                </div>
                                <div style={checks[i] ? S.checkDone : S.checkLabel}>{item}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Note */}
                <div>
                    <div style={S.sectionLabel}><BookOpen size={12} /> QUICK NOTE</div>
                    <div style={S.panel}>
                        <textarea style={S.textarea} placeholder="Log a thought, observation, or setup idea..."
                                  value={note} onChange={e => setNote(e.target.value)} />
                        <button style={S.saveBtn} onClick={saveNote}>
                            {noteSaved ? '✓ SAVED TO JOURNAL' : 'SAVE TO JOURNAL'}
                        </button>
                    </div>
                </div>

                {/* Timer + Stats stacked */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <div style={S.sectionLabel}><Clock size={12} /> FOCUS TIMER</div>
                        <div style={S.panel}>
                            <div style={{ fontSize: 9, textAlign: 'center', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 2,
                                          color: timerMode === 'work' ? '#06b6d4' : '#10b981' }}>
                                {timerMode === 'work' ? 'WORK SESSION' : 'BREAK TIME'}
                            </div>
                            <div style={S.timerDisp}>{fmtTime(timerSecs)}</div>
                            <div style={S.timerLbl}>POMODORO 25 / 5</div>
                            <div style={S.timerRow}>
                                <button style={S.timerBtn} onClick={() => setTimerRunning(r => !r)}>
                                    {timerRunning ? 'PAUSE' : 'START'}
                                </button>
                                <button style={S.timerBtnAlt} onClick={resetTimer}>RESET</button>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div style={S.sectionLabel}><TrendingUp size={12} /> ACTIVITY</div>
                        <div style={S.panel}>
                            <div style={S.statRow}>
                                <div style={S.statLabel}>Journal entries</div>
                                <div style={{ ...S.statVal, color: '#06b6d4' }}>{journalCount ?? '—'}</div>
                            </div>
                            <div style={S.statRow}>
                                <div style={S.statLabel}>Trades logged</div>
                                <div style={{ ...S.statVal, color: '#a855f7' }}>{tradeCount ?? '—'}</div>
                            </div>
                            <div style={S.statRow}>
                                <div style={S.statLabel}>Prof. reviews</div>
                                <div style={{ ...S.statVal, color: liveReviews.length > 0 ? '#10b981' : 'rgba(255,255,255,0.3)' }}>
                                    {liveReviews.length > 0 ? liveReviews.length : '—'}
                                </div>
                            </div>
                            <div style={{ ...S.statRow, borderBottom: 'none' }}>
                                <div style={S.statLabel}>Checklist</div>
                                <div style={{ ...S.statVal, color: checkedCount === PRE_MARKET_CHECKLIST.length ? '#10b981' : '#f59e0b' }}>
                                    {checkedCount === PRE_MARKET_CHECKLIST.length ? 'CLEAR ✓' : `${checkedCount}/${PRE_MARKET_CHECKLIST.length}`}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
}
