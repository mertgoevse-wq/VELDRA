import { getVeldraHost } from './veldra-host';
import { SubagentService, type SpawnSubagentOptions } from '~/lib/services/subagentService';
import { createScopedLogger } from '~/utils/logger';
import type { Goal, Task } from './types';
import { createWorkflowRun, runWorkflow } from './run-workflow';
import { checkBudget } from './budget';
import { resolveBudgetPolicy } from './entitlement';
import { entitlementTierStore } from '~/lib/stores/entitlement';
import { getRuntimeEnvironment } from '~/lib/dev/runtime-environment';

const logger = createScopedLogger('orchestrator-integration');

/**
 * Check if orchestrator integration is enabled.
 *
 * Checks at runtime (not import-time) to allow tests to override.
 *
 * Can be controlled via environment variable:
 * VELDRA_USE_ORCHESTRATOR=true
 */
function isOrchestratorFeatureEnabled(): boolean {
  return typeof process !== 'undefined' && process.env?.VELDRA_USE_ORCHESTRATOR === 'true';
}

/**
 * Spawn a subagent using the orchestrator (if enabled) or legacy path (fallback).
 *
 * This is the **integration bridge** between:
 * - Legacy: SubagentService (direct LLM invocation)
 * - New: OrchestratorHost → VeldraAgentRunner → SubagentService
 *
 * **Behavior**:
 * 1. If USE_ORCHESTRATOR=true: Try orchestrator path
 * 2. If orchestrator fails: Log error, fall back to legacy
 * 3. If USE_ORCHESTRATOR=false: Use legacy path directly
 *
 * **Why this exists**:
 * - Allows gradual migration from legacy to orchestrator
 * - Provides safety net (fallback) during transition
 * - Enables A/B testing of orchestrator vs legacy
 * - Maintains backward compatibility
 *
 * As of the "real runtime foundation" round (see run-workflow.ts), the orchestrator
 * path no longer calls host.agents.run() directly: it builds a single-task WorkflowRun
 * and drives it through runWorkflow(), so a spawn taken this way actually exercises the
 * real state machine, event emission and persistence that exist for it now, not just a
 * bare AgentRunner call with the state machine sitting unused beside it.
 *
 * @param options - Subagent spawn options
 * @param apiKeys - API keys for LLM providers
 * @param providerSettings - Provider-specific settings
 * @returns Task ID message from subagent spawn
 */
export async function spawnSubagentWithOrchestrator(
  options: SpawnSubagentOptions,
  apiKeys?: any,
  providerSettings?: any,
): Promise<string> {
  /*
   * options.apiKeys/providerSettings win if a caller already set them there (SpawnSubagentOptions
   * carries both); otherwise fall back to the separate params. Without this merge, a caller that
   * passes credentials only via the separate params (as the orchestrator path below already
   * requires, for getVeldraHost) would silently lose them on either the disabled-flag path or the
   * post-failure fallback -- degrading to an unauthenticated call instead of an equivalent one.
   */
  const legacyOptions: SpawnSubagentOptions = {
    ...options,
    apiKeys: options.apiKeys ?? apiKeys,
    providerSettings: options.providerSettings ?? providerSettings,
  };

  // Legacy path (default for now)
  if (!isOrchestratorFeatureEnabled()) {
    logger.debug('Using legacy SubagentService path (orchestrator disabled)');
    return SubagentService.getInstance().spawnSubagent(legacyOptions);
  }

  // Orchestrator path with fallback
  try {
    logger.info('Using orchestrator path for subagent spawn');

    const host = getVeldraHost(apiKeys, providerSettings);
    const budget = resolveBudgetPolicy(entitlementTierStore.get(), getRuntimeEnvironment()).budget;

    /*
     * A budget that can't even afford one iteration before any work has happened (e.g.
     * FREE tier's maxCostMinor: 0 -- checkBudget's `used >= allowed` trips on 0 >= 0
     * immediately) would make runWorkflow's very first budget check request an approval
     * via host.approvals.request(), which genuinely suspends until something calls
     * respond() (see veldra-approvals.ts) -- and nothing does yet, no approval UI is
     * wired up. That would hang this call forever instead of falling back. Treat "this
     * tier can't afford a single iteration" the same as a policy denial: fall back to
     * legacy immediately rather than attempt a run that can never resolve.
     */
    const zeroUsage = { elapsedMs: 0, tokens: 0, costMinor: 0, iterations: 0 };
    const preflightViolation = checkBudget(budget, zeroUsage);

    if (preflightViolation) {
      throw new Error(`Tier budget cannot support even one orchestrator iteration: ${preflightViolation.message}`);
    }

    const goal: Goal = {
      id: crypto.randomUUID(),
      text: options.initialPrompt,
      openQuestions: [],
    };
    const task: Task = {
      id: crypto.randomUUID(),
      goalId: goal.id,
      title: `Spawn subagent (${options.model})`,
      dependsOn: [],
    };

    let lastAgentOutput = '';
    const finishedRun = await runWorkflow(createWorkflowRun(goal, [task], budget), host, {
      taskToInvocation: () => ({
        role: 'subagent', // Generic role for now
        prompt: options.initialPrompt,
        requestedModel: options.model,
      }),
      requiredCapability: 'spawn-subagent',
      maxConcurrency: 1,
      onEvent: (event) => {
        if (event.type === 'agent.completed' || event.type === 'agent.failed') {
          const output = event.data.output;

          if (typeof output === 'string') {
            lastAgentOutput = output;
          }
        }
      },
    });

    if (finishedRun.state !== 'completed') {
      throw new Error(
        `Orchestrator workflow ended in state '${finishedRun.state}'` +
          (finishedRun.haltReason ? `: ${finishedRun.haltReason}` : ''),
      );
    }

    // Extract task ID from evidence or fall back to the captured agent output
    const taskIdEvidence = finishedRun.tasks[0]?.evidence.find((e) => e.source.startsWith('subagent:'));

    if (taskIdEvidence) {
      const taskId = taskIdEvidence.source.replace('subagent:', '');
      return `Subagent spawned via orchestrator. Task ID: ${taskId}`;
    }

    return `Subagent spawned via orchestrator. Output: ${lastAgentOutput.slice(0, 100)}...`;
  } catch (error) {
    logger.error('Orchestrator path failed, falling back to legacy', error);

    // Fallback to legacy
    return SubagentService.getInstance().spawnSubagent(legacyOptions);
  }
}

/**
 * Check if orchestrator integration is enabled.
 *
 * Useful for UI indicators or logging.
 */
export function isOrchestratorEnabled(): boolean {
  return isOrchestratorFeatureEnabled();
}

/**
 * Get orchestrator status for debugging/monitoring.
 */
export function getOrchestratorStatus(): {
  enabled: boolean;
  mode: 'orchestrator' | 'legacy' | 'fallback';
  host: 'veldra-app';
} {
  const enabled = isOrchestratorFeatureEnabled();

  return {
    enabled,
    mode: enabled ? 'orchestrator' : 'legacy',
    host: 'veldra-app',
  };
}
