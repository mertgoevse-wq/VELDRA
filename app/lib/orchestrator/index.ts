/**
 * VELDRA Orchestrator — Portable Multi-Agent Coordination
 *
 * This module provides the orchestration layer for spawning and coordinating
 * multiple agents, managing budgets, enforcing policies, and collecting evidence.
 *
 * **Architecture**:
 * - `types.ts`, `adapters.ts`, `budget.ts`, `events.ts`, `run-workflow.ts` — portable core.
 *   No host, no LLM, no UI import (see project/ARCHITECTURE-ORCHESTRATOR.md). This is what
 *   must run unchanged inside Claude Code, Freebuff, and the Veldra app.
 * - `veldra-host.ts`, `veldra-agent-runner.ts`, `veldra-approvals.ts`, `veldra-policy.ts` —
 *   VELDRA-app's concrete OrchestratorHost + port implementations.
 * - `integration.ts` — Gradual migration wrapper with legacy fallback.
 *
 * **Usage**:
 * ```typescript
 * import { getVeldraHost, createWorkflowRun, runWorkflow } from '~/lib/orchestrator';
 *
 * const host = getVeldraHost(apiKeys, providerSettings, db);
 * const run = createWorkflowRun(goal, tasks, budget);
 * const finished = await runWorkflow(run, host, {
 *   taskToInvocation: (task) => ({ role: task.title, prompt: '...' }),
 *   onEvent: (event) => console.log(event.type, event.data),
 * });
 * ```
 *
 * **Current Status** (2026-08-15):
 * - ✅ VeldraAgentRunner fully functional (spawns real subagents via SubagentService)
 * - ✅ Integration wrapper with legacy fallback (VELDRA_USE_ORCHESTRATOR flag, off by default)
 * - ✅ ApprovalPort: real suspend/resume handoff (veldra-approvals.ts) -- no UI consumes
 *   pendingApprovalsStore yet, but the runtime contract is real, not a stub
 * - ✅ PolicyGate: real entitlement-tier gate (veldra-policy.ts) -- client-side only, see
 *   its doc comment for what that does and doesn't guarantee
 * - ✅ RunStore: wired to the existing IndexedDB-backed store when a db handle is supplied
 * - ✅ WorkflowRun driver (run-workflow.ts): actually drives idle->running->
 *   (awaiting-approval<->running)->completed/failed/cancelled, respecting budget, policy,
 *   task dependencies, and collecting Evidence -- the piece
 *   project/ARCHITECTURE-ORCHESTRATOR.md's "What is deliberately NOT modelled here yet"
 *   flagged as the real gap ("nothing... currently creates a WorkflowRun")
 * - ❌ ModelCatalog not implemented (no catalog yet)
 * - ❌ Task DECOMPOSITION from a Goal (i.e. planning) is not built -- callers of
 *   createWorkflowRun must supply an already-built Task[] graph
 * - ❌ Nothing in the live chat/UI path creates a WorkflowRun yet -- this is foundation,
 *   not integration; see docs/ai-state/DECISIONS.md's 2026-08-15 entries for what's next
 */

// Core adapters and types
export type {
  OrchestratorHost,
  AgentRunner,
  AgentInvocation,
  AgentResult,
  ApprovalPort,
  ApprovalRequest,
  ApprovalResponse,
  PolicyGate,
  RunStore,
  ModelCatalog,
  Evidence,
  CapabilityResolver,
  ModelCapabilities,
} from './adapters';

// VELDRA implementations
export { VeldraOrchestratorHost, getVeldraHost } from './veldra-host';
export { VeldraAgentRunner } from './veldra-agent-runner';
export { createVeldraApprovalPort, pendingApprovalsStore, type VeldraApprovalPort } from './veldra-approvals';
export { createVeldraPolicyGate } from './veldra-policy';

// Integration layer (gradual migration)
export { spawnSubagentWithOrchestrator, isOrchestratorEnabled, getOrchestratorStatus } from './integration';

// Workflow event model — see events.ts's doc comment for the "no fake events" contract.
export {
  createWorkflowEvent,
  createWorkflowEventEmitter,
  type WorkflowEvent,
  type WorkflowEventType,
  type WorkflowEventListener,
  type WorkflowEventEmitter,
} from './events';

/*
 * WorkflowRun driver — see run-workflow.ts's doc comment for what this does and doesn't do
 * (task decomposition/planning from a Goal is NOT built here).
 */
export {
  createWorkflowRun,
  runWorkflow,
  canTransition,
  transitionWorkflow,
  type RunWorkflowOptions,
} from './run-workflow';

// Supporting types and utilities
export type {
  Goal,
  Task,
  TaskState,
  Budget,
  BudgetUsage,
  RoutingDecision,
  VerificationRequirement,
  ApprovalKind,
  FailureFingerprint,
  WorkflowState,
  WorkflowRun,
} from './types';
