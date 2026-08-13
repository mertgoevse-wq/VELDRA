import type { SandboxSession } from '~/lib/execution/types';
import { path as nodePath } from '~/utils/path';
import { WORK_DIR } from '~/utils/constants';
import { atom, map, type MapStore } from 'nanostores';
import type { ActionAlert, BoltAction, DeployAlert, FileHistory, SupabaseAction, SupabaseAlert } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';
import type { BoltShell } from '~/utils/shell';
import { runtimeModeStore, type RuntimeMode } from '~/lib/stores/runtime-mode';
import { toast } from 'react-toastify';

/**
 * File actions are already persisted by FilesStore on Android fallback and
 * Android remote mode. Desktop Remote still uses WebContainer until a remote
 * sandbox session adapter exists.
 */
export function usesLocalWorkspaceForFileActions(mode: RuntimeMode, isAndroid = false): boolean {
  return mode === 'android-fallback' || (mode === 'remote' && isAndroid);
}

type LocalFileWriter = (filePath: string, content: string) => Promise<void>;
type LocalFileReader = (filePath: string) => Promise<string | undefined>;

function normalizeLocalWorkspacePath(filePath: string): string {
  const normalizedPath = nodePath.normalize(
    nodePath.isAbsolute(filePath) ? filePath : nodePath.join(WORK_DIR, filePath),
  );
  const relativePath = nodePath.relative(WORK_DIR, normalizedPath);

  if (
    relativePath === '' ||
    relativePath === '.' ||
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.startsWith('..\\')
  ) {
    throw new Error(`Path '${filePath}' is outside the local workspace`);
  }

  return normalizedPath;
}

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

class ActionCommandError extends Error {
  readonly _output: string;
  readonly _header: string;

  constructor(message: string, output: string) {
    // Create a formatted message that includes both the error message and output
    const formattedMessage = `Failed To Execute Shell Command: ${message}\n\nOutput:\n${output}`;
    super(formattedMessage);

    // Set the output separately so it can be accessed programmatically
    this._header = message;
    this._output = output;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ActionCommandError.prototype);

    // Set the name of the error for better debugging
    this.name = 'ActionCommandError';
  }

  // Optional: Add a method to get just the terminal output
  get output() {
    return this._output;
  }
  get header() {
    return this._header;
  }
}

export class ActionRunner {
  #getSession: () => Promise<SandboxSession | null>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();
  #shellTerminal: () => BoltShell;
  #localFileWriter?: LocalFileWriter;
  #localFileReader?: LocalFileReader;
  runnerId = atom<string>(`${Date.now()}`);
  actions: ActionsMap = map({});
  onAlert?: (alert: ActionAlert) => void;
  onSupabaseAlert?: (alert: SupabaseAlert) => void;
  onDeployAlert?: (alert: DeployAlert) => void;
  buildOutput?: { path: string; exitCode: number; output: string };

  constructor(
    getSession: () => Promise<SandboxSession | null>,
    getShellTerminal: () => BoltShell,
    onAlert?: (alert: ActionAlert) => void,
    onSupabaseAlert?: (alert: SupabaseAlert) => void,
    onDeployAlert?: (alert: DeployAlert) => void,
    localFileWriter?: LocalFileWriter,
    localFileReader?: LocalFileReader,
  ) {
    this.#getSession = getSession;
    this.#shellTerminal = getShellTerminal;
    this.onAlert = onAlert;
    this.onSupabaseAlert = onSupabaseAlert;
    this.onDeployAlert = onDeployAlert;
    this.#localFileWriter = localFileWriter;
    this.#localFileReader = localFileReader;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    if (action) {
      // action already added
      return;
    }

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.#updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData, isStreaming: boolean = false) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable(`Action ${actionId} not found`);
    }

    if (action.executed) {
      return; // No return value here
    }

    if (isStreaming && action.type !== 'file') {
      return; // No return value here
    }

    this.#updateAction(actionId, { ...action, ...data.action, executed: !isStreaming });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId, isStreaming);
      })
      .catch((error) => {
        logger.error('Action execution promise failed:', error);
      });

    await this.#currentExecutionPromise;

    return;
  }

  async #executeAction(actionId: string, isStreaming: boolean = false) {
    const action = this.actions.get()[actionId];

    // Intercept WebContainer actions on Android Fallback Mode
    const runtimeState = runtimeModeStore.get();
    const needsWebContainer = ['shell', 'build', 'start'].includes(action.type);

    if (needsWebContainer && !runtimeState.capabilities.commandExecution) {
      const errorMsg = 'Command execution requires WebContainer or Remote Runtime';
      this.#updateAction(actionId, {
        status: 'failed',
        error: errorMsg,
      });
      toast.warning(`Action "${action.type}" blocked: ${errorMsg}`);

      /*
       * Unlike a toast (easy to miss, auto-dismisses), this reaches the same ChatAlert UI real
       * shell/build/start failures use -- without it, the model has no way to learn the command
       * it just emitted never ran (it isn't told this session has no shell/build capability in
       * the first place), and will keep talking as if setup succeeded. The user still has to
       * click "Ask VELDRA" to feed it back, same as any other terminal error in this UI.
       */
      this.onAlert?.({
        type: 'error',
        title: 'Command Execution Unavailable',
        description: errorMsg,
        content: 'content' in action ? action.content : '',
        source: 'terminal',
      });

      return;
    }

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(action);
          break;
        }
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
        case 'supabase': {
          try {
            const result = await this.handleSupabaseAction(action as SupabaseAction);

            if ('pending' in result && result.pending) {
              this.#updateAction(actionId, { executed: false, status: 'running' });
              return;
            }
          } catch (error: any) {
            // Update action status
            this.#updateAction(actionId, {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Supabase action failed',
            });

            // Return early without re-throwing
            return;
          }
          break;
        }
        case 'build': {
          const buildOutput = await this.#runBuildAction(action);

          // Store build output for deployment
          this.buildOutput = buildOutput;
          break;
        }
        case 'start': {
          // making the start app non blocking

          this.#runStartAction(action)
            .then(() => this.#updateAction(actionId, { status: 'complete' }))
            .catch((err: Error) => {
              if (action.abortSignal.aborted) {
                return;
              }

              this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
              logger.error(`[${action.type}]:Action failed\n\n`, err);

              if (!(err instanceof ActionCommandError)) {
                return;
              }

              this.onAlert?.({
                type: 'error',
                title: 'Dev Server Failed',
                description: err.header,
                content: err.output,
              });
            });

          /*
           * adding a delay to avoid any race condition between 2 start actions
           * i am up for a better approach
           */
          await new Promise((resolve) => setTimeout(resolve, 2000));

          return;
        }
      }

      this.#updateAction(actionId, {
        status: isStreaming ? 'running' : action.abortSignal.aborted ? 'aborted' : 'complete',
      });
    } catch (error) {
      if (action.abortSignal.aborted) {
        return;
      }

      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });
      logger.error(`[${action.type}]:Action failed\n\n`, error);

      if (!(error instanceof ActionCommandError)) {
        return;
      }

      this.onAlert?.({
        type: 'error',
        title: 'Dev Server Failed',
        description: error.header,
        content: error.output,
      });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runShellAction(action: ActionState) {
    if (action.type !== 'shell') {
      unreachable('Expected shell action');
    }

    const session = await this.#getSession();

    if (!session) {
      throw new Error('No active sandbox session');
    }

    const shell = this.#shellTerminal();
    await shell.ready();

    if (!shell || !shell.terminal || !shell.process) {
      unreachable('Shell terminal not found');
    }

    const isWebContainer = session.id === 'webcontainer:default';

    // If WebContainer, we can use the interactive shell which has OSC exit codes
    if (isWebContainer) {
      const resp = await shell.executeCommand(this.runnerId.get(), action.content, () => {
        logger.debug(`[${action.type}]:Aborting Action\n\n`, action);
        action.abort();
      });
      logger.debug(`${action.type} Shell Response: [exit code:${resp?.exitCode}]`);

      if (resp?.exitCode != 0) {
        throw new ActionCommandError(
          'Shell Command Failed',
          resp?.output || `Command exited with code ${resp?.exitCode}`,
        );
      }

      return;
    }

    // For generic providers, spawn a separate process for the command to get a reliable exit code
    let output = '';
    const process = await session.spawn('bash', ['-c', action.content]);

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
          shell.terminal?.write(data);
        },
      }),
    );

    action.abortSignal.addEventListener('abort', () => {
      if (typeof process.kill === 'function') {
        process.kill();
      }
    });

    const exitCode = await process.exit;
    logger.debug(`${action.type} Shell Response: [exit code:${exitCode}]`);

    if (exitCode !== 0) {
      throw new ActionCommandError('Shell Command Failed', output || `Command exited with code ${exitCode}`);
    }
  }

  async #runStartAction(action: ActionState) {
    if (action.type !== 'start') {
      unreachable('Expected start action');
    }

    const session = await this.#getSession();

    if (!session) {
      throw new Error('No active sandbox session');
    }

    if (!this.#shellTerminal) {
      unreachable('Shell terminal not found');
    }

    const shell = this.#shellTerminal();
    await shell.ready();

    if (!shell || !shell.terminal || !shell.process) {
      unreachable('Shell terminal not found');
    }

    const isWebContainer = session.id === 'webcontainer:default';

    if (isWebContainer) {
      const resp = await shell.executeCommand(this.runnerId.get(), action.content, () => {
        logger.debug(`[${action.type}]:Aborting Action\n\n`, action);
        action.abort();
      });
      logger.debug(`${action.type} Shell Response: [exit code:${resp?.exitCode}]`);

      if (resp?.exitCode != 0) {
        throw new ActionCommandError('Failed To Start Application', resp?.output || 'No Output Available');
      }

      return resp;
    }

    let output = '';
    const process = await session.spawn('bash', ['-c', action.content]);

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
          shell.terminal?.write(data);
        },
      }),
    );

    action.abortSignal.addEventListener('abort', () => {
      if (typeof process.kill === 'function') {
        process.kill();
      }
    });

    const exitCode = await process.exit;
    logger.debug(`${action.type} Shell Response: [exit code:${exitCode}]`);

    if (exitCode !== 0) {
      throw new ActionCommandError('Failed To Start Application', output || `Command exited with code ${exitCode}`);
    }

    return { output, exitCode };
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') {
      unreachable('Expected file action');
    }

    const runtime = runtimeModeStore.get();

    if (usesLocalWorkspaceForFileActions(runtime.mode, runtime.isAndroid)) {
      if (!this.#localFileWriter) {
        throw new Error('Local workspace writer is not configured for this runtime');
      }

      const filePath = normalizeLocalWorkspacePath(action.filePath);
      await this.#localFileWriter(filePath, action.content);

      return;
    }

    const session = await this.#getSession();

    if (!session) {
      throw new Error('No active sandbox session');
    }

    const relativePath = nodePath.relative(session.workdir, action.filePath);

    let folder = nodePath.dirname(relativePath);

    // remove trailing slashes
    folder = folder.replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await session.mkdir(folder, { recursive: true });
        logger.debug('Created folder', folder);
      } catch (error) {
        logger.error('Failed to create folder\n\n', error);
      }
    }

    try {
      await session.writeFiles([{ path: relativePath, content: action.content }]);
      logger.debug(`File written ${relativePath}`);
    } catch (error) {
      logger.error('Failed to write file\n\n', error);
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
  }

  async getFileHistory(filePath: string): Promise<FileHistory | null> {
    try {
      const runtime = runtimeModeStore.get();
      const historyPath = this.#getHistoryPath(filePath);

      if (usesLocalWorkspaceForFileActions(runtime.mode, runtime.isAndroid)) {
        if (!this.#localFileReader) {
          return null;
        }

        const content = await this.#localFileReader(normalizeLocalWorkspacePath(historyPath));

        return content === undefined ? null : JSON.parse(content);
      }

      const session = await this.#getSession();

      if (!session) {
        return null;
      }

      const content = await session.readFile(historyPath);

      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to get file history:', error);
      return null;
    }
  }

  async saveFileHistory(filePath: string, history: FileHistory) {
    // const webcontainer = await this.#webcontainer;
    const historyPath = this.#getHistoryPath(filePath);

    await this.#runFileAction({
      type: 'file',
      filePath: historyPath,
      content: JSON.stringify(history),
      changeSource: 'auto-save',
    } as any);
  }

  #getHistoryPath(filePath: string) {
    return nodePath.join('.history', filePath);
  }

  async #runBuildAction(action: ActionState) {
    if (action.type !== 'build') {
      unreachable('Expected build action');
    }

    // Trigger build started alert
    this.onDeployAlert?.({
      type: 'info',
      title: 'Building Application',
      description: 'Building your application...',
      stage: 'building',
      buildStatus: 'running',
      deployStatus: 'pending',
      source: 'netlify',
    });

    const session = await this.#getSession();

    if (!session) {
      throw new Error('No active sandbox session');
    }

    // Create a new terminal specifically for the build
    const buildProcess = await session.spawn('npm', ['run', 'build']);

    let output = '';
    const outputPromise = buildProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
        },
      }),
    );

    const exitCode = await buildProcess.exit;
    await outputPromise.catch(() => {
      // Ignore output piping errors; we still have whatever was captured
    });

    let buildDir = '';

    if (exitCode !== 0) {
      const buildResult = {
        path: buildDir,
        exitCode,
        output,
      };

      this.buildOutput = buildResult;

      // Trigger build failed alert
      this.onDeployAlert?.({
        type: 'error',
        title: 'Build Failed',
        description: 'Your application build failed',
        content: output || 'No build output available',
        stage: 'building',
        buildStatus: 'failed',
        deployStatus: 'pending',
        source: 'netlify',
      });

      throw new ActionCommandError('Build Failed', output || 'No Output Available');
    }

    // Trigger build success alert
    this.onDeployAlert?.({
      type: 'success',
      title: 'Build Completed',
      description: 'Your application was built successfully',
      stage: 'deploying',
      buildStatus: 'complete',
      deployStatus: 'running',
      source: 'netlify',
    });

    // Check for common build directories
    const commonBuildDirs = ['dist', 'build', 'out', 'output', '.next', 'public'];

    // Try to find the first existing build directory
    for (const dir of commonBuildDirs) {
      const dirPath = nodePath.join(session.workdir, dir);

      try {
        await session.readDir(dirPath);
        buildDir = dirPath;
        break;
      } catch {
        continue;
      }
    }

    // If no build directory was found, use the default (dist)
    if (!buildDir) {
      buildDir = nodePath.join(session.workdir, 'dist');
    }

    const buildResult = {
      path: buildDir,
      exitCode,
      output,
    };

    this.buildOutput = buildResult;

    return buildResult;
  }
  async handleSupabaseAction(action: SupabaseAction) {
    const { operation, content, filePath } = action;
    logger.debug('[Supabase Action]:', { operation, filePath, content });

    switch (operation) {
      case 'migration':
        if (!filePath) {
          throw new Error('Migration requires a filePath');
        }

        // Show alert for migration action
        this.onSupabaseAlert?.({
          type: 'info',
          title: 'Supabase Migration',
          description: `Create migration file: ${filePath}`,
          content,
          source: 'supabase',
        });

        // Only create the migration file
        await this.#runFileAction({
          type: 'file',
          filePath,
          content,
          changeSource: 'supabase',
        } as any);
        return { success: true };

      case 'query': {
        // Always show the alert and let the SupabaseAlert component handle connection state
        this.onSupabaseAlert?.({
          type: 'info',
          title: 'Supabase Query',
          description: 'Execute database query',
          content,
          source: 'supabase',
        });

        // The actual execution will be triggered from SupabaseChatAlert
        return { pending: true };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  // Add this method declaration to the class
  handleDeployAction(
    stage: 'building' | 'deploying' | 'complete',
    status: ActionStatus,
    details?: {
      url?: string;
      error?: string;
      source?: 'netlify' | 'vercel' | 'github' | 'gitlab';
    },
  ): void {
    if (!this.onDeployAlert) {
      logger.debug('No deploy alert handler registered');
      return;
    }

    const alertType = status === 'failed' ? 'error' : status === 'complete' ? 'success' : 'info';

    const title =
      stage === 'building'
        ? 'Building Application'
        : stage === 'deploying'
          ? 'Deploying Application'
          : 'Deployment Complete';

    const description =
      status === 'failed'
        ? `${stage === 'building' ? 'Build' : 'Deployment'} failed`
        : status === 'running'
          ? `${stage === 'building' ? 'Building' : 'Deploying'} your application...`
          : status === 'complete'
            ? `${stage === 'building' ? 'Build' : 'Deployment'} completed successfully`
            : `Preparing to ${stage === 'building' ? 'build' : 'deploy'} your application`;

    const buildStatus =
      stage === 'building' ? status : stage === 'deploying' || stage === 'complete' ? 'complete' : 'pending';

    const deployStatus = stage === 'building' ? 'pending' : status;

    this.onDeployAlert({
      type: alertType,
      title,
      description,
      content: details?.error || '',
      url: details?.url,
      stage,
      buildStatus: buildStatus as any,
      deployStatus: deployStatus as any,
      source: details?.source || 'netlify',
    });
  }
}
