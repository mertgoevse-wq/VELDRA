import { getSandboxProvider, selectSandboxProvider } from './registry';
import type { SandboxCapabilities } from './types';

export type ExecutionRuntimeMode = 'webcontainer' | 'android-fallback' | 'remote';

export type ExecutionProviderStatusState = 'available' | 'unavailable' | 'unregistered' | 'not-required';

export interface ExecutionProviderStatus {
  mode: ExecutionRuntimeMode;
  providerId: string | null;
  state: ExecutionProviderStatusState;
  reason: string;
  capabilities?: SandboxCapabilities;
}

const DEFAULT_TIMEOUT_MS = 1000;

const EXECUTION_PROVIDER_BY_MODE: Record<ExecutionRuntimeMode, string | null> = {
  webcontainer: 'webcontainer',
  'android-fallback': null,
  remote: null,
};

const COMMAND_EXECUTION_REQUIREMENTS = { interactiveShell: true } as const;

function timeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Execution provider availability check timed out'));
      }
    }, timeoutMs);

    void promise.then(
      (value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Reports whether the registry has a usable provider for a runtime mode.
 *
 * This is deliberately observational: it never boots a runtime, changes the
 * runtime-mode store, or treats Remote/Android modes as WebContainer modes.
 */
export async function getExecutionProviderStatus(
  mode: ExecutionRuntimeMode,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ExecutionProviderStatus> {
  if (mode === 'android-fallback') {
    return {
      mode,
      providerId: null,
      state: 'not-required',
      reason: 'Android fallback uses its local persistence adapter; command execution is unavailable.',
    };
  }

  const providerId = EXECUTION_PROVIDER_BY_MODE[mode];

  if (!providerId) {
    return {
      mode,
      providerId: null,
      state: 'unregistered',
      reason: 'Remote Runtime is not registered in the sandbox registry yet.',
    };
  }

  const provider = getSandboxProvider(providerId);

  if (!provider) {
    return {
      mode,
      providerId,
      state: 'unregistered',
      reason: 'No provider is registered for the selected runtime mode.',
    };
  }

  try {
    const selected = await timeout(selectSandboxProvider(COMMAND_EXECUTION_REQUIREMENTS, [providerId]), timeoutMs);

    if (selected) {
      return {
        mode,
        providerId,
        state: 'available',
        reason: `${selected.label} is registered and available.`,
        capabilities: selected.capabilities,
      };
    }

    return {
      mode,
      providerId,
      state: 'unavailable',
      reason: `${provider.label} is registered but unavailable in the current environment.`,
      capabilities: provider.capabilities,
    };
  } catch (error) {
    return {
      mode,
      providerId,
      state: 'unavailable',
      reason: error instanceof Error ? error.message : 'Provider availability could not be verified.',
      capabilities: provider.capabilities,
    };
  }
}
