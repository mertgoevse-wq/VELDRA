import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usesLocalWorkspaceForFileActions } from './action-runner';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { ActionRunner } from './action-runner';
import { WORK_DIR } from '~/utils/constants';
import type { FileHistory } from '~/types/actions';
import { buildActivityStore, clearBuildActivity } from '~/lib/stores/buildActivity';
import { RemoteRuntimeClient } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { remotePreviewRefreshSignal } from '~/lib/stores/remotePreviewSignal';
import { pushLocalWorkspaceToRemote } from '~/lib/remote-runtime/RemoteWorkspaceSync';

// action-runner.ts dynamically imports this (avoiding a real circular import via workbench.ts).
vi.mock('~/lib/remote-runtime/RemoteWorkspaceSync', () => ({
  pushLocalWorkspaceToRemote: vi.fn().mockResolvedValue({ state: 'success', syncedFileCount: 1 }),
}));

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
    const webcontainer = () => Promise.reject(new Error('WebContainer unavailable'));

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
    const runner = new ActionRunner(
      () => Promise.resolve({} as never),
      () => undefined as never,
    );
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

  it('feeds a blocked shell action into onAlert so the model can learn it never ran', async () => {
    const onAlert = vi.fn();
    const webcontainer = () => Promise.reject(new Error('WebContainer unavailable'));

    const runner = new ActionRunner(webcontainer, () => undefined as never, onAlert);

    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'shell-action',
      action: { type: 'shell', content: 'npm install && npm run dev' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(runner.actions.get()['shell-action']?.status).toBe('failed');
    expect(onAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        content: 'npm install && npm run dev',
        source: 'terminal',
      }),
    );
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
    const webcontainer = () => Promise.reject(new Error('WebContainer unavailable'));

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
      () => Promise.resolve({} as never),
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

  it('resolves a real BuildActivityFeed entry as done when a file write actually succeeds', async () => {
    clearBuildActivity();

    const writeFile = vi.fn(async () => undefined);
    const webcontainer = () => Promise.reject(new Error('WebContainer unavailable'));

    const runner = new ActionRunner(webcontainer, () => undefined as never, undefined, undefined, undefined, writeFile);

    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'ok-action',
      action: { type: 'file', filePath: 'src/ok.ts', content: 'export {}' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    const { events } = buildActivityStore.get();
    const entry = events.find((e) => e.label.includes('ok.ts'));
    expect(entry?.status).toBe('done');
  });

  it('resolves a real BuildActivityFeed entry as an error, not a fake success, when a file write actually fails', async () => {
    clearBuildActivity();

    const writeFile = vi.fn(async () => {
      throw new Error('disk full');
    });
    const webcontainer = () => Promise.reject(new Error('WebContainer unavailable'));

    const runner = new ActionRunner(webcontainer, () => undefined as never, undefined, undefined, undefined, writeFile);

    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'failing-action',
      action: { type: 'file', filePath: 'src/fails.ts', content: 'export {}' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(runner.actions.get()['failing-action']?.status).toBe('failed');

    const { events } = buildActivityStore.get();
    const entry = events.find((e) => e.label.includes('fails.ts'));
    expect(entry?.status).toBe('error');
  });

  it('rejects a local file action outside the workspace', async () => {
    const writeFile = vi.fn(async () => undefined);
    const runner = new ActionRunner(
      () => Promise.resolve({} as never),
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

/**
 * Covers the real ActionRunner.abort()/abortAll() the chat Stop button now calls, instead of
 * workbenchStore.abortAllActions() only console.warn-ing (its previous, unimplemented stub).
 */
describe('ActionRunner.abort / abortAll (real per-action abort closure)', () => {
  it('marks a not-yet-run action aborted and trips its AbortSignal', () => {
    const runner = new ActionRunner(
      () => Promise.resolve({} as never),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'pending-action',
      action: { type: 'shell', content: 'sleep 100' },
    } as const;

    runner.addAction(action);
    runner.abort('pending-action');

    expect(runner.actions.get()['pending-action']?.status).toBe('aborted');
    expect(runner.actions.get()['pending-action']?.abortSignal.aborted).toBe(true);
  });

  it('does not retroactively mark an already-finished action as aborted', async () => {
    const writeFile = vi.fn(async () => undefined);
    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
      undefined,
      undefined,
      undefined,
      writeFile,
    );

    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'done-action',
      action: { type: 'file', filePath: 'src/done.ts', content: 'export {}' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(runner.actions.get()['done-action']?.status).toBe('complete');

    runner.abort('done-action');

    expect(runner.actions.get()['done-action']?.status).toBe('complete');
  });

  it('is a safe no-op for an unknown action id', () => {
    const runner = new ActionRunner(
      () => Promise.resolve({} as never),
      () => undefined as never,
    );

    expect(() => runner.abort('does-not-exist')).not.toThrow();
  });

  it('abortAll() aborts every not-yet-finished tracked action', () => {
    const runner = new ActionRunner(
      () => Promise.resolve({} as never),
      () => undefined as never,
    );

    const actionA = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'action-a',
      action: { type: 'shell', content: 'sleep 100' },
    } as const;
    const actionB = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'action-b',
      action: { type: 'shell', content: 'sleep 200' },
    } as const;

    runner.addAction(actionA);
    runner.addAction(actionB);

    runner.abortAll();

    expect(runner.actions.get()['action-a']?.status).toBe('aborted');
    expect(runner.actions.get()['action-b']?.status).toBe('aborted');
  });
});

describe('agent build/start actions on Remote Runtime (real bridge, not raw shell)', () => {
  const initialRuntime = runtimeModeStore.get();

  beforeEach(() => {
    runtimeModeStore.set({
      ...initialRuntime,
      mode: 'remote',
      remoteRuntimeUrl: 'https://remote.example.com',
      remoteAuthToken: 'token',
      remoteWorkspaceId: 'workspace-1',
      capabilities: { ...initialRuntime.capabilities, agentBuildCommands: true, commandExecution: false },
    });
    clearBuildActivity();

    /*
     * afterEach's vi.restoreAllMocks() wipes this vi.fn()'s mockResolvedValue default (it has
     * no "original" pre-mock implementation to restore to, since it's a synthetic vi.mock()
     * factory function, not a vi.spyOn() on something real) -- re-establish it every test
     * rather than relying on the factory's one-time initial value surviving restoreAllMocks.
     */
    vi.mocked(pushLocalWorkspaceToRemote).mockResolvedValue({
      state: 'success',
      syncedFileCount: 1,
      skippedFileCount: 0,
      conflictCount: 0,
      warnings: [],
      conflicts: [],
    } as any);
  });

  afterEach(() => {
    runtimeModeStore.set(initialRuntime);
    vi.restoreAllMocks();
  });

  it('syncs current local files to the remote workspace before running a remote build, so it never builds stale/no files', async () => {
    const runCommand = vi.fn().mockResolvedValue({ commandId: 'cmd-sync', status: 'running' });
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockImplementation(runCommand);
    vi.spyOn(RemoteRuntimeClient.prototype, 'getCommandStatus').mockResolvedValue({
      commandId: 'cmd-sync',
      status: 'exited',
      exitCode: 0,
    } as any);

    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'sync-build-action',
      action: { type: 'build', content: '' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(pushLocalWorkspaceToRemote).toHaveBeenCalled();
    expect(runCommand).toHaveBeenCalledWith('npm run build');
  });

  it('reports a real sync failure honestly and never runs the remote command against unsynced files', async () => {
    vi.mocked(pushLocalWorkspaceToRemote).mockResolvedValueOnce({
      state: 'error',
      lastError: 'Remote Runtime is not configured. Missing: workspace ID.',
      syncedFileCount: 0,
      skippedFileCount: 0,
      conflictCount: 0,
      warnings: [],
      conflicts: [],
    } as any);

    const runCommand = vi.fn();
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockImplementation(runCommand);

    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'sync-fail-action',
      action: { type: 'build', content: '' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(runCommand).not.toHaveBeenCalled();
    expect(runner.actions.get()['sync-fail-action']?.status).toBe('failed');
  });

  it('runs a real build action through RemoteRuntimeClient.runCommand and reports success on real exit 0', async () => {
    const runCommand = vi.fn().mockResolvedValue({ commandId: 'cmd-1', status: 'running' });
    const getCommandStatus = vi.fn().mockResolvedValue({ commandId: 'cmd-1', status: 'exited', exitCode: 0 });
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockImplementation(runCommand);
    vi.spyOn(RemoteRuntimeClient.prototype, 'getCommandStatus').mockImplementation(getCommandStatus);

    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'build-action',
      action: { type: 'build', content: '' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(runCommand).toHaveBeenCalledWith('npm run build');
    expect(runner.actions.get()['build-action']?.status).not.toBe('failed');
  });

  it('reports a real remote build failure honestly, not as a false success', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockResolvedValue({
      commandId: 'cmd-2',
      status: 'running',
    } as any);
    vi.spyOn(RemoteRuntimeClient.prototype, 'getCommandStatus').mockResolvedValue({
      commandId: 'cmd-2',
      status: 'exited',
      exitCode: 1,
      error: 'npm ERR! build failed',
    } as any);

    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'build-fail-action',
      action: { type: 'build', content: '' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    expect(runner.actions.get()['build-fail-action']?.status).toBe('failed');
  });

  it('resolves a start action once the remote dev server enters "running", without waiting for it to exit', async () => {
    const runCommand = vi.fn().mockResolvedValue({ commandId: 'cmd-3', status: 'running' });
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockImplementation(runCommand);

    const getCommandStatus = vi.spyOn(RemoteRuntimeClient.prototype, 'getCommandStatus');

    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'start-action',
      action: { type: 'start', content: '' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    // give the non-blocking .then()/.catch() chain a tick to settle
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(runCommand).toHaveBeenCalledWith('npm run dev');
    expect(getCommandStatus).not.toHaveBeenCalled();
    expect(runner.actions.get()['start-action']?.status).toBe('complete');
  });

  it('stops the real remote build command via RemoteRuntimeClient.stopCommand when the action is aborted mid-flight', async () => {
    const runCommand = vi.fn().mockResolvedValue({ commandId: 'cmd-abort-build', status: 'running' });
    const stopCommand = vi.fn().mockResolvedValue({ commandId: 'cmd-abort-build', status: 'stopped' });
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockImplementation(runCommand);
    vi.spyOn(RemoteRuntimeClient.prototype, 'stopCommand').mockImplementation(stopCommand);

    let resolveStatus: ((value: any) => void) | undefined;
    const getCommandStatus = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
    );
    vi.spyOn(RemoteRuntimeClient.prototype, 'getCommandStatus').mockImplementation(getCommandStatus);

    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'abort-build-action',
      action: { type: 'build', content: '' },
    } as const;

    runner.addAction(action);

    const runPromise = runner.runAction(action);

    // Let the sync/runCommand chain progress until pollRemoteCommand is genuinely mid-poll.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(getCommandStatus).toHaveBeenCalled();

    runner.abort('abort-build-action');

    expect(stopCommand).toHaveBeenCalledWith('cmd-abort-build');
    expect(runner.actions.get()['abort-build-action']?.status).toBe('aborted');

    // Unblock the in-flight status poll so the run settles instead of hanging the test.
    resolveStatus?.({ commandId: 'cmd-abort-build', status: 'exited', exitCode: 1, error: 'aborted' });
    await runPromise;
  });

  it('stops the real remote dev server via RemoteRuntimeClient.stopCommand when the action is aborted mid-flight', async () => {
    const runCommand = vi.fn().mockResolvedValue({ commandId: 'cmd-abort-start', status: 'running' });
    const stopCommand = vi.fn().mockResolvedValue({ commandId: 'cmd-abort-start', status: 'stopped' });
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockImplementation(runCommand);
    vi.spyOn(RemoteRuntimeClient.prototype, 'stopCommand').mockImplementation(stopCommand);

    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'abort-start-action',
      action: { type: 'start', content: '' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);

    /*
     * The 'start' action's ActionState is intentionally marked 'complete' as soon as the remote
     * dev server confirms it started (non-blocking, by design -- see #executeAction's 'start'
     * case), well before the real long-running server process ends. Assert the abort listener
     * itself, registered before that non-blocking chain settles, independently of ActionRunner's
     * own (unrelated) status-based abort() guard.
     */
    runner.actions.get()['abort-start-action']?.abort();

    expect(stopCommand).toHaveBeenCalledWith('cmd-abort-start');
  });

  it('triggers a real Preview refresh check once the remote dev server starts, not just on mount/manual click', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockResolvedValue({
      commandId: 'cmd-4',
      status: 'running',
    } as any);

    const before = remotePreviewRefreshSignal.get();

    const runner = new ActionRunner(
      () => Promise.reject(new Error('WebContainer unavailable')),
      () => undefined as never,
    );
    const action = {
      artifactId: 'artifact',
      messageId: 'message',
      actionId: 'start-refresh-action',
      action: { type: 'start', content: '' },
    } as const;

    runner.addAction(action);
    await runner.runAction(action);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(remotePreviewRefreshSignal.get()).toBe(before + 1);
  });
});
