export interface AndroidFallbackSessionState {
  key: 'session';
  activeWorkspace: string;
  lastOpenedFile?: string;
  currentView?: string;
  updatedAt: string;
}

export interface AndroidFallbackWorkspaceState {
  key: 'workspace';
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
const DB_VERSION = 1;
const WORKSPACE_STORE = 'workspace';
const SESSION_STORE = 'session';

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function createDefaultWorkspaceState(): AndroidFallbackWorkspaceState {
  return {
    key: 'workspace',
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
    candidate.key === 'workspace' &&
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

function openDb(): Promise<IDBDatabase | undefined> {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}

async function getWorkspaceState(): Promise<AndroidFallbackWorkspaceState> {
  const db = await openDb();

  if (!db) {
    return createDefaultWorkspaceState();
  }

  return new Promise((resolve) => {
    const transaction = db.transaction(WORKSPACE_STORE, 'readonly');
    const store = transaction.objectStore(WORKSPACE_STORE);
    const request = store.get('workspace');

    request.onsuccess = () => {
      const value: unknown = request.result;

      if (value === undefined) {
        resolve(createDefaultWorkspaceState());
        return;
      }

      if (!isValidWorkspaceState(value)) {
        console.error('[androidFallbackStorage] Discarding corrupted workspace record', value);
        resolve(createDefaultWorkspaceState());

        return;
      }

      resolve(value);
    };

    request.onerror = () => resolve(createDefaultWorkspaceState());
  });
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

export async function loadAndroidFallbackState(): Promise<AndroidFallbackState> {
  const [workspace, session] = await Promise.all([getWorkspaceState(), getSessionState()]);

  return { workspace, session };
}

export async function saveAndroidFallbackWorkspace(files: Record<string, PersistedDirent>, deletedPaths: string[]) {
  const db = await openDb();

  if (!db) {
    return;
  }

  const state: AndroidFallbackWorkspaceState = {
    key: 'workspace',
    files,
    deletedPaths,
    updatedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(WORKSPACE_STORE, 'readwrite');
    const store = transaction.objectStore(WORKSPACE_STORE);
    const request = store.put(state);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to save workspace state'));
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

export async function resetAndroidFallbackStorage() {
  const db = await openDb();

  if (!db) {
    return;
  }

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(WORKSPACE_STORE, 'readwrite');
      const store = transaction.objectStore(WORKSPACE_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to clear workspace store'));
    }),
    new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE, 'readwrite');
      const store = transaction.objectStore(SESSION_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to clear session store'));
    }),
  ]);
}

export async function getAndroidFallbackPersistenceStatus() {
  const state = await loadAndroidFallbackState();

  return {
    available: isIndexedDBAvailable(),
    hasSavedFiles: Object.keys(state.workspace.files).length > 0,
    lastOpenedFile: state.session.lastOpenedFile,
  };
}
