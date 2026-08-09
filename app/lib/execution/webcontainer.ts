import type { PathWatcherEvent, WebContainer, WebContainerProcess } from '@webcontainer/api';
import { WORK_DIR, WORK_DIR_NAME } from '~/utils/constants';
import { detectWebContainerSupport } from '~/lib/webcontainer/capabilities';
import { path } from '~/utils/path';
import { getSandboxProvider, registerSandboxProvider } from './registry';
import type {
  SandboxCapabilities,
  SandboxCreateOptions,
  SandboxDirEntry,
  SandboxEvent,
  SandboxFileChange,
  SandboxFileWrite,
  SandboxProcess,
  SandboxProvider,
  SandboxSession,
  SandboxSpawnOptions,
  SandboxWatchOptions,
  Unsubscribe,
} from './types';

export const WEB_CONTAINER_PROVIDER_ID = 'webcontainer';
export const WEB_CONTAINER_SESSION_ID = 'webcontainer:default';

const WEB_CONTAINER_CAPABILITIES: SandboxCapabilities = {
  interactiveShell: true,
  fileWatch: true,
  publicPreviewUrl: false,

  /*
   * The adapter keeps the shared runtime alive when a session is disposed and
   * can attach to it again while the current app instance is still running.
   */
  persistentFilesystem: true,
  network: 'outbound',
  maxSessionMs: null,
};

function relativePath(workdir: string, value: string): string {
  const normalized = path.normalize(value || '.');
  const candidate = path.isAbsolute(normalized) ? path.relative(workdir, normalized) : normalized;

  if (candidate === '..' || candidate.startsWith('../') || candidate.startsWith('..\\')) {
    throw new Error(`Path '${value}' is outside the sandbox workdir`);
  }

  return candidate || '.';
}

function ensureWatchPatternIsRelative(pattern: string): string {
  const normalized = path.normalize(pattern);

  if (
    path.isAbsolute(normalized) ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('..\\')
  ) {
    throw new Error(`Watch pattern '${pattern}' is outside the sandbox workdir`);
  }

  return normalized;
}

function absoluteWatchPattern(workdir: string, pattern: string): string {
  return path.join(workdir, ensureWatchPatternIsRelative(pattern));
}

function toRelativeWatchPath(workdir: string, value: string): string {
  return relativePath(workdir, value);
}

function mapFileChanges(workdir: string, events: PathWatcherEvent[]): SandboxFileChange[] {
  return events.flatMap((event) => {
    /*
     * The contract does not distinguish files from directories (SandboxFileChange
     * has no such field), so a directory being created or removed is reported the
     * same way a file is. update_directory is dropped: it fires because something
     * inside the directory changed, and that child change arrives as its own
     * event, so forwarding this too would double-report every write.
     */
    const type =
      event.type === 'add_file' || event.type === 'add_dir'
        ? 'add'
        : event.type === 'change'
          ? 'change'
          : event.type === 'remove_file' || event.type === 'remove_dir'
            ? 'remove'
            : null;

    if (!type) {
      return [];
    }

    return [{ path: toRelativeWatchPath(workdir, event.path), type }];
  });
}

function adaptProcess(process: WebContainerProcess): SandboxProcess {
  return {
    output: process.output,
    input: process.input,
    exit: process.exit,
    kill: () => process.kill(),
    resize: (size) => process.resize(size),
  };
}

class WebContainerSession implements SandboxSession {
  readonly id = WEB_CONTAINER_SESSION_ID;
  readonly workdir = WORK_DIR;
  readonly capabilities = WEB_CONTAINER_CAPABILITIES;

  #containerPromise: Promise<WebContainer>;
  #disposed = false;
  #subscriptions = new Set<Unsubscribe>();
  #subscriptionCleanups = new Set<Promise<void>>();
  #watchUnsubscribers = new Set<Unsubscribe>();
  #portUrls = new Map<number, string>();

  constructor(containerPromise: Promise<WebContainer>) {
    this.#containerPromise = containerPromise;
  }

  async #container(): Promise<WebContainer> {
    if (this.#disposed) {
      throw new Error('WebContainer session has been disposed');
    }

    const container = await this.#containerPromise;

    if (this.#disposed) {
      throw new Error('WebContainer session has been disposed');
    }

    return container;
  }

  async writeFiles(files: SandboxFileWrite[]): Promise<void> {
    const container = await this.#container();

    await Promise.all(files.map((file) => container.fs.writeFile(relativePath(this.workdir, file.path), file.content)));
  }

  async readFile(filePath: string): Promise<string> {
    const container = await this.#container();
    return container.fs.readFile(relativePath(this.workdir, filePath), 'utf8');
  }

  async readDir(directoryPath: string): Promise<SandboxDirEntry[]> {
    const container = await this.#container();
    const entries = await container.fs.readdir(relativePath(this.workdir, directoryPath), { withFileTypes: true });

    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  }

  async mkdir(directoryPath: string, options?: { recursive?: boolean }): Promise<void> {
    const container = await this.#container();
    const target = relativePath(this.workdir, directoryPath);

    if (options?.recursive) {
      await container.fs.mkdir(target, { recursive: true });
    } else {
      await container.fs.mkdir(target);
    }
  }

  async remove(targetPath: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    const container = await this.#container();
    await container.fs.rm(relativePath(this.workdir, targetPath), options);
  }

  async spawn(command: string, args: string[], options?: SandboxSpawnOptions): Promise<SandboxProcess> {
    const container = await this.#container();
    const spawnOptions = options
      ? {
          cwd: options.cwd === undefined ? undefined : relativePath(this.workdir, options.cwd),
          env: options.env,
          terminal: options.terminal,
        }
      : undefined;

    return adaptProcess(await container.spawn(command, args, spawnOptions));
  }

  async previewUrl(port: number): Promise<string | null> {
    await this.#container();

    /*
     * WebContainer preview URLs are browser-local plumbing, not public URLs
     * that satisfy the provider contract for remote/device consumers.
     */
    return this.capabilities.publicPreviewUrl ? (this.#portUrls.get(port) ?? null) : null;
  }

  watch(options: SandboxWatchOptions, onChange: (changes: SandboxFileChange[]) => void): Promise<Unsubscribe> {
    return this.#container().then((container) => {
      if (this.#disposed) {
        throw new Error('WebContainer session has been disposed');
      }

      let active = true;
      const unsubscribe = container.internal.watchPaths(
        {
          path: this.workdir,
          include: options.include.map((pattern) => absoluteWatchPattern(this.workdir, pattern)),
          exclude: options.exclude?.map(ensureWatchPatternIsRelative),
          includeContent: false,
        },
        (events) => {
          if (!active) {
            return;
          }

          const changes = mapFileChanges(this.workdir, events);

          if (changes.length > 0) {
            onChange(changes);
          }
        },
      );

      const stop = () => {
        if (!active) {
          return;
        }

        active = false;

        try {
          unsubscribe();
        } catch {
          // Continue disposing remaining watchers if one watcher rejects cleanup.
        }

        this.#watchUnsubscribers.delete(stop);
      };

      this.#watchUnsubscribers.add(stop);

      return stop;
    });
  }

  subscribe(handler: (event: SandboxEvent) => void): Unsubscribe {
    let active = true;
    let cleaned = false;
    const unsubscribers: Unsubscribe[] = [];
    let resolveCleanup!: () => void;
    const cleanupCompleted = new Promise<void>((resolve) => {
      resolveCleanup = resolve;
    });
    let setupFailure: unknown;
    const emit = (event: SandboxEvent) => {
      try {
        handler(event);
      } catch {
        // Consumer callbacks must not break provider listener cleanup.
      }
    };
    const cleanup = () => {
      if (cleaned) {
        return;
      }

      cleaned = true;

      for (const stop of unsubscribers.splice(0)) {
        try {
          stop();
        } catch {
          // A failed unsubscribe must not prevent cleanup of other listeners.
        }
      }

      resolveCleanup();
    };

    void this.#container()
      .then((container) => {
        if (!active || this.#disposed) {
          cleanup();
          return;
        }

        const emitPortOpen = (port: number, url: string | null) => {
          const previousUrl = this.#portUrls.get(port) ?? null;

          if (url) {
            this.#portUrls.set(port, url);
          }

          if (previousUrl !== url) {
            emit({ type: 'port-open', port, url });
          }
        };

        try {
          unsubscribers.push(
            container.on('port', (port, type, url) => {
              if (!active) {
                return;
              }

              if (type === 'open') {
                emitPortOpen(port, url);
              } else {
                this.#portUrls.delete(port);
                emit({ type: 'port-close', port });
              }
            }),
          );
          unsubscribers.push(
            container.on('server-ready', (port, url) => {
              if (active) {
                emitPortOpen(port, url);
              }
            }),
          );
          unsubscribers.push(
            container.on('error', (error) => {
              if (active) {
                emit({ type: 'session-lost', reason: error.message });
              }
            }),
          );
        } catch (error) {
          setupFailure = error;
          active = false;
          cleanup();
          throw error;
        }
      })
      .catch((error: unknown) => {
        if (this.#disposed || (!active && setupFailure === undefined)) {
          active = false;
          cleanup();

          return;
        }

        active = false;
        cleanup();

        this.#subscriptions.delete(unsubscribe);

        const failure = setupFailure ?? error;
        emit({
          type: 'session-lost',
          reason: failure instanceof Error ? failure.message : String(failure),
        });
      });

    const unsubscribe = () => {
      if (!active) {
        return;
      }

      active = false;
      cleanup();
      this.#subscriptions.delete(unsubscribe);
    };

    this.#subscriptions.add(unsubscribe);
    this.#subscriptionCleanups.add(cleanupCompleted);
    void cleanupCompleted.then(() => this.#subscriptionCleanups.delete(cleanupCompleted));

    return unsubscribe;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;

    for (const unsubscribe of this.#subscriptions) {
      unsubscribe();
    }

    for (const unsubscribe of this.#watchUnsubscribers) {
      unsubscribe();
    }

    this.#subscriptions.clear();
    this.#watchUnsubscribers.clear();

    await Promise.all([...this.#subscriptionCleanups]);
    this.#subscriptionCleanups.clear();
  }
}

export function createWebContainerProvider(containerPromise: Promise<WebContainer>): SandboxProvider {
  return {
    id: WEB_CONTAINER_PROVIDER_ID,
    label: 'WebContainer',
    capabilities: WEB_CONTAINER_CAPABILITIES,
    isAvailable: async () => {
      if (import.meta.env.SSR || !detectWebContainerSupport().supported) {
        return false;
      }

      try {
        await containerPromise;
        return true;
      } catch {
        return false;
      }
    },
    create: async (options: SandboxCreateOptions) => {
      if (!detectWebContainerSupport().supported) {
        throw new Error('WebContainer is not supported in this runtime');
      }

      if (options.workdirName !== WORK_DIR_NAME) {
        throw new Error(`WebContainer is booted with workdir '${WORK_DIR_NAME}'`);
      }

      await containerPromise;

      return new WebContainerSession(containerPromise);
    },
    resume: async (sessionId: string) => {
      if (sessionId !== WEB_CONTAINER_SESSION_ID || import.meta.env.SSR || !detectWebContainerSupport().supported) {
        return null;
      }

      await containerPromise;

      return new WebContainerSession(containerPromise);
    },
  };
}

/** Registers the adapter once; callers provide the app's shared runtime promise. */
export function registerWebContainerProvider(containerPromise: Promise<WebContainer>): void {
  if (getSandboxProvider(WEB_CONTAINER_PROVIDER_ID)) {
    return;
  }

  registerSandboxProvider(createWebContainerProvider(containerPromise));
}
