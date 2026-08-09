/**
 * Provider-agnostic contract for executing project code and serving its preview.
 *
 * Modeled on what the codebase already does with WebContainer today (file
 * read/write/watch, spawning processes, reacting to opened ports) plus what
 * remote execution additionally requires: batched writes, explicit URL
 * resolution, and resuming a session after the app lost its connection.
 *
 * Rationale, provider comparison and routing policy: project/ARCHITECTURE-EXECUTION.md
 * Decision record: project/DECISIONS.md D-11, D-12
 */

/**
 * What a provider can actually do. Providers differ far too much to pretend
 * otherwise -- an in-browser WebContainer has no public URL, a phone-local
 * runtime may have no PTY, a serverless backend may cap session length.
 * Callers must branch on these rather than assume a uniform feature set.
 */
export interface SandboxCapabilities {
  /** Interactive PTY: process.input is writable and resize() works. Terminal UI requires this. */
  interactiveShell: boolean;

  /** Push-based file change events via watch(). When false, callers must poll or rely on their own writes. */
  fileWatch: boolean;

  /** previewUrl() can return a URL the device can actually load. False for execution-only backends. */
  publicPreviewUrl: boolean;

  /** Filesystem survives dispose() and can be reattached via resume(). */
  persistentFilesystem: boolean;

  /** Outbound reachability from inside the sandbox; 'outbound' is the minimum for npm install. */
  network: 'none' | 'outbound' | 'full';

  /** Hard limit the backend imposes on one session, in ms. null when only our own policy applies. */
  maxSessionMs: number | null;
}

export interface SandboxFileWrite {
  /** Relative to the session's workdir. */
  path: string;
  content: string | Uint8Array;
}

export interface SandboxDirEntry {
  name: string;
  isDirectory: boolean;
}

export interface SandboxSpawnOptions {
  /** Relative to workdir; defaults to workdir itself. */
  cwd?: string;
  env?: Record<string, string>;

  /**
   * Requests a PTY of this size. Ignored by providers without
   * capabilities.interactiveShell, which then leave process.input undefined.
   */
  terminal?: { cols: number; rows: number };
}

export interface SandboxProcess {
  readonly output: ReadableStream<string>;

  /** Only present when the provider reports interactiveShell. */
  readonly input?: WritableStream<string>;

  readonly exit: Promise<number>;

  kill(): void;

  /** Only meaningful for PTY-backed processes. */
  resize?(size: { cols: number; rows: number }): void;
}

export interface SandboxWatchOptions {
  /** Glob patterns relative to workdir. */
  include: string[];
  exclude?: string[];
}

export interface SandboxFileChange {
  path: string;
  type: 'add' | 'change' | 'remove';
}

/**
 * Port lifecycle is an event rather than a return value because a dev server
 * opens its port whenever it feels like it, long after spawn() resolved.
 */
export type SandboxEvent =
  | { type: 'port-open'; port: number; url: string | null }
  | { type: 'port-close'; port: number }
  | { type: 'session-lost'; reason: string };

export type Unsubscribe = () => void;

export interface SandboxSession {
  readonly id: string;

  /** Absolute path inside the sandbox that all relative paths resolve against. */
  readonly workdir: string;

  readonly capabilities: SandboxCapabilities;

  /**
   * Batched deliberately: a code-generating agent commonly emits dozens of
   * files at once, and one round trip per file is unusable over a mobile link.
   */
  writeFiles(files: SandboxFileWrite[]): Promise<void>;

  readFile(path: string): Promise<string>;
  readDir(path: string): Promise<SandboxDirEntry[]>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  remove(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;

  spawn(command: string, args: string[], options?: SandboxSpawnOptions): Promise<SandboxProcess>;

  /**
   * URL at which the device can reach the given port, or null when the port
   * isn't served (yet) or the provider lacks publicPreviewUrl.
   */
  previewUrl(port: number): Promise<string | null>;

  /** Only present when capabilities.fileWatch is true. */
  watch?(options: SandboxWatchOptions, onChange: (changes: SandboxFileChange[]) => void): Promise<Unsubscribe>;

  subscribe(handler: (event: SandboxEvent) => void): Unsubscribe;

  dispose(): Promise<void>;
}

export interface SandboxCreateOptions {
  /** Directory name to create the project under; providers map this onto their own root. */
  workdirName: string;
}

export interface SandboxProvider {
  /** Stable identifier used in config, routing policy and telemetry, e.g. 'webcontainer', 'e2b'. */
  readonly id: string;

  /** Human-readable, for the provider picker in settings. */
  readonly label: string;

  readonly capabilities: SandboxCapabilities;

  /**
   * Whether this provider can be used right now -- credentials present, host
   * reachable, platform supported. Routing consults this before create().
   */
  isAvailable(): Promise<boolean>;

  create(options: SandboxCreateOptions): Promise<SandboxSession>;

  /**
   * Reattach to a still-live session, e.g. after the app was backgrounded.
   * Only meaningful for providers with persistentFilesystem; returns null when
   * the session is gone.
   */
  resume?(sessionId: string): Promise<SandboxSession | null>;
}
