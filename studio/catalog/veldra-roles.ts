import type { AgentManifest } from '@studio/catalog/types';
import { permissiveLicense, provenance } from '@studio/catalog/validation';

const source = provenance({
  sourceId: 'veldra-core',
  repository: 'local://veldra',
  revision: 'foundation-1',
  path: 'studio/catalog/veldra-roles.ts',
  importedAs: 'internal',
});
const license = permissiveLicense('MIT', 'Project-owned Veldra role metadata');

const role = (
  id: string,
  name: string,
  description: string,
  capabilities: string[],
  taskTypes: string[],
  risk: AgentManifest['risk_level'] = 'low',
): AgentManifest => ({
  kind: 'agent',
  schemaVersion: 1,
  id,
  name,
  description,
  capabilities,
  domains: ['engineering-studio'],
  languages: ['typescript'],
  frameworks: [],
  task_types: taskTypes,
  required_tools: [],
  compatible_skills: [],
  risk_level: risk,
  approval_required: risk === 'high' || risk === 'critical',
  context_requirements: {},
  source,
  license,
  enabled: true,
});

export const veldraFoundationAgents: AgentManifest[] = [
  role(
    'product-director',
    'Product Director',
    'Escalates product and irreversible decisions to the Product Owner.',
    ['planning', 'approval-gate'],
    ['planning'],
    'high',
  ),
  role(
    'architecture-agent',
    'Architecture Agent',
    'Checks compatibility with Veldra and existing project boundaries.',
    ['architecture', 'review'],
    ['analysis', 'review'],
  ),
  role(
    'research-agent',
    'Research Agent',
    'Collects bounded evidence and records provenance before implementation.',
    ['research', 'provenance'],
    ['research'],
  ),
  role(
    'implementation-agent',
    'Implementation Agent',
    'Implements a narrowly scoped approved engineering change.',
    ['implementation', 'coding'],
    ['implementation'],
  ),
  role(
    'testing-agent',
    'Testing Agent',
    'Designs and executes relevant automated checks.',
    ['testing', 'verification'],
    ['testing'],
  ),
  role(
    'security-agent',
    'Security Agent',
    'Reviews trust boundaries, secrets, permissions and unsafe execution.',
    ['security', 'mcp'],
    ['review'],
    'high',
  ),
  role(
    'verification-agent',
    'Verification Agent',
    'Checks acceptance criteria and evidence independently.',
    ['verification', 'quality'],
    ['verification'],
  ),
  role(
    'documentation-agent',
    'Documentation Agent',
    'Persists state, decisions, risks and handoff information.',
    ['documentation', 'status'],
    ['documentation'],
  ),
];
