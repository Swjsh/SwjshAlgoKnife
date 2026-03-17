# Game Plan V3: Authenticated Alpha

**Goal**: Transform Swjsh Algo Knife into a multi-user, production-ready platform with a premium landing experience and intuitive agent management.

---

## 🎨 Design Vision: "The Glass SaaS"
- **Landing Page**: A high-impact hero section using Canvas-based particle text ("Swjsh AK") in the **Voltrex Glass Purple** style.
- **SaaS Template Aesthetic**: Redesigning the entire dashboard using the clean, modern look of the [Wisedev SaaS Template](https://21st.dev/community/components/wisedev/saa-s-template/default).
- **Dynamic Borders**: Implement "Epic" animated borders for cards and panels.
- **Navigation**: Transition to a unified, top-tier SaaS navigation structure with the "Efferd" header and cleaned-up sidebar.
- **Dual Souls**: Maintain the "Space Cafe" (Dark) and "Nature/Coffee Shop" (Light) themes within the new SaaS framework.

---

## 🏗️ Technical Roadmap

### Phase 1: Authentication & User State (Firebase)
- **Firebase Project Setup**: Configure Firebase Console for Auth (Google + Email/Pass).
- **Client Side**: 
  - Integrate `firebase/auth`.
  - Create `AuthContext` to manage user sessions.
  - Implement a sleek "Enter the Lab" sign-in modal.
- **Server Side**:
  - Middleware to protect `/dashboard`, `/agents`, etc.
  - Multi-tenant data structure (User-specific `agents_db.json` logic later).

### Phase 2: "The Portal" (Landing Page)
- **Component**: Create `src/components/Landing/HeroParticle.tsx`.
- **Logic**: Use Three.js or Vanilla Canvas for the particle text effect.
- **Style**: Apply the glassmorphic purple gradient to the particle logo.
- **Action**: A massive "CONNECT TERMINAL" button that triggers Auth.

### Phase 3: "Command Header" (Agent Selection UI)
- **Redesign**: Replace current sidebar/header combo with a rich selection UI (inspired by 21st.dev's Efferd Header).
- **Features**:
  - Visual thumbnails/icons for each agent.
  - Real-time status indicators (Active/Pausd/KillSwitched).
  - One-click strategy switching.

---

## 🛠️ Implementation Steps

### 1. Foundation (Auth)
- [ ] Install `firebase`, `react-firebase-hooks`.
- [ ] Create `initFirebase.ts`.
- [ ] Build Sign-in Page (`/login`).

### 2. Branding (Landing)
- [ ] Implement Particle Text Effect.
- [ ] Design Glass-Style Title Component.

### 3. Agent Navigation
- [ ] Build the "Efferd" style mega-menu.
- [ ] Connect selection to `StrategyContext`.

---

## 🛡️ Overseer Considerations
- **Secure Auth**: Token-based validation for all API calls.
- **Production Safety**: Ensure Kill Switches are user-specific and persistent.
