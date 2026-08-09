import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { ContentSource } from '@studio/catalog/content-adapter';

export function createLocalContentSource(
  id: string,
  repository: string,
  revision: string,
  root: string,
): ContentSource {
  const resolvedRoot = resolve(root);

  return {
    id,
    repository,
    revision,
    trusted: true,
    async read(path: string) {
      if (isAbsolute(path)) {
        throw new Error('Content path must be relative to the source root');
      }

      const resolvedPath = resolve(resolvedRoot, path);
      const lexicalRelative = relative(resolvedRoot, resolvedPath);

      if (lexicalRelative.startsWith('..') || isAbsolute(lexicalRelative)) {
        throw new Error('Content path escapes the source root');
      }

      const [realRoot, realPath] = await Promise.all([realpath(resolvedRoot), realpath(resolvedPath)]);
      const realRelative = relative(realRoot, realPath);

      if (realRelative.startsWith('..') || isAbsolute(realRelative)) {
        throw new Error('Content path escapes the source root');
      }

      return readFile(realPath, 'utf8');
    },
  };
}
