import { getVeldraHost } from './veldra-host';
import { SubagentService, type SpawnSubagentOptions } from '~/lib/services/subagentService';
import { createScopedLogger } from '~/utils/logger';
import type { AgentInvocation } from './adapters';

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
  // Legacy path (default for now)
  if (!isOrchestratorFeatureEnabled()) {
    logger.debug('Using legacy SubagentService path (orchestrator disabled)');
    return SubagentService.getInstance().spawnSubagent(options);
  }

  // Orchestrator path with fallback
  try {
    logger.info('Using orchestrator path for subagent spawn');

    const host = getVeldraHost(apiKeys, providerSettings);

    // Convert SubagentOptions to AgentInvocation
    const invocation: AgentInvocation = {
      role: 'subagent', // Generic role for now
      prompt: options.initialPrompt,
      requestedModel: options.model,
    };

    // Check policy gate
    const policyDenial = await host.policy.check('spawn-subagent', {
      model: options.model,
      prompt: options.initialPrompt,
    });

    if (policyDenial) {
      logger.warn('Subagent spawn denied by policy', { reason: policyDenial });
      throw new Error(`Policy denied subagent spawn: ${policyDenial}`);
    }

    // Run via orchestrator (max concurrency = 1 for single spawn)
    const results = await host.agents.run([invocation], 1);

    if (!results || results.length === 0) {
      throw new Error('Orchestrator returned no results');
    }

    const result = results[0];

    if (!result.output) {
      throw new Error('Orchestrator result has no output');
    }

    // Extract task ID from evidence or generate fallback
    const taskIdEvidence = result.evidence?.find((e) => e.source.startsWith('subagent:'));

    if (taskIdEvidence) {
      const taskId = taskIdEvidence.source.replace('subagent:', '');
      return `Subagent spawned via orchestrator. Task ID: ${taskId}`;
    }

    // Fallback message if no task ID in evidence
    return `Subagent spawned via orchestrator. Output: ${result.output.slice(0, 100)}...`;
  } catch (error) {
    logger.error('Orchestrator path failed, falling back to legacy', error);

    // Fallback to legacy
    return SubagentService.getInstance().spawnSubagent(options);
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
