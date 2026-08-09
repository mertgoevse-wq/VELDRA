import type { ModelCapabilities } from './registries';
import type { RoutingDecision } from './types';

/**
 * Capability-based model selection. Every filter here is a verified field on
 * ModelCapabilities -- there is deliberately no "route by model name" branch;
 * a model with an unknown capability is excluded from a hard requirement for
 * it rather than assumed to have it (the "unknown != false" rule cuts both
 * ways: unknown also never satisfies a requirement).
 */
export interface ModelSelectionCriteria {
  requireToolUse?: boolean;
  requireVision?: boolean;
  requireStructuredOutput?: boolean;
  requireStreaming?: boolean;
  requireReasoning?: boolean;
  requireLocal?: boolean;

  minContextWindow?: number;

  /** Restrict to these providers, e.g. providers with a configured API key right now. */
  allowedProviders?: string[];

  /** Break ties on lowest known cost instead of largest context window. Candidates with unknown cost sort last. */
  optimizeForCost?: boolean;
}

export type ModelSelectionResult =
  | { outcome: 'selected'; decision: RoutingDecision<string> }
  | { outcome: 'no-match'; rejected: Array<{ candidate: string; reason: string }> };

function modelKey(model: ModelCapabilities): string {
  return `${model.provider}:${model.model}`;
}

function rejectionReason(model: ModelCapabilities, criteria: ModelSelectionCriteria): string | null {
  if (criteria.allowedProviders && !criteria.allowedProviders.includes(model.provider)) {
    return `provider '${model.provider}' is not in the allowed set`;
  }

  if (model.availability === 'unavailable') {
    return 'provider reports this model as unavailable';
  }

  if (criteria.requireToolUse && !model.toolUse) {
    return 'tool use required but not confirmed supported';
  }

  if (criteria.requireVision && !model.vision) {
    return 'vision required but not confirmed supported';
  }

  if (criteria.requireStructuredOutput && !model.structuredOutput) {
    return 'structured output required but not confirmed supported';
  }

  if (criteria.requireStreaming && !model.streaming) {
    return 'streaming required but not confirmed supported';
  }

  if (criteria.requireReasoning && !model.reasoning?.supported) {
    return 'reasoning required but not confirmed supported';
  }

  if (criteria.requireLocal && !model.localAvailability) {
    return 'local execution required but not confirmed supported';
  }

  if (criteria.minContextWindow !== undefined && model.contextWindow < criteria.minContextWindow) {
    return `context window ${model.contextWindow} is below the required ${criteria.minContextWindow}`;
  }

  return null;
}

/**
 * Selects one model from a candidate pool. Never returns a bare model without
 * showing what lost and why (D-13's routing-transparency rule) -- callers
 * that only need the winner can read `.decision.chosen` and ignore the rest.
 */
export function selectModel(
  candidates: ModelCapabilities[],
  criteria: ModelSelectionCriteria = {},
  now: number = Date.now(),
): ModelSelectionResult {
  const rejected: Array<{ candidate: string; reason: string }> = [];
  const survivors: ModelCapabilities[] = [];

  for (const model of candidates) {
    const reason = rejectionReason(model, criteria);

    if (reason) {
      rejected.push({ candidate: modelKey(model), reason });
    } else {
      survivors.push(model);
    }
  }

  if (survivors.length === 0) {
    return { outcome: 'no-match', rejected };
  }

  const ranked = [...survivors].sort((a, b) => {
    if (criteria.optimizeForCost) {
      const costA = a.costPerMTokenInMinor ?? Number.POSITIVE_INFINITY;
      const costB = b.costPerMTokenInMinor ?? Number.POSITIVE_INFINITY;

      if (costA !== costB) {
        return costA - costB;
      }
    }

    return b.contextWindow - a.contextWindow;
  });

  const [chosen, ...rest] = ranked;
  const tieBreakReason = criteria.optimizeForCost
    ? 'higher cost (or unknown cost) than the chosen candidate'
    : 'smaller context window than the chosen candidate';

  return {
    outcome: 'selected',
    decision: {
      router: 'model',
      chosen: modelKey(chosen),
      rejected: [...rejected, ...rest.map((model) => ({ candidate: modelKey(model), reason: tieBreakReason }))],
      rationale: `satisfies all required capabilities; ranked first by ${criteria.optimizeForCost ? 'lowest known cost' : 'largest context window'} among survivors`,
      decidedAt: now,
    },
  };
}
