/**
 * RuntimeAdapter — High-level abstraction for VELDRA's runtime layer.
 *
 * Every store, hook, and component that currently talks to
 * @webcontainer/api directly should eventually route through this
 * interface instead.  That lets us swap in:
 *
 *   - WebContainerRuntimeAdapter   (desktop browser / Electron)
 *   - AndroidFallbackRuntimeAdapter (Capacitor WebView, no WC)
 *   - RemoteRuntimeAdapter          (future — server-side sandbox)
 *
 * The interface is intentionally a superset of the existing
 * PlatformAdapter in app/lib/adapters/types.ts.  It adds explicit
 * methods for the operations VELDRA's action-runner, file-store,
 * terminal-store, and preview-store need:
 *
 *   - boot / shutdown
 *   - file CRUD + watch
 *   - spawn shell / run command
 *   - install dependencies
 *   - start dev server
 *   - expose preview URL
 *
 * Each method that is unsupported on the current platform MUST return
 * a rejected promise (or a stub result with exitCode 1) — never throw
 * synchronously.  Consumers can also check `getCapabilities()` before
 * calling to decide whether to show UI or fall back.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type PlatformType = 'webcontainer' | 'android' | 'fallback' | 'remote';

export interface PlatformInfo {
  type: PlatformType;
  isMobile: boolean;
  isAndroid: boolean;
  isWebContainerSupported: boolean;
  isElectron: boolean;
}

export interface Dirent {
  name: string;
  path: string;
  type: 'file' | 'folder';
  isBinary?: boolean;
}

export interface PathWatcherEvent {
  path: string;
  type: 'add' | 'change' | 'remove';
}

export interface FileContent {
  content: string;
  isBinary: boolean;
}

export interface IPreview {
  port: number;
  ready: boolean;
  baseUrl: string;
}

export interface CommandResult {
  output: string;
  exitCode: number;
}

export interface ITerminalProcess {
  readonly input: WritableStreamDefaultWriter<string>;
  readonly output: ReadableStream<string>;
  resize(cols: number, rows: number): void;
  kill(): void;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/**
 * Declares which runtime features are available on the current platform.
 * Consumers should check this *before* calling methods that may be
 * unsupported, so they can show appropriate UI instead of getting errors.
 */
export interface RuntimeCapabilities {
  /** Read, write, list, and watch files */
  fileSystem: boolean;

  /** Spawn an interactive shell process */
  terminal: boolean;

  /** Run one-shot commands (npm, git, etc.) */
  commandExecution: boolean;

  /** Install npm/pnpm/yarn packages */
  packageInstall: boolean;

  /** Start a long-lived dev server (vite, next, etc.) */
  devServer: boolean;

  /** Live preview iframe of the dev server */
  preview: boolean;

  /** Clone git repositories into the workdir */
  gitClone: boolean;

  /** If false, file operations are in-memory only and won't persist */
  persistentFileSystem: boolean;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * Minimal terminal interface (avoids importing the full ITerminal type
 * which pulls in xterm etc.).
 */
export interface IRuntimeTerminal {
  cols: number;
  rows: number;
  write(data: string): void;
  onData(callback: (data: string) => void): void;
  input(data: string): void;
}

export interface RuntimeAdapter {
  // -- Platform identification ------------------------------------------------

  /** Returns information about the current platform and adapter type */
  getPlatformInfo(): PlatformInfo;

  /** Returns capability flags for the current platform */
  getCapabilities(): RuntimeCapabilities;

  // -- Lifecycle --------------------------------------------------------------

  /** Boot the underlying runtime (WebContainer, in-memory FS, etc.) */
  boot(): Promise<void>;

  /** Whether boot() has completed successfully */
  isReady(): boolean;

  /** Clean up resources. Safe to call multiple times. */
  shutdown(): Promise<void>;

  // -- File system ------------------------------------------------------------

  readFile(path: string): Promise<FileContent>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  mkdir(path: string, recursive?: boolean): Promise<void>;
  readdir(path: string): Promise<Dirent[]>;
  rm(path: string, recursive?: boolean): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  watch(path: string, callback: (event: PathWatcherEvent) => void): Promise<() => void>;

  // -- Terminal / commands ----------------------------------------------------

  /** Spawn an interactive shell attached to a terminal */
  spawnShell(terminal: IRuntimeTerminal): Promise<ITerminalProcess>;

  /** Run a single command and return its output + exit code */
  executeCommand(command: string): Promise<CommandResult>;

  /** Install dependencies (runs `npm install` / `pnpm install` / etc.) */
  installDependencies(options?: {
    packageManager?: 'npm' | 'pnpm' | 'yarn';
    cwd?: string;
  }): Promise<CommandResult>;

  // -- Dev server / preview ---------------------------------------------------

  /** Start the dev server (e.g. `npm run dev`) */
  startDevServer(command: string): Promise<CommandResult>;

  /** Register a callback fired when the dev server is ready on a port */
  onServerReady(callback: (port: number, url: string) => void): void;

  /** Register a callback for port open/close events */
  onPortEvent(callback: (port: number, type: 'open' | 'close', url: string) => void): void;

  /** Get the preview URL for a given port, or null if not ready */
  getPreviewUrl(port: number): string | null;

  /** Get all current previews */
  getPreviews(): IPreview[];

  // -- Preview inspector ------------------------------------------------------

  /** Register a callback for preview messages (console errors, etc.) */
  onPreviewMessage(callback: (message: any) => void): void;

  /** Set the inspector script injected into preview iframes */
  setPreviewScript(script: string): Promise<void>;

  // -- Workdir ----------------------------------------------------------------

  /** The working directory path inside the runtime */
  readonly workdir: string;
}

// ---------------------------------------------------------------------------
// Helper: unsupported-feature error
// ---------------------------------------------------------------------------

/**
 * Standard error thrown by adapters when a capability is not available.
 * Has a `capability` field so UI can show a targeted message.
 */
export class UnsupportedFeatureError extends Error {
  readonly capability: keyof RuntimeCapabilities;

  constructor(capability: keyof RuntimeCapabilities, platform: string) {
    const messages: Record<keyof RuntimeCapabilities, string> = {
      fileSystem: 'File system operations are not available on this device.',
      terminal: 'Interactive terminal is not available on this device.',
      commandExecution: 'Command execution is not available on this device.',
      packageInstall: 'Package installation is not available on this device.',
      devServer: 'Dev server is not available on this device.',
      preview: 'Live preview is not available on this device.',
      gitClone: 'Git clone is not available on this device.',
      persistentFileSystem: 'File system is in-memory only and will not persist.',
    };

    super(`${messages[capability]} (platform: ${platform})`);
    this.name = 'UnsupportedFeatureError';
    this.capability = capability;
  }
}
