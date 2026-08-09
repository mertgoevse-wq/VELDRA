import { validateManifest } from '@studio/catalog/validation';
import type { CatalogManifest, ContentAvailability, Provenance } from '@studio/catalog/types';

export interface ContentLoadRequest {
  id: string;
  expectedRevision?: string;
  allowPatternDerived?: boolean;
}

export interface LoadedContent {
  id: string;
  kind: CatalogManifest['kind'];
  content: string;
  provenance: Provenance;
  licenseSpdx: string;
  sourcePath: string;
}

export interface ContentSource {
  id: string;
  repository: string;
  revision: string;
  trusted: boolean;
  read(path: string): Promise<string>;
}

export interface ContentLoadFailure {
  id: string;
  code: 'NOT_FOUND' | 'INVALID_MANIFEST' | 'REVISION_MISMATCH' | 'LICENSE_BLOCKED' | 'CONTENT_UNAVAILABLE';
  message: string;
}

export type ContentLoadResult = { ok: true; value: LoadedContent } | { ok: false; error: ContentLoadFailure };

export interface ContentAdapter {
  load(request: ContentLoadRequest): Promise<ContentLoadResult>;
}

export function createContentAdapter(manifests: CatalogManifest[], sources: ContentSource[]): ContentAdapter {
  const manifestById = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return {
    async load(request) {
      const manifest = manifestById.get(request.id);

      if (!manifest) {
        return {
          ok: false,
          error: { id: request.id, code: 'NOT_FOUND', message: 'Capability manifest was not found' },
        };
      }

      const validationErrors = validateManifest(manifest);

      if (validationErrors.length > 0) {
        return { ok: false, error: { id: request.id, code: 'INVALID_MANIFEST', message: validationErrors.join('; ') } };
      }

      if (request.expectedRevision && request.expectedRevision !== manifest.source.revision) {
        return {
          ok: false,
          error: {
            id: request.id,
            code: 'REVISION_MISMATCH',
            message: `Expected revision ${request.expectedRevision}, found ${manifest.source.revision}`,
          },
        };
      }

      if (!manifest.enabled || !['permissive', 'internal'].includes(manifest.license.status)) {
        return {
          ok: false,
          error: {
            id: request.id,
            code: 'LICENSE_BLOCKED',
            message: `Content loading is blocked for license status ${manifest.license.status}`,
          },
        };
      }

      if (manifest.source.importedAs === 'pattern-derived' && !request.allowPatternDerived) {
        return {
          ok: false,
          error: {
            id: request.id,
            code: 'LICENSE_BLOCKED',
            message: 'Pattern-derived content requires explicit loading permission',
          },
        };
      }

      const source = sourceById.get(manifest.source.sourceId);

      if (!source) {
        return {
          ok: false,
          error: {
            id: request.id,
            code: 'CONTENT_UNAVAILABLE',
            message: 'No content source is registered for this capability',
          },
        };
      }

      if (!source.trusted || source.repository !== manifest.source.repository) {
        return {
          ok: false,
          error: {
            id: request.id,
            code: 'LICENSE_BLOCKED',
            message: 'Content source trust or repository does not match manifest provenance',
          },
        };
      }

      if (source.revision !== manifest.source.revision) {
        return {
          ok: false,
          error: {
            id: request.id,
            code: 'REVISION_MISMATCH',
            message: `Source revision ${source.revision} does not match manifest revision ${manifest.source.revision}`,
          },
        };
      }

      try {
        const content = await source.read(manifest.source.path);
        return {
          ok: true,
          value: {
            id: manifest.id,
            kind: manifest.kind,
            content,
            provenance: manifest.source,
            licenseSpdx: manifest.license.spdx,
            sourcePath: manifest.source.path,
          },
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            id: manifest.id,
            code: 'CONTENT_UNAVAILABLE',
            message: error instanceof Error ? error.message : 'Content source could not be read',
          },
        };
      }
    },
  };
}

export function contentAvailability(manifest: CatalogManifest): ContentAvailability {
  if (!manifest.enabled || !['permissive', 'internal'].includes(manifest.license.status)) {
    return 'blocked';
  }

  return 'metadata-only';
}
