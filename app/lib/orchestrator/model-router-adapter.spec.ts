import { describe, expect, it } from 'vitest';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { resolveAutoModelInfo, routeModelInfo, toModelCapabilities } from './model-router-adapter';

function model(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    name: 'small-model',
    label: 'Small model',
    provider: 'TestProvider',
    maxTokenAllowed: 8_000,
    ...overrides,
  };
}

describe('model-router-adapter', () => {
  it('projects only verified ModelInfo fields into capabilities', () => {
    expect(toModelCapabilities(model({ maxCompletionTokens: 1_024 }))).toEqual({
      provider: 'TestProvider',
      model: 'small-model',
      modalities: ['text'],
      contextWindow: 8_000,
      maxOutputTokens: 1_024,
      lastVerified: 0,
      availability: 'unknown',
    });
  });

  it('routes to the model with the largest verified context window', () => {
    const result = routeModelInfo(
      [model(), model({ name: 'large-model', label: 'Large model', maxTokenAllowed: 128_000 })],
      {},
      123,
    );

    expect(result?.model.name).toBe('large-model');
    expect(result?.result.decision).toMatchObject({
      chosen: 'TestProvider:large-model',
      decidedAt: 123,
    });
  });

  it('resolves the chat Auto sentinel to a concrete model within the selected provider', () => {
    const result = resolveAutoModelInfo(
      [
        model({ provider: 'OtherProvider', name: 'other', maxTokenAllowed: 1_000_000 }),
        model({ provider: 'TestProvider', name: 'selected', maxTokenAllowed: 64_000 }),
      ],
      'TestProvider',
      456,
    );

    expect(result?.model.name).toBe('selected');
    expect(result?.result.decision).toMatchObject({
      chosen: 'TestProvider:selected',
      decidedAt: 456,
    });
  });

  it('fails closed when a required capability is not verified by ModelInfo', () => {
    const result = routeModelInfo([model({ name: 'candidate' })], { requireToolUse: true });

    expect(result).toBeNull();
  });

  it('ignores malformed candidates rather than routing to them', () => {
    const result = routeModelInfo([
      model({ name: '', maxTokenAllowed: 0 }),
      model({ name: 'valid', maxTokenAllowed: 16_000 }),
    ]);

    expect(result?.model.name).toBe('valid');
  });
});
