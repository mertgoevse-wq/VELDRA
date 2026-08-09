import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalContentSource } from './local-content-source';

describe('local content source', () => {
  it('reads content inside the configured root and rejects traversal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'veldra-content-'));
    await writeFile(join(root, 'skill.md'), 'original content');

    const source = createLocalContentSource('source', 'https://example.test/source', 'revision-1', root);

    await expect(source.read('skill.md')).resolves.toBe('original content');
    await expect(source.read('../outside.md')).rejects.toThrow(/escapes/);
    await expect(source.read(join(root, 'skill.md'))).rejects.toThrow(/relative/);
  });
});
