import type { VerificationRequirement } from './types';

/**
 * Registries the orchestrator routes over. All of them are catalogues of
 * metadata, not of content: resolving an entry to its actual text or code is a
 * separate, permission-checked step (see CapabilitySource below).
 */

/* == Prompt patterns == */

/**
 * How a pattern may be used, decided by its licence. Anything without a clear,
 * permissive licence stays research-only: its shape may inform our own writing,
 * its text may never enter the product (project/DECISIONS.md D-5).
 */
export type PatternUsage = 'product' | 'research-only';

export interface PromptPattern {
  patternId: string;
  category: string;

  /** What problem this pattern solves, in one sentence. */
  purpose: string;

  /** Context keys the pattern needs supplied before it can be specialised. */
  requiredContext: string[];

  suitableTasks: string[];
  incompatibleTasks: string[];
  expectedOutput: string;

  /** Rough added token cost when applied; used by the context optimizer. */
  tokenCost: number;

  /** 0..1, derived from observed outcomes, not from the source's own claim. */
  reliability: number;

  /** Where it came from: URL, repo, or 'original' for patterns we wrote. */
  provenance: string;

  /** SPDX identifier, or 'unknown'. 'unknown' forces usage to 'research-only'. */
  license: string;

  usage: PatternUsage;

  revision: number;

  /** Known failure modes or misuse risks, e.g. tends to over-generate. */
  risk: string;

  /** Empty array means "no known restriction", not "verified everywhere". */
  supportedModels: string[];
  supportedAgents: string[];
  supportedMethods: string[];
}

/* == Engineering methods == */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface MethodStage {
  id: string;
  description: string;

  /** Whether this stage may run subagents in parallel. */
  parallelizable: boolean;
}

/**
 * A declarative engineering method (TDD, gauntlet, security review, ...).
 * Declarative so the user can pick one, and so new methods do not require
 * touching the orchestrator.
 */
export interface MethodDefinition {
  id: string;
  label: string;
  stages: MethodStage[];

  /** Capability names the method cannot run without. */
  requiredCapabilities: string[];

  recommendedAgents: string[];
  recommendedSkills: string[];

  verificationRequirements: VerificationRequirement[];

  maxIterations: number;
  riskLevel: RiskLevel;

  /** Approval kinds this method always gates on, regardless of user settings. */
  approvalRequirements: string[];
}

/* == Model capabilities == */

export type Modality = 'text' | 'code' | 'image' | 'audio' | 'video';

/** Where a model is in its lifecycle. Absent means unknown, never assume 'current'. */
export type ModelStatus = 'current' | 'preview' | 'deprecated' | 'retired';

/**
 * Reasoning here means a provider-controlled effort/depth knob (e.g. Anthropic's
 * `effort`, OpenAI's `reasoning_effort`), not the ability to see raw chain-of-thought --
 * this project does not attempt to extract or fabricate hidden reasoning (project/DECISIONS.md).
 */
export interface ReasoningCapability {
  supported: boolean;

  /** Caller can turn reasoning on/off or pick a level; false/undefined means the provider decides. */
  configurable?: boolean;

  /** Discrete levels the provider exposes, in the provider's own vocabulary, e.g. ['low','medium','high']. */
  levels?: string[];

  /** Provider accepts a numeric token budget for reasoning (e.g. Anthropic's legacy budget_tokens). */
  budgetTokens?: boolean;
}

/**
 * Whether a model's reasoning process is visible at all, distinct from ReasoningCapability's
 * effort control. A provider may support reasoning without exposing any thinking content, in
 * which case only a generic "reasoning active" status is shown -- never a fabricated summary.
 */
export interface ThinkingCapability {
  supported: boolean;

  /** Thinking/reasoning delta events arrive incrementally rather than only at completion. */
  streamed?: boolean;

  /** Provider exposes a redacted/summarized thinking trace, not raw internal chain-of-thought. */
  visibleSummary?: boolean;
}

/**
 * Technically-scoped, non-marketing description for surfacing in a model picker.
 * Every field is a short technical judgment, not copied provider marketing copy.
 */
export interface ModelDescription {
  summary: string;
  bestFor: string[];
  notIdealFor: string[];
  strengths: string[];
  limitations: string[];
  tags: string[];
}

/**
 * Routing metadata for one model.
 *
 * Deliberately a separate overlay rather than an extension of ModelInfo in
 * app/lib/modules/llm/types.ts: that type is implemented by 22 providers, and
 * widening it would force every one of them to supply data they do not have --
 * which in practice means inventing it. Absence here means "unknown", and the
 * UI must show unknown as unknown (project/PRODUCT-VISION.md).
 */
export interface ModelCapabilities {
  provider: string;
  model: string;

  /** Human-readable name, distinct from the API model id in `model`. */
  displayName?: string;

  /** Model family/line, e.g. 'claude', 'gemini' -- for grouping, not routing. */
  family?: string;
  version?: string;
  status?: ModelStatus;

  /** ISO date strings; undefined means not published by the provider. */
  releaseDate?: string;
  deprecationDate?: string;

  modalities: Modality[];

  /** Output modalities beyond text, e.g. ['image'] for an image-generation model. Undefined means text-only or unknown. */
  outputModalities?: Modality[];

  contextWindow: number;
  maxOutputTokens?: number;

  vision?: boolean;
  imageGeneration?: boolean;
  streaming?: boolean;
  toolUse?: boolean;
  structuredOutput?: boolean;

  reasoning?: ReasoningCapability;
  thinking?: ThinkingCapability;

  /** 0..1 relative score. Undefined means unmeasured, never assume a default. */
  coding?: number;

  /** Median time to first token, ms. */
  latencyMs?: number;

  costPerMTokenInMinor?: number;
  costPerMTokenOutMinor?: number;
  cachedInputCostPerMTokenMinor?: number;

  rateLimits?: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
  };

  /** Regions/endpoints this model is confirmed available through, e.g. ['us','eu']. Undefined means unrestricted or unknown. */
  regionAvailability?: string[];

  /** Runs without a network call, e.g. on-device or LAN. */
  localAvailability?: boolean;

  /** Accelerator backends this model is known to run on locally. */
  accelerators?: string[];

  reliability?: number;

  /** Free-form benchmark references; never used as the sole routing input. */
  benchmarks?: Record<string, number>;

  description?: ModelDescription;

  /** When these facts were last checked. Stale data is a routing hazard. */
  lastVerified: number;

  availability: 'available' | 'degraded' | 'unavailable' | 'unknown';
}

/* == Capability sources (external agent/skill/prompt repositories) == */

/**
 * Lifecycle for anything discovered from outside. Nothing is ever used straight
 * from 'discovered': a source must be verified and catalogued, and a human must
 * enable it. Auto-enabling unknown providers or unvetted agent content is
 * exactly the supply-chain risk we are trying not to build.
 */
export type DiscoveryState = 'discovered' | 'verified' | 'cataloged' | 'optional' | 'enabled';

export type CapabilityKind = 'agent' | 'skill' | 'prompt-pattern' | 'method' | 'connector' | 'mcp-server';

/**
 * An external repository of engineering capabilities, catalogued by reference.
 * Cataloguing records where something is and what it is licensed as; it does
 * not copy the content into this repository.
 */
export interface CapabilitySource {
  id: string;
  label: string;

  /** Repo URL or local path. Local paths only resolve on the host that has them. */
  location: string;

  license: string;
  provenance: string;

  state: DiscoveryState;

  provides: CapabilityKind[];

  /** False when the licence forbids shipping its content inside the product. */
  usableInProduct: boolean;

  lastVerified: number;
}

export interface CapabilityEntry {
  id: string;
  sourceId: string;
  kind: CapabilityKind;
  label: string;

  /** Path within the source; resolved lazily, only when actually used. */
  path: string;
}

/**
 * Loading external capability content is separated from cataloguing it so that
 * a policy check sits between "we know this exists" and "we are running it".
 */
export interface CapabilityResolver {
  listSources(): Promise<CapabilitySource[]>;
  listEntries(sourceId: string): Promise<CapabilityEntry[]>;

  /**
   * Returns the entry's content, or null when policy or licence forbids it.
   * Null is a legitimate answer and callers must handle it without failing.
   */
  load(entryId: string): Promise<string | null>;
}

/* == Connectors (live external services: GitHub, Supabase, Vercel, an MCP server, ...) == */

/**
 * Whether a connector is currently reachable and authenticated. Distinct from DiscoveryState:
 * DiscoveryState is a one-directional trust/vetting pipeline (a connector, once 'enabled', stays
 * vetted), while ConnectionStatus is the connector's live, freely-changing runtime state -- a
 * connector can be DiscoveryState='enabled' (trusted, catalogued, the user opted in) while its
 * ConnectionStatus is 'disconnected' because credentials expired or were never supplied.
 */
export type ConnectionStatus = 'not-configured' | 'connecting' | 'connected' | 'error' | 'disconnected';

export type CredentialKind = 'api-key' | 'oauth' | 'personal-access-token' | 'none';

export interface RequiredCredential {
  kind: CredentialKind;
  label: string;

  /** Where the user gets this credential from, e.g. a docs URL. Never a prefilled/default value. */
  obtainUrl?: string;
}

/**
 * A declared, non-enforced permission scope a connector asks for, e.g. 'repo:read'. Enforcement
 * (sandboxing, network/filesystem restriction) is a separate, later concern -- this is only the
 * declaration surface an enforcement layer will eventually check against.
 */
export interface ConnectorPermission {
  scope: string;
  description: string;
  required: boolean;
}

/** Free-form because providers structure limits differently; absent means unknown, never fabricated. */
export interface ConnectorPricingNote {
  summary: string;
  sourceUrl?: string;
}

/**
 * Metadata for one connector: a live external service integration (GitHub, Supabase, Vercel,
 * Figma, a Google service, Cloudflare, AWS, a local OpenAI-compatible server, an MCP server, ...).
 * A connector is catalogued through the same CapabilitySource/DiscoveryState pipeline as any other
 * capability (kind='connector' or kind='mcp-server') -- this type holds the extra detail a live
 * service integration needs that a content source (a skill/agent/prompt-pattern repository) does
 * not: credentials, a permission scope, and live connection state.
 *
 * "Install" = a CapabilitySource for this connector exists and is 'cataloged'/'optional'.
 * "Configure" = requiredCredentials are supplied (host-specific, not modelled here).
 * "Enable"/"Disable" = the isEnabled toggle below -- deliberately independent of DiscoveryState,
 * so switching a connector off is a reversible user action, not a re-run of the trust pipeline.
 * "Remove" = deleting this entry and its CapabilitySource; not a distinct state.
 */
export interface ConnectorDefinition {
  id: string;
  sourceId: string;

  name: string;
  description: string;

  /** What this connector actually lets VELDRA do, in the user's terms, e.g. 'read repositories'. */
  capabilities: string[];

  requiredCredentials: RequiredCredential[];
  permissions: ConnectorPermission[];

  /** User's current on/off choice. See the type doc comment above for why this isn't DiscoveryState. */
  isEnabled: boolean;

  connectionStatus: ConnectionStatus;

  /** Short, user-facing setup steps; link to setupDocsUrl for the full guide rather than duplicating it. */
  setupInstructions: string[];
  setupDocsUrl?: string;

  pricing?: ConnectorPricingNote;

  /** Free-form security notes shown before connecting, e.g. 'credentials stored locally only'. */
  securityNotes: string[];

  /** Populated only after a real connection attempt; undefined means never tested, not "working". */
  lastConnectionCheckedAt?: number;
  lastConnectionError?: string;
}
