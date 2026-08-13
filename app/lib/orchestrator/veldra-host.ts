import type { OrchestratorHost, ApprovalPort, ApprovalRequest, ApprovalResponse, PolicyGate } from './adapters';
import { VeldraAgentRunner } from './veldra-agent-runner';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('veldra-orchestrator-host');

/**
 * VELDRA's implementation of the OrchestratorHost interface.
 *
 * This provides a bridge between VELDRA's product layer (SubagentService,
 * MCPService, UI stores) and the portable orchestrator core.
 *
 * **Current Status**: Minimal viable implementation
 * - agents: ✅ Fully functional via VeldraAgentRunner
 * - approvals: ⚠️ Stub (always approves, logs to console)
 * - policy: ⚠️ Stub (always allows, logs checks)
 * - runs: ❌ Not implemented (no persistence yet)
 * - models: ❌ Not implemented (no catalog yet)
 * - capabilities: ❌ Not implemented (no resolver yet)
 *
 * **Future Enhancements**:
 * 1. ApprovalPort: Wire to VELDRA UI confirmation dialogs
 * 2. PolicyGate: Integrate with settings/permissions system
 * 3. RunStore: Persist to localStorage or IndexedDB
 * 4. ModelCatalog: Export from LLMManager
 * 5. CapabilityResolver: Build from provider metadata
 */
export class VeldraOrchestratorHost implements OrchestratorHost {
  readonly id = 'veldra-app' as const;

  readonly agents: VeldraAgentRunner;
  readonly approvals: ApprovalPort;
  readonly policy: PolicyGate;

  // Optional ports (undefined for now, can be added later)
  readonly runs = undefined;
  readonly models = undefined;
  readonly capabilities = undefined;

  private static _instance: VeldraOrchestratorHost | null = null;

  private constructor(apiKeys?: any, providerSettings?: any) {
    logger.info('Initializing VELDRA Orchestrator Host');

    // Agent runner - fully functional
    this.agents = new VeldraAgentRunner(apiKeys, providerSettings);

    // Approval port - stub implementation
    this.approvals = this._createApprovalStub();

    // Policy gate - stub implementation
    this.policy = this._createPolicyStub();

    logger.info('VELDRA Orchestrator Host initialized successfully');
  }

  /**
   * Get or create the singleton instance.
   *
   * @param apiKeys - API keys for LLM providers
   * @param providerSettings - Provider-specific settings
   * @returns The singleton VeldraOrchestratorHost instance
   */
  static getInstance(apiKeys?: any, providerSettings?: any): VeldraOrchestratorHost {
    if (!VeldraOrchestratorHost._instance) {
      VeldraOrchestratorHost._instance = new VeldraOrchestratorHost(apiKeys, providerSettings);
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

  /**
   * Stub approval port - always approves with logging.
   *
   * TODO: Wire to VELDRA UI confirmation system
   * - Modal dialogs for user approval
   * - Store approval history
   * - Timeout handling
   */
  private _createApprovalStub(): ApprovalPort {
    return {
      async request(approval: ApprovalRequest): Promise<ApprovalResponse> {
        logger.warn('Approval requested (auto-approved in stub mode)', {
          kind: approval.kind,
          question: approval.question,
        });

        // Auto-approve first option (temporary behavior)
        const chosen = approval.options[0] || 'approve';

        return {
          requestId: approval.id,
          chosen,
          note: 'Auto-approved by stub (UI integration pending)',
          respondedAt: Date.now(),
        };
      },
    };
  }

  /**
   * Stub policy gate - always allows with logging.
   *
   * TODO: Wire to VELDRA settings/permissions
   * - Check user tier/plan
   * - Check feature flags
   * - Check provider allow-lists
   * - Check budget limits
   */
  private _createPolicyStub(): PolicyGate {
    return {
      async check(capability: string, context?: Record<string, unknown>): Promise<string | null> {
        logger.debug('Policy check requested (auto-allowed in stub mode)', {
          capability,
          context,
        });

        // Always allow (temporary behavior)
        return null;
      },
    };
  }
}

/**
 * Convenience function to get the orchestrator host instance.
 *
 * Usage:
 *   const host = getVeldraHost(apiKeys, providerSettings);
 *   const results = await host.agents.run(invocations, maxConcurrency);
 */
export function getVeldraHost(apiKeys?: any, providerSettings?: any): VeldraOrchestratorHost {
  return VeldraOrchestratorHost.getInstance(apiKeys, providerSettings);
}
