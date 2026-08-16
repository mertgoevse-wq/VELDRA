// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageProvider } from './local-provider';
import { saveAndroidFallbackWorkspace } from '~/lib/persistence/androidFallbackStorage';

const PROJECT = { id: 'any-project' };
const OTHER_PROJECT = { id: 'a-different-project' };

describe('LocalStorageProvider (real fake-indexeddb-backed round-trip, no mocks of VELDRA logic)', () => {
  beforeEach(async () => {
    await saveAndroidFallbackWorkspace({}, [], PROJECT.id);
    await saveAndroidFallbackWorkspace({}, [], OTHER_PROJECT.id);
  });

  it('lists real files that were actually persisted', async () => {
    await saveAndroidFallbackWorkspace(
      { 'index.html': { type: 'file', content: '<html></html>', isBinary: false } },
      [],
      PROJECT.id,
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

  it('genuinely isolates two different projects at the adapter level, not just in the underlying store', async () => {
    const provider = new LocalStorageProvider();
    await provider.writeFiles(PROJECT, { 'a.txt': 'from A' });
    await provider.writeFiles(OTHER_PROJECT, { 'b.txt': 'from B' });

    expect((await provider.listFiles(PROJECT)).map((f) => f.path)).toEqual(['a.txt']);
    expect((await provider.listFiles(OTHER_PROJECT)).map((f) => f.path)).toEqual(['b.txt']);
  });

  it('exists reflects real presence/absence', async () => {
    const provider = new LocalStorageProvider();
    expect(await provider.exists(PROJECT, 'ghost.txt')).toBe(false);

    await provider.writeFiles(PROJECT, { 'real.txt': 'here' });
    expect(await provider.exists(PROJECT, 'real.txt')).toBe(true);
  });

  it('getMetadata returns real metadata without content, and undefined for a missing path', async () => {
    const provider = new LocalStorageProvider();
    await provider.writeFiles(PROJECT, { 'meta.txt': 'some content' });

    const metadata = await provider.getMetadata(PROJECT, 'meta.txt');
    expect(metadata).toEqual({
      path: 'meta.txt',
      type: 'file',
      size: undefined,
      modifiedAt: undefined,
      isBinary: false,
    });

    expect(await provider.getMetadata(PROJECT, 'missing.txt')).toBeUndefined();
  });

  it('rename atomically moves a file to a new path -- the old path is gone, the new path has the same content', async () => {
    const provider = new LocalStorageProvider();
    await provider.writeFiles(PROJECT, { 'old-name.txt': 'unchanged content' });

    await provider.rename(PROJECT, 'old-name.txt', 'new-name.txt');

    expect(await provider.exists(PROJECT, 'old-name.txt')).toBe(false);

    const renamed = await provider.readFile(PROJECT, 'new-name.txt');
    expect(renamed?.content).toBe('unchanged content');
  });

  it('rename rejects a nonexistent source path instead of silently creating an empty destination', async () => {
    const provider = new LocalStorageProvider();
    await expect(provider.rename(PROJECT, 'never-existed.txt', 'new.txt')).rejects.toThrow();
    expect(await provider.exists(PROJECT, 'new.txt')).toBe(false);
  });
});
