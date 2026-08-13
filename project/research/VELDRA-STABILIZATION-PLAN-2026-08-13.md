# VELDRA Stabilization Plan
**Date**: 2026-08-13  
**Status**: In Progress  
**Environment**: proot-Debian ARM64 (Termux)

## Current State

### ✅ Working
- TypeScript compilation (no errors)
- Git repository (staged changes ready)
- Ecosystem repos linked (not yet utilized)
- File structure intact

### ⚠️ Issues
- Build fails with OOM (expected on ARM64/Termux)
- Lint errors (style only, auto-fixable)
- Ecosystem repos not yet integrated
- Core functionality untested

### 📝 Staged Changes
- Ecosystem symlinks (.claude/ecosystem/)
- Component updates (Chat, Settings, Workbench, Terminal)
- Orchestrator bridge (veldra-agent-runner.ts)
- LLM streaming updates
- Runtime modifications

## Priority 0: Stabilization

### P0.1 — Code Quality ✅ COMPLETE
- [x] TypeScript compilation
- [x] Fix lint errors (auto-fixable)
- [x] Verify imports resolve
- [x] Committed: `9a76a67` refactor(lint): fix ESLint violations

### P0.2 — Core Functionality Analysis ✅ COMPLETE
**Goal**: Verify the request flow actually works

**Analysis Complete**: See `CORE-FUNCTIONALITY-ANALYSIS-2026-08-13.md`

**Key Finding**: Dual architecture (legacy + orchestrator)
- Legacy path: MCPService → SubagentService ✅ WORKING
- Orchestrator path: VeldraHost → VeldraAgentRunner → SubagentService ⚠️ WAS DORMANT

**Solution Implemented**: Option C (Hybrid Approach)
- Created VeldraOrchestratorHost with full test coverage
- Created integration wrapper with feature flag + fallback
- Zero breaking changes to existing functionality
- Committed: Phase 1 orchestrator implementation

### P0.2.1 — Orchestrator PoC ✅ COMPLETE
- [x] Created VeldraOrchestratorHost (singleton, extensible)
- [x] Created integration wrapper with feature flag + fallback
- [x] Wrote comprehensive tests (23 tests, all passing)
- [x] Exported unified interface via index.ts
- [x] Committed: `68e0b07` feat(orchestrator)

### P0.3 — Ecosystem Integration Strategy ✅ COMPLETE

```
USER REQUEST
  ↓
ROUTING (app/routes/)
  ↓
AGENT ORCHESTRATION
  ├─ app/lib/orchestrator/veldra-agent-runner.ts
  ├─ app/lib/orchestrator/adapters.ts
  └─ app/lib/orchestrator/subagentService
  ↓
TOOL/SKILL EXECUTION
  ├─ SkillService
  ├─ MCPService
  └─ ToolRegistry
  ↓
SUBAGENT SPAWNING
  ↓
LLM PROVIDER LAYER
  ├─ app/lib/.server/llm/stream-text.ts
  ├─ app/lib/modules/llm/providers/
  └─ Provider adapters
  ↓
RUNTIME
  ├─ WebContainer (browser)
  ├─ Remote runtime (server)
  └─ Mobile runtime (Capacitor)
  ↓
ACTION RUNNER
  └─ app/lib/runtime/action-runner.ts
  ↓
WORKBENCH UI
  ├─ Chat (BaseChat, ChatBox)
  ├─ Terminal (TerminalTabs)
  ├─ Preview
  └─ SubagentActivityWidget
  ↓
RESULT TO USER
```

**Tasks**:
- [ ] Trace a sample request through this flow
- [ ] Identify broken connections
- [ ] Fix integration points
- [ ] Verify each layer can call the next

### P0.3 — Ecosystem Integration Strategy

**Available Resources** (in /root/repos/):
- everything-claude-code (ECC) — full reference implementation
- awesome-claude-code-subagents — agent patterns
- awesome-claude-code — skills, commands, hooks
- mcp-servers — MCP server catalog
- mcp-specification — protocol spec

**Integration Approach** (not blind copy):
1. **Analyze**: Study ECC architecture for patterns
2. **Extract**: Identify reusable concepts/algorithms
3. **Adapt**: Create VELDRA-native implementations
4. **Test**: Verify each integration works

**Priority Integrations**:
- [ ] Code reviewer agent (from subagents repo)
- [ ] Architecture reviewer agent
- [ ] Build error resolver agent
- [ ] Testing patterns (from ECC)
- [ ] Context management (from ECC)
- [ ] Token optimization (from ECC)

### P0.4 — Runtime Validation
- [ ] Dev server starts (`npm run dev`)
- [ ] Basic chat interaction works
- [ ] Terminal connects
- [ ] Preview renders
- [ ] WebContainer initializes

## Priority 1: UI/UX

### P1.1 — Component Functionality
- [ ] BaseChat message handling
- [ ] ChatBox input/submit flow
- [ ] SubagentActivityWidget real-time updates
- [ ] TerminalTabs shell connection
- [ ] Preview iframe security

### P1.2 — Settings Integration
- [ ] RuntimeModeTab provider selection
- [ ] SettingsTab persistence
- [ ] Model/provider configuration
- [ ] API key management

### P1.3 — Mobile Runtime
- [ ] Capacitor integration
- [ ] Android build (if resources allow)
- [ ] File system access
- [ ] Share functionality

## Priority 1: MCP

### P1.1 — Core MCP Servers
Evaluate and integrate (from mcp-specification):
- [ ] filesystem (file operations)
- [ ] git (repository operations)
- [ ] memory (context persistence)

### P1.2 — MCP Protocol
- [ ] Server discovery
- [ ] Tool registration
- [ ] Capability negotiation
- [ ] Error handling

## Priority 2: Polish

### P2.1 — Testing
- [ ] Unit tests for orchestrator
- [ ] Integration tests for agent flow
- [ ] E2E tests for critical paths
- [ ] Test coverage >80%

### P2.2 — Documentation
- [ ] Architecture overview
- [ ] Component interaction map
- [ ] Setup instructions
- [ ] Ecosystem integration guide

### P2.3 — Performance
- [ ] Bundle size optimization
- [ ] Lazy loading
- [ ] Code splitting
- [ ] Memory management

## Constraints

### Environment
- **Platform**: proot-Debian ARM64
- **RAM**: Limited (build OOM expected)
- **Strategy**: Dev server + typecheck, skip production builds

### Development Flow
1. Make changes
2. Run typecheck (`npm run typecheck`)
3. Run lint:fix (`npm run lint:fix`)
4. Test in dev server
5. Commit logical units

### No-Go Actions
- ❌ Don't discard staged changes
- ❌ Don't copy entire ecosystem repos
- ❌ Don't install unnecessary dependencies
- ❌ Don't use `--no-verify` without justification
- ❌ Don't commit secrets

## Next Steps

### Immediate (Autonomous)
1. Fix lint errors → `npm run lint:fix`
2. Analyze orchestrator layer
3. Trace request flow
4. Identify broken connections
5. Fix critical integration points

### After P0
1. Test dev server
2. Analyze ECC patterns
3. Implement critical agent types
4. Enhance UI/UX
5. MCP integration

## Success Criteria

### P0 Complete
- ✅ Typecheck passes
- ✅ Lint passes
- ✅ Core flow traced and validated
- ✅ Critical bugs fixed
- ✅ Dev server runs

### P1 Complete
- ✅ UI components functional
- ✅ Settings persist
- ✅ MCP servers integrated
- ✅ Agent orchestration works end-to-end

### P2 Complete
- ✅ Tests passing (>80% coverage)
- ✅ Documentation complete
- ✅ Performance optimized
- ✅ Production-ready (when built on suitable hardware)
