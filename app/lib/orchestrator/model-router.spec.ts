import { describe, expect, it } from 'vitest';
import { selectModel } from './model-router';
import type { ModelCapabilities } from './registries';

function model(overrides: Partial<ModelCapabilities>): ModelCapabilities {
  return {
    provider: 'TestProvider',
    model: 'test-model',
    modalities: ['text'],
    contextWindow: 100_000,
    lastVerified: 0,
    availability: 'available',
    ...overrides,
  };
}

describe('selectModel', () => {
  it('rejects candidates missing a required capability rather than assuming they have it', () => {
    const noToolUse = model({ model: 'a', toolUse: undefined });
    const withToolUse = model({ model: 'b', toolUse: true });

    const result = selectModel([noToolUse, withToolUse], { requireToolUse: true });

    expect(result.outcome).toBe('selected');
    expect(result.outcome === 'selected' && result.decision.chosen).toBe('TestProvider:b');
    expect(result.outcome === 'selected' && result.decision.rejected).toEqual([
      { candidate: 'TestProvider:a', reason: 'tool use required but not confirmed supported' },
    ]);
  });

  it('never routes by model name -- only by verified capability fields', () => {
    const claudeNamed = model({ model: 'claude-sonnet-5', vision: undefined });
    const genericNamed = model({ model: 'unnamed-model-42', vision: true });

    const result = selectModel([claudeNamed, genericNamed], { requireVision: true });

    expect(result.outcome === 'selected' && result.decision.chosen).toBe('TestProvider:unnamed-model-42');
  });

  it('returns no-match with reasons when nothing satisfies the requirements', () => {
    const result = selectModel([model({ contextWindow: 8_000 })], { minContextWindow: 200_000 });

    expect(result.outcome).toBe('no-match');
    expect(result.outcome === 'no-match' && result.rejected).toEqual([
      { candidate: 'TestProvider:test-model', reason: 'context window 8000 is below the required 200000' },
    ]);
  });

  it('excludes a provider not in the allowed set, e.g. one without a configured API key', () => {
    const allowed = model({ model: 'a', provider: 'Anthropic' });
    const notAllowed = model({ model: 'b', provider: 'OpenAI' });

    const result = selectModel([allowed, notAllowed], { allowedProviders: ['Anthropic'] });

    expect(result.outcome === 'selected' && result.decision.chosen).toBe('Anthropic:a');
  });

  it('excludes a model the provider reports as unavailable', () => {
    const down = model({ model: 'down', availability: 'unavailable' });
    const up = model({ model: 'up', availability: 'available' });

    const result = selectModel([down, up], {});

    expect(result.outcome === 'selected' && result.decision.chosen).toBe('TestProvider:up');
  });

  it('breaks ties on largest context window by default', () => {
    const small = model({ model: 'small', contextWindow: 50_000 });
    const large = model({ model: 'large', contextWindow: 1_000_000 });

    const result = selectModel([small, large], {});

    expect(result.outcome === 'selected' && result.decision.chosen).toBe('TestProvider:large');
  });

  it('breaks ties on lowest known cost when optimizing for cost, treating unknown cost as worst', () => {
    const unknownCost = model({ model: 'unknown-cost', costPerMTokenInMinor: undefined });
    const cheap = model({ model: 'cheap', costPerMTokenInMinor: 100 });
    const expensive = model({ model: 'expensive', costPerMTokenInMinor: 500 });

    const result = selectModel([unknownCost, cheap, expensive], { optimizeForCost: true });

    expect(result.outcome === 'selected' && result.decision.chosen).toBe('TestProvider:cheap');
    expect(result.outcome === 'selected' && result.decision.rejected.map((r) => r.candidate)).toEqual([
      'TestProvider:expensive',
      'TestProvider:unknown-cost',
    ]);
  });

  it('requires local availability only when explicitly asked', () => {
    const cloudOnly = model({ model: 'cloud', localAvailability: undefined });
    const result = selectModel([cloudOnly], { requireLocal: true });

    expect(result.outcome).toBe('no-match');
  });
});
