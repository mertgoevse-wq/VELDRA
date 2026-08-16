import { getCurrentProjectId } from '~/lib/identity/project';

export interface AndroidFallbackSessionState {
  key: 'session';

  /**
   * Historically hardcoded to the literal string 'default' everywhere it was set, never
   * read back for any decision -- effectively dead. Now genuinely holds the current
   * project's ID (see app/lib/identity/project.ts), reflecting which project's workspace
   * record this session last touched.
   */
  activeWorkspace: string;

  /**
   * Set once, the first time per-project workspace storage successfully determines
   * whether pre-upgrade global workspace data existed. Either the project ID that
   * inherited that legacy data, or NO_LEGACY_DATA_SENTINEL if there was nothing to
   * migrate. Never re-checked once set, so a legacy record is claimed by exactly one
   * project, and every other/new project starts genuinely empty rather than each
   * repeatedly re-claiming the same old data.
   */
  migratedGlobalWorkspaceToProjectId?: string;
  lastOpenedFile?: string;
  currentView?: string;
  updatedAt: string;
}

export interface AndroidFallbackWorkspaceState {
  /**
   * The full per-project storage key (see workspaceKeyFor) -- also IndexedDB's keyPath
   *  for this record, so this field IS this record's primary key, not just a label.
   */
  key: string;
  files: Record<string, PersistedDirent>;
  deletedPaths: string[];
  updatedAt: string;
}

export interface PersistedDirent {
  type: 'file' | 'folder';
  content?: string;
  isBinary?: boolean;
  isLocked?: boolean;
  lockedByFolder?: string;
}

interface AndroidFallbackState {
  workspace: AndroidFallbackWorkspaceState;
  session: AndroidFallbackSessionState;
}

const DB_NAME = 'bolt-android-fallback';

/**
 * v2 adds SYNC_BASE_STORE (the three-way-sync "last known common state" snapshot -- see
 * app/lib/sync/three-way-merge.ts). No data migration needed for existing installs: the store
 * simply doesn't exist yet for any project, and an absent base snapshot is a valid, meaningful
 * state (treated as "never synced" -- see getBaseSnapshot below), not an error.
 */
const DB_VERSION = 2;
const WORKSPACE_STORE = 'workspace';
const SESSION_STORE = 'session';
const SYNC_BASE_STORE = 'syncBase';

/**
 * The exact IndexedDB key every install used before per-project storage existed --
 * pre-migration data lives here and ONLY here. Never written to again after this file
 * introduced per-project keys; read-only, for one-time migration.
 */
const LEGACY_GLOBAL_WORKSPACE_KEY = 'workspace';

/**
 * Recorded in session state when a migration check found no legacy data to migrate,
 *  so that check is never repeated for every subsequently-created project.
 */
const NO_LEGACY_DATA_SENTINEL = '__none__';

function workspaceKeyFor(projectId: string): string {
  return `workspace:${projectId}`;
}

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function createDefaultWorkspaceState(key: string): AndroidFallbackWorkspaceState {
  return {
    key,
    files: {},
    deletedPaths: [],
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultSessionState(): AndroidFallbackSessionState {
  return {
    key: 'session',
    activeWorkspace: 'default',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * IndexedDB has no schema enforcement -- a record could be malformed from an interrupted write,
 * a future incompatible version, or platform bugs. Reading `request.result` straight through an
 * `as` cast previously trusted it unconditionally; a corrupted `files`/`deletedPaths` shape would
 * propagate into FilesStore and crash or silently corrupt the workspace instead of falling back
 * to a safe, empty default.
 */
export function isValidWorkspaceState(value: unknown): value is AndroidFallbackWorkspaceState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AndroidFallbackWorkspaceState>;

  return (
    typeof candidate.key === 'string' &&
    (candidate.key === LEGACY_GLOBAL_WORKSPACE_KEY || candidate.key.startsWith('workspace:')) &&
    typeof candidate.files === 'object' &&
    candidate.files !== null &&
    Array.isArray(candidate.deletedPaths)
  );
}

export function isValidSessionState(value: unknown): value is AndroidFallbackSessionState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AndroidFallbackSessionState>;

  return candidate.key === 'session' && typeof candidate.activeWorkspace === 'string';
}

/**
 * Cached across calls, deliberately -- opening a fresh IDBDatabase connection per
 * operation and never closing it (the original shape of this function) leaks a
 * connection every single call. Standard IndexedDB usage opens once per app session and
 * keeps the connection alive; this does that instead of open-per-call-and-forget.
 */
let dbConnectionPromise: Promise<IDBDatabase | undefined> | undefined;

function openDb(): Promise<IDBDatabase | undefined> {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(undefined);
  }

  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }

  dbConnectionPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(SYNC_BASE_STORE)) {
        db.createObjectStore(SYNC_BASE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      /*
       * A connection can still be force-closed externally (e.g. deleteDatabase() from
       * another tab/context) -- drop the cache so the next call reopens instead of
       * reusing a dead handle forever.
       */
      db.onclose = () => {
        dbConnectionPromise = undefined;
      };

      resolve(db);
    };

    request.onerror = () => {
      dbConnectionPromise = undefined;
      resolve(undefined);
    };
  });

  return dbConnectionPromise;
}

/**
 * Test-only: drops the cached connection so a fresh indexedDB.deleteDatabase() in a
 *  test's setup isn't blocked waiting for this module's own long-lived connection to close.
 */
export async function __closeDbConnectionForTests(): Promise<void> {
  const db = await dbConnectionPromise;
  dbConnectionPromise = undefined;
  db?.close();
}

function getRawWorkspaceRecord(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve) => {
    const transaction = db.transaction(WORKSPACE_STORE, 'readonly');
    const store = transaction.objectStore(WORKSPACE_STORE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}

function putRawWorkspaceRecord(db: IDBDatabase, state: AndroidFallbackWorkspaceState): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WORKSPACE_STORE, 'readwrite');
    const store = transaction.objectStore(WORKSPACE_STORE);
    const request = store.put(state);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to save workspace state'));
  });
}

/**
 * Migrates pre-per-project data exactly once, deterministically, based on a persisted
 * marker rather than timing -- see AndroidFallbackSessionState.migratedGlobalWorkspaceToProjectId's
 * doc comment for why. Never deletes the legacy record (append-only: if anything here
 * goes wrong, the original data is untouched and recoverable, not silently lost).
 */
async function migrateLegacyWorkspaceIfNeeded(
  db: IDBDatabase,
  projectId: string,
): Promise<AndroidFallbackWorkspaceState | undefined> {
  const session = await getSessionState();

  if (session.migratedGlobalWorkspaceToProjectId !== undefined) {
    /*
     * Migration already resolved (either claimed by a project, or confirmed empty) --
     * never re-claim legacy data for a second project.
     */
    return undefined;
  }

  const legacyValue = await getRawWorkspaceRecord(db, LEGACY_GLOBAL_WORKSPACE_KEY);
  const hasLegacyData =
    isValidWorkspaceState(legacyValue) &&
    (Object.keys(legacyValue.files).length > 0 || legacyValue.deletedPaths.length > 0);

  if (!hasLegacyData) {
    await updateAndroidFallbackSession({ migratedGlobalWorkspaceToProjectId: NO_LEGACY_DATA_SENTINEL });
    return undefined;
  }

  const legacy = legacyValue as AndroidFallbackWorkspaceState;
  const migrated: AndroidFallbackWorkspaceState = {
    key: workspaceKeyFor(projectId),
    files: legacy.files,
    deletedPaths: legacy.deletedPaths,
    updatedAt: new Date().toISOString(),
  };

  await putRawWorkspaceRecord(db, migrated);
  await updateAndroidFallbackSession({ migratedGlobalWorkspaceToProjectId: projectId, activeWorkspace: projectId });

  console.info(
    `[androidFallbackStorage] Migrated pre-upgrade global workspace (${Object.keys(legacy.files).length} files) to project "${projectId}"`,
  );

  return migrated;
}

async function getWorkspaceState(projectId: string): Promise<AndroidFallbackWorkspaceState> {
  const db = await openDb();
  const key = workspaceKeyFor(projectId);

  if (!db) {
    return createDefaultWorkspaceState(key);
  }

  const value = await getRawWorkspaceRecord(db, key);

  if (value !== undefined) {
    if (!isValidWorkspaceState(value)) {
      console.error('[androidFallbackStorage] Discarding corrupted workspace record', value);
      return createDefaultWorkspaceState(key);
    }

    return value;
  }

  const migrated = await migrateLegacyWorkspaceIfNeeded(db, projectId);

  return migrated ?? createDefaultWorkspaceState(key);
}

async function getSessionState(): Promise<AndroidFallbackSessionState> {
  const db = await openDb();

  if (!db) {
    return createDefaultSessionState();
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(SESSION_STORE, 'readonly');
    const store = transaction.objectStore(SESSION_STORE);
    const request = store.get('session');

    request.onsuccess = () => {
      const value: unknown = request.result;

      if (value === undefined) {
        resolve(createDefaultSessionState());
        return;
      }

      if (!isValidSessionState(value)) {
        console.error('[androidFallbackStorage] Discarding corrupted session record', value);
        resolve(createDefaultSessionState());

        return;
      }

      resolve(value);
    };

    request.onerror = () => resolve(createDefaultSessionState());
  });
}

export async function loadAndroidFallbackState(
  projectId: string = getCurrentProjectId(),
): Promise<AndroidFallbackState> {
  const [workspace, session] = await Promise.all([getWorkspaceState(projectId), getSessionState()]);

  return { workspace, session };
}

export async function saveAndroidFallbackWorkspace(
  files: Record<string, PersistedDirent>,
  deletedPaths: string[],
  projectId: string = getCurrentProjectId(),
) {
  const db = await openDb();

  if (!db) {
    return;
  }

  const state: AndroidFallbackWorkspaceState = {
    key: workspaceKeyFor(projectId),
    files,
    deletedPaths,
    updatedAt: new Date().toISOString(),
  };

  await putRawWorkspaceRecord(db, state);
}

interface SyncBaseRecord {
  key: string;
  snapshot: Record<string, string>;
  updatedAt: string;
}

function syncBaseKeyFor(projectId: string): string {
  return `syncBase:${projectId}`;
}

function isValidSyncBaseRecord(value: unknown): value is SyncBaseRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SyncBaseRecord>;

  return typeof candidate.key === 'string' && typeof candidate.snapshot === 'object' && candidate.snapshot !== null;
}

/**
 * The three-way-sync "last known common state" snapshot -- absent means this project has never
 * completed a sync, which the caller (RemoteWorkspaceSync.ts) treats as an empty base, correctly
 * classifying every existing file as newly-added rather than crashing or guessing.
 */
export async function getSyncBaseSnapshot(projectId: string = getCurrentProjectId()): Promise<Record<string, string>> {
  const db = await openDb();

  if (!db) {
    return {};
  }

  const value = await new Promise<unknown>((resolve) => {
    const transaction = db.transaction(SYNC_BASE_STORE, 'readonly');
    const store = transaction.objectStore(SYNC_BASE_STORE);
    const request = store.get(syncBaseKeyFor(projectId));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });

  if (value === undefined) {
    return {};
  }

  if (!isValidSyncBaseRecord(value)) {
    console.error('[androidFallbackStorage] Discarding corrupted sync base record', value);
    return {};
  }

  return value.snapshot;
}

export async function saveSyncBaseSnapshot(
  snapshot: Record<string, string>,
  projectId: string = getCurrentProjectId(),
): Promise<void> {
  const db = await openDb();

  if (!db) {
    return;
  }

  const record: SyncBaseRecord = {
    key: syncBaseKeyFor(projectId),
    snapshot,
    updatedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SYNC_BASE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_BASE_STORE);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to save sync base snapshot'));
  });
}

export async function updateAndroidFallbackSession(partial: Partial<AndroidFallbackSessionState>) {
  const db = await openDb();

  if (!db) {
    return;
  }

  const current = await getSessionState();
  const state: AndroidFallbackSessionState = {
    ...current,
    ...partial,
    key: 'session',
    updatedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SESSION_STORE, 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    const request = store.put(state);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to save session state'));
  });
}

/**
 * Resets ONE project's workspace -- deliberately scoped, not a whole-database wipe.
 * Deleting only this project's record (not calling store.clear()) means every other
 * project's files are untouched, matching what a user resetting "my current workspace"
 * actually expects; a global wipe would be a surprising, destructive side effect on
 * unrelated projects.
 */
export async function resetAndroidFallbackStorage(projectId: string = getCurrentProjectId()) {
  const db = await openDb();

  if (!db) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(WORKSPACE_STORE, 'readwrite');
    const store = transaction.objectStore(WORKSPACE_STORE);
    const request = store.delete(workspaceKeyFor(projectId));

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to reset workspace state'));
  });

  /*
   * A stale sync base surviving a workspace reset would misclassify every remote file on the
   * next sync (base says "existed", fresh-empty local says "gone" -> looks like a local
   * deletion instead of "never synced, safe to pull"). Reset must clear both together.
   */
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(SYNC_BASE_STORE, 'readwrite');
    const store = transaction.objectStore(SYNC_BASE_STORE);
    const request = store.delete(syncBaseKeyFor(projectId));

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to reset sync base snapshot'));
  });
}

export async function getAndroidFallbackPersistenceStatus() {
  const state = await loadAndroidFallbackState();

  return {
    available: isIndexedDBAvailable(),
    hasSavedFiles: Object.keys(state.workspace.files).length > 0,
    lastOpenedFile: state.session.lastOpenedFile,
  };
}
