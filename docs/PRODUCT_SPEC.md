# Product Specification: Swjsh Algo Knife (AK)
**Version:** 1.0.0  
**Status:** Implementation / Beta  
**Purpose:** Autonomous Intelligence Trading Terminal & Agent Deployment Hub

---

## 1. Product Overview
Swjsh Algo Knife is a high-performance, agent-centric trading terminal designed for emotionless algorithmic execution across Forex, Crypto, and Index (SPX 0DTE) markets. It blends "Engineered Precision" with a premium "SaaS Template" aesthetic to provide professional-grade market monitoring and trade management.

---

## 2. Core Functional Requirements

### 2.1 Identity & Access Management
- **Authentication**: Firebase Auth integration.
- **Methods**: Google Sign-In and Secure Email/Password.
- **Protected Routes**: Middleware enforcement for dashboard access.
- **Multi-Tenancy**: User-specific strategy configurations and trade history.

### 2.2 Dashboard & Navigation
- **Hero Landing**: Particle-based "Swjsh AK" text effect with "Connect Terminal" entry portal.
- **SaaS Layout**: Unified Sidebar/Header structure with sticky navigation.
- **Strategy Selection**: "SQUAD TERMINAL" mega-menu with rich agent profiles and animated dynamic borders.
- **Dual Themes**:
    - **Voltrex Protocol (Dark)**: Metallic grays, indigo, and neon purple glows.
    - **Nature/Café Precision (Light)**: Warm parchment, plant vibes, and forest green accents.
- **Market Ticker**: Continuous scrolling price feed for BTC, ETH, SPX, and major FX pairs.

### 2.3 Trading Engine (The Lab)
- **Local Runner**: Node.js-based execution loop (`agent_runner.ts`).
- **Data Sources**: Yahoo Finance (FX), Binance (Crypto), and Finnhub (Live).
- **Communication**: Webhook-based signal reception from TradingView.
- **Journaling**: Centralized `agents_db.json` for persistent state and trade logging.

### 2.4 Autonomous Squad (The Agents)
- **Pivot Pete**: Forex-specific price action and supply/demand specialist.
- **Boba**: Institutional flow and liquidity analyzer.
- **SPX Sniper**: High-frequency 0DTE options execution.
- **The Professor**: Performance grader; provides post-trade analysis and grading (A-F).
- **The Auditor**: Verification agent; checks The Professor's work and ensures data integrity.

### 2.5 Risk Management (Overseer SuperPlan)
- **RiskEngine**: Per-agent and global trade limits, concurrent trade checks, and correlation filters.
- **FrictionSimulator**: Realistic slippage, commission, and latency modeling.
- **RegimeDetector**: Classifies market state (Trending, Ranging, Volatile, Dead).
- **KillSwitch**: Immediate emergency halt for specific agents or the global system.

---

## 3. Technical Architecture

### 3.1 Frontend Stack
- **Framework**: Next.js (App Router).
- **Styling**: Vanilla CSS Modules (SaaS Design System).
- **Animations**: Framer Motion, Canvas API (Particles).
- **Icons**: Lucide React.
- **Providers**: AuthContext, StrategyContext, AgentContext.

### 3.2 Backend & Data
- **Hosting**: Oracle Cloud Free Tier (Planned).
- **Persistence**: SQLite (Local) + Firebase Firestore (Configuration).
- **Auth**: Firebase Authentication.
- **Internal APIs**: Next.js API Routes for webhook ingestion and dashboard state synchronization.

---

## 4. User Journeys

### 4.1 Onboarding
1. User lands on the Particle Hero page.
2. Clicks "CONNECT TERMINAL".
3. Authenticates via Google or Email/PW.
4. Redirected to the Command Center (DASHBOARD).

### 4.2 Trade Lifecycle
1. TradingView webhook sends a signal.
2. `agent_runner.ts` validates signal vs. **RiskEngine**.
3. **RegimeDetector** confirms market suitability.
4. Trade executes; **FrictionSimulator** applies slippage.
5. **The Professor** grades the trade upon completion.
6. **The Auditor** verifies the grade and updates the Journal.

---

## 5. Design Guidelines
- **Aesthetic**: Premium SaaS.
- **Borders**: 1px solid defined by `--border-base`.
- **Radii**: 12px-16px (`--radius-md` to `--radius-lg`).
- **Monospace**: All numerical data uses `JetBrains Mono`.
- **Aesthetics over Placeholders**: No empty states; use AI-generated assets or rich gradients.

---

## 6. Success Metrics for TestSprite
- **Bug-Free Routing**: Auth protected routes must never leak dashboard content.
- **Theme Consistency**: Context switching must not break styling or variables.
- **Data Integrity**: Trade JSON logs must match the UI representation 1:1.
- **Performance**: Zero lag in CSS animations/Framer Motion transitions.
