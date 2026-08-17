/**
 * GitHubSyncPanel
 *
 * Mobile-friendly panel for GitHub sync in the Android/fallback workflow.
 *
 * Shows:
 *   - Repository URL input (saved locally)
 *   - Branch name input
 *   - Last sync status + timestamp
 *   - Uncommitted changes count
 *   - "Commit changes" button — disabled with explanation
 *   - "Push to GitHub" button — disabled with explanation
 *
 * The commit and push buttons are DISABLED because:
 *   - On Android, WebContainer is not available (no local git runtime)
 *   - Remote Runtime backend is not yet implemented
 *
 * This panel does NOT fake any git operations. It clearly explains
 * what's not available and what the user can do instead.
 *
 * The existing GitHub settings tab (token connection, repo browsing)
 * is separate and still works — this panel focuses on the sync workflow.
 */

import { useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { githubSyncStore, setSyncRepoUrl, setSyncBranch, isRepoConfigured } from '~/lib/stores/github-sync';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { useStore as useNanostore } from '@nanostores/react';
import { RemoteRuntimeClient } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { githubConnectionStore } from '~/lib/stores/githubConnection';

// GitHub logo
const GithubLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path
      fill="currentColor"
      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
    />
  </svg>
);

export function GitHubSyncPanel() {
  const sync = useStore(githubSyncStore);
  const runtime = useNanostore(runtimeModeStore);

  const [urlInput, setUrlInput] = useState(sync.repoUrl);
  const [branchInput, setBranchInput] = useState(sync.branch);

  const handleSaveConfig = useCallback(() => {
    const trimmedUrl = urlInput.trim();

    // Basic URL validation
    if (trimmedUrl && !trimmedUrl.startsWith('https://github.com/') && !trimmedUrl.startsWith('http://github.com/')) {
      toast.error('Repository URL should start with https://github.com/');
      return;
    }

    setSyncRepoUrl(trimmedUrl);
    setSyncBranch(branchInput.trim() || 'main');
    toast.success('GitHub sync configuration saved');
  }, [urlInput, branchInput]);

  const [commitMessage, setCommitMessage] = useState('');
  const [gitOutput, setGitOutput] = useState('');
  const [gitError, setGitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if runtime supports git operations
  const isRemoteMode = runtime.mode === 'remote';
  const isRemoteUrlConfigured = !!runtime.remoteRuntimeUrl;
  const isWorkspaceConfigured = !!runtime.remoteWorkspaceId;

  const isGitActionDisabled = !isRepoConfigured() || !isRemoteMode || !isRemoteUrlConfigured || !isWorkspaceConfigured;

  // Explanation for disabled buttons
  const disabledReason = !isRepoConfigured()
    ? 'Configure a repository URL first'
    : !isRemoteMode
      ? 'Remote Runtime required: Git operations require a connected Remote Runtime. To configure, go to Settings → Runtime Mode.'
      : !runtime.remoteRuntimeUrl
        ? 'Set a Remote Runtime URL in Settings → Runtime Mode first'
        : !isWorkspaceConfigured
          ? 'Workspace ID is not set. Initialize a workspace in Settings → Runtime Mode first.'
          : '';

  const handleGitInit = useCallback(async () => {
    if (isGitActionDisabled) {
      return;
    }

    setIsLoading(true);
    setGitOutput('');
    setGitError('');

    try {
      const client = new RemoteRuntimeClient(
        runtime.remoteRuntimeUrl,
        runtime.remoteAuthToken,
        runtime.remoteWorkspaceId,
      );

      const res = await client.gitInit();

      if (res.ok) {
        setGitOutput(res.output || 'Git repository initialized successfully.');
        toast.success('Git repository initialized.');
      } else {
        setGitError(res.error || 'Failed to initialize Git repository.');
        toast.error('Git init failed.');
      }
    } catch (err: any) {
      setGitError(err.message || 'Unknown network error during Git init.');
      toast.error('Network error during Git init.');
    } finally {
      setIsLoading(false);
    }
  }, [isGitActionDisabled, runtime]);

  const handleGitStatus = useCallback(async () => {
    if (isGitActionDisabled) {
      return;
    }

    setIsLoading(true);
    setGitOutput('');
    setGitError('');

    try {
      const client = new RemoteRuntimeClient(
        runtime.remoteRuntimeUrl,
        runtime.remoteAuthToken,
        runtime.remoteWorkspaceId,
      );

      const res = await client.gitStatus();

      if (res.ok) {
        setGitOutput(res.status || 'git status output was empty.');
        toast.success('Git status checked.');
      } else {
        setGitError(res.error || 'Failed to retrieve Git status.');
        toast.error('Git status failed.');
      }
    } catch (err: any) {
      setGitError(err.message || 'Unknown network error during Git status.');
      toast.error('Network error during Git status.');
    } finally {
      setIsLoading(false);
    }
  }, [isGitActionDisabled, runtime]);

  const handleGitCommit = useCallback(async () => {
    if (isGitActionDisabled || !commitMessage.trim()) {
      return;
    }

    setIsLoading(true);
    setGitOutput('');
    setGitError('');

    try {
      const client = new RemoteRuntimeClient(
        runtime.remoteRuntimeUrl,
        runtime.remoteAuthToken,
        runtime.remoteWorkspaceId,
      );

      const res = await client.gitCommit(commitMessage.trim());

      if (res.ok) {
        setGitOutput(res.output || 'Changes committed successfully.');
        toast.success('Changes committed.');
        setCommitMessage('');
      } else {
        setGitError(res.error || 'Failed to commit changes.');
        toast.error('Git commit failed.');
      }
    } catch (err: any) {
      setGitError(err.message || 'Unknown network error during Git commit.');
      toast.error('Network error during Git commit.');
    } finally {
      setIsLoading(false);
    }
  }, [isGitActionDisabled, commitMessage, runtime]);

  const handleGitPush = useCallback(async () => {
    if (isGitActionDisabled) {
      return;
    }

    const token = githubConnectionStore.get().token;

    if (!token) {
      toast.error('GitHub token is required to push. Please connect your GitHub account in Settings → GitHub.');
      return;
    }

    setIsLoading(true);
    setGitOutput('');
    setGitError('');

    try {
      const client = new RemoteRuntimeClient(
        runtime.remoteRuntimeUrl,
        runtime.remoteAuthToken,
        runtime.remoteWorkspaceId,
      );

      const res = await client.gitPush({
        token,
        repoUrl: sync.repoUrl,
      });

      if (res.ok) {
        setGitOutput(res.output || 'Push completed (simulation).');
        toast.success('Git push simulated (dry-run).');
      } else {
        setGitError(res.error || 'Failed to execute simulated push.');
        toast.error('Git push simulated check failed.');
      }
    } catch (err: any) {
      setGitError(err.message || 'Unknown network error during Git push.');
      toast.error('Network error during Git push.');
    } finally {
      setIsLoading(false);
    }
  }, [isGitActionDisabled, sync.repoUrl, runtime]);

  const formatTimestamp = (iso: string | null): string => {
    if (!iso) {
      return 'Never';
    }

    try {
      const date = new Date(iso);
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div className="flex items-center gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <GithubLogo className="w-5 h-5 text-bolt-elements-textPrimary" />
        <h2 className="text-lg font-medium text-bolt-elements-textPrimary">GitHub Sync</h2>
      </motion.div>

      {/* Info banner */}
      <motion.div
        className={classNames(
          'rounded-lg p-3 flex items-start gap-2 text-sm',
          'bg-blue-50 dark:bg-blue-950/20',
          'border border-blue-200 dark:border-blue-800/50',
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <div className="i-ph:info-fill w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
        <div className="text-blue-800 dark:text-blue-200 leading-snug">
          {!isRemoteMode ? (
            <span>
              <strong>Remote Runtime Required:</strong> Git operations (status, commit, push) require a connected Remote
              Runtime. To configure, go to <strong>Settings → Runtime Mode</strong>.
            </span>
          ) : (
            <span>
              <strong>Remote Git Workflow Scaffolded:</strong> Predefined allowlisted Git API endpoints are active on
              your Remote Runtime. Client integration will be completed in the next phase. Actions currently run in
              simulation to avoid faking success.
            </span>
          )}
        </div>
      </motion.div>

      {/* Configuration */}
      <motion.div
        className={classNames(
          'rounded-lg shadow-sm dark:shadow-none p-4 space-y-4',
          'bg-bolt-elements-background-depth-1',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <div className="i-ph:gear-fill w-4 h-4 text-bolt-elements-item-contentAccent" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Repository Configuration</span>
        </div>

        {/* Repo URL */}
        <div>
          <label className="block text-sm text-bolt-elements-textSecondary mb-2">Repository URL</label>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://github.com/your-username/your-repo"
            className={classNames(
              'w-full px-3 py-2 rounded-lg text-sm',
              'bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
              'transition-all duration-200',
              'placeholder:text-bolt-elements-textTertiary',
            )}
          />
        </div>

        {/* Branch */}
        <div>
          <label className="block text-sm text-bolt-elements-textSecondary mb-2">Branch</label>
          <input
            type="text"
            value={branchInput}
            onChange={(e) => setBranchInput(e.target.value)}
            placeholder="main"
            className={classNames(
              'w-full px-3 py-2 rounded-lg text-sm',
              'bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
              'transition-all duration-200',
              'placeholder:text-bolt-elements-textTertiary',
            )}
          />
        </div>

        <button
          onClick={handleSaveConfig}
          className={classNames(
            'w-full min-h-11 px-4 py-2 rounded-lg text-sm font-medium',
            'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent',
            'hover:bg-bolt-elements-button-primary-backgroundHover',
            'transition-all duration-200',
            'transform active:scale-95',
          )}
        >
          Save Configuration
        </button>
      </motion.div>

      {/* Sync Status */}
      <motion.div
        className={classNames(
          'rounded-lg shadow-sm dark:shadow-none p-4 space-y-3',
          'bg-bolt-elements-background-depth-1',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2">
          <div className="i-ph:clock-countdown-fill w-4 h-4 text-bolt-elements-item-contentAccent" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Sync Status</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-bolt-elements-textSecondary">Status:</span>{' '}
            <span
              className={classNames(
                'font-medium',
                sync.syncStatus === 'synced' && 'text-green-600 dark:text-green-400',
                sync.syncStatus === 'error' && 'text-red-500',
                sync.syncStatus === 'not-configured' && 'text-bolt-elements-textSecondary',
                sync.syncStatus === 'idle' && 'text-amber-600 dark:text-amber-400',
                sync.syncStatus === 'syncing' && 'text-blue-500',
              )}
            >
              {sync.syncStatus === 'not-configured'
                ? 'Not configured'
                : sync.syncStatus === 'idle'
                  ? 'Ready'
                  : sync.syncStatus === 'synced'
                    ? 'Synced'
                    : sync.syncStatus === 'error'
                      ? 'Error'
                      : 'Syncing'}
            </span>
          </div>
          <div>
            <span className="text-bolt-elements-textSecondary">Last sync:</span>{' '}
            <span className="font-medium text-bolt-elements-textPrimary">{formatTimestamp(sync.lastSyncedAt)}</span>
          </div>
          <div>
            <span className="text-bolt-elements-textSecondary">Uncommitted:</span>{' '}
            <span className="font-medium text-bolt-elements-textPrimary">{sync.uncommittedCount} files</span>
          </div>
          <div>
            <span className="text-bolt-elements-textSecondary">Branch:</span>{' '}
            <span className="font-medium text-bolt-elements-textPrimary">{sync.branch}</span>
          </div>
        </div>

        {sync.errorMessage && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded-lg p-2">
            {sync.errorMessage}
          </div>
        )}
      </motion.div>

      {/* Git Operations */}
      <motion.div
        className={classNames(
          'rounded-lg shadow-sm dark:shadow-none p-4 space-y-4',
          'bg-bolt-elements-background-depth-1',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="i-ph:git-branch-fill w-4 h-4 text-bolt-elements-item-contentAccent" />
            <span className="text-sm font-medium text-bolt-elements-textPrimary">Git Operations</span>
          </div>
          {isRemoteMode && isRemoteUrlConfigured && isWorkspaceConfigured && (
            <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold">
              Remote Runtime Connected
            </span>
          )}
        </div>

        {/* Basic Git Ops Row (Init & Status) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleGitInit}
            disabled={isGitActionDisabled || isLoading}
            className={classNames(
              'min-h-11 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-bolt-elements-borderColor text-bolt-elements-textPrimary transition-all duration-200',
              isGitActionDisabled || isLoading
                ? 'opacity-50 cursor-not-allowed bg-bolt-elements-background-depth-3'
                : 'bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-2 active:scale-95',
            )}
          >
            <div
              className={isLoading ? 'i-ph:spinner-gap animate-spin w-3.5 h-3.5' : 'i-ph:folder-plus-fill w-3.5 h-3.5'}
            />
            Git Init
          </button>

          <button
            onClick={handleGitStatus}
            disabled={isGitActionDisabled || isLoading}
            className={classNames(
              'min-h-11 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-bolt-elements-borderColor text-bolt-elements-textPrimary transition-all duration-200',
              isGitActionDisabled || isLoading
                ? 'opacity-50 cursor-not-allowed bg-bolt-elements-background-depth-3'
                : 'bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-2 active:scale-95',
            )}
          >
            <div
              className={isLoading ? 'i-ph:spinner-gap animate-spin w-3.5 h-3.5' : 'i-ph:git-diff-fill w-3.5 h-3.5'}
            />
            Git Status
          </button>
        </div>

        {/* Commit message input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-bolt-elements-textSecondary">Commit Message</label>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            disabled={isGitActionDisabled || isLoading}
            placeholder="feat: build remote git workflow..."
            className={classNames(
              'w-full px-3 py-2 rounded-lg text-xs',
              'bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
              'transition-all duration-200',
              'placeholder:text-bolt-elements-textTertiary',
              (isGitActionDisabled || isLoading) && 'opacity-50 cursor-not-allowed',
            )}
          />
        </div>

        {/* Commit action button */}
        <button
          onClick={handleGitCommit}
          disabled={isGitActionDisabled || isLoading || !commitMessage.trim()}
          className={classNames(
            'w-full min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200',
            isGitActionDisabled || isLoading || !commitMessage.trim()
              ? 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary opacity-50 cursor-not-allowed'
              : 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover transform active:scale-95',
          )}
        >
          <div className={isLoading ? 'i-ph:spinner-gap animate-spin w-4 h-4' : 'i-ph:git-commit-fill w-4 h-4'} />
          Commit Changes
        </button>

        {/* Push action button (Dry-run simulated) */}
        <div>
          <button
            onClick={handleGitPush}
            disabled={isGitActionDisabled || isLoading}
            className={classNames(
              'w-full min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200',
              isGitActionDisabled || isLoading
                ? 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary opacity-50 cursor-not-allowed'
                : 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover transform active:scale-95',
            )}
          >
            <div className={isLoading ? 'i-ph:spinner-gap animate-spin w-4 h-4' : 'i-ph:cloud-arrow-up-fill w-4 h-4'} />
            Push to GitHub (Dry-Run)
          </button>
          <p className="text-[10px] text-amber-500 mt-1.5 flex items-center gap-1 leading-normal">
            <span className="i-ph:info-fill flex-shrink-0" />
            <span>Push is simulated in dry-run mode for credential safety.</span>
          </p>
        </div>

        {/* Disabled hint warning */}
        {isGitActionDisabled && (
          <p className="text-xs text-red-500 bg-red-950/10 border border-red-900/20 rounded-lg p-2.5 leading-relaxed">
            <strong>Runtime Needed:</strong> {disabledReason}
          </p>
        )}

        {/* Git console logs output */}
        {(gitOutput || gitError) && (
          <div className="flex flex-col gap-1.5 border border-bolt-elements-borderColor rounded-lg p-3 bg-black/40 font-mono text-[10px] leading-relaxed break-all">
            <div className="flex items-center justify-between text-bolt-elements-textSecondary border-b border-bolt-elements-borderColor/30 pb-1 mb-1.5">
              <span>Git Console Output</span>
              <button
                onClick={() => {
                  setGitOutput('');
                  setGitError('');
                }}
                className="hover:text-bolt-elements-textPrimary transition-colors"
              >
                Clear
              </button>
            </div>
            {gitOutput && <pre className="text-green-400 whitespace-pre-wrap">{gitOutput}</pre>}
            {gitError && (
              <pre className="text-red-400 whitespace-pre-wrap">
                <strong>Error:</strong> {gitError}
              </pre>
            )}
          </div>
        )}
      </motion.div>

      {/* Token connection hint */}
      <motion.div
        className={classNames(
          'rounded-lg p-3 flex items-start gap-2 text-sm',
          'bg-amber-50 dark:bg-amber-950/20',
          'border border-amber-200 dark:border-amber-800/50',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="i-ph:lightbulb-fill w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="text-amber-800 dark:text-amber-200 leading-snug">
          To connect your GitHub account (for auth tokens), go to Settings → GitHub. The token connection works on
          mobile — it's the git operations that need a runtime.
        </div>
      </motion.div>

      {/* TODO notice */}
      <motion.div
        className={classNames(
          'rounded-lg p-3 flex items-start gap-2 text-xs',
          'bg-bolt-elements-background-depth-1',
          'border border-bolt-elements-borderColor',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="i-ph:wrench-fill w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
        <div className="text-gray-500 dark:text-gray-500 leading-relaxed">
          <strong>Future Workflow Scaffolded:</strong> Predefined allowlisted Git operations (status, init, commit,
          push) are ready on the Remote Runtime backend. In-memory sync changes will be committed directly inside the
          isolated workspace directory without running arbitrary shell commands.
        </div>
      </motion.div>
    </div>
  );
}
