// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  isValidSessionState,
  isValidWorkspaceState,
  loadAndroidFallbackState,
  saveAndroidFallbackWorkspace,
  resetAndroidFallbackStorage,
  __closeDbConnectionForTests,
} from './androidFallbackStorage';

describe('isValidWorkspaceState', () => {
  it('accepts a well-formed workspace record', () => {
    expect(
      isValidWorkspaceState({
        key: 'workspace',
        files: { '/home/project/a.txt': { type: 'file', content: 'hi' } },
        deletedPaths: [],
        updatedAt: '2026-08-10T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('accepts an empty (default-shaped) workspace record', () => {
    expect(isValidWorkspaceState({ key: 'workspace', files: {}, deletedPaths: [] })).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'workspace'],
    ['wrong key', { key: 'session', files: {}, deletedPaths: [] }],
    ['missing files', { key: 'workspace', deletedPaths: [] }],
    ['files not an object', { key: 'workspace', files: 'oops', deletedPaths: [] }],
    ['files is null', { key: 'workspace', files: null, deletedPaths: [] }],
    ['deletedPaths not an array', { key: 'workspace', files: {}, deletedPaths: 'oops' }],
    ['missing deletedPaths', { key: 'workspace', files: {} }],
  ])('rejects a corrupted record: %s', (_label, value) => {
    expect(isValidWorkspaceState(value)).toBe(false);
  });
});

describe('isValidSessionState', () => {
  it('accepts a well-formed session record', () => {
    expect(
      isValidSessionState({
        key: 'session',
        activeWorkspace: 'default',
        updatedAt: '2026-08-10T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['wrong key', { key: 'workspace', activeWorkspace: 'default' }],
    ['missing activeWorkspace', { key: 'session' }],
    ['activeWorkspace not a string', { key: 'session', activeWorkspace: 123 }],
  ])('rejects a corrupted record: %s', (_label, value) => {
    expect(isValidSessionState(value)).toBe(false);
  });
});

/**
 * Block 1/2 of the project-identity mandate: per-project workspace isolation, with a
 * migration path for pre-existing single-global-workspace installs. Real fake-indexeddb-
 * backed round-trips throughout -- no mocking of this module's own logic.
 */
describe('per-project workspace isolation + legacy migration', () => {
  beforeEach(async () => {
    await __closeDbConnectionForTests();

    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('bolt-android-fallback');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });

  it('a brand-new project with no legacy data starts genuinely empty', async () => {
    const state = await loadAndroidFallbackState('project-a');
    expect(state.workspace.files).toEqual({});
    expect(state.workspace.key).toBe('workspace:project-a');
  });

  it('two different projects are fully isolated from each other', async () => {
    await saveAndroidFallbackWorkspace(
      { 'a.txt': { type: 'file', content: 'from A', isBinary: false } },
      [],
      'project-a',
    );
    await saveAndroidFallbackWorkspace(
      { 'b.txt': { type: 'file', content: 'from B', isBinary: false } },
      [],
      'project-b',
    );

    const stateA = await loadAndroidFallbackState('project-a');
    const stateB = await loadAndroidFallbackState('project-b');

    expect(Object.keys(stateA.workspace.files)).toEqual(['a.txt']);
    expect(Object.keys(stateB.workspace.files)).toEqual(['b.txt']);
  });

  it('migrates real pre-upgrade global workspace data to the first project that loads after upgrade', async () => {
    // Simulate a pre-upgrade install: write directly under the legacy fixed key.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('bolt-android-fallback', 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('workspace')) {
          db.createObjectStore('workspace', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('workspace', 'readwrite');
        tx.objectStore('workspace').put({
          key: 'workspace',
          files: { 'legacy.txt': { type: 'file', content: 'pre-upgrade content', isBinary: false } },
          deletedPaths: [],
          updatedAt: new Date(0).toISOString(),
        });

        /*
         * Close this manually-opened connection once the write lands -- otherwise it
         * leaks and blocks a later test's beforeEach deleteDatabase() call forever.
         */
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const migratedState = await loadAndroidFallbackState('first-project-after-upgrade');
    expect(migratedState.workspace.files['legacy.txt']?.content).toBe('pre-upgrade content');

    // A second, different project must NOT also inherit the legacy data -- it was already claimed.
    const otherState = await loadAndroidFallbackState('a-different-project');
    expect(otherState.workspace.files).toEqual({});
  });

  it('resetAndroidFallbackStorage only clears the target project, leaving other projects untouched', async () => {
    await saveAndroidFallbackWorkspace({ 'a.txt': { type: 'file', content: 'A', isBinary: false } }, [], 'project-a');
    await saveAndroidFallbackWorkspace({ 'b.txt': { type: 'file', content: 'B', isBinary: false } }, [], 'project-b');

    await resetAndroidFallbackStorage('project-a');

    const stateA = await loadAndroidFallbackState('project-a');
    const stateB = await loadAndroidFallbackState('project-b');

    expect(stateA.workspace.files).toEqual({});
    expect(Object.keys(stateB.workspace.files)).toEqual(['b.txt']);
  });
});
