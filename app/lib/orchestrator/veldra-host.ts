import type { OrchestratorHost, PolicyGate, RunStore } from './adapters';
import { VeldraAgentRunner } from './veldra-agent-runner';
import { createVeldraApprovalPort, type VeldraApprovalPort } from './veldra-approvals';
import { createVeldraPolicyGate } from './veldra-policy';
import { createIndexedDBRunStore } from '~/lib/persistence/orchestratorRunStore';
import { entitlementTierStore } from '~/lib/stores/entitlement';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('veldra-orchestrator-host');

/**
 * VELDRA's implementation of the OrchestratorHost interface.
 *
 * This provides a bridge between VELDRA's product layer (SubagentService,
 * MCPService, UI stores) and the portable orchestrator core.
 *
 * **Current Status** (2026-08-15):
 * - agents: ✅ Fully functional via VeldraAgentRunner
 * - approvals: ✅ Real handoff (veldra-approvals.ts) -- request() genuinely suspends
 *   until something calls respond(); no UI wired to it yet (see pendingApprovalsStore)
 * - policy: ✅ Real entitlement-tier gate (veldra-policy.ts) -- client-side only, not a
 *   security boundary; see that file's doc comment
 * - runs: ✅ Wired to the existing IndexedDB-backed store (orchestratorRunStore.ts),
 *   when a db handle is supplied -- degrades to undefined (a still-valid host per
 *   OrchestratorHost's own contract) when it isn't
 * - models: ❌ Not implemented (no catalog yet)
 * - capabilities: ❌ Not implemented (no resolver yet)
 */
export class VeldraOrchestratorHost implements OrchestratorHost {
  readonly id = 'veldra-app' as const;

  readonly agents: VeldraAgentRunner;
  readonly approvals: VeldraApprovalPort;
  readonly policy: PolicyGate;
  readonly runs: RunStore | undefined;
  readonly models = undefined;
  readonly capabilities = undefined;

  private static _instance: VeldraOrchestratorHost | null = null;

  private constructor(apiKeys?: any, providerSettings?: any, db?: IDBDatabase) {
    logger.info('Initializing VELDRA Orchestrator Host');

    this.agents = new VeldraAgentRunner(apiKeys, providerSettings);
    this.approvals = createVeldraApprovalPort();
    this.policy = createVeldraPolicyGate(() => entitlementTierStore.get());
    this.runs = createIndexedDBRunStore(db);

    logger.info('VELDRA Orchestrator Host initialized successfully');
  }

  /**
   * Get or create the singleton instance.
   *
   * @param apiKeys - API keys for LLM providers
   * @param providerSettings - Provider-specific settings
   * @param db - Already-opened IndexedDB handle to back the RunStore (e.g.
   *   `~/lib/persistence/useChatHistory`'s `db` export). Omit to get a host whose
   *   `runs` port is a safe no-op -- still a valid host, it just can't persist/resume.
   * @returns The singleton VeldraOrchestratorHost instance
   */
  static getInstance(apiKeys?: any, providerSettings?: any, db?: IDBDatabase): VeldraOrchestratorHost {
    if (!VeldraOrchestratorHost._instance) {
      VeldraOrchestratorHost._instance = new VeldraOrchestratorHost(apiKeys, providerSettings, db);
    }

    return VeldraOrchestratorHost._instance;
  }

  /**
   * Reset the singleton instance (useful for testing or credential updates).
   */
  static resetInstance(): void {
    VeldraOrchestratorHost._instance = null;
    logger.info('VELDRA Orchestrator Host instance reset');
  }

  /**
   * Update credentials without recreating the entire host.
   *
   * @param apiKeys - New API keys
   * @param providerSettings - New provider settings
   */
  updateCredentials(apiKeys: any, providerSettings: any): void {
    logger.info('Updating orchestrator credentials');

    // Recreate agent runner with new credentials
    (this as any).agents = new VeldraAgentRunner(apiKeys, providerSettings);
  }
}

/**
 * Convenience function to get the orchestrator host instance.
 *
 * Usage:
 *   const host = getVeldraHost(apiKeys, providerSettings, db);
 *   const results = await host.agents.run(invocations, maxConcurrency);
 */
export function getVeldraHost(apiKeys?: any, providerSettings?: any, db?: IDBDatabase): VeldraOrchestratorHost {
  return VeldraOrchestratorHost.getInstance(apiKeys, providerSettings, db);
}
