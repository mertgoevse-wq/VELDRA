import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Execute git binary safely with specific arguments.
 * Bypasses the shell to prevent shell code injection.
 */
function execGit(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null; error?: Error }> {
  return new Promise((resolve) => {
    // Set 15 seconds timeout to prevent hanging commands
    execFile('git', args, { cwd, timeout: 15000 }, (error, stdout, stderr) => {
      const code = error ? (error.code as number) ?? null : 0;
      resolve({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        code,
        error: error || undefined,
      });
    });
  });
}

/**
 * Helper to check if git is initialized in the workspace.
 */
export function isGitRepository(workspacePath: string): boolean {
  return fs.existsSync(path.join(workspacePath, '.git'));
}

/**
 * Run git status
 */
export async function gitStatus(workspacePath: string): Promise<{ ok: boolean; status?: string; error?: string }> {
  if (!isGitRepository(workspacePath)) {
    return { ok: false, error: 'Not a git repository. Call git init first.' };
  }

  const { stdout, stderr, code } = await execGit(['status'], workspacePath);
  if (code !== 0) {
    return { ok: false, error: stderr.trim() || 'git status failed.' };
  }

  return { ok: true, status: stdout.trim() };
}

/**
 * Run git init
 */
export async function gitInit(workspacePath: string): Promise<{ ok: boolean; output?: string; error?: string }> {
  const { stdout, stderr, code } = await execGit(['init'], workspacePath);
  if (code !== 0) {
    return { ok: false, error: stderr.trim() || 'git init failed.' };
  }

  return { ok: true, output: stdout.trim() };
}

/**
 * Stage and Commit changes
 */
export async function gitCommit(workspacePath: string, message: string): Promise<{ ok: boolean; output?: string; error?: string }> {
  if (!isGitRepository(workspacePath)) {
    return { ok: false, error: 'Not a git repository. Call git init first.' };
  }

  // 1. git add .
  const addResult = await execGit(['add', '.'], workspacePath);
  if (addResult.code !== 0) {
    return { ok: false, error: addResult.stderr.trim() || 'git add failed.' };
  }

  // 2. git commit -m "<message>"
  // Specify name/email dynamically in case they aren't configured globally on the server.
  const commitResult = await execGit(
    [
      '-c',
      'user.name=VELDRA',
      '-c',
      'user.email=git@veldra.app',
      'commit',
      '-m',
      message,
    ],
    workspacePath
  );

  if (commitResult.code !== 0) {
    const combinedOutput = (commitResult.stdout + '\n' + commitResult.stderr).trim();
    if (combinedOutput.includes('nothing to commit') || combinedOutput.includes('working tree clean')) {
      return { ok: true, output: 'Nothing to commit, working tree clean.' };
    }
    return { ok: false, error: commitResult.stderr.trim() || commitResult.stdout.trim() || 'git commit failed.' };
  }

  return { ok: true, output: commitResult.stdout.trim() };
}

/**
 * Configure git remote origin URL
 */
export async function gitSetRemote(workspacePath: string, repoUrl: string): Promise<{ ok: boolean; output?: string; error?: string }> {
  if (!isGitRepository(workspacePath)) {
    return { ok: false, error: 'Not a git repository. Call git init first.' };
  }

  // Check existing remotes
  const checkResult = await execGit(['remote'], workspacePath);
  const remotes = checkResult.stdout.split('\n').map(r => r.trim()).filter(Boolean);

  let result;
  if (remotes.includes('origin')) {
    result = await execGit(['remote', 'set-url', 'origin', repoUrl], workspacePath);
  } else {
    result = await execGit(['remote', 'add', 'origin', repoUrl], workspacePath);
  }

  if (result.code !== 0) {
    return { ok: false, error: result.stderr.trim() || 'Failed to set remote URL.' };
  }

  return { ok: true, output: `Remote origin set to: ${repoUrl}` };
}

/**
 * Mocked remote push operation.
 * Validates inputs but doesn't fully execute push to avoid credential disclosure.
 */
export async function gitPush(
  workspacePath: string,
  token?: string,
  repoUrl?: string
): Promise<{ ok: boolean; output?: string; error?: string }> {
  if (!isGitRepository(workspacePath)) {
    return { ok: false, error: 'Not a git repository. Call git init first.' };
  }

  if (!token || !token.trim()) {
    return { ok: false, error: 'Authorization token required for remote git operations.' };
  }

  if (!repoUrl || !repoUrl.trim()) {
    return { ok: false, error: 'Remote repository URL is required.' };
  }

  // Mask token to avoid exposing in logs or response payloads
  const maskedToken = token.slice(0, 4) + '...' + token.slice(-4);
  console.log(`[RemoteRuntime] Git push dry-run triggered. Token: ${maskedToken}, RepoUrl: ${repoUrl}`);

  // Dry-run simulated response
  return {
    ok: true,
    output: 'Dry-run push simulated successfully! Full remote push implementation is pending verification.',
  };
}
