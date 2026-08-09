import type { ModelInfo } from '~/lib/modules/llm/types';
import { selectModel, type ModelSelectionCriteria, type ModelSelectionResult } from './model-router';
import type { ModelCapabilities } from './registries';

export interface RoutedModelInfo {
  model: ModelInfo;
  result: Extract<ModelSelectionResult, { outcome: 'selected' }>;
}

/**
 * Projects the established provider model contract into the capability router.
 *
 * ModelInfo only verifies the provider, model id, and context/output limits.
 * Availability is kept unknown because a catalog entry alone does not prove
 * that the provider is reachable for this request. All other capability fields
 * intentionally remain unknown, so a hard request for tools, vision, reasoning,
 * or local execution fails closed.
 */
export function toModelCapabilities(model: ModelInfo): ModelCapabilities {
  return {
    provider: model.provider,
    model: model.name,
    modalities: ['text'],
    contextWindow: model.maxTokenAllowed,
    ...(model.maxCompletionTokens !== undefined && { maxOutputTokens: model.maxCompletionTokens }),
    lastVerified: 0,
    availability: 'unknown',
  };
}

/**
 * Selects one existing provider model and keeps the full router decision for
 * transparent UI/audit annotations. Returns null when no candidate satisfies
 * the requested verified capabilities.
 */
export function routeModelInfo(
  models: ModelInfo[],
  criteria: ModelSelectionCriteria = {},
  now: number = Date.now(),
): RoutedModelInfo | null {
  const candidates = models.filter(
    (model) => model.name.trim().length > 0 && model.provider.trim().length > 0 && model.maxTokenAllowed > 0,
  );
  const candidateByKey = new Map(candidates.map((model) => [`${model.provider}:${model.name}`, model]));
  const result = selectModel(candidates.map(toModelCapabilities), criteria, now);

  if (result.outcome !== 'selected') {
    return null;
  }

  const selectedModel = candidateByKey.get(result.decision.chosen);

  if (!selectedModel) {
    return null;
  }

  return { model: selectedModel, result };
}

/**
 * Resolves the model sentinel used by the chat request before provider
 * construction. Keeping this seam pure makes the server integration testable
 * without credentials or a live provider.
 */
export function resolveAutoModelInfo(
  models: ModelInfo[],
  providerName: string,
  now: number = Date.now(),
): RoutedModelInfo | null {
  return routeModelInfo(models, { allowedProviders: [providerName] }, now);
}
