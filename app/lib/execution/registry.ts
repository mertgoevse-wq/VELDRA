import type { SandboxCapabilities, SandboxProvider } from './types';

/**
 * Adapter registry. Providers register themselves here; nothing else in the
 * codebase should import a provider module directly, so that adding a backend
 * stays a one-line change plus one adapter file.
 *
 * Providers are registered by their composition roots; the WebContainer
 * adapter is wired from app/lib/webcontainer/index.ts. Generic consumers do
 * not import a provider module directly.
 */
const providers = new Map<string, SandboxProvider>();

export function registerSandboxProvider(provider: SandboxProvider): void {
  if (providers.has(provider.id)) {
    throw new Error(`Sandbox provider '${provider.id}' is already registered`);
  }

  providers.set(provider.id, provider);
}

export function getSandboxProvider(id: string): SandboxProvider | undefined {
  return providers.get(id);
}

export function listSandboxProviders(): SandboxProvider[] {
  return [...providers.values()];
}

/** Test seam; production code never removes providers. */
export function clearSandboxProviders(): void {
  providers.clear();
}

/** Capability floor a task needs. Omitted keys mean "don't care". */
export type SandboxRequirements = Partial<
  Pick<SandboxCapabilities, 'interactiveShell' | 'fileWatch' | 'publicPreviewUrl' | 'persistentFilesystem'>
> & {
  minNetwork?: SandboxCapabilities['network'];
};

const NETWORK_RANK: Record<SandboxCapabilities['network'], number> = {
  none: 0,
  outbound: 1,
  full: 2,
};

export function satisfiesRequirements(capabilities: SandboxCapabilities, requirements: SandboxRequirements): boolean {
  const flags = ['interactiveShell', 'fileWatch', 'publicPreviewUrl', 'persistentFilesystem'] as const;

  for (const flag of flags) {
    if (requirements[flag] && !capabilities[flag]) {
      return false;
    }
  }

  if (requirements.minNetwork && NETWORK_RANK[capabilities.network] < NETWORK_RANK[requirements.minNetwork]) {
    return false;
  }

  return true;
}

/**
 * Picks the first available provider that meets the requirements, in the order
 * given by `preference`. Callers own the preference order because the right
 * answer is a user setting (local-first vs. always-remote), not a global
 * constant -- see project/ARCHITECTURE-EXECUTION.md, "Routing".
 */
export async function selectSandboxProvider(
  requirements: SandboxRequirements,
  preference: string[],
): Promise<SandboxProvider | null> {
  for (const id of preference) {
    const provider = providers.get(id);

    if (!provider || !satisfiesRequirements(provider.capabilities, requirements)) {
      continue;
    }

    if (await provider.isAvailable()) {
      return provider;
    }
  }

  return null;
}
