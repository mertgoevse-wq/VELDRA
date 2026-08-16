import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usesLocalWorkspaceForFileActions } from './action-runner';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { ActionRunner } from './action-runner';
import { WORK_DIR } from '~/utils/constants';
import type { FileHistory } from '~/types/actions';
import { buildActivityStore, clearBuildActivity } from '~/lib/stores/buildActivity';
import { RemoteRuntimeClient } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { remotePreviewRefreshSignal } from '~/lib/stores/remotePreviewSignal';

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
  });

  afterEach(() => {
    runtimeModeStore.set(initialRuntime);
    vi.restoreAllMocks();
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
