import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createWorkspace } from './workspaces.js';
import { deleteWorkspaceFiles, listFilesRecursively, writeWorkspaceFiles } from './files.js';

/**
 * Block 4 of the multi-file consistency mandate: RemoteWorkspaceSync.pushLocalWorkspaceToRemote
 * never told the Remote Runtime server about locally-deleted files -- the server had no delete
 * capability at all (PUT /files only ever wrote/overwrote). A deleted file stayed on the remote
 * workspace forever, stale, potentially still built/served by the remote dev server. This tests
 * the new deleteWorkspaceFiles() the server-side half of the fix is built on, against the real
 * filesystem (same convention as security.spec.ts), not a mock.
 */
describe('deleteWorkspaceFiles', () => {
  it('removes a real file from the workspace and reports it as deleted', () => {
    const workspaceId = `delete_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const workspacePath = createWorkspace(workspaceId);

    try {
      writeWorkspaceFiles(workspaceId, { 'index.html': '<html></html>', 'style.css': 'body {}' });

      const deleted = deleteWorkspaceFiles(workspaceId, ['index.html']);

      expect(deleted).toEqual(['index.html']);
      expect(listFilesRecursively(workspaceId).map((f) => f.path)).toEqual(['style.css']);
    } finally {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('is idempotent: an already-missing path is silently skipped, not an error', () => {
    const workspaceId = `delete_missing_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const workspacePath = createWorkspace(workspaceId);

    try {
      const deleted = deleteWorkspaceFiles(workspaceId, ['never-existed.txt']);
      expect(deleted).toEqual([]);
    } finally {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });

  it('rejects a path-traversal delete attempt the same way reads/writes already do', () => {
    const workspaceId = `delete_traversal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const workspacePath = createWorkspace(workspaceId);

    try {
      expect(() => deleteWorkspaceFiles(workspaceId, ['../outside.txt'])).toThrow(/Path traversal/);
    } finally {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });
});
