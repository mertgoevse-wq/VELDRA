import {
  RemoteRuntimeClient,
  type RemoteCommandProfile,
  type RemoteRuntimeEvent,
} from '~/lib/remote-runtime/RemoteRuntimeClient';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';

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

export const REMOTE_RUNTIME_PROVIDER_ID = 'remote-runtime';

const REMOTE_RUNTIME_CAPABILITIES: SandboxCapabilities = {
  interactiveShell: false,
  fileWatch: true,
  publicPreviewUrl: true,
  persistentFilesystem: true,
  network: 'full',
  maxSessionMs: null,
};

const DEFAULT_WORKDIR = '/workspace';

function normalizeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');

  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Path '${value}' is outside the remote workspace`);
  }

  return normalized || '.';
}

function toRemotePath(value: string): string {
  return normalizeRelativePath(value);
}

function commandToProfile(command: string, args: string[]): RemoteCommandProfile | null {
  const full = [command, ...args].join(' ').trim();

  const profiles: RemoteCommandProfile[] = [
    'npm install',
    'npm run dev',
    'npm run build',
    'pnpm install',
    'pnpm run dev',
    'pnpm run build',
  ];

  return profiles.find((profile) => profile === full) ?? null;
}

function createOutputStream(chunks: string[], closed: { value: boolean }): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }

      if (closed.value) {
        controller.close();
      }
    },
  });
}

class RemoteSandboxProcess implements SandboxProcess {
  readonly output: ReadableStream<string>;

  readonly exit: Promise<number>;

  readonly input = undefined;

  #killed = false;

  constructor(
    private readonly _client: RemoteRuntimeClient,
    private readonly _commandId: string,
  ) {
    const chunks: string[] = [];
    const closed = { value: false };

    this.output = createOutputStream(chunks, closed);

    this.exit = new Promise<number>((resolve, reject) => {
      let ws: WebSocket | null = null;
      let finished = false;

      const finish = (code: number) => {
        if (finished) {
          return;
        }

        finished = true;
        closed.value = true;

        try {
          ws?.close();
        } catch {
          // Ignore WebSocket cleanup failures.
        }

        resolve(code);
      };

      try {
        ws = this._client.connectEvents((event: RemoteRuntimeEvent) => {
          if (event.payload.commandId !== this._commandId) {
            return;
          }

          if (event.type === 'stdout' || event.type === 'stderr') {
            const output = event.payload.output ?? '';

            if (output) {
              chunks.push(output);
            }

            return;
          }

          if (event.type === 'exit') {
            finish(event.payload.exitCode ?? 0);
            return;
          }

          if (event.type === 'status' && (event.payload.status === 'error' || event.payload.status === 'timed-out')) {
            finish(1);
          }
        });

        void this._client
          .getCommandStatus(this._commandId)
          .then((status: any) => {
            if (status.status === 'exited') {
              finish(status.exitCode ?? 0);
            } else if (status.status === 'error' || status.status === 'timed-out') {
              finish(status.exitCode ?? 1);
            }
          })
          .catch((error: unknown) => {
            if (!finished) {
              finished = true;
              closed.value = true;
              reject(error);
            }
          });
      } catch (error) {
        finished = true;
        closed.value = true;
        reject(error);
      }
    });
  }

  kill(): void {
    if (this.#killed) {
      return;
    }

    this.#killed = true;

    void this._client.stopCommand(this._commandId).catch(() => {
      // Best effort.
    });
  }
}

class RemoteRuntimeSession implements SandboxSession {
  readonly capabilities = REMOTE_RUNTIME_CAPABILITIES;

  readonly workdir = DEFAULT_WORKDIR;

  #disposed = false;

  #subscriptions = new Set<Unsubscribe>();

  #watchers = new Set<Unsubscribe>();

  constructor(
    readonly id: string,
    private readonly _client: RemoteRuntimeClient,
  ) {}

  #ensureActive(): void {
    if (this.#disposed) {
      throw new Error('Remote Runtime session has been disposed');
    }
  }

  async writeFiles(files: SandboxFileWrite[]): Promise<void> {
    this.#ensureActive();

    const payload: Record<string, string> = {};

    for (const file of files) {
      if (file.content instanceof Uint8Array) {
        throw new Error(`Remote Runtime currently supports text files only: '${file.path}'`);
      }

      payload[toRemotePath(file.path)] = file.content;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    await this._client.syncFiles(payload);
  }

  async readFile(filePath: string): Promise<string> {
    this.#ensureActive();

    const result = await this._client.readFile(toRemotePath(filePath));

    return result.content;
  }

  async readDir(directoryPath: string): Promise<SandboxDirEntry[]> {
    this.#ensureActive();

    const result = await this._client.listFiles();

    const directory = normalizeRelativePath(directoryPath);

    const prefix = directory === '.' ? '' : `${directory}/`;

    const entries = new Map<string, SandboxDirEntry>();

    for (const file of result.files) {
      const normalized = normalizeRelativePath(file.path);

      if (!normalized.startsWith(prefix)) {
        continue;
      }

      const remainder = normalized.slice(prefix.length);

      if (!remainder || remainder.includes('/')) {
        continue;
      }

      entries.set(remainder, {
        name: remainder,
        isDirectory: file.type === 'directory',
      });
    }

    return [...entries.values()];
  }

  async mkdir(directoryPath: string, options?: { recursive?: boolean }): Promise<void> {
    this.#ensureActive();

    /*
     * The current Remote Runtime API has no dedicated mkdir endpoint.
     * Creating a placeholder file lets the server-side file layer create
     * the required parent directories where supported.
     */
    if (options?.recursive) {
      const placeholder = `${normalizeRelativePath(directoryPath)}/.veldra-directory`;

      await this._client.writeFile(placeholder, '');

      return;
    }

    throw new Error('Remote Runtime does not currently expose a non-recursive mkdir operation.');
  }

  async remove(targetPath: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    this.#ensureActive();

    /*
     * The current RemoteRuntimeClient exposes no file-delete endpoint.
     * Do not emulate deletion through arbitrary remote commands.
     */
    if (options?.force) {
      throw new Error('Remote Runtime file deletion is not implemented by the current safe API.');
    }

    throw new Error(`Remote Runtime cannot remove '${targetPath}' until a dedicated delete API is available.`);
  }

  async spawn(command: string, args: string[], _options?: SandboxSpawnOptions): Promise<SandboxProcess> {
    this.#ensureActive();

    if (_options?.terminal) {
      throw new Error('Remote Runtime does not currently provide an interactive PTY.');
    }

    const profile = commandToProfile(command, args);

    if (!profile) {
      throw new Error(
        `Remote Runtime rejected command '${[command, ...args].join(' ')}'. ` +
          'Only allowlisted command profiles are supported.',
      );
    }

    const response = await this._client.runCommand(profile);

    return new RemoteSandboxProcess(this._client, response.commandId);
  }

  async previewUrl(port: number): Promise<string | null> {
    this.#ensureActive();

    const preview = await this._client.getPreviewUrl();

    if (preview.status !== 'running') {
      return null;
    }

    if (preview.port !== undefined && preview.port !== port) {
      return null;
    }

    return preview.previewUrl ?? preview.proxyUrl ?? preview.networkUrl ?? preview.localUrl ?? null;
  }

  watch(_options: SandboxWatchOptions, _onChange: (changes: SandboxFileChange[]) => void): Promise<Unsubscribe> {
    this.#ensureActive();

    /*
     * The Remote Runtime event contract currently exposes command events,
     * not filesystem watcher events. We therefore do not pretend that
     * fileWatch=true is available until a real file-watch protocol exists.
     */
    return Promise.reject(new Error('Remote Runtime filesystem watching is not implemented by the current event API.'));
  }

  subscribe(handler: (event: SandboxEvent) => void): Unsubscribe {
    this.#ensureActive();

    let active = true;

    const emit = (event: SandboxEvent) => {
      if (!active) {
        return;
      }

      try {
        handler(event);
      } catch {
        // Consumer handlers must not break provider lifecycle.
      }
    };

    const unsubscribe = () => {
      if (!active) {
        return;
      }

      active = false;
      this.#subscriptions.delete(unsubscribe);
    };

    /*
     * Preview/port events are not currently pushed by the Remote Runtime
     * WebSocket protocol. This subscription is therefore intentionally a
     * lifecycle hook for future protocol events rather than a fake event
     * source.
     */
    this.#subscriptions.add(unsubscribe);

    void emit;

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

    for (const unsubscribe of this.#watchers) {
      unsubscribe();
    }

    this.#subscriptions.clear();
    this.#watchers.clear();
  }
}

export function createRemoteRuntimeProvider(): SandboxProvider {
  return {
    id: REMOTE_RUNTIME_PROVIDER_ID,
    label: 'Remote Runtime',
    capabilities: REMOTE_RUNTIME_CAPABILITIES,

    isAvailable: async () => {
      const state = runtimeModeStore.get();

      if (!state.remoteRuntimeUrl) {
        return false;
      }

      const client = new RemoteRuntimeClient(state.remoteRuntimeUrl, state.remoteAuthToken || '');

      try {
        const health = await client.checkHealth();
        return health.ok === true;
      } catch {
        return false;
      }
    },

    create: async (createOptions: SandboxCreateOptions) => {
      const state = runtimeModeStore.get();

      if (!state.remoteRuntimeUrl) {
        throw new Error('Remote Runtime URL not configured');
      }

      const client = new RemoteRuntimeClient(state.remoteRuntimeUrl, state.remoteAuthToken || '');
      const workspace = await client.createWorkspace(createOptions.workdirName);

      return new RemoteRuntimeSession(workspace.workspaceId, client);
    },

    resume: async (sessionId: string) => {
      if (!sessionId) {
        return null;
      }

      const state = runtimeModeStore.get();

      if (!state.remoteRuntimeUrl) {
        return null;
      }

      const client = new RemoteRuntimeClient(state.remoteRuntimeUrl, state.remoteAuthToken || '');

      try {
        await client.checkHealth();
        return new RemoteRuntimeSession(sessionId, client);
      } catch {
        return null;
      }
    },
  };
}
