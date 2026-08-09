export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type LicenseStatus = 'permissive' | 'copyleft' | 'restricted' | 'unknown' | 'internal';
export type ContentAvailability = 'available' | 'metadata-only' | 'blocked' | 'missing';

export interface LicenseInfo {
  spdx: string;
  status: LicenseStatus;
  evidence?: string;
  noticeRequired?: boolean;
}

export interface Provenance {
  sourceId: string;
  repository: string;
  revision: string;
  path: string;
  importedAs: 'metadata' | 'pattern-derived' | 'internal';
}

export interface ContextRequirements {
  estimatedTokens?: number;
  requiredFiles?: string[];
  requiredArtifacts?: string[];
}

export interface AgentManifest {
  kind: 'agent';
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  domains: string[];
  languages: string[];
  frameworks: string[];
  task_types: string[];
  required_tools: string[];
  compatible_skills: string[];
  risk_level: RiskLevel;
  approval_required: boolean;
  context_requirements: ContextRequirements;
  source: Provenance;
  license: LicenseInfo;
  enabled: boolean;
}

export interface SkillManifest {
  kind: 'skill';
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  triggers: string[];
  capabilities: string[];
  domains: string[];
  dependencies: string[];
  conflicts: string[];
  risk_level: RiskLevel;
  source: Provenance;
  license: LicenseInfo;
  enabled: boolean;
}

export type CatalogManifest = AgentManifest | SkillManifest;

export interface CapabilityIndexEntry {
  id: string;
  name: string;
  type: 'agent' | 'skill';
  domain: string[];
  capabilities: string[];
  languages: string[];
  frameworks: string[];
  tools: string[];
  riskLevel: RiskLevel;
  requiredApproval: boolean;
  dependencies: string[];
  sourceRepository: string;
  revision: string;
  license: LicenseInfo;
  provenance: Provenance;
  localPath: string;
  contentAvailability: ContentAvailability;
  enabled: boolean;
  relevance: {
    keywords: string[];
    priority: number;
  };
}

export interface CapabilityIndex {
  schemaVersion: 1;
  generatedAt: string;
  entries: CapabilityIndexEntry[];
}

export interface CapabilityRequest {
  task: string;
  goal?: string;
  projectState?: string;
  relevantFiles?: string[];
  domain?: string;
  language?: string;
  frameworks?: string[];
  task_types?: string[];
  capabilities?: string[];
  required_tools?: string[];
  model_capabilities?: string[];
  budget?: number;
  context_budget?: number;
  risk?: RiskLevel;
  context_tokens?: number;
  approvalGranted?: boolean;
}

export interface RoutingPolicy {
  maxRisk: RiskLevel;
  allowedTools: string[];
  maxAgents: number;
  maxSkills: number;
  allowDisabled?: boolean;
}

export interface RoutingReason {
  id: string;
  kind: 'agent' | 'skill' | 'policy' | 'dependency';
  score?: number;
  selected: boolean;
  message: string;
}

export interface RoutingResult {
  selected_agents: string[];
  selected_skills: string[];
  executable_agents: string[];
  blocked_agents: string[];
  rejected_agents?: Array<{ id: string; reason: string }>;
  required_tools?: string[];
  estimated_context_cost?: number;
  reasons: RoutingReason[];
  inferred_capabilities: string[];
  policy: {
    passed: boolean;
    approval_required: string[];
    excluded: string[];
  };
}

export interface SkillResolution {
  orderedSkills: SkillManifest[];
  excluded: Array<{ id: string; reason: string }>;
}
