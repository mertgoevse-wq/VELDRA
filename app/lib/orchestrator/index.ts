/**
 * VELDRA Orchestrator — Portable Multi-Agent Coordination
 *
 * This module provides the orchestration layer for spawning and coordinating
 * multiple agents, managing budgets, enforcing policies, and collecting evidence.
 *
 * **Architecture**:
 * - `adapters.ts` — Portable contracts (AgentRunner, ApprovalPort, PolicyGate, etc.)
 * - `veldra-host.ts` — VELDRA's OrchestratorHost implementation
 * - `veldra-agent-runner.ts` — Bridge to SubagentService with concurrency control
 * - `integration.ts` — Gradual migration wrapper with legacy fallback
 *
 * **Usage**:
 * ```typescript
 * import { getVeldraHost, spawnSubagentWithOrchestrator } from '~/lib/orchestrator';
 *
 * // Get orchestrator host
 * const host = getVeldraHost(apiKeys, providerSettings);
 *
 * // Run agents via orchestrator
 * const results = await host.agents.run(invocations, maxConcurrency);
 *
 * // Or use integration wrapper (with fallback)
 * const taskId = await spawnSubagentWithOrchestrator(options, apiKeys, providerSettings);
 * ```
 *
 * **Current Status**:
 * - ✅ VeldraAgentRunner fully functional
 * - ✅ Integration wrapper with legacy fallback
 * - ⚠️ ApprovalPort stub (auto-approves, needs UI wiring)
 * - ⚠️ PolicyGate stub (auto-allows, needs settings integration)
 * - ❌ RunStore not implemented (no persistence yet)
 * - ❌ ModelCatalog not implemented (no catalog yet)
 *
 * **Future Enhancements**:
 * See CORE-FUNCTIONALITY-ANALYSIS-2026-08-13.md
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

// Integration layer (gradual migration)
export { spawnSubagentWithOrchestrator, isOrchestratorEnabled, getOrchestratorStatus } from './integration';

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
