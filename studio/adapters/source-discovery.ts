import { readdir, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { homedir } from 'node:os';
import { assertValidManifest, permissiveLicense, provenance, unknownLicense } from '@studio/catalog/validation';
import type { AgentManifest, CatalogManifest, LicenseInfo, SkillManifest } from '@studio/catalog/types';

export interface SourceDefinition {
  id: string;
  repository: string;
  license: LicenseInfo;
  agentRoots: string[];
  skillRoots: string[];
  runtimeRoots?: string[];
}

export interface SourceInventory {
  source: SourceDefinition;
  agents: number;
  skills: number;
  runtimeModules: number;
  manifestIds: string[];
}

export interface DiscoveryResult {
  inventories: SourceInventory[];
  manifests: CatalogManifest[];
}

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    id: 'awesome-claude-code-toolkit',
    repository: 'https://github.com/rohitg00/awesome-claude-code-toolkit',
    license: permissiveLicense('Apache-2.0', 'Local checkout LICENSE at revision ebdf1d5'),
    agentRoots: ['agents'],
    skillRoots: ['skills'],
  },
  {
    id: 'awesome-claude-code-subagents',
    repository: 'https://github.com/VoltAgent/awesome-claude-code-subagents',
    license: permissiveLicense('MIT', 'Local checkout LICENSE at revision 91810b3'),
    agentRoots: ['categories'],
    skillRoots: [],
  },
  {
    id: 'learn-claude-code',
    repository: 'https://github.com/shareAI-lab/learn-claude-code',
    license: permissiveLicense('MIT', 'Local checkout LICENSE at revision 7b564c3'),
    agentRoots: [],
    skillRoots: ['skills'],
    runtimeRoots: ['agents'],
  },
  {
    id: 'awesome-claude-code',
    repository: 'https://github.com/hesreallyhim/awesome-claude-code',
    license: { spdx: 'CC-BY-NC-ND-4.0', status: 'restricted', evidence: 'Local checkout LICENSE at revision be13803' },
    agentRoots: [],
    skillRoots: [],
  },
  {
    id: 'awesome-claude-skills',
    repository: 'https://github.com/travisvn/awesome-claude-skills',
    license: unknownLicense('No LICENSE/COPYING/NOTICE found in local checkout at revision 1da55aa'),
    agentRoots: [],
    skillRoots: [],
  },
  {
    id: 'jqueryscript-awesome-claude-code',
    repository: 'https://github.com/jqueryscript/awesome-claude-code',
    license: permissiveLicense('CC0-1.0', 'Local checkout LICENSE at revision 2982de1'),
    agentRoots: [],
    skillRoots: [],
  },
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.md$|\.py$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function title(value: string): string {
  return value
    .replace(/\.md$|\.py$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function filesUnder(root: string, predicate: (path: string) => boolean): Promise<string[]> {
  if (!(await isDirectory(root))) {
    return [];
  }

  const result: string[] = [];
  const entries = (await readdir(root, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      result.push(...(await filesUnder(path, predicate)));
    } else if (predicate(path)) {
      result.push(path);
    }
  }

  return result;
}

function manifestSource(source: SourceDefinition, sourceRoot: string, filePath: string) {
  return provenance({
    sourceId: source.id,
    repository: source.repository,
    revision: source.license.evidence?.match(/revision ([a-f0-9]+)/)?.[1] ?? 'unknown',
    path: relative(sourceRoot, filePath),
  });
}

function inferDomains(filePath: string): string[] {
  const value = filePath.toLowerCase();
  const domains = new Set<string>();
  const terms: Record<string, string[]> = {
    android: ['android', 'kotlin', 'compose', 'mobile'],
    web: ['web', 'frontend', 'react', 'typescript', 'javascript'],
    security: ['security', 'audit', 'auth', 'vulnerability'],
    testing: ['test', 'qa', 'quality', 'review'],
    architecture: ['architect', 'architecture', 'api-design'],
    mcp: ['mcp', 'model-context-protocol'],
    git: ['git', 'github', 'gitlab', 'worktree'],
    performance: ['performance', 'profil', 'optimization'],
  };

  for (const [domain, matches] of Object.entries(terms)) {
    if (matches.some((match) => value.includes(match))) {
      domains.add(domain);
    }
  }

  return [...domains];
}

function inferredCapabilities(filePath: string, kind: 'agent' | 'skill'): string[] {
  const domains = inferDomains(filePath);
  const capabilities = new Set(domains);

  if (kind === 'agent') {
    capabilities.add('agent-execution');
  } else {
    capabilities.add('progressive-skill');
  }

  return [...capabilities];
}

function agentManifest(source: SourceDefinition, sourceRoot: string, filePath: string): AgentManifest {
  const file = basename(filePath);
  const domains = inferDomains(filePath);
  const capabilities = inferredCapabilities(filePath, 'agent');
  const lower = filePath.toLowerCase();
  const languages = ['kotlin', 'typescript', 'javascript', 'python'].filter((language) => lower.includes(language));
  const frameworks = ['react', 'capacitor', 'compose', 'remix'].filter((framework) => lower.includes(framework));

  return assertValidManifest({
    kind: 'agent',
    schemaVersion: 1,
    id: `${source.id}:${slug(relative(sourceRoot, filePath))}`,
    name: title(file),
    description: `Metadata-derived capability profile for ${title(file)}. Source content is not imported.`,
    capabilities,
    domains,
    languages,
    frameworks,
    task_types: ['implementation', 'analysis', 'review'],
    required_tools: [],
    compatible_skills: [],
    risk_level: domains.includes('security') ? 'high' : 'medium',
    approval_required: domains.includes('security'),
    context_requirements: {},
    source: manifestSource(source, sourceRoot, filePath),
    license: source.license,
    enabled: source.license.status === 'permissive',
  });
}

function skillManifest(source: SourceDefinition, sourceRoot: string, filePath: string): SkillManifest {
  const file = basename(filePath);
  const domains = inferDomains(filePath);

  return assertValidManifest({
    kind: 'skill',
    schemaVersion: 1,
    id: `${source.id}:${slug(relative(sourceRoot, filePath))}`,
    name: title(file),
    description: `Metadata-derived capability profile for ${title(file)}. Source content is not imported.`,
    triggers: [slug(file)],
    capabilities: inferredCapabilities(filePath, 'skill'),
    domains,
    dependencies: [],
    conflicts: [],
    risk_level: domains.includes('security') ? 'high' : 'low',
    source: manifestSource(source, sourceRoot, filePath),
    license: source.license,
    enabled: source.license.status === 'permissive',
  });
}

function runtimeModuleManifest(source: SourceDefinition, sourceRoot: string, filePath: string): AgentManifest {
  return assertValidManifest({
    kind: 'agent',
    schemaVersion: 1,
    id: `${source.id}:runtime:${slug(relative(sourceRoot, filePath))}`,
    name: title(basename(filePath)),
    description: `Metadata-only runtime capability profile for ${title(basename(filePath))}. Runtime source is not imported.`,
    capabilities: inferredCapabilities(filePath, 'agent'),
    domains: inferDomains(filePath),
    languages: ['python'],
    frameworks: [],
    task_types: ['orchestration'],
    required_tools: [],
    compatible_skills: [],
    risk_level: 'medium',
    approval_required: false,
    context_requirements: {},
    source: manifestSource(source, sourceRoot, filePath),
    license: source.license,
    enabled: source.license.status === 'permissive',
  });
}

export const DEFAULT_SOURCE_ROOT = join(homedir(), 'studio-sources');

export async function discoverSources(
  sourceRoot = DEFAULT_SOURCE_ROOT,
  definitions = SOURCE_DEFINITIONS,
): Promise<DiscoveryResult> {
  const inventories: SourceInventory[] = [];
  const manifests: CatalogManifest[] = [];

  for (const source of definitions) {
    const sourcePath = join(sourceRoot, source.id);
    const agentFiles = (
      await Promise.all(
        source.agentRoots.map((root) =>
          filesUnder(join(sourcePath, root), (file) => /\.md$/i.test(file) && !/README\.md$/i.test(file)),
        ),
      )
    ).flat();
    const skillFiles = (
      await Promise.all(
        source.skillRoots.map((root) => filesUnder(join(sourcePath, root), (file) => /SKILL\.md$/i.test(file))),
      )
    ).flat();
    const runtimeFiles = (
      await Promise.all(
        (source.runtimeRoots ?? []).map((root) =>
          filesUnder(join(sourcePath, root), (file) => /\.py$/i.test(file) && !/\/__init__\.py$/i.test(file)),
        ),
      )
    ).flat();

    const sourceManifests = [
      ...agentFiles.map((file) => agentManifest(source, sourcePath, file)),
      ...skillFiles.map((file) => skillManifest(source, sourcePath, file)),
      ...runtimeFiles.map((file) => runtimeModuleManifest(source, sourcePath, file)),
    ];

    const ids = sourceManifests.map((manifest) => manifest.id);

    if (new Set(ids).size !== ids.length) {
      throw new Error(`Duplicate manifest id discovered in ${source.id}`);
    }

    manifests.push(...sourceManifests);
    inventories.push({
      source,
      agents: agentFiles.length + runtimeFiles.length,
      skills: skillFiles.length,
      runtimeModules: runtimeFiles.length,
      manifestIds: sourceManifests.map((manifest) => manifest.id),
    });
  }

  return { inventories, manifests };
}

export { SOURCE_DEFINITIONS };
