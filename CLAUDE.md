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
- [x] Write comprehensive tests (23 tests)
- [x] Feature flag + fallback wrapper
- **Commit**: `68e0b07`

### Phase 2: Integration (Current)
- [ ] Wire ApprovalPort to UI confirmations
- [ ] Wire PolicyGate to settings/permissions
- [ ] Implement RunStore for persistence
- [ ] Test with feature flag enabled
- [ ] Collect evidence of correctness

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
- ✅ Orchestrator PoC implemented (23 tests passing)
- ✅ P0 agents integrated (code-reviewer, debugger, context-manager)
- ✅ Android P0 stabilization: fixed the fallback-banner/toolbar overlap, an
  app-crashing production chunk-splitting bug, and the Workbench-always-full-screen bug
  (see `docs/ai-state/CURRENT_STATE.md` / `ROADMAP.md` / `DECISIONS.md` for full detail
  and the verification method)
- ✅ Lint errors fixed (0 errors, 2 pre-existing warnings)
- ✅ TypeScript compilation clean (0 errors)
- ✅ Ecosystem repositories linked

**Next Priorities**:
1. Product-quality pass across the whole app (not just Android): verify every
   interactive element is genuinely wired end-to-end, no dead buttons/fake states —
   see `docs/ai-state/ROADMAP.md` P1 for the known open items
2. Wire orchestrator approvals/policy to UI
3. Real device / APK verification (blocked on Android SDK availability in this
   container; code is ready for it)
4. Continue closing the gap between VELDRA and a generic AI-dashboard feel — distinct
   product identity, not a Bolt/ChatGPT/Lovable clone

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
