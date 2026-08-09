import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORK_DIR, WORK_DIR_NAME } from '~/utils/constants';
import {
  createWebContainerProvider,
  registerWebContainerProvider,
  WEB_CONTAINER_PROVIDER_ID,
  WEB_CONTAINER_SESSION_ID,
} from './webcontainer';
import { clearSandboxProviders, listSandboxProviders } from './registry';
import type { SandboxEvent } from './types';

function createContainerMock() {
  const listeners = new Map<string, (first: any, second?: any, third?: any) => void>();
  const unsubscribe = vi.fn();
  const watchUnsubscribe = vi.fn();
  const container = {
    workdir: WORK_DIR,
    fs: {
      writeFile: vi.fn(async () => undefined),
      readFile: vi.fn(async () => 'content'),
      readdir: vi.fn(async () => [{ name: 'src', isDirectory: () => true }]),
      mkdir: vi.fn(async () => undefined),
      rm: vi.fn(async () => undefined),
    },
    internal: {
      watchPaths: vi.fn((_options, callback) => {
        listeners.set('watch', callback);
        return watchUnsubscribe;
      }),
    },
    spawn: vi.fn(async () => ({
      output: new ReadableStream<string>(),
      input: new WritableStream<string>(),
      exit: Promise.resolve(0),
      kill: vi.fn(),
      resize: vi.fn(),
    })),
    on: vi.fn((event, callback) => {
      listeners.set(event, callback);
      return unsubscribe;
    }),
  };

  return { container, listeners, unsubscribe, watchUnsubscribe };
}

describe('WebContainer sandbox provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('crossOriginIsolated', true);
    clearSandboxProviders();
  });

  it('registers the provider once for the shared execution registry', () => {
    const containerPromise = Promise.resolve({} as any);

    registerWebContainerProvider(containerPromise);
    registerWebContainerProvider(containerPromise);

    expect(listSandboxProviders().map((provider) => provider.id)).toEqual([WEB_CONTAINER_PROVIDER_ID]);
  });

  it('reports a failed boot as unavailable', async () => {
    const boot = Promise.reject(new Error('boot failed'));

    void boot.catch(() => undefined);

    const provider = createWebContainerProvider(boot);

    await expect(provider.isAvailable()).resolves.toBe(false);
  });

  it('exposes the existing runtime through the provider contract', async () => {
    const { container } = createContainerMock();
    const provider = createWebContainerProvider(Promise.resolve(container as any));

    expect(provider.id).toBe(WEB_CONTAINER_PROVIDER_ID);
    expect(await provider.isAvailable()).toBe(false);

    const session = await provider.create({ workdirName: WORK_DIR_NAME });

    expect(session.id).toBe(WEB_CONTAINER_SESSION_ID);
    expect(session.workdir).toBe(WORK_DIR);
    expect(session.capabilities.publicPreviewUrl).toBe(false);
  });

  it('rejects a workdir that does not match the booted runtime', async () => {
    const provider = createWebContainerProvider(Promise.resolve({} as any));

    await expect(provider.create({ workdirName: 'other' })).rejects.toThrow(/workdir/);
  });

  it('rejects file and watch paths outside the workdir', async () => {
    const { container } = createContainerMock();
    const provider = createWebContainerProvider(Promise.resolve(container as any));
    const session = await provider.create({ workdirName: WORK_DIR_NAME });

    await expect(session.readFile('../outside.txt')).rejects.toThrow(/outside the sandbox workdir/);
    await expect(session.watch!({ include: ['../outside/**'] }, vi.fn())).rejects.toThrow(
      /outside the sandbox workdir/,
    );
  });

  it('maps file and process operations to WebContainer', async () => {
    const { container } = createContainerMock();
    const provider = createWebContainerProvider(Promise.resolve(container as any));
    const session = await provider.create({ workdirName: WORK_DIR_NAME });

    await session.writeFiles([{ path: 'src/index.ts', content: 'export {}' }]);
    await session.readFile('src/index.ts');
    await session.readDir('src');
    await session.mkdir('src/new', { recursive: true });
    await session.remove('src/old', { force: true });

    const process = await session.spawn('npm', ['run', 'test'], { cwd: WORK_DIR, env: { CI: '1' } });

    expect(container.fs.writeFile).toHaveBeenCalledWith('src/index.ts', 'export {}');
    expect(container.fs.readFile).toHaveBeenCalledWith('src/index.ts', 'utf8');
    expect(container.fs.readdir).toHaveBeenCalledWith('src', { withFileTypes: true });
    expect(container.fs.mkdir).toHaveBeenCalledWith('src/new', { recursive: true });
    expect(container.fs.rm).toHaveBeenCalledWith('src/old', { force: true });
    expect(container.spawn).toHaveBeenCalledWith('npm', ['run', 'test'], {
      cwd: '.',
      env: { CI: '1' },
      terminal: undefined,
    });
    expect(await process.exit).toBe(0);
  });

  it('translates watcher events and unsubscribes them on dispose', async () => {
    const { container, listeners, watchUnsubscribe } = createContainerMock();
    const provider = createWebContainerProvider(Promise.resolve(container as any));
    const session = await provider.create({ workdirName: WORK_DIR_NAME });
    const changes = vi.fn();
    const events: SandboxEvent[] = [];

    const stopWatching = await session.watch!({ include: ['src/**'], exclude: ['src/node_modules/**'] }, changes);
    session.subscribe((event) => events.push(event));
    await new Promise((resolve) => setTimeout(resolve, 0));

    listeners.get('watch')?.([
      { type: 'add_file', path: `${WORK_DIR}/src/index.ts` },
      { type: 'change', path: `${WORK_DIR}/src/index.ts` },
      { type: 'remove_file', path: `${WORK_DIR}/src/old.ts` },
      { type: 'add_dir', path: `${WORK_DIR}/src/new-dir` },
      { type: 'remove_dir', path: `${WORK_DIR}/src/old-dir` },
      { type: 'update_directory', path: `${WORK_DIR}/src` },
    ]);

    listeners.get('port')?.(5173, 'open', 'https://example.test');
    listeners.get('port')?.(5173, 'open', 'https://example.test');
    listeners.get('port')?.(5173, 'close', 'https://example.test');

    expect(changes).toHaveBeenCalledWith([
      { path: 'src/index.ts', type: 'add' },
      { path: 'src/index.ts', type: 'change' },
      { path: 'src/old.ts', type: 'remove' },
      { path: 'src/new-dir', type: 'add' },
      { path: 'src/old-dir', type: 'remove' },
    ]);
    expect(events).toEqual([
      { type: 'port-open', port: 5173, url: 'https://example.test' },
      { type: 'port-close', port: 5173 },
    ]);

    stopWatching();
    await session.dispose();

    expect(watchUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not attach async subscriptions after disposal', async () => {
    const { container } = createContainerMock();
    const provider = createWebContainerProvider(Promise.resolve(container as any));
    const session = await provider.create({ workdirName: WORK_DIR_NAME });

    session.subscribe(vi.fn());

    await session.dispose();
    await Promise.resolve();
    await Promise.resolve();

    expect(container.on).not.toHaveBeenCalled();
  });

  it('cleans up listeners when a later listener registration fails', async () => {
    const { container } = createContainerMock();
    const firstUnsubscribe = vi.fn();
    let registration = 0;
    container.on.mockImplementation(() => {
      registration += 1;

      if (registration === 2) {
        throw new Error('listener registration failed');
      }

      return firstUnsubscribe;
    });

    const provider = createWebContainerProvider(Promise.resolve(container as any));
    const session = await provider.create({ workdirName: WORK_DIR_NAME });
    const events: SandboxEvent[] = [];

    session.subscribe((event) => events.push(event));

    await vi.waitFor(() => expect(firstUnsubscribe).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(events).toEqual([{ type: 'session-lost', reason: 'listener registration failed' }]));
  });

  it('cleans up all listeners when one unsubscribe fails', async () => {
    const { container } = createContainerMock();
    const firstUnsubscribe = vi.fn(() => {
      throw new Error('unsubscribe failed');
    });
    const secondUnsubscribe = vi.fn();
    const thirdUnsubscribe = vi.fn();
    let registration = 0;
    container.on.mockImplementation(() => {
      registration += 1;
      return registration === 1 ? firstUnsubscribe : registration === 2 ? secondUnsubscribe : thirdUnsubscribe;
    });

    const provider = createWebContainerProvider(Promise.resolve(container as any));
    const session = await provider.create({ workdirName: WORK_DIR_NAME });

    session.subscribe(vi.fn());

    await vi.waitFor(() => expect(container.on).toHaveBeenCalledTimes(3));

    await session.dispose();
    await vi.waitFor(() => expect(firstUnsubscribe).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(secondUnsubscribe).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(thirdUnsubscribe).toHaveBeenCalledTimes(1));
  });

  it('does not attach async watchers after disposal', async () => {
    const { container } = createContainerMock();
    const provider = createWebContainerProvider(Promise.resolve(container as any));
    const session = await provider.create({ workdirName: WORK_DIR_NAME });

    const watching = session.watch!({ include: ['src/**'] }, vi.fn());
    await session.dispose();

    await expect(watching).rejects.toThrow(/disposed/);
    expect(container.internal.watchPaths).not.toHaveBeenCalled();
  });

  it('can resume the shared runtime without tearing it down', async () => {
    const { container } = createContainerMock();
    const provider = createWebContainerProvider(Promise.resolve(container as any));

    const resumed = await provider.resume?.(WEB_CONTAINER_SESSION_ID);

    expect(resumed).toBeNull();
    expect((container as any).teardown).toBeUndefined();
  });
});
