// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageProvider } from './local-provider';
import { saveAndroidFallbackWorkspace } from '~/lib/persistence/androidFallbackStorage';

const PROJECT = { id: 'any-project' };

describe('LocalStorageProvider (real fake-indexeddb-backed round-trip, no mocks of VELDRA logic)', () => {
  beforeEach(async () => {
    await saveAndroidFallbackWorkspace({}, []);
  });

  it('lists real files that were actually persisted', async () => {
    await saveAndroidFallbackWorkspace(
      { 'index.html': { type: 'file', content: '<html></html>', isBinary: false } },
      [],
    );

    const provider = new LocalStorageProvider();
    const entries = await provider.listFiles(PROJECT);

    expect(entries).toEqual([
      { path: 'index.html', type: 'file', content: '<html></html>', isBinary: false, isLocked: undefined },
    ]);
  });

  it('writeFiles persists real content that a subsequent listFiles genuinely sees', async () => {
    const provider = new LocalStorageProvider();

    const result = await provider.writeFiles(PROJECT, { 'style.css': 'body {}' });
    expect(result).toEqual({ writtenCount: 1 });

    const entries = await provider.listFiles(PROJECT);
    expect(entries).toEqual([
      { path: 'style.css', type: 'file', content: 'body {}', isBinary: false, isLocked: undefined },
    ]);
  });

  it('deleteFiles actually removes the file, not just marks it -- a later read finds nothing', async () => {
    const provider = new LocalStorageProvider();
    await provider.writeFiles(PROJECT, { 'temp.txt': 'scratch' });

    const result = await provider.deleteFiles(PROJECT, ['temp.txt']);
    expect(result).toEqual({ deletedCount: 1 });

    expect(await provider.readFile(PROJECT, 'temp.txt')).toBeUndefined();
    expect(await provider.listFiles(PROJECT)).toEqual([]);
  });

  it('deleteFiles reports 0 for a path that was never there, honestly (not a fabricated success)', async () => {
    const provider = new LocalStorageProvider();
    const result = await provider.deleteFiles(PROJECT, ['never-existed.txt']);
    expect(result).toEqual({ deletedCount: 0 });
  });

  it('reports no conflict-detection capability -- a single local copy has nothing to compare against', () => {
    const provider = new LocalStorageProvider();
    expect(provider.capabilities.conflictDetection).toBe(false);
  });
});
