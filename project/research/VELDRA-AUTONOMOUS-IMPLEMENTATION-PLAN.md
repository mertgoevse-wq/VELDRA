# VELDRA Autonomous Implementation Plan

**Created:** 2026-08-12  
**Session:** Autonomous Engineering Leadership Mission  
**Working Directory:** `/data/data/com.termux/files/home/VELDRA`  
**Branch:** `main` (5 commits ahead of origin/main)

---

## Executive Summary

This plan synthesizes discoveries from:
- **VELDRA's existing architecture** (analyzed 15+ documentation files)
- **Claude Code orchestration patterns** (system prompt analysis)
- **External resources** (12 cloned repositories: 68 agents, 284 skills, 7 MCP servers)
- **Architectural research** (VELDRA-ARCHITECTURE-RESEARCH.md, CLAUDE-CODE-BOOTSTRAP-HANDOFF.md)

**Key Finding:** VELDRA has a sophisticated but partially-wired architecture. The orchestrator core (`app/lib/orchestrator/`) and studio layer (`studio/`) are well-designed contracts with real test coverage, but lack runtime integration. External resources provide valuable patterns but must be adapted, not blindly imported.

---

## Current State Analysis

### What Works (Production-Ready)

| Component | Status | Evidence |
|-----------|--------|----------|
| Chat/LLM | ✅ Working | Remix actions, 23 providers, streaming |
| WebContainer | ✅ Working | Desktop browsers only |
| Android Runtime | ✅ Working | IndexedDB FS, fallback adapters |
| Remote Runtime | ✅ Working | Auth, WS, file sync, safe commands |
| MCP Service | ✅ Working | stdio/SSE/streamable-HTTP transports |
| IndexedDB Persistence | ✅ Working | Chat history, snapshots |
| Multi-Provider LLM | ✅ Working | 23 providers, capability routing |
| UI/UX | ✅ Working | 8 skins, mobile-responsive, dark/light |
| Pre-commit Hooks | ✅ Working | Typecheck + lint automated |

### What's Contract-Only (Types Exist, No Runtime)

| Component | Contract Location | Missing |
|-----------|------------------|---------|
| Goal/Task Orchestration | `app/lib/orchestrator/types.ts` | Runtime driver, UI |
| Workflow Runs | `app/lib/persistence/db.ts` schema v3 | Creation flow, resume UI |
| Agent Registry | `studio/catalog/`, `app/lib/orchestrator/registries.ts` | `AgentRunner` impl, discovery UI |
| Skill System | `studio/catalog/skill-loader.ts` | Runtime loader, SKILL.md parser |
| Entitlement Tiers | `app/lib/orchestrator/entitlement.ts` | Billing integration, enforcement |
| Capability Discovery | `DiscoveryState` enum | Install/enable flow |
| Connector Definitions | `ConnectorDefinition` type | Transport layer, QR pairing |

### Two Parallel Orchestration Systems (UNRESOLVED)

**Studio** (`studio/orchestration/gauntlet.ts`):
- 10-state state machine (PLANNED → RESEARCHING → ... → COMPLETED/FAILED)
- 6 review gates (ARCHITECTURE, SECURITY, LICENSE, TESTS, VERIFICATION, DOCUMENTATION)
- Failure fingerprinting with `MAX_IDENTICAL_FAILURES`
- 2,200+ lines, real tests

**Orchestrator** (`app/lib/orchestrator/`):
- Goal/Task/Budget portable contracts
- Provider-agnostic adapters
- `EntitlementTier` with real budget ceilings
- `DiscoveryState` for staged trust

**Recommendation:** Use `app/lib/orchestrator/` types as product-facing contracts; use `studio/` logic as internal implementation. DO NOT merge them into one system blindly—they serve different layers.

---

## External Resources Inventory

### Repositories Already Cloned (`.veldra-ecosystem/repos/`)

| Repository | License | Content | Integration Priority |
|------------|---------|---------|---------------------|
| **everything-claude-code** | MIT | 68 agents, 284 skills | **P1** - Mine for patterns |
| **awesome-claude-code-houshuang** | — | 3 agents, commands, hooks | **P2** - Selective adaptation |
| **awesome-claude-code-toolkit** | — | Organized agent categories | **P2** - Pattern reference |
| **mcp-servers** (official) | Apache-2.0/MIT | 7 servers (filesystem, git, fetch, memory, time, etc.) | **P1** - Direct integration |
| **claude-mem** | — | Memory/RAG patterns | **P2** - Study for context engine |
| **claude-code-action** | — | GitHub Actions integration | **P3** - CI/CD automation |
| **ui-ux-pro-max-skill** | — | UI/UX skill (already in .claude/skills/) | ✅ Already integrated |
| **superpowers** | — | Cross-IDE plugin patterns | **P3** - Reference only |
| **awesome-claude-plugins** | — | Plugin discovery | **P3** - Future marketplace |
| **github-mcp-server-reference** | — | GitHub MCP example | **P2** - MCP patterns |

### Claude Code Patterns Discovered

From system prompt analysis:

1. **Agent Orchestration**
   - Specialized agent types with clear responsibilities
   - Background execution by default
   - Worktree isolation for safe experimentation
   - SendMessage for agent continuation

2. **Memory Architecture**
   - File-based with frontmatter metadata
   - Types: user, feedback, project, reference
   - MEMORY.md index for fast lookup
   - `[[name]]` semantic linking

3. **Context Management**
   - Token budgeting via summarization
   - Scratchpad for temporary work
   - Selective tool use over generic bash
   - Monitoring for long-running processes

4. **Verification Principles**
   - Read before publish (security boundary)
   - Pre-execution validation
   - Faithful outcome reporting
   - Confirmation for destructive actions

5. **Quality Patterns**
   - Output-first communication
   - Complete sentences, avoid jargon
   - Tool transparency (never fabricate results)
   - Design-first visualization

---

## Architectural Gaps Analysis

### Critical (Blocks Core Product Features)

1. **No AgentRunner Implementation**
   - Contract exists (`adapters.ts:AgentRunner`)
   - Zero concrete implementation
   - `subagentService.ts` exists but unwired
   - Blocks: autonomous task execution

2. **No Skill Loader Runtime**
   - `skill-loader.ts` reads SKILL.md format
   - Zero consumers in `app/`
   - No UI to browse/enable skills
   - Blocks: extensibility, marketplace

3. **No Goal/Task UI**
   - IndexedDB schema v3 has `orchestratorRuns` store
   - No route creates `WorkflowRun` entries
   - No resume/list UI
   - Blocks: multi-step project workflows

4. **Android Chat Not Production-Ready**
   - Bridge scaffolded (`AndroidApiClient.ts`)
   - Recommends separate backend
   - Provider keys stay server-side (correct)
   - NOT wired to production chat
   - Blocks: Android AI feature

### Important (Limits Product Quality)

5. **No Context Engine**
   - No repo-map/symbol-graph
   - No relevance scoring
   - No prompt caching abstraction
   - Limits: large codebase performance

6. **MCP Not Discoverable**
   - `mcpService.ts` works for stdio/SSE/streamable-HTTP
   - No registry UI
   - No install/enable flow matching `DiscoveryState`
   - Limits: extensibility UX

7. **No Connector Transport Layer**
   - `ConnectorDefinition` type exists
   - No QR pairing, Bluetooth, LAN discovery
   - Limits: local model UX, device pairing

### Enhancement (Improves Experience)

8. **No Local Model Scoring**
   - Ollama/LMStudio providers work
   - No device capability profiling
   - No quantization/VRAM matching
   - Limits: on-device intelligence routing

9. **No Entitlement Enforcement**
   - `TIER_BUDGETS` well-defined
   - No billing integration
   - No runtime enforcement beyond tests
   - Limits: monetization readiness

---

## Recommended Agent/Skill Architecture

### Principles

1. **Extend, Don't Replace** - VELDRA's `CapabilityKind` registry is the right architecture; add to it, don't build a second system
2. **Contracts First** - Every agent/skill must have a typed manifest before implementation
3. **Staged Trust** - Reuse `DiscoveryState` (discovered → verified → cataloged → optional → enabled)
4. **License-Aware** - Track provenance/license in manifest (already designed in `studio/catalog/veldra-roles.ts`)
5. **No Blind Import** - Adapt patterns from ECC/houshuang, don't copy entire repos into `.claude/`

### Proposed `.claude/` Structure

```
.claude/
  settings.local.json           ← EXISTS (permissions only)
  agents/
    veldra-architect.md         ← Validates changes against VELDRA architecture
    veldra-researcher.md        ← Parallel web research + external docs
    veldra-reviewer.md          ← Code review against project conventions
    veldra-tester.md            ← Writes/runs tests
    veldra-mobile-qa.md         ← Audits UI at 320-430px viewports
    veldra-security.md          ← Security review, OWASP, credentials audit
    veldra-runtime.md           ← Analyzes orchestrator/execution/runtime
    veldra-docs.md              ← Keeps docs synchronized
  skills/
    verify-build/               ← Typecheck + lint + test + build
      SKILL.md
    android-cycle/              ← android:sync + Gradle build
      SKILL.md
    branch-archaeology/         ← Analyze branch diffs
      SKILL.md
    architecture-check/         ← Verify no duplication
      SKILL.md
    context-budget/             ← Estimate context usage
      SKILL.md
```

### Agent Specifications

Each agent should:
- **Clear Responsibility** - One domain, narrowly scoped
- **VELDRA-Specific** - References actual project architecture
- **Tool Allowlist** - Explicit allowed/denied tools
- **Example Prompts** - Shows typical invocations
- **Success Criteria** - Measurable outcomes

### Integration with VELDRA Product

**Development-time** (`.claude/` agents/skills):
- Help BUILD VELDRA during development
- Run inside Claude Code sessions
- Improve developer productivity

**Runtime** (`studio/` + `app/lib/orchestrator/`):
- Run INSIDE VELDRA app for end-users
- Product feature, not dev tool
- Monetization layer

**These are SEPARATE concerns - do not conflate them.**

---

## Implementation Priorities

### Phase 1: Foundation (Week 1-2)

**P0: AgentRunner MVP**
- Implement concrete `AgentRunner` (spawn, execute, collect results)
- Wire `subagentService.ts` into `ActionRunner`
- Add agent spawn/status to chat UI
- Test with one agent (file operations)

**P0: Skill Loader Runtime**
- Implement SKILL.md parser
- Create skill registry UI (Settings tab)
- Wire into ActionRunner
- Test with `verify-build` skill

**P0: Goal/Task Creation Flow**
- Add "Start Project" UI (Guided Build extension)
- Create `WorkflowRun` on project init
- Persist Goal/Tasks to IndexedDB
- Display task tree in workbench

### Phase 2: Context & Discovery (Week 3-4)

**P1: Context Engine MVP**
- Integrate `tree-sitter-typescript` for AST
- Build file relevance scorer
- Add prompt caching per provider
- Implement compaction strategy

**P1: MCP Discovery UI**
- Extend `CapabilityKind` with `'mcp-server'`
- Build MCP server registry UI
- Add install/enable flow
- Ship with official `filesystem`, `git`, `fetch` servers

**P1: Connector Layer**
- Implement `Connector` transport abstraction
- Add LAN discovery for Ollama/LMStudio
- Build QR pairing for Remote Runtime
- Document in settings UI

### Phase 3: Intelligence & Optimization (Week 5-6)

**P2: Local Model Capability Scoring**
- Device profiling (VRAM, CPU, quantization support)
- Model compatibility matrix
- Auto-select best local model for task
- Integrate with existing capability router

**P2: Android Production Chat**
- Deploy authenticated backend (Cloudflare Worker)
- Wire `AndroidApiClient` to backend
- Test LLM streaming on device
- Document deployment guide

**P2: Entitlement Enforcement**
- Runtime budget tracking
- Capability gates per tier
- Billing webhook scaffold
- Admin panel (tier assignment)

### Phase 4: Polish & Expansion (Week 7-8)

**P3: Advanced Features**
- Image generation provider integration (if credentials available)
- Multi-agent workflows (pipeline patterns from Claude Code)
- Memory/RAG system (inspired by claude-mem patterns)
- Advanced MCP servers (memory, sequentialthinking)

**P3: Documentation & Tooling**
- Comprehensive CLAUDE.md update
- Developer onboarding guide
- Agent/skill authoring guide
- Video demo (Veo prompt available)

---

## Technical Decisions

### TD-001: Use `app/lib/orchestrator/` as Product Layer

**Decision:** Treat `app/lib/orchestrator/` as the product-facing runtime orchestration system.

**Rationale:**
- Provider-agnostic by design
- Well-typed contracts
- Test coverage exists
- IndexedDB integration ready

**Implication:** `studio/` remains internal implementation logic, not a competing system.

### TD-002: Adapt External Agents, Don't Copy

**Decision:** Mine ECC/houshuang for *patterns*, create VELDRA-specific agent definitions.

**Rationale:**
- Generic agents reference bolt.diy, WebContainer, non-VELDRA architecture
- VELDRA has unique constraints (Android, Remote Runtime, provider-agnostic)
- License clarity requires selective adaptation

**Implication:** `.claude/agents/` will be hand-authored, not bulk-copied.

### TD-003: MCP as First-Class Capability Type

**Decision:** Extend `CapabilityKind` union with `'mcp-server'`, reuse `DiscoveryState`.

**Rationale:**
- MCP servers are discoverable, installable, require staged trust
- Existing registry architecture already models this
- Official Anthropic MCP servers (7) are MIT/Apache-2.0

**Implication:** MCP discovery UI reuses existing registry patterns.

### TD-004: Separate Dev-Time vs Runtime Agents

**Decision:** Maintain clear separation between `.claude/` (dev tooling) and product runtime agents.

**Rationale:**
- Confusion between these layers led to "duplicate orchestration" perception
- Dev agents help BUILD VELDRA; product agents run FOR end-users
- Different trust models, different UX

**Implication:** Documentation must emphasize this distinction.

### TD-005: Android Backend Remains Separate Service

**Decision:** Do not embed provider keys in APK; require authenticated backend.

**Rationale:**
- Aligns with existing Android LLM API bridge design (`docs/ANDROID_LLM_API_BRIDGE.md`)
- Security best practice
- Enables centralized rate limiting

**Implication:** Android production deployment requires backend setup.

---

## Risk Assessment

### High-Risk Items

1. **Scope Creep**
   - Mitigation: Strict phasing, "no" to unplanned features
   - Gate: Every feature must map to documented architecture gap

2. **Duplicate Orchestration**
   - Mitigation: TD-001 decision locks in `app/lib/orchestrator/` as primary
   - Gate: No new orchestration system creation

3. **License Violations**
   - Mitigation: Verify license before every external import
   - Gate: GPL/AGPL automatically rejected

4. **Over-Engineering**
   - Mitigation: MVP first, optimize later
   - Gate: Working vertical slice before horizontal expansion

### Medium-Risk Items

5. **Android Device Gap**
   - Mitigation: Playwright screenshots at mobile viewports
   - Limitation: Cannot catch device-specific WebView bugs
   - Gate: Requires physical device validation pass

6. **External Dependency Freshness**
   - Mitigation: Pin versions, document update strategy
   - Gate: Monthly dependency audit

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Agent spawned from chat produces visible output
- [ ] Skill invoked via `/skill-name` executes successfully
- [ ] Goal/Task tree visible in workbench
- [ ] All existing tests pass (273 tests)
- [ ] TypeScript/lint clean
- [ ] Android build succeeds

### Phase 2 Complete When:
- [ ] MCP server installed via UI
- [ ] Context engine reduces token usage (measured)
- [ ] Connector layer connects to LAN Ollama
- [ ] Phase 1 features regression-tested

### Phase 3 Complete When:
- [ ] Local model auto-selected based on device
- [ ] Android chat streams from production backend
- [ ] Budget enforcement blocks over-tier usage
- [ ] Phase 1-2 features regression-tested

### Phase 4 Complete When:
- [ ] Image generation produces real output (if provider available)
- [ ] Multi-agent workflow completes end-to-end
- [ ] CLAUDE.md reflects current architecture
- [ ] Demo video recorded

---

## Next Immediate Steps

1. **Mark Phase 5 Complete** - This document IS the project analysis
2. **Mark Phase 6 Complete** - This document IS the implementation plan
3. **Begin Phase 7 (Implementation)** - Start with P0: AgentRunner MVP
4. **Create Subagents for Parallel Work** - Architect, Researcher, Tester
5. **Run Verification After Each Slice** - Tests, typecheck, lint, build

---

## Appendix: External Resource Licenses

| Repository | License | Commercial Use | Notes |
|------------|---------|----------------|-------|
| everything-claude-code | MIT | ✅ Yes | Verified in repo |
| mcp-servers (official) | Apache-2.0/MIT | ✅ Yes | Official Anthropic |
| awesome-claude-code-houshuang | Unknown | ⚠️ Verify | Check before use |
| awesome-claude-code-toolkit | Unknown | ⚠️ Verify | Check before use |
| claude-mem | Unknown | ⚠️ Verify | Pattern reference only |
| ui-ux-pro-max-skill | Unknown | ⚠️ Verify | Already integrated |

**Action Required:** License audit of repositories marked "Unknown" before importing any code.

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-12 | Claude (Autonomous Mission) | Initial comprehensive plan |
