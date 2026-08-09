import { beforeEach, describe, expect, it } from 'vitest';
import { clearSandboxProviders, registerSandboxProvider } from './registry';
import { getExecutionProviderStatus } from './runtime-status';
import type { SandboxProvider } from './types';

const webContainerProvider: SandboxProvider = {
  id: 'webcontainer',
  label: 'WebContainer',
  capabilities: {
    interactiveShell: true,
    fileWatch: true,
    publicPreviewUrl: false,
    persistentFilesystem: true,
    network: 'outbound',
    maxSessionMs: null,
  },
  isAvailable: async () => true,
  create: async () => {
    throw new Error('not used in status tests');
  },
};

describe('execution provider status', () => {
  beforeEach(() => {
    clearSandboxProviders();
  });

  it('reports an unregistered WebContainer provider without booting anything', async () => {
    await expect(getExecutionProviderStatus('webcontainer')).resolves.toMatchObject({
      mode: 'webcontainer',
      providerId: 'webcontainer',
      state: 'unregistered',
    });
  });

  it('reports a registered and available provider with capabilities', async () => {
    registerSandboxProvider(webContainerProvider);

    await expect(getExecutionProviderStatus('webcontainer')).resolves.toMatchObject({
      mode: 'webcontainer',
      providerId: 'webcontainer',
      state: 'available',
      capabilities: webContainerProvider.capabilities,
    });
  });

  it('does not report a provider without an interactive shell as execution-ready', async () => {
    registerSandboxProvider({
      ...webContainerProvider,
      capabilities: { ...webContainerProvider.capabilities, interactiveShell: false },
    });

    await expect(getExecutionProviderStatus('webcontainer')).resolves.toMatchObject({
      state: 'unavailable',
      reason: 'WebContainer is registered but unavailable in the current environment.',
    });
  });

  it('fails closed when provider availability rejects', async () => {
    registerSandboxProvider({
      ...webContainerProvider,
      isAvailable: async () => {
        throw new Error('boot failed');
      },
    });

    await expect(getExecutionProviderStatus('webcontainer')).resolves.toMatchObject({
      state: 'unavailable',
      reason: 'boot failed',
    });
  });

  it('fails closed when provider availability does not settle', async () => {
    registerSandboxProvider({
      ...webContainerProvider,
      isAvailable: () => new Promise<boolean>(() => undefined),
    });

    await expect(getExecutionProviderStatus('webcontainer', 5)).resolves.toMatchObject({
      state: 'unavailable',
      reason: 'Execution provider availability check timed out',
    });
  });

  it('does not require a sandbox provider for Android fallback mode', async () => {
    await expect(getExecutionProviderStatus('android-fallback')).resolves.toEqual({
      mode: 'android-fallback',
      providerId: null,
      state: 'not-required',
      reason: 'Android fallback uses its local persistence adapter; command execution is unavailable.',
    });
  });

  it('does not pretend Remote Runtime is a registered sandbox provider', async () => {
    await expect(getExecutionProviderStatus('remote')).resolves.toEqual({
      mode: 'remote',
      providerId: null,
      state: 'unregistered',
      reason: 'Remote Runtime is not registered in the sandbox registry yet.',
    });
  });
});
