# UI Components

---
tags: #frontend #components #design-system
status: Reference
created: 2026-03-22
---

## Overview

SwjshAK uses a **Premium 21st Century UI Component Library** built with Framer Motion, CSS Modules, and the "Cyber-Industrial" design philosophy. Components feature glassmorphism, animated glows, spring physics, and cursor-following effects.

**Design Tokens** (defined in `src/app/globals.css`):
- **Primary**: `#06b6d4` (Electric Cyan)
- **Accent**: `#a855f7` (Neon Purple)
- **Success**: `#10b981` (Emerald Green)
- **Danger**: `#ef4444` (Red)
- **Background**: `hsl(222 47% 11%)` (Deep Gunmetal)

---

## Component Categories

### 1. Status Indicators

#### PulseIndicator
**Purpose**: Animated status dot with configurable pulse effect
**Use For**: Agent status, connection status, live/idle indicators

```tsx
import { PulseIndicator } from '@/components/UI';

<PulseIndicator status="LIVE" size="md" showLabel />
<PulseIndicator status="ERROR" size="lg" />
<PulseIndicator status="IDLE" />
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `LIVE \| IDLE \| OFF \| ERROR \| PENDING \| PAUSED` | required | Status state |
| `size` | `sm \| md \| lg` | `md` | Indicator size |
| `showLabel` | `boolean` | `false` | Show text label next to dot |

**Status Colors**:
- `LIVE/active/running`: Green (#10b981) + pulse
- `IDLE/idle/paused`: Amber (#f59e0b)
- `OFF/stopped`: Gray (#374151)
- `ERROR`: Red (#ef4444) + pulse
- `PENDING`: Cyan (#06b6d4) + pulse

---

### 2. Interactive Buttons

#### ShimmerButton
**Purpose**: Premium CTA button with animated shimmer overlay
**Use For**: Primary actions, kill switches, important CTAs

```tsx
import { ShimmerButton } from '@/components/UI';

<ShimmerButton onClick={handleClick} shimmerColor="#06b6d4">
  ACTIVATE
</ShimmerButton>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `shimmerColor` | `string` | `#06b6d4` | Color for shimmer effect |
| `size` | `sm \| md \| lg` | `md` | Button size |
| `disabled` | `boolean` | `false` | Disabled state |

---

#### EncryptButton
**Purpose**: Cyberpunk-style button with scrambling text animation during loading
**Use For**: Submit buttons, async actions, login/auth flows

```tsx
import { EncryptButton } from '@/components/UI';

<EncryptButton
  isLoading={loading}
  isSuccess={success}
  loadingText="AUTHENTICATING..."
  successText="ACCESS GRANTED"
  onClick={handleSubmit}
>
  LOGIN
</EncryptButton>
```

**Features**:
- Text scrambles with random characters during loading
- "Decrypt" animation reveals final text character by character
- SVG icons for success (checkmark) / error (X) states
- Animated scan line during loading state

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isLoading` | `boolean` | `false` | Show loading animation |
| `isSuccess` | `boolean` | `false` | Show success state |
| `isError` | `boolean` | `false` | Show error state |
| `loadingText` | `string` | `PROCESSING...` | Text during loading |
| `successText` | `string` | `SUCCESS` | Text on success |
| `errorText` | `string` | `ERROR` | Text on error |

---

#### MagnetButton
**Purpose**: Button that follows cursor with magnetic spring effect
**Use For**: Secondary actions (Pause, Configure, Settings)

```tsx
import { MagnetButton } from '@/components/UI';

<MagnetButton onClick={pauseAgent}>
  PAUSE
</MagnetButton>
```

**Behavior**: Button subtly shifts position (max 8px) toward cursor on hover with spring physics.

---

#### SpotlightButton
**Purpose**: Button with cursor-following spotlight/glow effect
**Use For**: Destructive actions (Stop, Kill, Delete)

```tsx
import { SpotlightButton } from '@/components/UI';

<SpotlightButton spotlightColor="#ef4444" onClick={killSwitch}>
  EMERGENCY STOP
</SpotlightButton>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `spotlightColor` | `string` | `#ef4444` | Color for spotlight (default red) |

---

### 3. Cards & Panels

#### GlowHoverCard
**Purpose**: Card with interactive glow that follows cursor
**Use For**: Metric cards, dashboard widgets, agent panels

```tsx
import { GlowHoverCard } from '@/components/UI';

<GlowHoverCard glowColor="#a855f7" glowIntensity="high">
  <h3>Daily P&L</h3>
  <span>+$1,234.56</span>
</GlowHoverCard>
```

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `glowColor` | `string` | `#a855f7` | Color for glow effect |
| `glowIntensity` | `low \| medium \| high` | `medium` | Glow brightness |
| `borderRadius` | `number` | `12` | Border radius in px |

---

#### SplitBorderPanel
**Purpose**: Card with animated rotating border based on P&L value
**Use For**: Trade performance cards, agent status cards, P&L displays

```tsx
import { SplitBorderPanel } from '@/components/UI';

<SplitBorderPanel pnl={dailyPnL} threshold={1000}>
  <h3>Total P&L</h3>
  <CounterAnimation value={dailyPnL} prefix="$" />
</SplitBorderPanel>
```

**Behavior**:
- Positive P&L: Green rotating glow (`#10b981`)
- Negative P&L: Red rotating glow (`#ef4444`)
- Neutral (near 0): Subtle gray glow
- Intensity scales with `|P&L| / threshold`
- Border rotation speed increases with higher P&L

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pnl` | `number` | required | P&L value to determine color/intensity |
| `threshold` | `number` | `100` | P&L value for max intensity |

---

#### GlassPanel
**Purpose**: Standard glassmorphic container panel
**Use For**: General content containers, modals, sidebars

```tsx
import { GlassPanel } from '@/components/UI';

<GlassPanel>
  <p>Content here</p>
</GlassPanel>
```

---

#### DynamicBorderCard
**Purpose**: Card with animated gradient border
**Use For**: Featured content, highlighted sections

---

### 4. Data Display

#### CounterAnimation
**Purpose**: Animated number counter with spring physics
**Use For**: P&L displays, metrics, KPIs, live updating values

```tsx
import { CounterAnimation } from '@/components/UI';

<CounterAnimation value={1234.56} prefix="$" colorize />
<CounterAnimation value={75.5} suffix="%" decimals={1} />
<CounterAnimation value={-50.25} prefix="$" colorize />
```

**Features**:
- Smooth spring animation between value changes
- Auto-adds +/- prefix when `colorize` is true
- Green for positive, red for negative values
- Configurable decimal places

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | required | Numeric value to display |
| `prefix` | `string` | `""` | Prefix (e.g., "$", "+") |
| `suffix` | `string` | `""` | Suffix (e.g., "%", "pts") |
| `decimals` | `number` | `2` | Decimal places |
| `duration` | `number` | `1` | Animation duration (seconds) |
| `colorize` | `boolean` | `true` | Apply +/- color styling |

---

### 5. 21st Subdirectory (Premium Effects)

Located in `src/components/UI/21st/`:

#### BentoItem
**Purpose**: Bento grid item with holographic corner brackets
**Use For**: Dashboard grids, feature showcase sections

```tsx
import BentoItem from '@/components/UI/21st/BentoItem';

<BentoItem className="span-2">
  <h3>Feature Title</h3>
  <p>Description</p>
</BentoItem>
```

---

#### GlowingEffect
**Purpose**: Cursor-following gradient border effect
**Use For**: Premium cards, featured content, hero sections

```tsx
import { GlowingEffect } from '@/components/UI/21st/GlowingEffect';

<div className="relative">
  <GlowingEffect
    variant="blue-purple"
    glow
    spread={30}
    blur={10}
  />
  <div className="content">...</div>
</div>
```

**Variants**:
- `default`: Rainbow gradient (pink/yellow/green/blue)
- `white`: Monochrome white
- `blue-purple`: Purple/blue gradient (matches brand)

**Props**:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `default \| white \| blue-purple` | `blue-purple` | Color scheme |
| `blur` | `number` | `0` | Blur radius |
| `spread` | `number` | `25` | Gradient spread angle |
| `glow` | `boolean` | `false` | Enable glow effect |
| `disabled` | `boolean` | `true` | Disable cursor tracking |

---

#### RealtimeChart
**Purpose**: TradingView-style real-time candlestick chart
**Use For**: Price displays, mini charts in dashboards

---

## Barrel Export

All components are exported from `src/components/UI/index.ts`:

```tsx
import {
  GlowHoverCard,
  PulseIndicator,
  CounterAnimation,
  ShimmerButton,
  MagnetButton,
  SpotlightButton,
  EncryptButton,
  SplitBorderPanel,
  GlassPanel,
  DynamicBorderCard,
  ErrorBoundary,
  LoadingSkeleton,
  LogoIcon,
  ThemeToggle,
  ToastProvider,
  useToast,
} from '@/components/UI';
```

---

## Usage Guidelines

### When to Use Each Button Type

| Button Type | Use Case | Example |
|-------------|----------|---------|
| **ShimmerButton** | Primary CTAs, important actions | "Start Trading", "Activate" |
| **EncryptButton** | Async operations with loading state | "Login", "Submit Order" |
| **MagnetButton** | Secondary actions | "Pause", "Configure", "Settings" |
| **SpotlightButton** | Destructive/stop actions | "Kill Switch", "Close Position" |

### Card Selection Guide

| Card Type | Use Case | Example |
|-----------|----------|---------|
| **GlowHoverCard** | Metrics, KPIs, interactive widgets | Agent status card |
| **SplitBorderPanel** | P&L-driven styling | Daily performance card |
| **GlassPanel** | General containers | Settings panel |
| **BentoItem** | Grid layouts | Dashboard overview |

---

## Dependencies

- `framer-motion` - Animations and spring physics
- `clsx` - Conditional class names
- `@/lib/utils` - Utility functions (cn helper)

---

## Related Pages

- [[System Architecture]] - Overall system design
- [[Troubleshooting]] - Common UI issues
- [[Strategies Overview]] - Dashboard context

