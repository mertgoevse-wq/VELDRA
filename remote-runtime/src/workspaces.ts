import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// workspaces directory located under remote-runtime/workspaces
export const WORKSPACES_DIR = path.resolve(__dirname, '../workspaces');

/**
 * Ensures workspaces directory exists.
 */
export function ensureWorkspacesDir() {
  if (!fs.existsSync(WORKSPACES_DIR)) {
    fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
  }
}

/**
 * Validates workspace ID format to prevent any directory injection.
 */
export function isValidWorkspaceId(workspaceId: string): boolean {
  return /^[a-zA-Z0-9_\-]+$/.test(workspaceId);
}

/**
 * Safely resolves and normalizes a workspace path.
 * Throws an error if path traversal is attempted.
 */
export function getWorkspacePath(workspaceId: string): string {
  if (!isValidWorkspaceId(workspaceId)) {
    throw new Error('Invalid workspace ID format');
  }

  const workspacePath = path.resolve(WORKSPACES_DIR, workspaceId);
  const workspaceRoot = path.resolve(WORKSPACES_DIR);
  const workspaceRootWithSeparator = `${workspaceRoot}${path.sep}`;

  // Check lexical traversal before touching the filesystem.
  if (workspacePath !== workspaceRoot && !workspacePath.startsWith(workspaceRootWithSeparator)) {
    throw new Error('Access denied: Path traversal detected.');
  }

  let realWorkspaceRoot: string;

  try {
    const rootStats = fs.lstatSync(workspaceRoot);

    if (rootStats.isSymbolicLink()) {
      throw new Error('Access denied: Path traversal detected.');
    }

    realWorkspaceRoot = fs.realpathSync(workspaceRoot);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // A normal workspace creation path may not exist yet.
      return workspacePath;
    }

    if (error instanceof Error && error.message.includes('Access denied')) {
      throw error;
    }

    throw new Error('Access denied: Path traversal detected.');
  }

  // The configured workspaces root itself must not be redirected elsewhere.
  if (realWorkspaceRoot !== workspaceRoot) {
    throw new Error('Access denied: Path traversal detected.');
  }

  try {
    fs.lstatSync(workspacePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return workspacePath;
    }

    throw error;
  }

  try {
    const realWorkspacePath = fs.realpathSync(workspacePath);
    const realWorkspaceRootWithSeparator = `${realWorkspaceRoot}${path.sep}`;

    if (realWorkspacePath !== realWorkspaceRoot && !realWorkspacePath.startsWith(realWorkspaceRootWithSeparator)) {
      throw new Error('Access denied: Path traversal detected.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      throw error;
    }

    /*
     * An existing entry that cannot be realpath-resolved is most commonly a
     * dangling symlink. Treat it as untrusted rather than as a new workspace.
     */
    throw new Error('Access denied: Path traversal detected.');
  }

  return workspacePath;
}

/**
 * Creates a workspace directory.
 */
export function createWorkspace(workspaceId: string): string {
  ensureWorkspacesDir();

  const wsPath = getWorkspacePath(workspaceId);

  if (!fs.existsSync(wsPath)) {
    fs.mkdirSync(wsPath, { recursive: true });
  }

  return wsPath;
}
