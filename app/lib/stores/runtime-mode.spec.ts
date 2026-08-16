import { afterEach, describe, expect, it } from 'vitest';
import { runtimeModeStore, setRuntimeMode } from './runtime-mode';

describe('runtime mode capabilities', () => {
  const initialState = runtimeModeStore.get();

  afterEach(() => {
    runtimeModeStore.set(initialState);
  });

  it('keeps commandExecution false for Remote Runtime -- raw shell text must not reach a real remote server unvalidated', () => {
    setRuntimeMode('remote');

    expect(runtimeModeStore.get().capabilities.commandExecution).toBe(false);
  });

  it('keeps commandExecution false for Android fallback', () => {
    setRuntimeMode('android-fallback');

    expect(runtimeModeStore.get().capabilities.commandExecution).toBe(false);
  });

  it('still reports file sync and preview as available for Remote Runtime -- those paths are real and unaffected by the commandExecution fix', () => {
    setRuntimeMode('remote');

    const { capabilities } = runtimeModeStore.get();
    expect(capabilities.fileSystem).toBe(true);
    expect(capabilities.preview).toBe(true);
  });

  it('reports agentBuildCommands true for Remote Runtime -- build/start bridge to the safe command-profile allowlist (action-runner.ts)', () => {
    setRuntimeMode('remote');

    expect(runtimeModeStore.get().capabilities.agentBuildCommands).toBe(true);
  });

  it('reports agentBuildCommands true for WebContainer', () => {
    const state = runtimeModeStore.get();

    if (!state.webContainerAvailable) {
      return;
    }

    setRuntimeMode('webcontainer');
    expect(runtimeModeStore.get().capabilities.agentBuildCommands).toBe(true);
  });

  it('reports agentBuildCommands false for Android fallback -- no bridge exists, must not silently claim one', () => {
    setRuntimeMode('android-fallback');

    expect(runtimeModeStore.get().capabilities.agentBuildCommands).toBe(false);
  });
});
