import type { ApprovalRequest, ApprovalResponse, Evidence, PolicyGate } from './types';
import type { CapabilityResolver, ModelCapabilities } from './registries';

// Re-export types needed by host implementations
export type { ApprovalRequest, ApprovalResponse, PolicyGate, Evidence } from './types';
export type { CapabilityResolver, ModelCapabilities } from './registries';

/**
 * Ports the core needs from whatever host it runs in.
 *
 * The core calls these; it never imports a host. Claude Code, Freebuff and the
 * Veldra app each supply an implementation, which is what lets the same
 * orchestrator run in all three without a fork.
 */

/** One unit of work handed to whatever can actually run a model. */
export interface AgentInvocation {
  /** Role the host should adopt, e.g. 'security-reviewer'. Hosts may map this to their own agent types. */
  role: string;

  prompt: string;

  /** Model the router picked. Hosts may substitute and must report it if they do. */
  requestedModel?: string;

  /** Hard ceiling for this single invocation, independent of the workflow budget. */
  maxTokens?: number;
}

export interface AgentResult {
  role: string;

  output: string;

  /** What the host actually used, which may differ from requestedModel. */
  usedModel?: string;

  tokensIn?: number;
  tokensOut?: number;
  costMinor?: number;

  /** Artifacts the invocation produced; the core will not treat claims as verified without these. */
  evidence: Evidence[];
}

/**
 * The host's ability to run work. Deliberately narrow: the core does not care
 * whether the host spawns real subagents, queues them, or runs them serially --
 * only that concurrency is respected and results come back.
 */
export interface AgentRunner {
  /**
   * Runs invocations, honouring maxConcurrency. Hosts that cannot parallelise
   * must still honour the contract by running serially rather than failing.
   */
  run(invocations: AgentInvocation[], maxConcurrency: number): Promise<AgentResult[]>;
}

/** How the core asks a human something. Hosts render this however they like. */
export interface ApprovalPort {
  request(approval: ApprovalRequest): Promise<ApprovalResponse>;
}

/** Where the core persists a run so it survives a restart or a lost connection. */
export interface RunStore {
  save(runId: string, serialized: string): Promise<void>;
  load(runId: string): Promise<string | null>;
  list(): Promise<string[]>;
}

/** Optional: hosts that know model metadata supply it; others return nothing. */
export interface ModelCatalog {
  list(): Promise<ModelCapabilities[]>;
}

/**
 * Everything a host must provide. Only agents, approvals and policy are
 * mandatory -- a host that cannot persist runs or enumerate models is still a
 * valid host, it just loses resume and automatic model routing.
 */
export interface OrchestratorHost {
  id: 'claude-code' | 'freebuff' | 'veldra-app';

  agents: AgentRunner;
  approvals: ApprovalPort;
  policy: PolicyGate;

  runs?: RunStore;
  models?: ModelCatalog;
  capabilities?: CapabilityResolver;
}
