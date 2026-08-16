// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ModelSelector } from './ModelSelector';
import type { ProviderInfo } from '~/types/model';
import type { ModelInfo } from '~/lib/modules/llm/types';

/**
 * Covers the model-level self-heal effect added alongside the Block 11 model-registry
 * fixes: ModelSelector already had a provider-level fallback effect (resets to the first
 * provider when the selected one drops out of providerList) but nothing equivalent for the
 * model itself -- a persisted model no longer present in modelList for an otherwise-valid
 * provider (e.g. a retired id carried over from a previous session) previously just
 * rendered the literal string "Select model" instead of self-correcting. Flagged as an
 * untested high-severity gap by the discovery audit; this is the first ModelSelector test
 * in the codebase.
 */

describe('ModelSelector -- model-level fallback', () => {
  afterEach(() => {
    cleanup();
  });

  const provider: ProviderInfo = {
    name: 'Anthropic',
    staticModels: [],
  } as unknown as ProviderInfo;

  const modelList: ModelInfo[] = [
    { name: 'claude-opus-5', label: 'Claude Opus 5', provider: 'Anthropic', maxTokenAllowed: 1000000 },
    { name: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'Anthropic', maxTokenAllowed: 1000000 },
  ];

  it('self-corrects to the first available model when the persisted model is no longer in modelList for a still-valid provider', () => {
    const setModel = vi.fn();

    render(
      <ModelSelector
        model="claude-3-5-sonnet-20241022"
        setModel={setModel}
        provider={provider}
        setProvider={vi.fn()}
        modelList={modelList}
        providerList={[provider]}
        apiKeys={{}}
      />,
    );

    expect(setModel).toHaveBeenCalledWith('claude-opus-5');
  });

  it('does not touch a model that is still present in modelList', () => {
    const setModel = vi.fn();

    render(
      <ModelSelector
        model="claude-sonnet-5"
        setModel={setModel}
        provider={provider}
        setProvider={vi.fn()}
        modelList={modelList}
        providerList={[provider]}
        apiKeys={{}}
      />,
    );

    expect(setModel).not.toHaveBeenCalled();
  });

  it("does not correct while this provider's dynamic fetch is still in flight (modelList not yet populated for the provider)", () => {
    const setModel = vi.fn();

    render(
      <ModelSelector
        model="claude-3-5-sonnet-20241022"
        setModel={setModel}
        provider={provider}
        setProvider={vi.fn()}
        modelList={[]}
        providerList={[provider]}
        apiKeys={{}}
        modelLoading="Anthropic"
      />,
    );

    expect(setModel).not.toHaveBeenCalled();
  });
});
