import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getConfiguredToken, MIN_RUNTIME_TOKEN_LENGTH, validateToken } from './auth.js';
import { listFilesRecursively, readWorkspaceTextFile, resolveSafeFilePath, writeWorkspaceFiles } from './files.js';
import { createWorkspace, getWorkspacePath, WORKSPACES_DIR } from './workspaces.js';
import { isAllowedCorsOrigin } from './security.js';

describe('Remote Runtime security policy', () => {
  it('does not accept a fallback or weak token when authentication is unconfigured', () => {
    expect(getConfiguredToken({})).toBeUndefined();
    expect(getConfiguredToken({ REMOTE_RUNTIME_TOKEN: 'change-me' })).toBeUndefined();
    expect(getConfiguredToken({ REMOTE_RUNTIME_TOKEN: 'x'.repeat(MIN_RUNTIME_TOKEN_LENGTH) })).toBe(
      'x'.repeat(MIN_RUNTIME_TOKEN_LENGTH),
    );
    expect(validateToken('change-me', undefined)).toBe(false);
  });

  it('compares configured tokens and rejects mismatches', () => {
    const configuredToken = 'r'.repeat(MIN_RUNTIME_TOKEN_LENGTH);

    expect(validateToken(configuredToken, configuredToken)).toBe(true);
    expect(validateToken('wrong-secret', configuredToken)).toBe(false);
    expect(validateToken(configuredToken, ` ${configuredToken} `)).toBe(false);
  });

  it('allows native and explicitly configured origins while denying unknown production origins', () => {
    const production = {
      NODE_ENV: 'production',
      REMOTE_RUNTIME_ALLOWED_ORIGINS: 'https://veldra.example, capacitor://trusted',
    };

    expect(isAllowedCorsOrigin(undefined, production)).toBe(true);
    expect(isAllowedCorsOrigin('capacitor://trusted', production)).toBe(true);
    expect(isAllowedCorsOrigin('https://veldra.example', production)).toBe(true);
    expect(isAllowedCorsOrigin('https://malicious.example', production)).toBe(false);
  });

  it('allows localhost origins only outside production', () => {
    expect(isAllowedCorsOrigin('http://localhost:5173', { NODE_ENV: 'development' })).toBe(true);
    expect(isAllowedCorsOrigin('capacitor://localhost', { NODE_ENV: 'development' })).toBe(true);
    expect(isAllowedCorsOrigin('http://localhost:5173', { NODE_ENV: 'production' })).toBe(false);
  });

  it('rejects symlinked parents that escape the workspace for reads and writes', () => {
    const workspaceId = `symlink_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const workspacePath = createWorkspace(workspaceId);
    const outsidePath = fs.mkdtempSync(path.join(os.tmpdir(), 'veldra-runtime-outside-'));

    try {
      writeWorkspaceFiles(workspaceId, { 'nested/deeper/new.txt': 'inside' });
      expect(readWorkspaceTextFile(workspaceId, 'nested/deeper/new.txt').content).toBe('inside');

      fs.writeFileSync(path.join(outsidePath, 'secret.txt'), 'outside', 'utf8');
      fs.symlinkSync(outsidePath, path.join(workspacePath, 'escape'), 'dir');

      expect(() => resolveSafeFilePath(workspaceId, 'escape/secret.txt')).toThrow(/Path traversal/);
      expect(() => readWorkspaceTextFile(workspaceId, 'escape/secret.txt')).toThrow(/Path traversal/);
      expect(() => writeWorkspaceFiles(workspaceId, { 'escape/new.txt': 'must not escape' })).toThrow(/Path traversal/);
      expect(listFilesRecursively(workspaceId).some((item) => item.path.startsWith('escape'))).toBe(false);
    } finally {
      fs.rmSync(workspacePath, { recursive: true, force: true });
      fs.rmSync(outsidePath, { recursive: true, force: true });
    }
  });

  it('rejects a workspace root symlink that points outside the runtime directory', () => {
    const workspaceId = `root_symlink_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const outsidePath = fs.mkdtempSync(path.join(os.tmpdir(), 'veldra-runtime-root-'));
    const workspacePath = path.join(WORKSPACES_DIR, workspaceId);

    try {
      fs.writeFileSync(path.join(outsidePath, 'secret.txt'), 'outside', 'utf8');
      fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
      fs.symlinkSync(outsidePath, workspacePath, 'dir');

      expect(() => getWorkspacePath(workspaceId)).toThrow(/Path traversal/);
      expect(() => listFilesRecursively(workspaceId)).toThrow(/Path traversal/);
    } finally {
      fs.unlinkSync(workspacePath);
      fs.rmSync(outsidePath, { recursive: true, force: true });
    }
  });

  it('rejects dangling symlinks but permits symlinks that stay inside the workspace', () => {
    const workspaceId = `symlink_targets_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const workspacePath = createWorkspace(workspaceId);

    try {
      writeWorkspaceFiles(workspaceId, { 'safe/source.txt': 'inside' });
      fs.symlinkSync('safe/source.txt', path.join(workspacePath, 'safe-link.txt'));
      expect(readWorkspaceTextFile(workspaceId, 'safe-link.txt').content).toBe('inside');

      fs.symlinkSync('missing.txt', path.join(workspacePath, 'dangling-link.txt'));
      expect(() => resolveSafeFilePath(workspaceId, 'dangling-link.txt')).toThrow(/Path traversal/);
    } finally {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
  });
});
