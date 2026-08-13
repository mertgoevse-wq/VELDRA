/**
 * Workbench configuration constants.
 *
 * Centralizes timing, limits, and behavior configuration for the workbench store.
 * All values are runtime-configurable for testing and tuning.
 */

export interface WorkbenchConfig {
  /** Debounce interval (ms) for action stream sampling to reduce redundant executions */
  actionStreamSampleIntervalMs: number;

  /** Maximum actions that can run concurrently per artifact */
  maxConcurrentActionsPerArtifact: number;

  /** Timeout (ms) for action completion before considering it stalled */
  actionTimeoutMs: number;
}

/**
 * Default workbench configuration.
 *
 * Production values tuned for responsiveness without overwhelming the runtime.
 */
export const DEFAULT_WORKBENCH_CONFIG: WorkbenchConfig = {
  // 100ms debounce: responsive enough for streaming, reduces redundant work
  actionStreamSampleIntervalMs: 100,

  // Allow 1 action per artifact to prevent race conditions
  maxConcurrentActionsPerArtifact: 1,

  // 5 minute timeout: enough for complex builds, catches truly stalled actions
  actionTimeoutMs: 300_000,
};

/**
 * Test configuration with faster timings for unit tests.
 */
export const TEST_WORKBENCH_CONFIG: WorkbenchConfig = {
  actionStreamSampleIntervalMs: 10,
  maxConcurrentActionsPerArtifact: 1,
  actionTimeoutMs: 5_000,
};

let currentConfig: WorkbenchConfig = { ...DEFAULT_WORKBENCH_CONFIG };

/**
 * Get current workbench configuration.
 */
export function getWorkbenchConfig(): Readonly<WorkbenchConfig> {
  return currentConfig;
}

/**
 * Update workbench configuration (for testing or runtime tuning).
 *
 * @param partial - Partial configuration to merge with current
 */
export function setWorkbenchConfig(partial: Partial<WorkbenchConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
}

/**
 * Reset workbench configuration to defaults.
 */
export function resetWorkbenchConfig(): void {
  currentConfig = { ...DEFAULT_WORKBENCH_CONFIG };
}
