# VELDRA Core Functionality Analysis
**Date**: 2026-08-13  
**Status**: Critical Integration Gap Identified

## Current Request Flow

```
USER REQUEST (Web/Android)
  ↓
ROUTE (/app/routes/api.chat.ts)
  ↓
chatAction (/app/lib/.server/llm/chat-action.ts)
  ↓
streamText (/app/lib/.server/llm/stream-text.ts)
  ├─ LLMManager → Provider → Model
  ├─ SkillService.discoverSkills() ← ✅ INTEGRATED
  └─ MCPService → tools
      ├─ spawnSubagent ← ✅ WORKS (directly)
      └─ loadSkill ← ✅ WORKS
  ↓
RUNTIME
  ├─ WebContainer (browser)
  ├─ Remote Runtime (server)
  └─ Mobile Runtime (Capacitor)
  ↓
ACTION RUNNER (/app/lib/runtime/action-runner.ts)
  ↓
WORKBENCH UI
  ├─ BaseChat, ChatBox
  ├─ SubagentActivityWidget ← ✅ SHOWS subagents
  ├─ Terminal, Preview
  └─ Settings
```

## Critical Finding: Dual Architecture

VELDRA has **TWO PARALLEL ORCHESTRATION SYSTEMS**:

### 1. Legacy Direct Integration (ACTIVE)
```
MCPService (MCP tools)
  └─ SubagentService.spawnSubagent() ← DIRECT CALL
     └─ LLMManager → Provider → Model
        └─ subagentsStore (state management)
           └─ SubagentActivityWidget (UI visualization)
```

**Location**: `/app/lib/services/mcpService.ts` line 230
**Status**: ✅ WORKING, but bypasses orchestrator

### 2. Orchestrator Architecture (DORMANT)
```
OrchestratorHost (portable contracts)
  └─ VeldraAgentRunner (bridge implementation)
     └─ SubagentService.spawnSubagent()
        └─ [same as above]
```

**Location**: `/app/lib/orchestrator/veldra-agent-runner.ts`
**Status**: ⚠️ IMPLEMENTED, TESTED, BUT **NOT INTEGRATED**

## Integration Gap Details

### What Exists
✅ **Portable Contracts** (adapters.ts)
- `AgentInvocation` / `AgentResult`
- `AgentRunner` interface
- `OrchestratorHost` interface
- Clean separation for multi-platform support

✅ **VeldraAgentRunner Implementation**
- Implements `AgentRunner` interface
- Handles concurrency limits
- Token estimation
- Evidence collection
- **8,028 bytes, fully tested**

✅ **Supporting Infrastructure**
- `model-router.ts` — model selection logic
- `budget.ts` — token budget tracking
- `entitlement.ts` — permission/policy gates
- `registries.ts` — agent/skill registries

### What's Missing
❌ **Integration Points**
1. **No OrchestratorHost instance** created in VELDRA
2. **chatAction** doesn't use orchestrator
3. **streamText** doesn't route through AgentRunner
4. **MCPService** bypasses orchestrator entirely

❌ **Entry Point**
- No code path from user request → VeldraAgentRunner
- Direct SubagentService calls everywhere
- Orchestrator layer is "dead code" (unused at runtime)

## Services Integration Status

| Service | Location | Used By | Status |
|---------|----------|---------|--------|
| **SubagentService** | `/app/lib/services/subagentService.ts` | MCPService, VeldraAgentRunner | ✅ ACTIVE (bypassed by orchestrator) |
| **SkillService** | `/app/lib/services/skillService.ts` | stream-text, MCPService | ✅ ACTIVE |
| **MCPService** | `/app/lib/services/mcpService.ts` | stream-text, tools | ✅ ACTIVE |
| **VeldraAgentRunner** | `/app/lib/orchestrator/veldra-agent-runner.ts` | ❌ NONE | ⚠️ DORMANT |

## Why This Matters

### Current Problems
1. **No Unified Agent Orchestration**
   - Agent spawning is ad-hoc via MCP tools
   - No central concurrency control
   - No budget enforcement
   - No evidence collection

2. **Portability Goals Unmet**
   - Orchestrator designed for claude-code/freebuff/veldra portability
   - But VELDRA doesn't use the abstraction
   - Can't easily swap implementations

3. **Testing Mismatch**
   - VeldraAgentRunner has comprehensive tests
   - But tests don't reflect actual usage (zero usage)

4. **Architecture Drift**
   - Two patterns for same functionality
   - Confusion about which to use/extend
   - Technical debt accumulating

### Impact on Features
❌ **Multi-agent workflows** — no orchestrator coordination
❌ **Budget-aware agent spawning** — budget.ts unused
❌ **Policy gates** — entitlement.ts unused
❌ **Model routing** — model-router.ts not in flow
❌ **Evidence-based verification** — evidence collection dormant

## Recommendations

### Option A: Complete the Integration (Recommended)
**Effort**: Medium (2-4 hours)
**Benefit**: Unlocks all orchestrator features

1. Create OrchestratorHost instance in VELDRA
   ```typescript
   // app/lib/orchestrator/veldra-host.ts
   export const veldraHost: OrchestratorHost = {
     id: 'veldra-app',
     agents: new VeldraAgentRunner(apiKeys, providerSettings),
     approvals: veldraApprovalPort,
     policy: veldraPolicyGate,
     // ... optionally: runs, models, capabilities
   };
   ```

2. Integrate into streamText
   ```typescript
   // Instead of direct MCPService.spawnSubagent()
   const results = await veldraHost.agents.run(invocations, maxConcurrency);
   ```

3. Update MCPService to use orchestrator
   ```typescript
   // Replace direct SubagentService calls with AgentRunner
   ```

**Pros**:
- Unlocks budget control, policy gates, evidence
- Maintains clean architecture
- Enables future portability
- Tests become meaningful

**Cons**:
- Requires refactoring MCPService
- Need to implement ApprovalPort and PolicyGate
- Risk of breaking current working flow

### Option B: Remove Orchestrator Layer
**Effort**: Low (30 minutes)
**Benefit**: Eliminates dead code

Delete:
- `/app/lib/orchestrator/veldra-agent-runner.ts`
- `/app/lib/orchestrator/adapters.ts`
- Related test files

Keep:
- model-router.ts (useful)
- budget.ts (potentially useful)
- registries.ts (useful)

**Pros**:
- Simpler codebase
- No dead code
- Clear single pattern

**Cons**:
- Loses portable architecture
- Harder to add orchestration later
- Can't reuse claude-code patterns

### Option C: Hybrid Approach (Pragmatic)
**Effort**: Low-Medium (1-2 hours)
**Benefit**: Gradual migration path

1. Keep both systems for now
2. Add orchestrator integration for NEW features
3. Document the two patterns clearly
4. Plan gradual migration

**Pros**:
- No immediate risk
- Incremental improvement
- Learn from usage

**Cons**:
- Maintains dual architecture
- Confusion continues

## Recommended Next Steps

### Immediate (P0)
1. **Document the dual architecture** in CLAUDE.md
2. **Choose integration strategy** (A, B, or C)
3. **If choosing A**: Create veldra-host.ts with basic implementation
4. **If choosing A**: Integrate into one use case (e.g., spawnSubagent)
5. **Test end-to-end** with actual agent spawning

### Short-term (P1)
1. Implement ApprovalPort for user confirmations
2. Implement PolicyGate for permission checks
3. Connect budget.ts to actual token tracking
4. Use model-router for automatic model selection

### Long-term (P2)
1. Full orchestrator integration across all agent spawning
2. Remove legacy direct calls
3. Add run persistence (RunStore)
4. Add model catalog (ModelCatalog)

## Files to Investigate Next

**If integrating (Option A)**:
1. `/app/lib/orchestrator/adapters.ts` — understand contracts
2. `/app/lib/orchestrator/types.ts` — ApprovalRequest, PolicyGate
3. `/app/lib/.server/llm/stream-text.ts` — where to inject orchestrator
4. `/app/lib/services/mcpService.ts` — refactor spawn logic

**If simplifying (Option B)**:
1. Identify dependencies on orchestrator files
2. Extract useful patterns (model-router, budget)
3. Clean deletion of unused code

## Conclusion

VELDRA has a **sophisticated orchestrator architecture that is completely disconnected from the runtime flow**. This is a critical P0 issue because:

1. **Architecture vs Reality mismatch** — tests pass but code is unused
2. **Wasted development effort** — VeldraAgentRunner is well-implemented but dormant
3. **Missing features** — budget, policy, evidence, coordination all dormant
4. **Confusion for future development** — which pattern to follow?

**Recommendation**: Choose **Option A** (Complete Integration) to unlock the designed capabilities and avoid accumulating more technical debt.

---

**Next Action**: Decision required on integration strategy before continuing with P0 stabilization.
