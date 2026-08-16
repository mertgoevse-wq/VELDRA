/**
 * Storage Provider Foundation
 *
 * Block 6 of the productization mandate: a clean interface so a project's files can live in
 * (and move between) different backends -- today's Remote Runtime workspace, the local
 * IndexedDB fallback, and eventually a real GitHub-backed or cloud-drive-backed provider --
 * without every call site needing to know which one it's talking to.
 *
 * SCOPE, deliberately: this file defines the CONTRACT and reconciles the three file-shape
 * types that already exist in this codebase (PersistedDirent in androidFallbackStorage.ts,
 * Dirent in files.ts, RemoteFileItem in RemoteRuntimeClient.ts -- confirmed to differ on
 * type naming ('folder' vs 'directory'), whether `path` is a field or an external Record key,
 * and whether isLocked/lockedByFolder exist at all). It does NOT implement a GitHub, Google
 * Drive, or iCloud provider -- those would be real, separate, larger pieces of work (OAuth,
 * conflict UI, quota handling) that don't exist yet and must not be faked. Only two REAL,
 * already-working backends get adapters in this block: Remote Runtime
 * (RemoteRuntimeProvider, wrapping the existing, proven RemoteWorkspaceSync/RemoteRuntimeClient
 * logic rather than reimplementing it) and local IndexedDB fallback storage.
 *
 * See docs/architecture/STORAGE_AND_SYNC.md for the full LOCAL/REMOTE/SYNC/PROJECT/
 * AUTHENTICATION/STORAGE PROVIDER breakdown and the honest threat model (today: no
 * encryption at rest anywhere, credentials in plaintext localStorage/cookies). Local
 * (Android fallback) storage genuinely isolates per project as of a later round --
 * Remote Runtime workspaces do not yet (see RemoteRuntimeProvider's own doc comment).
 */

/** A project's identity, independent of which device or storage backend is being used. */
export interface ProjectIdentity {
  /**
   * Stable identifier for this project. Today this is the chat ID (see current-session note
   *  below) -- there is no broader "project" grouping in the codebase yet, so this type
   *  formalizes what already functions as project identity rather than inventing a new one.
   */
  id: string;

  /** Human-readable name, if the project has one (e.g. a chat's description/title). */
  name?: string;
}

/**
 * A neutral file/folder entry, reconciling the three differently-shaped types already in
 *  use (see file header). `path` is always an explicit field here -- never an implicit
 *  Record key -- since a provider-agnostic API must be able to return a flat list.
 */
export interface StorageFileEntry {
  path: string;
  type: 'file' | 'folder';
  content?: string;
  isBinary?: boolean;
  size?: number;
  modifiedAt?: string;

  /**
   * Not every backend can represent this (Remote Runtime's file API has no lock concept
   *  today) -- optional, and providers that can't represent it should simply omit it rather
   *  than inventing a fake value.
   */
  isLocked?: boolean;
}

/**
 * The real, current sync status a provider can report -- deliberately narrow. A provider
 *  must never report 'synced' unless it actually confirmed the remote state, matching this
 *  codebase's existing "never invent success" rule (see RemoteWorkspaceSync.ts).
 */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'conflict' | 'error' | 'unavailable';

export interface StorageProviderCapabilities {
  /** Can list/read files at all. */
  read: boolean;

  /** Can write/create files. */
  write: boolean;

  /**
   * Can actually remove a file from the backend (not just stop tracking it locally) --
   *  false until a provider genuinely implements deletion, per the delete-propagation bug
   *  fixed this same round for Remote Runtime.
   */
  delete: boolean;

  /**
   * Whether this provider can detect a content conflict (a file changed on both sides)
   *  rather than silently picking a winner.
   */
  conflictDetection: boolean;

  /**
   * Whether `rename()` is real for this provider, not just present on the interface.
   * False for a provider with no real primitive to build one from -- see rename()'s own
   * doc comment. A provider must never claim this true and then fake the result.
   */
  rename: boolean;
}

/**
 * A storage backend for one project's files. Implementations wrap already-real code
 * (RemoteRuntimeClient, androidFallbackStorage) rather than re-implementing file I/O --
 * this interface exists to give call sites one shape to program against, not to replace
 * the underlying logic.
 */
export interface StorageProvider {
  readonly id: string;
  readonly capabilities: StorageProviderCapabilities;

  listFiles(project: ProjectIdentity): Promise<StorageFileEntry[]>;
  readFile(project: ProjectIdentity, path: string): Promise<StorageFileEntry | undefined>;
  writeFiles(project: ProjectIdentity, files: Record<string, string>): Promise<{ writtenCount: number }>;

  /**
   * Optional: only providers with capabilities.delete === true need to actually remove
   *  anything; a provider without delete support may implement this as a no-op, but must
   *  report capabilities.delete === false so callers don't assume it worked.
   */
  deleteFiles(project: ProjectIdentity, paths: string[]): Promise<{ deletedCount: number }>;

  /**
   * Whether a path currently exists (as a file or folder). Must reflect the same real
   *  state listFiles()/readFile() would -- not a separate, potentially-stale check.
   */
  exists(project: ProjectIdentity, path: string): Promise<boolean>;

  /**
   * Metadata only, no content -- for callers that don't need the (potentially large)
   *  file body. Returns undefined if the path doesn't exist, same as readFile().
   */
  getMetadata(
    project: ProjectIdentity,
    path: string,
  ): Promise<Pick<StorageFileEntry, 'path' | 'type' | 'size' | 'modifiedAt' | 'isBinary'> | undefined>;

  /**
   * Renames/moves a path. Real only when capabilities.rename is true -- a provider where
   * it's false MUST reject the call, never silently no-op or report false success. See
   * LocalStorageProvider vs. RemoteRuntimeProvider: the local provider composes a real
   * rename from its own read+write+delete primitives in one atomic save; Remote Runtime
   * has no rename primitive of its own to build one from (see
   * RemoteRuntimeProvider.rename()'s doc comment for exactly why).
   */
  rename(project: ProjectIdentity, fromPath: string, toPath: string): Promise<void>;

  getSyncState(project: ProjectIdentity): SyncState;
}
