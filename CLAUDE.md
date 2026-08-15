# VELDRA Development Guide

**VELDRA** is an AI-powered development environment that runs on Web, Desktop (Electron), and Android (Capacitor). It provides chat-based code assistance, terminal integration, preview rendering, and multi-agent orchestration.

## Architecture Overview

### Core Request Flow

```
USER REQUEST (Web/Android/Desktop)
  ↓
ROUTE (app/routes/api.chat.ts)
  ↓
chatAction (app/lib/.server/llm/chat-action.ts)
  ↓
streamText (app/lib/.server/llm/stream-text.ts)
  ├─ LLMManager → Provider → Model
  ├─ SkillService.discoverSkills()
  └─ MCPService → tools
      ├─ spawnSubagent
      └─ loadSkill
  ↓
ORCHESTRATOR (hybrid: feature-flagged)
  ├─ VeldraOrchestratorHost (new, opt-in)
  └─ SubagentService (legacy, default)
  ↓
RUNTIME
  ├─ WebContainer (browser)
  ├─ Remote Runtime (server)
  └─ Mobile Runtime (Capacitor)
  ↓
ACTION RUNNER (app/lib/runtime/action-runner.ts)
  ↓
WORKBENCH UI
  ├─ BaseChat, ChatBox
  ├─ SubagentActivityWidget
  ├─ Terminal, Preview
  └─ Settings
```

### Dual Orchestration Architecture

VELDRA currently has **two parallel orchestration systems** in a gradual migration:

#### Legacy (Default)
```
MCPService → SubagentService (direct call)
  └─ LLMManager → Provider → Model
```

**Status**: ✅ Active, production-ready  
**Location**: `app/lib/services/mcpService.ts`

#### Orchestrator (Feature-Flagged)
```
VeldraOrchestratorHost → VeldraAgentRunner → SubagentService
  └─ Budget tracking, policy gates, evidence collection
```

**Status**: ⚠️ Implemented, tested, feature-flagged (default: OFF)  
**Location**: `app/lib/orchestrator/`  
**Feature Flag**: `VELDRA_USE_ORCHESTRATOR` (env var)

**Rationale**: Safe incremental migration. Legacy path remains default until orchestrator is proven in production.

## Project Structure

```
app/
├── routes/                 # Remix routes (UI + API)
│   ├── api.chat.ts        # Chat API endpoint
│   └── _index.tsx         # Main UI
├── lib/
│   ├── .server/
│   │   └── llm/           # LLM integration
│   │       ├── stream-text.ts
│   │       └── chat-action.ts
│   ├── services/          # Core services
│   │   ├── mcpService.ts
│   │   ├── subagentService.ts
│   │   └── skillService.ts
│   ├── orchestrator/      # New orchestration layer
│   │   ├── veldra-host.ts
│   │   ├── veldra-agent-runner.ts
│   │   ├── integration.ts
│   │   └── adapters.ts
│   ├── runtime/           # Execution environments
│   │   └── action-runner.ts
│   └── modules/
│       └── llm/
│           └── providers/  # OpenAI, Anthropic, Google, etc.
├── components/            # React components
│   ├── chat/
│   ├── workbench/
│   └── ui/
└── stores/                # Nanostores state management

.claude/
├── agents/                # Specialized agents
│   ├── veldra-architect.md
│   ├── veldra-security.md
│   ├── veldra-researcher.md
│   ├── veldra-code-reviewer.md
│   ├── veldra-debugger.md
│   └── veldra-context-manager.md
├── skills/                # Task-specific skills
│   ├── ui-ux-pro-max/
│   ├── verify-build/
│   └── android-cycle/
├── ecosystem/             # Symlinks to reference repos
└── settings.local.json    # Local configuration

project/
└── research/              # Analysis and planning docs
```

## Multi-Platform Support

### Web (Primary)
- **Runtime**: WebContainer (in-browser Node.js)
- **Features**: Full development environment, terminal, preview
- **Build Target**: Remix + Vite

### Desktop (Electron)
- **Runtime**: Node.js (native)
- **Features**: Native filesystem, better performance
- **Status**: Planned

### Android (Capacitor)
- **Runtime**: WebView + Capacitor plugins
- **Features**: Mobile UI, file system access, share
- **Build Target**: `npm run build:android`
- **Platform**: Termux ARM64 development environment

## State Management

VELDRA uses **Nanostores** for reactive state management:

- `workbenchStore` — files, preview state
- `chatStore` — conversation history
- `subagentsStore` — active subagent tracking
- `settingsStore` — user preferences, API keys

**Why Nanostores**:
- Framework-agnostic (portable)
- Minimal bundle size (<1KB)
- Provider-neutral (no React Context lock-in)

## Development Practices

### Code Quality

- **Immutability**: ALWAYS create new objects, NEVER mutate
- **File Size**: 200-400 lines typical, 800 max
- **Function Size**: <50 lines preferred
- **Error Handling**: Explicit at every level
- **Input Validation**: At all system boundaries

### Testing

- **Minimum Coverage**: 80%
- **TDD Required**: Write tests first (RED → GREEN → REFACTOR)
- **Test Types**: Unit, integration, E2E
- **Test Files**: Co-located with implementation (`*.spec.ts`)

### Agents

VELDRA has 6 specialized agents (`.claude/agents/`):

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **veldra-architect** | System design validation | Architecture decisions |
| **veldra-security** | Security vulnerability analysis | Auth, payment, user data |
| **veldra-researcher** | Investigation and analysis | Understanding codebase |
| **veldra-code-reviewer** | Code quality review | After writing code |
| **veldra-debugger** | Multi-platform debugging | Runtime issues |
| **veldra-context-manager** | Workflow coordination | Multi-agent orchestration |

**Usage**: Agents are automatically discovered by Claude Code. Use them proactively for their specializations.

### Skills

VELDRA has 3 task-specific skills (`.claude/skills/`):

- **ui-ux-pro-max**: UI/UX design, 67 styles, 96 palettes
- **verify-build**: Build validation and error resolution
- **android-cycle**: Android-specific development workflow

### Git Workflow

```
1. Create feature branch (optional for solo development)
2. Make changes
3. npm run typecheck
4. npm run lint:fix
5. npm test (if applicable)
6. git commit -m "type(scope): description"
7. git push
```

**Commit Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

**Attribution**: `includeCoAuthoredBy: false` (set by ECC guidelines, can override in settings)

## Provider Neutrality

VELDRA is **provider-neutral** — supports multiple LLM providers:

- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)
- Mistral
- Groq
- Cohere
- Ollama (local)

**Implementation**: `app/lib/modules/llm/providers/`

**Configuration**: Runtime provider selection via Settings UI

## Orchestrator Migration Strategy

The orchestrator is being integrated gradually:

### Phase 1: PoC Implementation ✅
- [x] Create VeldraOrchestratorHost
- [x] Implement VeldraAgentRunner
- [x] Write comprehensive tests (99 tests across app/lib/orchestrator/*.spec.ts as of
      2026-08-15 -- unit tests against mocked dependencies verifying the stub behavior
      itself, not a real approval/policy mechanism; see Phase 2 below)
- [x] Feature flag + fallback wrapper
- **Commit**: `68e0b07`

### Phase 2: Integration (Current)

**Updated 2026-08-15 (later round)** — the items below were rewritten from a stale
description of the *pre*-real-runtime stub state (`_createApprovalStub()`/
`_createPolicyStub()`/`runs = undefined`). All of that was replaced by real
implementations in the same round; the docs describing it as "not started" simply
hadn't been refreshed yet. See `docs/ai-state/DECISIONS.md` for the full trail.

- [x] Wire ApprovalPort to a real handoff -- `veldra-approvals.ts`'s `request()`
      genuinely suspends until something calls `respond()`; `pendingApprovalsStore`
      (nanostore) exists for a future UI to subscribe to. **Still open**: no UI calls
      `respond()` yet, so a real approval request has nothing to answer it (see the
      preflight-budget note below for why that matters).
- [x] Wire PolicyGate to the entitlement system -- `veldra-policy.ts`, backed by
      `entitlement.ts`'s tier/capability model, not an always-allow stub. Documented as
      client-side/UX-only, not a security boundary (same limitation
      `entitlementTierStore` already states).
- [x] Implement RunStore for persistence -- wired to the existing IndexedDB-backed
      `orchestratorRunStore.ts` via an optional `db` handle in `veldra-host.ts`; degrades
      to a safe no-op RunStore (still a valid host) when no `db` is supplied.
      `ModelCatalog`/`CapabilityResolver` remain unimplemented (`undefined`).
- [x] Build a real-time event stream -- `events.ts` (typed `WorkflowEvent` model +
      dependency-free pub/sub emitter) and `run-workflow.ts` (`createWorkflowRun()` +
      `runWorkflow()`, the actual `WorkflowRun` state-machine driver that was previously
      missing entirely -- nothing anywhere built one before this). Every event type only
      fires from a real call site; no synthetic "make the timeline look busier" events.
      **Still open**: no UI subscribes to it yet.
- [x] Give the live spawn path something real to drive -- `spawnSubagentWithOrchestrator()`
      (`app/lib/orchestrator/integration.ts`) now builds a single-task `WorkflowRun` and
      drives it through `runWorkflow()` (still gated behind `VELDRA_USE_ORCHESTRATOR`,
      still off by default) instead of calling `host.agents.run()` directly -- closing the
      exact gap the runtime-foundation round's own commit message flagged ("nothing in the
      live chat/agent-spawn path creates a WorkflowRun yet"). Found and fixed one real bug
      while wiring this in: `TIER_BUDGETS`'s FREE tier has `maxCostMinor: 0`, and
      `checkBudget`'s `used >= allowed` trips on `0 >= 0` before any work has even
      dispatched -- which would have called the (real, no-timeout) `ApprovalPort.request()`
      for a decision nothing can currently answer, hanging the call forever. `integration.ts`
      now preflights `checkBudget` against zero usage and falls back to legacy immediately
      if a tier can't afford even one iteration, rather than attempting a run that can never
      resolve. 394→395 tests (integration.spec.ts rewritten for the real runWorkflow-driven
      contract, including a test for this deadlock guard specifically).
- [x] Test with the feature flag enabled, end-to-end, through every VELDRA-authored layer
      -- `app/lib/orchestrator/orchestrator-e2e.spec.ts` (run by `npm test`, no separate
      opt-in needed) drives a real spawn through `integration.ts` -> `runWorkflow()` ->
      `VeldraAgentRunner` -> `SubagentService` -> `subagentsStore` -> back up through
      `Evidence` -> a `completed` `WorkflowRun`, with nothing VELDRA-authored mocked --
      only the two boundaries this container genuinely cannot provide (a live LLM call via
      `ai`'s `generateText`, and a WebContainer sandbox session) are mocked. This is
      different from every other spec touching this code, which mocks at least one
      VELDRA-owned layer. Also found and fixed a real (if currently dormant) bug this test
      surfaced: `spawnSubagentWithOrchestrator()`'s `apiKeys`/`providerSettings` params
      were silently dropped on both the disabled-flag path and the post-failure fallback,
      instead of merging into the `SpawnSubagentOptions` passed to `SubagentService` --
      not yet hit in production (the only real caller, `mcpService.ts`, never passes them),
      but a real correctness gap in the function's own contract. `VELDRA_USE_ORCHESTRATOR`
      still stays unset by default in production; `.env.example` now documents it with a
      concrete recommendation (enable in dev/staging to keep exercising the real runtime).
      Deliberately did NOT change any default-enablement logic based on runtime
      environment (e.g. auto-on outside production) -- that would silently change
      `npm test`'s own behavior for every existing spec that doesn't explicitly set the
      env var, an untraceable blast radius not justified by what this round needed to
      prove. 397/397 tests (was 395).
- [x] Collect evidence of correctness -- two independent paths now populate real activity
      data: (a) legacy-path `AgentRunner` Evidence[] flows into `subagentsStore` regardless
      of the flag, surfaced by `SubagentActivityWidget`; (b)
      `subagent-activity-bridge.ts` watches that same store for real status transitions
      and emits `agent.started`/`agent.completed`/`agent.failed` into the typed
      `WorkflowEvent` model, so activity events flow through the new event model even
      though nothing in the live app calls `runWorkflow()` for a multi-agent case yet.
      Deliberately does not emit `tool.*`/`file.*` events -- `SubagentTask`'s status field
      doesn't carry that granularity; getting it needs an `onStepFinish` hook in
      `subagentService.ts` itself, a separate, higher-risk change not attempted blind.

### Phase 3: Migration (Future)
- [ ] Enable by default (after validation)
- [ ] Migrate remaining SubagentService calls
- [ ] Remove legacy code
- [ ] Full budget tracking
- [ ] Evidence-based verification

**Decision Criterion**: Enable orchestrator by default only after real-world validation shows no regressions.

## MCP Integration

VELDRA supports **Model Context Protocol** (MCP) for tool extensions:

- **Location**: `app/lib/services/mcpService.ts`
- **Discovery**: Automatic tool registration
- **Available Tools**: `spawnSubagent`, `loadSkill`, etc.

**Ecosystem Resources**:
- `mcp-specification` — Protocol spec
- `mcp-servers` — Server catalog

## Build & Development

### Environment: Termux ARM64 (proot-Debian)

**Constraints**:
- Limited RAM → production builds may OOM
- No GUI → terminal-only workflow
- ARM64 architecture

**Adapted Workflow**:
```bash
npm run typecheck    # Fast, no build
npm run lint:fix     # Auto-fix style issues
npm test             # Run tests (specific or all)
npm run dev          # Dev server (if RAM allows)
```

### Scripts

```json
{
  "dev": "remix vite:dev",
  "build": "remix vite:build",
  "typecheck": "tsc",
  "lint": "eslint --cache .",
  "lint:fix": "eslint --cache --fix .",
  "test": "vitest",
  "build:android": "ionic cap build android"
}
```

## Ecosystem Integration

VELDRA references best practices from:

- **everything-claude-code** (ECC) — Full reference implementation
- **awesome-claude-code-subagents** — Agent patterns
- **awesome-claude-code** — Skills, commands, hooks
- **mcp-servers** — MCP server catalog

**Principle**: Adapt, don't blindly copy. Study patterns, create VELDRA-native implementations.

**Attribution**: Source repos linked in `.claude/ecosystem/`

## Security

- **No Hardcoded Secrets**: Use environment variables
- **Input Validation**: At all boundaries (user input, API responses)
- **OWASP Top 10**: XSS, SQL injection, CSRF protection
- **Security Agent**: Use `veldra-security` before commits

## Known Limitations

1. **Production Builds**: May OOM on ARM64/Termux
   - **Mitigation**: Develop via `npm run dev` + typecheck
2. **Dual Architecture**: Two orchestration paths during migration
   - **Mitigation**: Feature flag + automatic fallback
3. **Android Build**: Requires native toolchain
   - **Status**: Ionic Capacitor configured, needs testing

## Troubleshooting

### TypeScript Errors
```bash
npm run typecheck        # Show errors
npm run lint:fix         # Fix auto-fixable issues
```

### Build Failures
```bash
# Use veldra-debugger agent
# Check app/lib/runtime/ for runtime issues
# Verify provider configuration
```

### Subagent Not Spawning
```bash
# Check MCPService tool registration
# Verify SubagentService initialization
# Check orchestrator feature flag status
```

### UI Component Issues
```bash
# Check Nanostores state management
# Verify component re-renders
# Use veldra-debugger for React debugging
```

## Contributing Guidelines

### For Claude Code Sessions

1. **Read this file first** — understand architecture
2. **Check existing agents/skills** — avoid duplication
3. **Use TDD** — write tests first
4. **Maintain immutability** — no mutations
5. **Provider neutrality** — support multiple LLMs
6. **Mobile-first** — verify Android compatibility
7. **Small commits** — logical, focused changes
8. **Attribution** — credit ecosystem sources

### Agent Development

New agents should:
- Have clear specialization (no overlap)
- Include VELDRA-specific context
- Document triggering conditions
- Provide verification criteria

### Skill Development

New skills should:
- Have frontmatter with clear metadata
- Define trigger keywords
- Include workflow steps
- Specify success/failure conditions

## Current Status

**Date**: 2026-08-15
**Branch**: `integration/veldra-bedrock-plus-claude-web` — this is the single active
development branch. Work directly on it; do not create new feature/integration/experiment
branches unless explicitly requested. Other sessions/agents should also work on this same
branch rather than splitting off parallel ones.
**Recent Work**:
- ✅ Orchestrator PoC implemented (99 tests passing, all unit-level against mocks —
  see Orchestrator Migration Strategy above for what that does/doesn't prove)
- ✅ P0 agents integrated (code-reviewer, debugger, context-manager)
- ✅ Android P0 stabilization: fixed the fallback-banner/toolbar overlap, an
  app-crashing production chunk-splitting bug, and the Workbench-always-full-screen bug
  (see `docs/ai-state/CURRENT_STATE.md` / `ROADMAP.md` / `DECISIONS.md` for full detail
  and the verification method)
- ✅ Product evolution pass (2026-08-15): deterministic starter-code seeding for
  Android's "Code Workspace"/"Project Overview" templates (previously only ever set a
  layout preset, never real project files); fixed a real UI/runtime state-truth bug
  where the Android bottom nav could disagree with what the Workbench panel was actually
  showing; unified `UserMessage`'s two divergent layouts (array vs. string content) into
  one; mounted `SubagentActivityWidget` (was built, wired to real data, never rendered);
  continued the hardcoded-hex-to-design-token cleanup. See `docs/ai-state/DECISIONS.md`
  and `current-session.md` for the full architecture findings and what was deliberately
  deferred (orchestrator UI — no backend event stream exists yet; unifying desktop's
  `StarterTemplates`/`/git`-route import path with the above — separate, larger change).
- ✅ Lint errors fixed (0 errors, 2 pre-existing warnings)
- ✅ TypeScript compilation clean (0 errors)
- ✅ Ecosystem repositories linked
- ✅ Core product + runtime foundation round (2026-08-15, later, this file's prior update
  went stale mid-round when the session crashed — recovered from git log/commit messages,
  not from docs, since none had been written yet for this part): real orchestrator runtime
  replacing the ApprovalPort/PolicyGate/RunStore stubs (events.ts, run-workflow.ts's
  WorkflowRun state-machine driver, veldra-approvals.ts, veldra-policy.ts); bridged real
  subagentsStore activity into the new typed event model
  (subagent-activity-bridge.ts, mounted in SubagentActivityWidget); a visual connector
  between a chat response and the tool call that produced it; extracted a shared
  file-seed-artifact builder used by both Android's template pipeline and desktop's
  `/git`-route import, which surfaced and fixed a real unescaped-tag injection gap in the
  latter. Then, continuing the same mandate: wired the one live call site that can reach
  the orchestrator (`spawnSubagentWithOrchestrator`) to actually drive a `WorkflowRun`
  through `runWorkflow()` instead of bypassing it — see "Orchestrator Migration Strategy"
  Phase 2 above for the full detail, including a real approval-deadlock bug found and
  fixed while wiring it in. 395/395 tests, typecheck and lint clean (scoped to changed
  files — see `docs/ai-state/QUALITY_GATES.md` on pre-existing whole-repo lint drift).

**Next Priorities**:
1. Orchestrator: still needs (a) a UI that actually calls `ApprovalPort.respond()`/reads
   `pendingApprovalsStore`, now that there's a real event stream and approval handoff to
   build it on, and (b) an end-to-end run with `VELDRA_USE_ORCHESTRATOR=true` against a
   live provider — everything so far is unit-tested against mocks only.
2. Unify desktop's StarterTemplates (`/git?url=` route, `GitUrlImport`) further — the
   file-seed-artifact builder is now shared, but `/git` still navigates to a whole new
   chat rather than seeding into the current one; a deliberate, separate, larger change.
3. Real device / APK verification (blocked on Android SDK availability in this
   container; code is ready for it)
4. Continue closing the gap between VELDRA and a generic AI-dashboard feel — distinct
   product identity, not a Bolt/ChatGPT/Lovable clone
5. No headless browser available in this container for true visual/interaction
   verification — all verification this round was typecheck/lint/test plus direct code
   reading; a future session with browser access should visually confirm UI changes

## Resources

- **Stabilization Plan**: `project/research/VELDRA-STABILIZATION-PLAN-2026-08-13.md`
- **Core Analysis**: `project/research/CORE-FUNCTIONALITY-ANALYSIS-2026-08-13.md`
- **Session Summary**: `project/research/SESSION-SUMMARY-2026-08-13.md`
- **Living Android/product state** (more current than the docs above): `docs/ai-state/CURRENT_STATE.md`, `ROADMAP.md`, `DECISIONS.md`, `QUALITY_GATES.md`, `current-session.md`

## Questions?

This file evolves with the project. Update it when:
- Architecture changes
- New patterns emerge
- Important decisions are made
- Onboarding friction is discovered

For autonomous Claude Code sessions: read this file, then proceed with development following these guidelines.
