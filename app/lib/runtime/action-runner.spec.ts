import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usesLocalWorkspaceForFileActions } from './action-runner';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { ActionRunner } from './action-runner';
import { WORK_DIR } from '~/utils/constants';
import type { FileHistory } from '~/types/actions';

describe('file action runtime policy', () => {
  const initialRuntime = runtimeModeStore.get();

  beforeEach(() => {
    runtimeModeStore.set({
      ...initialRuntime,
      mode: 'android-fallback',
      isAndroid: true,
      capabilities: {
        ...initialRuntime.capabilities,
        commandExecution: false,
      },
    });
  });

  afterEach(() => {
    runtimeModeStore.set(initialRuntime);
  });

  it('uses the local workspace for Android fallback actions', () => {
    expect(usesLocalWorkspaceForFileActions('android-fallback')).toBe(true);
  });

  it('uses the local workspace for Remote Runtime actions on Android', () => {
    expect(usesLocalWorkspaceForFileActions('remote', true)).toBe(true);
  });

  it('keeps the established WebContainer path for Remote Runtime on desktop', () => {
    expect(usesLocalWorkspaceForFileActions('remote', false)).toBe(false);
  });

  it('keeps direct WebContainer file writes for browser mode', () => {
    expect(usesLocalWorkspaceForFileActions('webcontainer', false)).toBe(false);
  });

  it('writes a direct Android file action through the local writer', async () => {
    const writeFile = vi.fn(async () => undefined);
    const webcontainer = Promise.reject(new Error('WebContainer unavailable'));
    void webcontainer.catch(() => undefined);

    const runner = new ActionRunner(webcontainer, () => undefined as never, undefined, undefined, undefined, writeFile);

    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'action',
      action: { type: 'file', filePath: 'src/migration.sql', content: 'select 1;' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(writeFile).toHaveBeenCalledWith('/home/project/src/migration.sql', 'select 1;');
  });

  it('keeps Supabase queries pending for the existing UI flow', async () => {
    const runner = new ActionRunner(Promise.resolve({} as never), () => undefined as never);
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'query-action',
      action: { type: 'supabase', operation: 'query', content: 'select 1;' },
    } as const;

    await expect(
      runner.handleSupabaseAction({ type: 'supabase', operation: 'query', content: 'select 1;' }),
    ).resolves.toEqual({ pending: true });

    runner.addAction(action);
    await runner.runAction(action);

    expect(runner.actions.get()['query-action']?.status).toBe('running');
    expect(runner.actions.get()['query-action']?.executed).toBe(false);
  });

  it('reads local file history without requiring WebContainer', async () => {
    runtimeModeStore.set({
      ...initialRuntime,
      mode: 'android-fallback',
      isAndroid: true,
      capabilities: { ...initialRuntime.capabilities, commandExecution: false },
    });

    const history: FileHistory = {
      originalContent: 'before',
      lastModified: 1,
      changes: [],
      versions: [{ timestamp: 1, content: 'before' }],
    };
    const readFile = vi.fn(async (filePath: string) => {
      expect(filePath).toBe(`${WORK_DIR}/.history/src/file.ts`);

      return JSON.stringify(history);
    });
    const webcontainer = Promise.reject(new Error('WebContainer unavailable'));
    void webcontainer.catch(() => undefined);

    const runner = new ActionRunner(
      webcontainer,
      () => undefined as never,
      undefined,
      undefined,
      undefined,
      undefined,
      readFile,
    );

    await expect(runner.getFileHistory('src/file.ts')).resolves.toEqual(history);
    expect(readFile).toHaveBeenCalledOnce();
  });

  it('rejects a local file action at the workspace root', async () => {
    const writeFile = vi.fn(async () => undefined);
    const runner = new ActionRunner(
      Promise.resolve({} as never),
      () => undefined as never,
      undefined,
      undefined,
      undefined,
      writeFile,
    );

    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'root-action',
      action: { type: 'file', filePath: '/home/project', content: 'blocked' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects a local file action outside the workspace', async () => {
    const writeFile = vi.fn(async () => undefined);
    const runner = new ActionRunner(
      Promise.resolve({} as never),
      () => undefined as never,
      undefined,
      undefined,
      undefined,
      writeFile,
    );

    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'outside-action',
      action: { type: 'file', filePath: '../outside.txt', content: 'blocked' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(writeFile).not.toHaveBeenCalled();
  });
});
