import { afterEach, describe, expect, it } from 'vitest';
import { runtimeModeStore, setRuntimeMode } from './runtime-mode';

describe('runtime mode capabilities', () => {
  const initialState = runtimeModeStore.get();

  afterEach(() => {
    runtimeModeStore.set(initialState);
  });

  it('keeps commandExecution false for Remote Runtime -- ActionRunner has no code path to route shell/build/start to RemoteRuntimeClient', () => {
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
});
