<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./public/veldra-mark-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./public/veldra-mark-light.png">
    <img alt="VELDRA Logo" src="./public/veldra-mark-dark.png" height="80">
  </picture>

  <h1>VELDRA</h1>
  <p><b>Autonomous AI Engineering Environment for Android, Web & Desktop</b></p>
  
  <p>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
    <a href="https://github.com/mertgoevse-wq/VELDRA/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
    <img src="https://img.shields.io/badge/Version-1.0.0-purple.svg" alt="Version 1.0.0">
  </p>
</div>

![VELDRA — Autonomous AI Engineering Workspace](./public/veldra-social-preview.png)

## What is VELDRA?

VELDRA is a provider-agnostic AI development workspace designed for next-generation engineering. Evolving beyond conventional chat interfaces, VELDRA is a comprehensive, mobile-first IDE powered by autonomous subagents, model-context protocol (MCP) native skills, and a responsive architectural framework.

Whether you are sketching out ideas on an Android device via Termux, running a local setup, or connecting to an enterprise remote runtime, VELDRA provides a unified, deeply immersive visual experience.

---

## Core Capabilities

- **Provider Agnostic**: Seamlessly integrate with Gemini, Claude, OpenAI, Ollama, and external headless CLIs.
- **Agent Orchestration**: Spin up dedicated subagents for specific tasks—UI Design, UX Audits, Security, and testing.
- **Native Skills System**: Dynamically load MCP tools and native platform skills to augment the AI's capabilities.
- **Universal Runtime**: From local static blob previews on Android to full remote Docker runtimes.
- **Mobile-First UX**: Responsive layouts engineered for 360px constraints and touch interactions.
- **Offline Persistence**: Local IndexedDB workspace storage that persists across sessions.

---

## Design System

VELDRA features a bespoke, unified design system engineered for technical precision. Moving away from generic CSS templates, VELDRA implements:

- **Typography**: `Inter` for UI clarity, `Space Grotesk` for distinct branding, and `JetBrains Mono` for precise terminal/code rendering.
- **Geometry & Micro-Interactions**: Sharp `veldra-radius` corners, subtle isometric backgrounds, and cohesive `framer-motion` cubic easings.
- **Motion Language**: Standardized transitions (Fast: 0.15s, Medium: 0.2s, Slow: 0.3s) mapped to the physical scale of the UI shift.

### VELDRA Skins

Experience VELDRA through 8 distinct, data-driven visual skins, rendered via native CSS variables without page reloads:

1. **VELDRA Core** - The default tech-focused aesthetic (sky blue on dark navy)
2. **VELDRA Dark** - Standard dark mode balance
3. **VELDRA Light** - Crisp, high-contrast bright UI
4. **VELDRA Midnight** - Ultra-dark obsidian/black
5. **VELDRA Matrix** - Retro hacker green on black
6. **VELDRA Aurora** - Vibrant purple/pink nebulas
7. **VELDRA Industrial** - High-contrast greyscale with orange accents
8. **VELDRA Minimal** - Pure black and white, zero distraction

---

## Architecture

VELDRA's execution layer is built on a robust `SandboxSession` pattern. Rather than coupling to a single runtime (like WebContainer), the framework routes commands via `ExecutionProvider` adapters.

### Subagents & Parallelization
VELDRA supports parallelized AI reasoning. Launch specialists (e.g., `UX_AUDITOR`, `MOTION_AGENT`) to investigate the codebase concurrently, collect their output, resolve conflicts, and orchestrate complex refactoring across the repository.

### GitHub Integration
Push, pull, and manage Git state directly within the VELDRA workspace without touching a traditional terminal.

---

## Mobile & Android

Powered by Capacitor, VELDRA offers a native Android APK build system.
The mobile shell features fallback UX components for environments lacking `SharedArrayBuffer` support:
- Local Blob URL HTML Preview
- Polished Remote Runtime Connection Modals
- Safe interception of incompatible WebContainer commands

---

## Demo Video

*A product demonstration video is planned for a future release.*
To generate a demonstration, refer to our Veo prompt script at:
[`docs/design/VEO_PRODUCT_DEMO_PROMPT.md`](./docs/design/VEO_PRODUCT_DEMO_PROMPT.md)

---

## Quick Start & Installation

### Prerequisites
- **Node.js** ≥ 18.18
- **npm** (legacy-peer-deps enabled)
- **Android SDK & Studio** (for native APK builds)

### 1. Clone & Install
```bash
git clone https://github.com/mertgoevse-wq/VELDRA.git
cd VELDRA
npm install --legacy-peer-deps
```

### 2. Run Locally
```bash
# Start Vite development server
npm run dev

# Run Android SPA mode
npm run android:dev
```

### 3. Build APK
```bash
# Compile web assets, sync Capacitor, and generate Debug APK
npm run android:apk:debug
```

---

## Roadmap

- [x] **Core Styling**: Establish VELDRA token foundations and component geometry.
- [x] **Application Shell**: Redesign the main viewport into a true workspace shell.
- [x] **Motion & Themes**: Implement 8 distinctive VELDRA skins and standard framer-motion variants.
- [ ] **Remote Runtime Node**: Build the lightweight Docker sandbox backend for terminal execution.
- [ ] **Filesystem API**: Hook Capacitor into native Android storage for seamless workspace exports.

---

## Contributing

We follow an iterative "Gauntlet Loop" strategy for development:
`DISCOVER` → `PLAN` → `IMPLEMENT` → `REVIEW` → `TEST` → `AUDIT` → `FIX`

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

---

## License & Attribution

VELDRA is an independent, heavily customized product derived from the open-source **bolt.diy** architecture.

- **Original Project**: [bolt.diy by StackBlitz Labs](https://github.com/stackblitz-labs/bolt.diy)
- **License**: MIT (See [LICENSE](./LICENSE) for details)

> Android port & adaptation © 2026 Mert Gövse. Original MIT license and notices are fully retained.
