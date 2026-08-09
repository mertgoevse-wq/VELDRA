/**
 * Platform Adapter Interface
 *
 * Abstracts the WebContainer / terminal / filesystem / preview functionality
 * so VELDRA can run on:
 *   - Desktop browsers (full WebContainer support)
 *   - Android WebView via Capacitor (fallback / degraded mode)
 *
 * The adapter pattern lets us keep all core VELDRA features compiling
 * while providing Android-compatible fallbacks where WebContainer is
 * unsupported.
 */

export type PlatformType = 'webcontainer' | 'android' | 'fallback';

export interface PlatformInfo {
  type: PlatformType;
  isMobile: boolean;
  isAndroid: boolean;
  isWebContainerSupported: boolean;
  isElectron: boolean;
}

/**
 * Minimal file system interface that both WebContainer and Android
 * adapters can implement.
 */
export interface IFileSystem {
  readFile(path: string): Promise<{ content: string; isBinary: boolean }>;
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  mkdir(path: string, recursive?: boolean): Promise<void>;
  readdir(path: string): Promise<Dirent[]>;
  rm(path: string, recursive?: boolean): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  watch(path: string, callback: (event: PathWatcherEvent) => void): Promise<() => void>;
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

/**
 * Terminal process interface — a subset of WebContainerProcess
 * that the Android adapter can also implement.
 */
export interface ITerminalProcess {
  readonly input: WritableStreamDefaultWriter<string>;
  readonly output: ReadableStream<string>;
  resize(cols: number, rows: number): void;
  kill(): void;
}

/**
 * Preview interface — represents a running dev server preview.
 */
export interface IPreview {
  port: number;
  ready: boolean;
  baseUrl: string;
}

/**
 * The main platform adapter interface. All WebContainer-dependent
 * functionality is routed through this.
 */
export interface PlatformAdapter {
  /** Platform identification */
  getPlatformInfo(): PlatformInfo;

  /** Boot the underlying runtime (WebContainer or fallback) */
  boot(): Promise<void>;

  /** Whether the runtime is ready */
  isReady(): boolean;

  /** Get the filesystem interface */
  getFileSystem(): IFileSystem;

  /**
   * Spawn a terminal shell process.
   * On Android, this returns a stub/blocked process.
   */
  spawnShell(terminal: import('~/types/terminal').ITerminal): Promise<ITerminalProcess>;

  /**
   * Execute a command and return its output.
   * On Android, this returns a stub result.
   */
  executeCommand(command: string): Promise<{ output: string; exitCode: number }>;

  /** Register a callback for server-ready events (preview) */
  onServerReady(callback: (port: number, url: string) => void): void;

  /** Register a callback for port open/close events */
  onPortEvent(callback: (port: number, type: 'open' | 'close', url: string) => void): void;

  /** Register a callback for preview messages */
  onPreviewMessage(callback: (message: any) => void): void;

  /** Set the preview inspector script */
  setPreviewScript(script: string): Promise<void>;

  /** Get available previews */
  getPreviews(): IPreview[];

  /** Shutdown the runtime */
  shutdown(): Promise<void>;
}
