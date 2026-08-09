import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearSandboxProviders,
  listSandboxProviders,
  registerSandboxProvider,
  satisfiesRequirements,
  selectSandboxProvider,
} from './registry';
import type { SandboxCapabilities, SandboxProvider } from './types';

const FULL_CAPABILITIES: SandboxCapabilities = {
  interactiveShell: true,
  fileWatch: true,
  publicPreviewUrl: true,
  persistentFilesystem: true,
  network: 'full',
  maxSessionMs: null,
};

function stubProvider(id: string, capabilities: Partial<SandboxCapabilities> = {}, available = true): SandboxProvider {
  return {
    id,
    label: id,
    capabilities: { ...FULL_CAPABILITIES, ...capabilities },
    isAvailable: async () => available,
    create: async () => {
      throw new Error('not implemented in stub');
    },
  };
}

describe('sandbox provider registry', () => {
  beforeEach(() => {
    clearSandboxProviders();
  });

  it('registers and lists providers', () => {
    registerSandboxProvider(stubProvider('a'));
    registerSandboxProvider(stubProvider('b'));

    expect(listSandboxProviders().map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('rejects duplicate ids so a typo cannot silently shadow a provider', () => {
    registerSandboxProvider(stubProvider('a'));

    expect(() => registerSandboxProvider(stubProvider('a'))).toThrow(/already registered/);
  });

  describe('satisfiesRequirements', () => {
    it('accepts when no requirements are given', () => {
      expect(satisfiesRequirements(FULL_CAPABILITIES, {})).toBe(true);
    });

    it('rejects a missing boolean capability', () => {
      expect(satisfiesRequirements({ ...FULL_CAPABILITIES, publicPreviewUrl: false }, { publicPreviewUrl: true })).toBe(
        false,
      );
    });

    it('ignores a capability the caller does not require', () => {
      expect(satisfiesRequirements({ ...FULL_CAPABILITIES, publicPreviewUrl: false }, { interactiveShell: true })).toBe(
        true,
      );
    });

    it('ranks network levels rather than comparing them literally', () => {
      const outbound = { ...FULL_CAPABILITIES, network: 'outbound' as const };

      expect(satisfiesRequirements(outbound, { minNetwork: 'outbound' })).toBe(true);
      expect(satisfiesRequirements(outbound, { minNetwork: 'full' })).toBe(false);
      expect(satisfiesRequirements({ ...FULL_CAPABILITIES, network: 'none' }, { minNetwork: 'outbound' })).toBe(false);
    });
  });

  describe('selectSandboxProvider', () => {
    it('follows the caller preference order', async () => {
      registerSandboxProvider(stubProvider('remote'));
      registerSandboxProvider(stubProvider('local'));

      const selected = await selectSandboxProvider({}, ['local', 'remote']);

      expect(selected?.id).toBe('local');
    });

    it('skips providers that lack a required capability', async () => {
      registerSandboxProvider(stubProvider('local', { publicPreviewUrl: false }));
      registerSandboxProvider(stubProvider('remote'));

      const selected = await selectSandboxProvider({ publicPreviewUrl: true }, ['local', 'remote']);

      expect(selected?.id).toBe('remote');
    });

    it('skips providers that are currently unavailable', async () => {
      registerSandboxProvider(stubProvider('local', {}, false));
      registerSandboxProvider(stubProvider('remote'));

      const selected = await selectSandboxProvider({}, ['local', 'remote']);

      expect(selected?.id).toBe('remote');
    });

    it('ignores unknown ids in the preference list', async () => {
      registerSandboxProvider(stubProvider('remote'));

      const selected = await selectSandboxProvider({}, ['does-not-exist', 'remote']);

      expect(selected?.id).toBe('remote');
    });

    it('returns null when nothing fits', async () => {
      registerSandboxProvider(stubProvider('local', { publicPreviewUrl: false }));

      expect(await selectSandboxProvider({ publicPreviewUrl: true }, ['local'])).toBeNull();
    });
  });
});
