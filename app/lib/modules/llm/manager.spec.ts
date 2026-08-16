import { describe, it, expect, beforeEach } from 'vitest';

/*
 * Side-effect-only, must stay first: app/utils/constants.ts eagerly calls
 * LLMManager.getInstance() at module scope, and providers/external-cli.ts imports
 * constants.ts back (manager.ts -> registry.ts -> external-cli.ts -> constants.ts ->
 * manager.ts). Real app code always reaches this cycle via constants.ts first, so
 * LLMManager is already defined by the time constants.ts needs it; importing manager.ts
 * directly as the entry point (the natural way to write this spec) hits the cycle from the
 * other side and crashes with "Cannot read properties of undefined (reading 'getInstance')"
 * -- LLMManager isn't exported yet at that point in the load graph. This import forces the
 * same order the real app uses. Pre-existing fragility, not something this spec fixes.
 */
import '~/utils/constants';

import { LLMManager } from './manager';
import { BaseProvider } from './base-provider';
import type { ModelInfo } from './types';
import type { IProviderSetting } from '~/types/model';

/**
 * LLMManager had zero test coverage before this file (see Block 11 discovery audit) --
 * neither its provider-registration logic, its static/dynamic model merge, nor the
 * retired-model exclusion added alongside these tests. Uses lightweight fake providers
 * rather than the real ~25 registered providers so tests don't depend on real API keys or
 * make network calls.
 */

class FakeProviderA extends BaseProvider {
  name = 'FakeProviderA';
  config = {};
  staticModels: ModelInfo[] = [
    { name: 'model-a-static', label: 'A Static', provider: 'FakeProviderA', maxTokenAllowed: 1000 },
    { name: 'model-a-shared', label: 'A Shared (static)', provider: 'FakeProviderA', maxTokenAllowed: 1000 },
    {
      name: 'model-a-retired',
      label: 'A Retired',
      provider: 'FakeProviderA',
      maxTokenAllowed: 1000,
      status: 'retired',
    },
  ];

  async getDynamicModels(): Promise<ModelInfo[]> {
    return [
      { name: 'model-a-shared', label: 'A Shared (dynamic)', provider: 'FakeProviderA', maxTokenAllowed: 2000 },
      { name: 'model-a-dynamic-only', label: 'A Dynamic Only', provider: 'FakeProviderA', maxTokenAllowed: 2000 },
    ];
  }

  getModelInstance(): never {
    throw new Error('not used in tests');
  }
}

class FakeProviderADuplicate extends BaseProvider {
  name = 'FakeProviderA';
  config = {};
  staticModels: ModelInfo[] = [
    {
      name: 'model-a-duplicate-provider',
      label: 'Should never register',
      provider: 'FakeProviderA',
      maxTokenAllowed: 1,
    },
  ];
  getModelInstance(): never {
    throw new Error('not used in tests');
  }
}

class FakeProviderNoDynamic extends BaseProvider {
  name = 'FakeProviderNoDynamic';
  config = {};
  staticModels: ModelInfo[] = [
    { name: 'model-b-static', label: 'B Static', provider: 'FakeProviderNoDynamic', maxTokenAllowed: 500 },
    {
      name: 'model-b-retired',
      label: 'B Retired',
      provider: 'FakeProviderNoDynamic',
      maxTokenAllowed: 500,
      status: 'retired',
    },
  ];
  getModelInstance(): never {
    throw new Error('not used in tests');
  }
}

describe('LLMManager', () => {
  let manager: LLMManager;

  beforeEach(() => {
    /*
     * Force a fresh singleton per test -- the real constructor also registers every
     * production provider from registry.ts, which is fine (tests scope assertions to
     * their own fake provider names) but must not leak registered fakes across tests.
     */
    (LLMManager as unknown as { _instance?: LLMManager })._instance = undefined;
    manager = LLMManager.getInstance({});
  });

  it('registers a provider and includes its non-retired static models in getModelList()', () => {
    manager.registerProvider(new FakeProviderA());

    const names = manager
      .getModelList()
      .filter((m) => m.provider === 'FakeProviderA')
      .map((m) => m.name);

    expect(names).toContain('model-a-static');
    expect(names).toContain('model-a-shared');
    expect(names).not.toContain('model-a-retired');
  });

  it('skips registering a second provider with an already-registered name', () => {
    const first = new FakeProviderA();
    manager.registerProvider(first);
    manager.registerProvider(new FakeProviderADuplicate());

    expect(manager.getProvider('FakeProviderA')).toBe(first);

    const names = manager
      .getModelList()
      .filter((m) => m.provider === 'FakeProviderA')
      .map((m) => m.name);
    expect(names).not.toContain('model-a-duplicate-provider');
  });

  it('getStaticModelList excludes retired models', () => {
    manager.registerProvider(new FakeProviderNoDynamic());

    const names = manager
      .getStaticModelList()
      .filter((m) => m.provider === 'FakeProviderNoDynamic')
      .map((m) => m.name);

    expect(names).toEqual(['model-b-static']);
  });

  it('getModelListFromProvider merges dynamic over static by name, keeps dynamic-only and static-only entries, and excludes retired', async () => {
    const provider = new FakeProviderA();
    manager.registerProvider(provider);

    const list = await manager.getModelListFromProvider(provider, {});
    const byName = new Map(list.map((m) => [m.name, m]));

    // Dynamic wins for the shared name -- static's stale maxTokenAllowed must not survive.
    expect(byName.get('model-a-shared')?.maxTokenAllowed).toBe(2000);
    expect(byName.get('model-a-shared')?.label).toBe('A Shared (dynamic)');

    expect(byName.has('model-a-dynamic-only')).toBe(true);
    expect(byName.has('model-a-static')).toBe(true);
    expect(byName.has('model-a-retired')).toBe(false);

    // No duplicate entries for the name present in both sources.
    expect(list.filter((m) => m.name === 'model-a-shared')).toHaveLength(1);
  });

  it('getModelListFromProvider returns static models unfiltered by dynamic data when the provider has no getDynamicModels', async () => {
    const provider = new FakeProviderNoDynamic();
    manager.registerProvider(provider);

    const list = await manager.getModelListFromProvider(provider, {});

    expect(list.map((m) => m.name)).toEqual(['model-b-static']);
  });

  it('updateModelList merges across providers, prefers dynamic data, and excludes retired models', async () => {
    manager.registerProvider(new FakeProviderA());
    manager.registerProvider(new FakeProviderNoDynamic());

    /*
     * Disable every real production provider registered by the constructor so only the
     * fakes' getDynamicModels (canned, no network) run -- real providers would otherwise
     * each attempt a live fetch.
     */
    const providerSettings: Record<string, IProviderSetting> = {};

    for (const p of manager.getAllProviders()) {
      providerSettings[p.name] = { enabled: p.name === 'FakeProviderA' || p.name === 'FakeProviderNoDynamic' };
    }

    const list = await manager.updateModelList({ providerSettings });
    const names = list.map((m) => m.name);

    expect(names).toContain('model-a-shared');
    expect(names).toContain('model-a-dynamic-only');
    expect(names).toContain('model-b-static');
    expect(names).not.toContain('model-a-retired');
    expect(names).not.toContain('model-b-retired');
    expect(names.filter((n) => n === 'model-a-shared')).toHaveLength(1);
  });
});
