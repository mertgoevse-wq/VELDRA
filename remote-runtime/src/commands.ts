import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';

export const COMMAND_PROFILES = {
  'npm install': packageManagerProfile('npm', ['install']),
  'npm run dev': packageManagerProfile('npm', ['run', 'dev']),
  'npm run build': packageManagerProfile('npm', ['run', 'build']),
  'pnpm install': packageManagerProfile('pnpm', ['install']),
  'pnpm run dev': packageManagerProfile('pnpm', ['run', 'dev']),
  'pnpm run build': packageManagerProfile('pnpm', ['run', 'build']),
} as const;

export type CommandProfile = keyof typeof COMMAND_PROFILES;
export type CommandStatus = 'running' | 'exited' | 'stopped' | 'error' | 'timed-out';

export interface CommandEvent {
  type: 'status' | 'stdout' | 'stderr' | 'exit';
  timestamp: string;
  payload: {
    commandId: string;
    commandProfile: CommandProfile;
    status?: CommandStatus;
    output?: string;
    exitCode?: number | null;
    signal?: NodeJS.Signals | null;
    error?: string;
  };
}

export interface CommandRecord {
  commandId: string;
  commandProfile: CommandProfile;
  workspaceId: string;
  status: CommandStatus;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  error?: string;
}

interface ActiveCommand extends CommandRecord {
  process?: ChildProcessWithoutNullStreams;
  timeout?: NodeJS.Timeout;
}

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.REMOTE_RUNTIME_COMMAND_TIMEOUT_MS || '300000', 10);
const activeCommands = new Map<string, ActiveCommand>();

function packageManagerProfile(name: 'npm' | 'pnpm', args: string[]) {
  if (process.platform !== 'win32') {
    return { command: name, args };
  }

  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', name, ...args],
  };
}

function now() {
  return new Date().toISOString();
}

function createCommandId() {
  return 'cmd_' + Math.random().toString(36).substring(2, 11);
}

function toPublicRecord(command: ActiveCommand): CommandRecord {
  const { process: _process, timeout: _timeout, ...record } = command;

  return record;
}

function terminateProcessTree(child: ChildProcessWithoutNullStreams | undefined) {
  if (!child?.pid) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }

  child.kill('SIGTERM');
}

function finishCommand(
  command: ActiveCommand,
  status: CommandStatus,
  emit: (event: CommandEvent) => void,
  details: Pick<CommandRecord, 'exitCode' | 'signal' | 'error'> = {},
) {
  if (command.timeout) {
    clearTimeout(command.timeout);
    command.timeout = undefined;
  }

  command.status = status;
  command.endedAt = now();
  command.exitCode = details.exitCode;
  command.signal = details.signal;
  command.error = details.error;
  command.process = undefined;

  console.log(
    `[RemoteRuntime] Command ${command.commandId} ended status=${status} workspace=${command.workspaceId} profile="${command.commandProfile}"`,
  );

  emit({
    type: 'exit',
    timestamp: now(),
    payload: {
      commandId: command.commandId,
      commandProfile: command.commandProfile,
      status,
      exitCode: command.exitCode,
      signal: command.signal,
      error: command.error,
    },
  });
}

export function isCommandProfile(value: unknown): value is CommandProfile {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COMMAND_PROFILES, value);
}

/**
 * Dev-server profiles are meant to run indefinitely until the user (or a future agent
 * action) explicitly stops them -- unlike install/build, which are one-shot and should
 * still be bounded by DEFAULT_TIMEOUT_MS in case they hang.
 */
function isDevServerProfile(profile: CommandProfile): boolean {
  return profile.endsWith('run dev');
}

export function listCommandProfiles(): CommandProfile[] {
  return Object.keys(COMMAND_PROFILES) as CommandProfile[];
}

export function startCommand(
  workspaceId: string,
  workspacePath: string,
  commandProfile: CommandProfile,
  emit: (event: CommandEvent) => void,
): CommandRecord {
  const profile = COMMAND_PROFILES[commandProfile];
  const commandId = createCommandId();
  const startedAt = now();
  const resolvedWorkspacePath = path.resolve(workspacePath);

  const record: ActiveCommand = {
    commandId,
    commandProfile,
    workspaceId,
    status: 'running',
    startedAt,
  };

  console.log(
    `[RemoteRuntime] Command ${commandId} started workspace=${workspaceId} cwd=${resolvedWorkspacePath} profile="${commandProfile}"`,
  );

  emit({
    type: 'status',
    timestamp: startedAt,
    payload: {
      commandId,
      commandProfile,
      status: 'running',
      output: `Started ${commandProfile}\n`,
    },
  });

  const child = spawn(profile.command, profile.args, {
    cwd: resolvedWorkspacePath,
    env: process.env,
    shell: false,
    windowsHide: true,
  });

  record.process = child;
  activeCommands.set(commandId, record);

  child.stdout.on('data', (chunk) => {
    emit({
      type: 'stdout',
      timestamp: now(),
      payload: {
        commandId,
        commandProfile,
        output: chunk.toString(),
      },
    });
  });

  child.stderr.on('data', (chunk) => {
    emit({
      type: 'stderr',
      timestamp: now(),
      payload: {
        commandId,
        commandProfile,
        output: chunk.toString(),
      },
    });
  });

  child.on('error', (error) => {
    console.error(`[RemoteRuntime] Command ${commandId} error`, error);
    finishCommand(record, 'error', emit, { error: error.message });
  });

  child.on('close', (exitCode, signal) => {
    if (record.status !== 'running') {
      return;
    }

    finishCommand(record, 'exited', emit, { exitCode, signal });
  });

  if (!isDevServerProfile(commandProfile)) {
    record.timeout = setTimeout(() => {
      if (record.status !== 'running') {
        return;
      }

      console.warn(`[RemoteRuntime] Command ${commandId} timed out after ${DEFAULT_TIMEOUT_MS}ms`);
      terminateProcessTree(record.process);
      finishCommand(record, 'timed-out', emit, { error: `Timed out after ${DEFAULT_TIMEOUT_MS}ms` });
    }, DEFAULT_TIMEOUT_MS);
  }

  return toPublicRecord(record);
}

export function getCommand(commandId: string): CommandRecord | undefined {
  const command = activeCommands.get(commandId);

  return command ? toPublicRecord(command) : undefined;
}

export function stopCommand(commandId: string, emit: (event: CommandEvent) => void): CommandRecord | undefined {
  const command = activeCommands.get(commandId);

  if (!command) {
    return undefined;
  }

  if (command.status !== 'running') {
    return toPublicRecord(command);
  }

  console.log(
    `[RemoteRuntime] Command ${command.commandId} stop requested workspace=${command.workspaceId} profile="${command.commandProfile}"`,
  );

  terminateProcessTree(command.process);
  finishCommand(command, 'stopped', emit, { signal: 'SIGTERM' });

  return toPublicRecord(command);
}
