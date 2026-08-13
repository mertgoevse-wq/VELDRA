/**
 * WebContainerRuntimeAdapter
 *
 * Wraps the existing @webcontainer/api in the RuntimeAdapter interface.
 *
 * This adapter is a *delegation* layer — it does NOT replace the existing
 * WebContainer logic in app/lib/webcontainer/index.ts, app/lib/stores/files.ts,
 * app/lib/stores/terminal.ts, etc.  Instead it provides a clean interface
 * that new code (and refactored stores) can call, while the old code
 * continues to work unchanged.
 *
 * The eventual migration path is:
 *   1. New code uses RuntimeAdapter exclusively.
 *   2. Existing stores get refactored to accept a RuntimeAdapter.
 *   3. The adapter's boot() replaces the ad-hoc boot in webcontainer/index.ts.
 *
 * Until then, both paths coexist safely.
 */

import { WebContainer } from '@webcontainer/api';
import type {
  RuntimeAdapter,
  PlatformInfo,
  RuntimeCapabilities,
  FileContent,
  Dirent,
  PathWatcherEvent,
  IPreview,
  CommandResult,
  ITerminalProcess,
  IRuntimeTerminal,
} from './RuntimeAdapter';
import { WORK_DIR_NAME } from '~/utils/constants';
import { newShellProcess } from '~/utils/shell';

export class WebContainerRuntimeAdapter implements RuntimeAdapter {
  private instance: WebContainer | null = null;
  private booted = false;

  // Callback registries
  private serverReadyCallbacks: ((port: number, url: string) => void)[] = [];
  private portCallbacks: ((port: number, type: 'open' | 'close', url: string) => void)[] = [];
  private previewCallbacks: ((message: any) => void)[] = [];

  // Preview state
  private previews = new Map<number, IPreview>();

  // Cached inspector script (set before boot if needed)
  private _previewScript: string | null = null;

  // -- Platform identification ------------------------------------------------

  getPlatformInfo(): PlatformInfo {
    return {
      type: 'webcontainer',
      isMobile: false,
      isAndroid: false,
      isWebContainerSupported: true,
      isElectron: false,
    };
  }

  getCapabilities(): RuntimeCapabilities {
    return {
      fileSystem: true,
      terminal: true,
      commandExecution: true,
      packageInstall: true,
      devServer: true,
      preview: true,
      gitClone: true,
      persistentFileSystem: true,
    };
  }

  // -- Lifecycle --------------------------------------------------------------

  async boot(): Promise<void> {
    if (this.instance) return;

    this.instance = await WebContainer.boot({
      coep: 'credentialless',
      workdirName: WORK_DIR_NAME,
      forwardPreviewErrors: true,
    });

    this.booted = true;

    // Set preview script if it was cached before boot
    if (this._previewScript) {
      await this.instance.setPreviewScript(this._previewScript);
    }

    // Wire up event listeners
    this.instance.on('server-ready', (port, url) => {
      const preview = this.previews.get(port);
      if (preview) {
        preview.ready = true;
        preview.baseUrl = url;
      }
      this.serverReadyCallbacks.forEach((cb) => cb(port, url));
    });

    this.instance.on('port', (port, type, url) => {
      if (type === 'close') {
        this.previews.delete(port);
      } else {
        const existing = this.previews.get(port);
        if (existing) {
          existing.ready = type === 'open';
          existing.baseUrl = url;
        } else {
          this.previews.set(port, { port, ready: type === 'open', baseUrl: url });
        }
      }
      this.portCallbacks.forEach((cb) => cb(port, type, url));
    });

    this.instance.on('preview-message', (message) => {
      this.previewCallbacks.forEach((cb) => cb(message));
    });
  }

  isReady(): boolean {
    return this.booted && this.instance !== null;
  }

  async shutdown(): Promise<void> {
    // WebContainer doesn't expose a public teardown, but we can
    // drop our reference and mark as not ready.
    this.booted = false;
    this.instance = null;
    this.previews.clear();
  }

  // -- File system ------------------------------------------------------------

  private requireInstance(): WebContainer {
    if (!this.instance) {
      throw new Error('WebContainer not booted. Call boot() first.');
    }
    return this.instance;
  }

  async readFile(path: string): Promise<FileContent> {
    const wc = this.requireInstance();
    const data = await wc.fs.readFile(path);
    const buffer = new Uint8Array(data.byteLength);
    buffer.set(new Uint8Array(data));
    const isBinary = buffer.some((byte) => byte === 0);
    const content = isBinary ? '' : new TextDecoder().decode(buffer);
    return { content, isBinary };
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    const wc = this.requireInstance();
    if (typeof content === 'string') {
      await wc.fs.writeFile(path, content);
    } else {
      await wc.fs.writeFile(path, content);
    }
  }

  async mkdir(path: string, recursive?: boolean): Promise<void> {
    const wc = this.requireInstance();
    if (recursive) {
      await wc.fs.mkdir(path, { recursive: true });
    } else {
      await wc.fs.mkdir(path);
    }
  }

  async readdir(path: string): Promise<Dirent[]> {
    const wc = this.requireInstance();
    const entries = await wc.fs.readdir(path, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      path: `${path}/${entry.name}`,
      type: entry.isDirectory() ? ('folder' as const) : ('file' as const),
    }));
  }

  async rm(path: string, recursive?: boolean): Promise<void> {
    const wc = this.requireInstance();
    if (recursive) {
      await wc.fs.rm(path, { recursive: true });
    } else {
      await wc.fs.rm(path);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const wc = this.requireInstance();
    await wc.fs.rename(oldPath, newPath);
  }

  async watch(path: string, callback: (event: PathWatcherEvent) => void): Promise<() => void> {
    const wc = this.requireInstance();
    const watcher = await wc.fs.watch(path, { recursive: true });
    (watcher as any).addEventListener('change', (event: any) => {
      callback({
        path: event.filename || path,
        type: 'change',
      });
    });
    return () => watcher.close();
  }

  // -- Terminal / commands ----------------------------------------------------

  async spawnShell(terminal: IRuntimeTerminal): Promise<ITerminalProcess> {
    const wc = this.requireInstance();

    // TODO: Architectural mismatch - newShellProcess expects SandboxSession but receives WebContainer.
    // This should be refactored to use WebContainerSession from lib/execution/webcontainer.ts
    // Cast: our IRuntimeTerminal is compatible with the ITerminal that
    // newShellProcess expects (it only uses cols, rows, write, onData).
    const process = await newShellProcess(wc as any, terminal as any);

    return {
      get input() {
        // process.input is guaranteed to exist for interactive shells
        return process.input!.getWriter();
      },
      get output() {
        return process.output;
      },
      resize(cols: number, rows: number) {
        process.resize?.({ cols, rows });
      },
      kill() {
        process.kill();
      },
    };
  }

  async executeCommand(command: string): Promise<CommandResult> {
    const wc = this.requireInstance();
    const process = await wc.spawn('jsh', ['-c', command]);
    const reader = process.output.getReader();
    let output = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += value;
    }

    const exitCode = (await process.exit) as number;
    return { output, exitCode };
  }

  async installDependencies(options?: {
    packageManager?: 'npm' | 'pnpm' | 'yarn';
    cwd?: string;
  }): Promise<CommandResult> {
    const pm = options?.packageManager ?? 'npm';
    const cmd = pm === 'pnpm' ? 'pnpm install' : pm === 'yarn' ? 'yarn install' : 'npm install';
    return this.executeCommand(cmd);
  }

  // -- Dev server / preview ---------------------------------------------------

  async startDevServer(command: string): Promise<CommandResult> {
    // Dev server is a long-running process. We run it via executeCommand
    // but the caller should not await completion — the server keeps running.
    // The returned promise resolves only if the server exits.
    return this.executeCommand(command);
  }

  onServerReady(callback: (port: number, url: string) => void): void {
    this.serverReadyCallbacks.push(callback);
  }

  onPortEvent(callback: (port: number, type: 'open' | 'close', url: string) => void): void {
    this.portCallbacks.push(callback);
  }

  getPreviewUrl(port: number): string | null {
    const preview = this.previews.get(port);
    return preview?.ready ? preview.baseUrl : null;
  }

  getPreviews(): IPreview[] {
    return Array.from(this.previews.values());
  }

  // -- Preview inspector ------------------------------------------------------

  onPreviewMessage(callback: (message: any) => void): void {
    this.previewCallbacks.push(callback);
  }

  async setPreviewScript(script: string): Promise<void> {
    this._previewScript = script;
    if (this.instance) {
      await this.instance.setPreviewScript(script);
    }
  }

  // -- Workdir ----------------------------------------------------------------

  get workdir(): string {
    return this.requireInstance().workdir;
  }
}
