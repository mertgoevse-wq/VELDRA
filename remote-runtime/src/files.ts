import path from 'path';
import fs from 'fs';
import { getWorkspacePath } from './workspaces.js';
import type { FileItem } from './types.js';

const TEXT_CONTROL_CHARACTER_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/**
 * Safely resolves a file path within a workspace, preventing traversal.
 */
function isWithinRoot(candidate: string, root: string): boolean {
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  return candidate === root || candidate.startsWith(rootWithSeparator);
}

/**
 * Resolves a file path while checking both lexical and filesystem-real paths.
 * The second check prevents a symlink inside the workspace from escaping it.
 * Nonexistent targets are supported by resolving the nearest existing parent.
 */
export function resolveSafeFilePath(workspaceId: string, relativeFilePath: string): string {
  const wsPath = getWorkspacePath(workspaceId);
  const normalizedRelativePath = relativeFilePath.replace(/\\/g, '/');

  if (!normalizedRelativePath || normalizedRelativePath.includes('\0') || path.isAbsolute(normalizedRelativePath)) {
    throw new Error('Invalid file path.');
  }

  const resolved = path.resolve(wsPath, normalizedRelativePath);
  const workspaceRoot = path.resolve(wsPath);

  // Reject lexical traversal before touching the filesystem.
  if (!isWithinRoot(resolved, workspaceRoot)) {
    throw new Error('Access denied: Path traversal detected.');
  }

  /*
   * realpathSync only accepts existing paths. Resolve the nearest existing
   * parent, then append the validated nonexistent suffix.
   */
  let existingPath = resolved;
  const missingParts: string[] = [];

  while (true) {
    try {
      // lstatSync intentionally detects dangling symlinks, unlike existsSync.
      fs.lstatSync(existingPath);
      break;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }

      const parentPath = path.dirname(existingPath);

      if (parentPath === existingPath) {
        throw new Error('Invalid file path.');
      }

      missingParts.unshift(path.basename(existingPath));
      existingPath = parentPath;
    }
  }

  const realWorkspaceRoot = fs.realpathSync(workspaceRoot);
  let realExistingPath: string;

  try {
    realExistingPath = fs.realpathSync(existingPath);
  } catch {
    /*
     * A dangling symlink (or an otherwise unresolved filesystem path) must not
     * be treated as a normal missing target beneath the workspace.
     */
    throw new Error('Access denied: Path traversal detected.');
  }

  const realResolvedPath = path.resolve(realExistingPath, ...missingParts);

  if (!isWithinRoot(realResolvedPath, realWorkspaceRoot)) {
    throw new Error('Access denied: Path traversal detected.');
  }

  return realResolvedPath;
}

export function isTextSafeContent(content: unknown): content is string {
  return typeof content === 'string' && !TEXT_CONTROL_CHARACTER_REGEX.test(content);
}

/**
 * Lists all files inside a workspace recursively.
 */
export function listFilesRecursively(workspaceId: string, dirPath: string = ''): FileItem[] {
  const targetDir = dirPath ? resolveSafeFilePath(workspaceId, dirPath) : getWorkspacePath(workspaceId);

  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const items = fs.readdirSync(targetDir, { withFileTypes: true });
  const result: FileItem[] = [];

  for (const item of items) {
    const relativeItemPath = path.join(dirPath, item.name).replace(/\\/g, '/');

    /*
     * Do not follow symlinks during recursive discovery. A symlink can point
     * outside the workspace even when its lexical path is inside it.
     */
    if (item.isSymbolicLink()) {
      continue;
    }

    if (item.isDirectory()) {
      const stats = fs.statSync(path.join(targetDir, item.name));
      result.push({
        path: relativeItemPath,
        type: 'directory',
        modifiedAt: stats.mtime.toISOString(),
      });

      // Recurse
      result.push(...listFilesRecursively(workspaceId, relativeItemPath));
    } else {
      const stats = fs.statSync(path.join(targetDir, item.name));
      result.push({
        path: relativeItemPath,
        type: 'file',
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      });
    }
  }

  return result;
}

/**
 * Deletes a set of files (or directories) from the workspace. Idempotent -- an
 * already-missing path is not an error, since the client's local delete state and the
 * remote workspace can legitimately be out of sync (e.g. a prior sync already removed it).
 * Returns the paths actually removed, for an honest response rather than assuming all
 * requested paths existed.
 */
export function deleteWorkspaceFiles(workspaceId: string, relativePaths: string[]): string[] {
  const deleted: string[] = [];

  for (const relativePath of relativePaths) {
    const resolvedPath = resolveSafeFilePath(workspaceId, relativePath);

    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    fs.rmSync(resolvedPath, { recursive: true, force: true });
    deleted.push(relativePath.replace(/\\/g, '/'));
  }

  return deleted;
}

/**
 * Writes a set of files to the workspace.
 */
export function writeWorkspaceFiles(workspaceId: string, files: Record<string, string>): void {
  for (const [relativePath, content] of Object.entries(files)) {
    if (!isTextSafeContent(content)) {
      throw new Error(`Invalid payload: "${relativePath}" must contain text-safe string content.`);
    }

    const resolvedPath = resolveSafeFilePath(workspaceId, relativePath);
    const parentDir = path.dirname(resolvedPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, content, 'utf8');
  }
}

export function readWorkspaceTextFile(
  workspaceId: string,
  filePath: string,
): { path: string; content: string; size: number; modifiedAt: string } {
  const resolvedPath = resolveSafeFilePath(workspaceId, filePath);
  const stats = fs.statSync(resolvedPath);

  if (!stats.isFile()) {
    throw new Error('Requested path is not a file.');
  }

  const content = fs.readFileSync(resolvedPath, 'utf8');

  if (!isTextSafeContent(content)) {
    throw new Error('Requested file is not text-safe.');
  }

  return {
    path: filePath.replace(/\\/g, '/'),
    content,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
}

/**
 * Recursively reads all files in a workspace and includes text-safe contents.
 */
export function getWorkspaceFilesWithContent(workspaceId: string): FileItem[] {
  const files = listFilesRecursively(workspaceId);
  const result: FileItem[] = [];

  for (const file of files) {
    if (file.type !== 'file') {
      result.push(file);
      continue;
    }

    try {
      const readFile = readWorkspaceTextFile(workspaceId, file.path);
      result.push({
        ...file,
        content: readFile.content,
        isBinary: false,
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('not text-safe')) {
        result.push({
          ...file,
          isBinary: true,
        });
      } else {
        console.error(`[RemoteRuntime] Error reading file ${file.path}:`, err);
        result.push(file);
      }
    }
  }

  return result;
}

export function getWorkspaceFileMetadata(workspaceId: string, filePaths: string[]): FileItem[] {
  const result: FileItem[] = [];

  for (const filePath of filePaths) {
    const normalizedPath = filePath.replace(/\\/g, '/');

    try {
      const resolvedPath = resolveSafeFilePath(workspaceId, normalizedPath);
      const stats = fs.statSync(resolvedPath);

      if (!stats.isFile()) {
        continue;
      }

      result.push({
        path: normalizedPath,
        type: 'file',
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      });
    } catch (err) {
      console.error(`[RemoteRuntime] Error collecting metadata for ${normalizedPath}:`, err);
    }
  }

  return result;
}
