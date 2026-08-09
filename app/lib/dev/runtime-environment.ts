import type { RuntimeEnvironment } from '~/lib/orchestrator/entitlement';

/**
 * Vite adapter for the orchestrator's runtime-environment concept: reads
 * import.meta.env.MODE once, here, so the orchestrator core itself never
 * depends on a bundler global (see entitlement.ts). MODE is 'development'
 * under `pnpm dev`, 'production' in a built app (web, Electron and Capacitor
 * all build through Vite), and 'test' under Vitest by default.
 */
export function getRuntimeEnvironment(): RuntimeEnvironment {
  const mode = import.meta.env.MODE;

  if (mode === 'production') {
    return 'production';
  }

  if (mode === 'test') {
    return 'test';
  }

  return 'development';
}
