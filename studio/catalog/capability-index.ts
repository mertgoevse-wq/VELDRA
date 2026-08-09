import type {
  AgentManifest,
  CapabilityIndex,
  CapabilityIndexEntry,
  CatalogManifest,
  SkillManifest,
} from '@studio/catalog/types';

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))].sort();
}

function keywords(manifest: CatalogManifest): string[] {
  return unique([
    manifest.id,
    manifest.name,
    ...manifest.capabilities,
    ...manifest.domains,
    ...(manifest.kind === 'agent' ? manifest.languages : manifest.triggers),
  ]);
}

function toEntry(manifest: CatalogManifest): CapabilityIndexEntry {
  const agent = manifest.kind === 'agent' ? (manifest as AgentManifest) : undefined;
  const skill = manifest.kind === 'skill' ? (manifest as SkillManifest) : undefined;

  return {
    id: manifest.id,
    name: manifest.name,
    type: manifest.kind,
    domain: [...manifest.domains].sort(),
    capabilities: [...manifest.capabilities].sort(),
    languages: agent ? [...agent.languages].sort() : [],
    frameworks: agent ? [...agent.frameworks].sort() : [],
    tools: agent ? [...agent.required_tools].sort() : [],
    riskLevel: manifest.risk_level,
    requiredApproval:
      agent?.approval_required ?? (manifest.risk_level === 'high' || manifest.risk_level === 'critical'),
    dependencies: skill ? [...skill.dependencies].sort() : [],
    sourceRepository: manifest.source.repository,
    revision: manifest.source.revision,
    license: manifest.license,
    provenance: manifest.source,
    localPath: manifest.source.path,
    contentAvailability: manifest.enabled && manifest.license.status === 'permissive' ? 'metadata-only' : 'blocked',
    enabled: manifest.enabled,
    relevance: {
      keywords: keywords(manifest),
      priority: manifest.enabled ? 1 : 0,
    },
  };
}

export function buildCapabilityIndex(
  manifests: CatalogManifest[],
  generatedAt = '1970-01-01T00:00:00.000Z',
): CapabilityIndex {
  const entries = manifests.map(toEntry).sort((left, right) => left.id.localeCompare(right.id));
  const ids = new Set<string>();

  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate capability index id: ${entry.id}`);
    }

    ids.add(entry.id);
  }

  return { schemaVersion: 1, generatedAt, entries };
}

export function indexManifests(index: CapabilityIndex): Map<string, CapabilityIndexEntry> {
  return new Map(index.entries.map((entry) => [entry.id, entry]));
}
