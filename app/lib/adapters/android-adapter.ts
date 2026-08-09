/**
 * Android / Fallback Platform Adapter
 *
 * Provides a working implementation of the PlatformAdapter interface
 * for environments where WebContainer is NOT available (Android WebView,
 * older browsers, etc.).
 *
 * Key differences from WebContainer:
 *   - File system is in-memory (using a Map)
 *   - Terminal shell is a stub that echoes input and shows a warning
 *   - Preview is not available (no dev server can run)
 *   - All AI/chat features work normally
 *
 * This allows VELDRA to run as a chat + code editor on Android,
 * with file management and AI code generation fully functional.
 */

import type {
  PlatformAdapter,
  PlatformInfo,
  IFileSystem,
  ITerminalProcess,
  IPreview,
  Dirent,
  PathWatcherEvent,
} from './types';
import type { ITerminal } from '~/types/terminal';
import {
  loadAndroidFallbackState,
  saveAndroidFallbackWorkspace,
  type PersistedDirent,
} from '~/lib/persistence/androidFallbackStorage';

export class InMemoryFileSystem implements IFileSystem {
  private _files = new Map<string, string>();
  private _watchers = new Map<string, (event: PathWatcherEvent) => void>();
  private _initialized = false;
  private _initializationPromise: Promise<void> | null = null;

  constructor() {
    this._initializationPromise = this._hydrateFromStorage();
  }

  private async _ensureInitialized(): Promise<void> {
    if (this._initialized) {
      return;
    }

    await this._initializationPromise;
  }

  private async _hydrateFromStorage(): Promise<void> {
    const state = await loadAndroidFallbackState();
    const entries = Object.entries(state.workspace.files ?? {});

    this._files = new Map();

    for (const [path, dirent] of entries) {
      if (dirent?.type === 'file' && typeof dirent.content === 'string') {
        this._files.set(path, dirent.content);
      }
    }

    this._initialized = true;
  }

  private async _persistState(): Promise<void> {
    await this._ensureInitialized();

    const files = Object.fromEntries(
      Array.from(this._files.entries()).map(([path, content]) => [path, { type: 'file' as const, content }]),
    );

    await saveAndroidFallbackWorkspace(files as Record<string, PersistedDirent>, []);
  }

  async readFile(path: string): Promise<{ content: string; isBinary: boolean }> {
    await this._ensureInitialized();
    const content = this._files.get(path);

    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }

    return { content, isBinary: false };
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    await this._ensureInitialized();
    const str = typeof content === 'string' ? content : new TextDecoder().decode(content);
    this._files.set(path, str);
    await this._persistState();
    this._notifyWatchers({ path, type: 'change' });
  }

  async mkdir(path: string, _recursive?: boolean): Promise<void> {
    await this._ensureInitialized();
    if (!this._files.has(path)) {
      this._files.set(path, '');
      await this._persistState();
    }

    this._notifyWatchers({ path, type: 'add' });
  }

  async readdir(path: string): Promise<Dirent[]> {
    await this._ensureInitialized();
    const results: Dirent[] = [];
    const prefix = path.endsWith('/') ? path : path + '/';

    for (const filePath of this._files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relative = filePath.slice(prefix.length);

        if (!relative.includes('/')) {
          results.push({ name: relative, path: filePath, type: 'file', isBinary: false });
        } else {
          const dirName = relative.split('/')[0];

          if (!results.find((r) => r.name === dirName)) {
            results.push({ name: dirName, path: prefix + dirName, type: 'folder' });
          }
        }
      }
    }

    return results;
  }

  async rm(path: string, _recursive?: boolean): Promise<void> {
    await this._ensureInitialized();
    // Remove exact match and all children
    for (const key of this._files.keys()) {
      if (key === path || key.startsWith(path + '/')) {
        this._files.delete(key);
      }
    }
    await this._persistState();
    this._notifyWatchers({ path, type: 'remove' });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this._ensureInitialized();
    const content = this._files.get(oldPath);

    if (content !== undefined) {
      this._files.set(newPath, content);
      this._files.delete(oldPath);
      await this._persistState();
      this._notifyWatchers({ path: newPath, type: 'change' });
    }
  }

  async watch(path: string, callback: (event: PathWatcherEvent) => void): Promise<() => void> {
    await this._ensureInitialized();
    this._watchers.set(path, callback);

    return () => {
      this._watchers.delete(path);
    };
  }

  private _notifyWatchers(event: PathWatcherEvent): void {
    for (const [watchPath, callback] of this._watchers.entries()) {
      if (event.path.startsWith(watchPath)) {
        callback(event);
      }
    }
  }

  /** Get all files as a map (for compatibility with FilesStore) */
  getAllFiles(): Map<string, string> {
    return new Map(this._files);
  }
}

/**
 * Stub terminal process for Android — echoes input and shows a
 * "not available" message.
 */
class StubTerminalProcess implements ITerminalProcess {
  private _outputController!: ReadableStreamDefaultController<string>;
  readonly output: ReadableStream<string>;
  readonly input: WritableStreamDefaultWriter<string>;
  private _alive = true;

  constructor(terminal: ITerminal) {
    const self = this;

    this.output = new ReadableStream<string>({
      start(controller) {
        self._outputController = controller;
        controller.enqueue(
          '\x1b[33m⚠ WebContainer is not available on this device.\x1b[0m\r\n' +
            '\x1b[33mTerminal commands cannot be executed on Android.\x1b[0m\r\n' +
            '\x1b[90mYou can still chat with AI, generate code, and edit files.\x1b[0m\r\n\r\n',
        );
      },
    });

    // Create input stream that echoes to terminal
    const inputStream = new WritableStream<string>({
      write(data) {
        if (self._alive) {
          terminal.write(data);
        }
      },
    });

    this.input = inputStream.getWriter();

    // Pipe output to terminal
    this.output
      .pipeTo(
        new WritableStream<string>({
          write(data) {
            terminal.write(data);
          },
        }),
      )
      .catch(() => {
        // stream closed
      });
  }

  resize(_cols: number, _rows: number): void {
    // no-op
  }

  kill(): void {
    this._alive = false;
  }
}

export class AndroidAdapter implements PlatformAdapter {
  private _fs = new InMemoryFileSystem();
  private _ready = false;
  private _serverReadyCallbacks: ((port: number, url: string) => void)[] = [];
  private _portCallbacks: ((port: number, type: 'open' | 'close', url: string) => void)[] = [];
  private _previewCallbacks: ((message: any) => void)[] = [];
  private _previews: IPreview[] = [];

  getPlatformInfo(): PlatformInfo {
    return {
      type: 'android',
      isMobile: true,
      isAndroid: true,
      isWebContainerSupported: false,
      isElectron: false,
    };
  }

  async boot(): Promise<void> {
    this._ready = true;
    console.log('[AndroidAdapter] Booted in fallback mode (no WebContainer)');
  }

  isReady(): boolean {
    return this._ready;
  }

  getFileSystem(): IFileSystem {
    return this._fs;
  }

  async spawnShell(terminal: ITerminal): Promise<ITerminalProcess> {
    return new StubTerminalProcess(terminal);
  }

  async executeCommand(_command: string): Promise<{ output: string; exitCode: number }> {
    return {
      output: 'Command execution is not available on Android.\n',
      exitCode: 1,
    };
  }

  onServerReady(callback: (port: number, url: string) => void): void {
    this._serverReadyCallbacks.push(callback);
  }

  onPortEvent(callback: (port: number, type: 'open' | 'close', url: string) => void): void {
    this._portCallbacks.push(callback);
  }

  onPreviewMessage(callback: (message: any) => void): void {
    this._previewCallbacks.push(callback);
  }

  async setPreviewScript(_script: string): Promise<void> {
    // no-op — no WebContainer to inject into
  }

  getPreviews(): IPreview[] {
    return this._previews;
  }

  async shutdown(): Promise<void> {
    this._ready = false;
  }
}
