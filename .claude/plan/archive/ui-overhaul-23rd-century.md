# Implementation Plan: SwjshAlgoKnife UI Overhaul — 23rd Century Premium SaaS

## Rollback Point
```bash
# Restore to pre-overhaul state:
git stash pop stash@{0}  # ROLLBACK_POINT: Pre-UI-overhaul 20260322_004555
```

---

## Task Type
- [x] Frontend (Primary)
- [ ] Backend
- [x] Fullstack (UI + API integration for status)

---

## Executive Summary

Transform SwjshAlgoKnife from a functional trading platform into a **premium 23rd-century SaaS product** that feels like mission control for an autonomous trading fleet. Maintain the existing "Voltrex Protocol" dark aesthetic while adding:

1. **Cohesive premium button system** across all pages
2. **Living status indicators** that pulse with real-time state
3. **Animated data transitions** for P&L and metrics
4. **Contextual glow effects** based on performance
5. **Micro-interactions** that delight without distracting

---

## Design Philosophy

**"Cyber-Command Center"** — Every element should feel like it belongs on the bridge of a starship:
- **Purple/Cyan energy lines** flow through the interface
- **Status indicators pulse** like vital signs monitors
- **Numbers animate** like readouts updating in real-time
- **Buttons shimmer** with contained energy, ready to execute
- **Cards glow** based on their performance state (green=profit, red=loss, amber=neutral)

---

## Implementation Steps

### Phase 1: Global Polish (Foundation)
**Files:** `globals.css`, `Sidebar.tsx`, `Header.tsx`

#### Step 1.1: Enhance Global CSS Variables
Add animation timing, glow intensity, and transition curves to `:root`

```css
/* Add to globals.css :root */
--transition-smooth: cubic-bezier(0.16, 1, 0.3, 1);
--glow-intensity: 0.5;
--pulse-duration: 2s;
--shimmer-speed: 3s;
```

#### Step 1.2: Sidebar Status Pulses
Replace static status dots with `PulseIndicator` components

**Current:** Static colored dots
**Target:** Pulsing indicators synced to agent status

```tsx
// Replace in Sidebar.tsx
import { PulseIndicator } from '@/components/UI';

// Status mapping
const statusMap = {
  'running': 'running',
  'paused': 'paused',
  'stopped': 'stopped',
  'error': 'error'
} as const;

<PulseIndicator status={statusMap[agent.status]} size="sm" />
```

---

### Phase 2: Bots Page Premium Upgrade
**Files:** `src/app/bots/page.tsx`, `src/app/bots/Bots.module.css`

#### Step 2.1: Bot Cards with Performance Glow
Wrap each bot card in `SplitBorderPanel` with P&L-based coloring

```tsx
import { SplitBorderPanel, PulseIndicator, CounterAnimation } from '@/components/UI';

<SplitBorderPanel pnl={bot.totalPnl} threshold={100}>
  <div className={styles.botCard}>
    <div className={styles.botHeader}>
      <h3>{bot.name}</h3>
      <PulseIndicator status={mapStatus(bot.status)} />
    </div>
    <div className={styles.pnlDisplay}>
      <CounterAnimation value={bot.totalPnl} prefix="$" />
    </div>
    {/* ... rest of card */}
  </div>
</SplitBorderPanel>
```

#### Step 2.2: Action Buttons
- **Start/Resume:** `ShimmerButton` (green shimmer)
- **Pause:** `MagnetButton` (amber)
- **Stop:** `SpotlightButton` (red spotlight)
- **Configure:** `MagnetButton` (purple)

```tsx
<div className={styles.botActions}>
  {bot.status === 'STOPPED' && (
    <ShimmerButton
      shimmerColor="#10b981"
      onClick={() => controlBot(bot.id, 'start')}
    >
      <Play size={16} /> Start
    </ShimmerButton>
  )}
  {bot.status === 'RUNNING' && (
    <MagnetButton onClick={() => controlBot(bot.id, 'pause')}>
      <Pause size={16} /> Pause
    </MagnetButton>
  )}
  <SpotlightButton
    spotlightColor="rgba(239, 68, 68, 0.3)"
    onClick={() => controlBot(bot.id, 'stop')}
  >
    <Square size={16} /> Stop
  </SpotlightButton>
</div>
```

#### Step 2.3: Create Bot Modal
- Use `GlowHoverCard` for the modal container
- `ShimmerButton` for "Create" CTA
- Form inputs with subtle glow on focus

---

### Phase 3: Brokers Page Connection Flow
**Files:** `src/app/brokers/page.tsx`, `src/app/brokers/Brokers.module.css`

#### Step 3.1: Connection Cards with Status Glow
```tsx
<GlowHoverCard
  glowColor={broker.connectionStatus === 'CONNECTED' ? '#10b981' : '#ef4444'}
  glowIntensity={0.4}
>
  <div className={styles.brokerCard}>
    <PulseIndicator
      status={broker.connectionStatus === 'CONNECTED' ? 'running' : 'error'}
    />
    <span>{broker.label}</span>
    {broker.buyingPower && (
      <CounterAnimation value={broker.buyingPower} prefix="$" />
    )}
  </div>
</GlowHoverCard>
```

#### Step 3.2: Connect Broker Button
```tsx
<EncryptButton
  isLoading={connecting}
  isSuccess={connectionSuccess}
  isError={connectionError}
  loadingText="ESTABLISHING SECURE LINK..."
  successText="CONNECTION ESTABLISHED"
  errorText="CONNECTION FAILED"
  onClick={handleConnect}
>
  Connect {brokerName}
</EncryptButton>
```

---

### Phase 4: Agents Page Fleet Command
**Files:** `src/app/agents/page.tsx`

#### Step 4.1: Agent Status Cards
Each trading agent gets a `GlowHoverCard` with their signature color

```tsx
{TRADING_AGENTS.map(agent => (
  <GlowHoverCard
    key={agent.id}
    glowColor={agent.color}
    glowIntensity={agentStatus[agent.id]?.running ? 0.6 : 0.2}
  >
    <div className={styles.agentCard}>
      <div className={styles.agentHeader}>
        <span className={styles.emoji}>{agent.emoji}</span>
        <h3>{agent.name}</h3>
        <PulseIndicator
          status={agentStatus[agent.id]?.status || 'stopped'}
        />
      </div>

      <div className={styles.agentMetrics}>
        <CounterAnimation
          value={agentStatus[agent.id]?.pnl || 0}
          prefix="$"
        />
        <span className={styles.winRate}>
          {agentStatus[agent.id]?.winRate || 0}% WR
        </span>
      </div>

      <div className={styles.agentActions}>
        <ShimmerButton shimmerColor={agent.color}>
          Deploy
        </ShimmerButton>
      </div>
    </div>
  </GlowHoverCard>
))}
```

---

### Phase 5: Command Center Dashboard
**Files:** `src/app/command-center/page.tsx`

#### Step 5.1: Fleet Status Overview
- Master P&L with large `CounterAnimation`
- Fleet health as `PulseIndicator` grid
- Kill switch as glowing red `ShimmerButton`

```tsx
<div className={styles.fleetPnL}>
  <span className={styles.label}>Fleet P&L</span>
  <CounterAnimation
    value={fleetPnL}
    prefix="$"
    className={styles.heroNumber}
  />
</div>

<div className={styles.fleetStatus}>
  {agents.map(a => (
    <div key={a.id} className={styles.statusDot}>
      <PulseIndicator status={a.status} size="lg" />
      <span>{a.emoji}</span>
    </div>
  ))}
</div>

<ShimmerButton
  shimmerColor="#ef4444"
  className={styles.killSwitch}
  onClick={triggerKillSwitch}
>
  🛑 EMERGENCY KILL SWITCH
</ShimmerButton>
```

---

### Phase 6: Research Lab & Intel Pages
**Files:** `src/app/research-lab/page.tsx`, `src/app/intel/page.tsx`

#### Step 6.1: Insight Cards with Hover Glow
```tsx
<GlowHoverCard glowColor="#06b6d4">
  <div className={styles.insightCard}>
    {/* Research insight content */}
  </div>
</GlowHoverCard>
```

#### Step 6.2: Run Analysis Buttons
```tsx
<EncryptButton
  isLoading={analyzing}
  loadingText="ANALYZING PATTERNS..."
  successText="ANALYSIS COMPLETE"
  onClick={runAnalysis}
>
  Run Analysis
</EncryptButton>
```

---

### Phase 7: Accounts & Settings Pages
**Files:** `src/app/accounts/page.tsx`, `src/app/settings/page.tsx`

#### Step 7.1: Account Balance Cards
```tsx
<SplitBorderPanel pnl={account.todayPnL}>
  <div className={styles.accountCard}>
    <h3>{account.name}</h3>
    <CounterAnimation value={account.balance} prefix="$" />
  </div>
</SplitBorderPanel>
```

#### Step 7.2: Settings Save Buttons
```tsx
<ShimmerButton onClick={saveSettings}>
  Save Configuration
</ShimmerButton>
```

---

### Phase 8: Sign-In & Onboarding Flow
**Files:** `src/app/sign-in/page.tsx`, `src/app/onboarding/**`

#### Step 8.1: Auth Buttons
```tsx
<EncryptButton
  isLoading={signingIn}
  isSuccess={signInSuccess}
  loadingText="AUTHENTICATING..."
  successText="ACCESS GRANTED"
  onClick={handleSignIn}
>
  Sign In
</EncryptButton>
```

#### Step 8.2: Onboarding Progress
Use `PulseIndicator` for step completion status

---

### Phase 9: Polish & Micro-Interactions
**Global enhancements**

#### Step 9.1: Page Transitions
Add framer-motion page transitions in `layout.tsx`

#### Step 9.2: Loading States
Replace spinners with `LoadingSkeleton` + subtle shimmer

#### Step 9.3: Empty States
Add `SplineScene` backgrounds for empty data states

#### Step 9.4: Toast Notifications
Enhance `Toast` component with glow effect on success/error

---

## Key Files to Modify

| File | Operation | Description |
|------|-----------|-------------|
| `src/app/globals.css` | Modify | Add animation timing variables |
| `src/app/bots/page.tsx` | Modify | Integrate all new UI components |
| `src/app/bots/Bots.module.css` | Modify | Update styles for new components |
| `src/app/brokers/page.tsx` | Modify | EncryptButton for connections |
| `src/app/agents/page.tsx` | Modify | Agent cards with glow + pulse |
| `src/app/command-center/page.tsx` | Modify | Fleet dashboard with counters |
| `src/app/accounts/page.tsx` | Modify | Balance cards with borders |
| `src/app/settings/page.tsx` | Modify | ShimmerButton for save |
| `src/app/sign-in/page.tsx` | Modify | Auth flow with EncryptButton |
| `src/components/Layout/Sidebar.tsx` | Modify | PulseIndicator for nav status |
| `src/components/Layout/Header.tsx` | Modify | Subtle enhancements |

---

## Component Usage Summary

| Component | Primary Usage |
|-----------|---------------|
| `ShimmerButton` | Primary CTAs (Connect, Start, Save, Deploy) |
| `MagnetButton` | Secondary actions (Pause, Configure, Edit) |
| `EncryptButton` | Async operations (Connect broker, Sign in, Run analysis) |
| `SpotlightButton` | Tertiary/destructive (Stop, Delete, Cancel) |
| `PulseIndicator` | Status display (Agent status, Connection status) |
| `CounterAnimation` | Numbers that change (P&L, Balance, Win rate) |
| `GlowHoverCard` | Interactive cards (Bot cards, Agent cards, Insights) |
| `SplitBorderPanel` | Performance-colored containers (P&L cards) |

---

## Risks and Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Animation performance on low-end devices | Medium | Use `will-change`, test on throttled CPU |
| Over-animation causing distraction | Medium | Keep animations subtle, respect reduced-motion |
| Inconsistent component usage | Low | Follow usage table strictly |
| Breaking existing functionality | High | Rollback point created, test each page |
| Theme compatibility | Low | All components use CSS variables |

---

## Success Criteria

- [ ] All pages use consistent button types per action category
- [ ] Status indicators pulse across all status displays
- [ ] P&L values animate when updated
- [ ] Bot/Agent cards glow based on performance
- [ ] Connection flows use EncryptButton with loading states
- [ ] No visual regressions on existing pages
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Build compiles without errors

---

## Estimated Effort

| Phase | Complexity | Parallel Agents |
|-------|------------|-----------------|
| Phase 1: Global Polish | Low | 1 |
| Phase 2: Bots Page | Medium | 1 |
| Phase 3: Brokers Page | Medium | 1 |
| Phase 4: Agents Page | Medium | 1 |
| Phase 5: Command Center | Medium | 1 |
| Phase 6: Research/Intel | Low | 1 |
| Phase 7: Accounts/Settings | Low | 1 |
| Phase 8: Auth/Onboarding | Low | 1 |
| Phase 9: Polish | Low | 1 |

**Recommended:** Run Phases 2-4 in parallel (3 agents), then 5-8 in parallel (4 agents)

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)

---

**Plan generated by Claude Opus 4.5**
**Date: 2026-03-22**
