import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverSources } from '@studio/adapters/source-discovery';
import { veldraEngineeringAgents, veldraEngineeringSkills } from '@studio/catalog/examples/veldra-engineering';
import { assertValidManifest, validateManifest } from '@studio/catalog/validation';
import type { AgentManifest, RoutingPolicy, SkillManifest } from '@studio/catalog/types';
import { routeCapabilities } from '@studio/orchestration/capability-router';
import { resolveSkills } from '@studio/orchestration/skill-resolver';

const policy: RoutingPolicy = {
  maxRisk: 'medium',
  allowedTools: ['filesystem', 'git', 'testing'],
  maxAgents: 3,
  maxSkills: 5,
};

function minimalAgent(overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    ...veldraEngineeringAgents[0],
    ...overrides,
  };
}

function minimalSkill(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    ...veldraEngineeringSkills[0],
    ...overrides,
  };
}

describe('studio catalog foundation', () => {
  it('validates required manifest fields and rejects malformed manifests', () => {
    expect(validateManifest({ kind: 'agent', schemaVersion: 1 })).toContain('id must be a non-empty string');
    expect(() => assertValidManifest(veldraEngineeringAgents[0])).not.toThrow();
  });

  it('discovers agents, skills, runtime modules, and preserves provenance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-discovery-'));
    await mkdir(join(root, 'fixture', 'agents'), { recursive: true });
    await mkdir(join(root, 'fixture', 'skills', 'demo'), { recursive: true });
    await writeFile(join(root, 'fixture', 'agents', 'android-specialist.md'), '# Android Specialist');
    await writeFile(join(root, 'fixture', 'skills', 'demo', 'SKILL.md'), '# Testing');

    const result = await discoverSources(root, [
      {
        id: 'fixture',
        repository: 'https://example.test/fixture',
        license: { spdx: 'MIT', status: 'permissive', evidence: 'fixture revision abc1234' },
        agentRoots: ['agents'],
        skillRoots: ['skills'],
      },
    ]);

    expect(result.inventories[0]).toMatchObject({ agents: 1, skills: 1, runtimeModules: 0 });
    expect(result.manifests).toHaveLength(2);
    expect(result.manifests.every((manifest) => manifest.source.sourceId === 'fixture')).toBe(true);
    expect(result.manifests.map((manifest) => manifest.license.spdx)).toEqual(['MIT', 'MIT']);
    expect(result.manifests.every((manifest) => manifest.source.importedAs === 'metadata')).toBe(true);
  });

  it('routes the Android task deterministically and excludes disabled/unrelated agents', () => {
    const request = {
      task: 'Analyze the current Veldra Android architecture and implement a native Android function',
      domain: 'android',
      language: 'kotlin',
      required_tools: ['filesystem', 'git', 'testing'],
      risk: 'medium' as const,
    };

    const first = routeCapabilities(request, veldraEngineeringAgents, veldraEngineeringSkills, policy);
    const second = routeCapabilities(
      request,
      [...veldraEngineeringAgents].reverse(),
      [...veldraEngineeringSkills].reverse(),
      policy,
    );

    expect(first).toEqual(second);
    expect(first.inferred_capabilities).toEqual(expect.arrayContaining(['android', 'kotlin', 'mobile', 'compose']));
    expect(first.selected_agents).toContain('android-kotlin-specialist');
    expect(first.selected_agents).toContain('studio-architecture-reviewer');
    expect(first.selected_agents).not.toContain('disabled-unrelated-agent');
    expect(first.selected_skills).toContain('android-native');
    expect(first.selected_skills).toContain('testing-strategies');
    expect(first.selected_skills).toContain('architecture-review');
    expect(first.selected_skills.indexOf('testing-strategies')).toBeLessThan(
      first.selected_skills.indexOf('architecture-review'),
    );
    expect(first.reasons.some((reason) => reason.selected && reason.id === 'android-kotlin-specialist')).toBe(true);
  });

  it('honors request risk as an additional policy ceiling', () => {
    const result = routeCapabilities(
      { task: 'Review Android architecture', domain: 'android', risk: 'low' },
      veldraEngineeringAgents,
      veldraEngineeringSkills,
      policy,
    );

    expect(result.selected_agents).not.toContain('android-kotlin-specialist');
    expect(result.blocked_agents).toContain('android-kotlin-specialist');
  });

  it('filters high-risk and approval-required entries', () => {
    const result = routeCapabilities(
      { task: 'Review MCP security integration', domain: 'mcp', risk: 'high' },
      veldraEngineeringAgents,
      veldraEngineeringSkills,
      policy,
    );

    expect(result.selected_agents).not.toContain('security-reviewer');
    expect(result.blocked_agents).toContain('security-reviewer');
    expect(result.policy.passed).toBe(false);
  });

  it('excludes a disabled capability even when it matches the task', () => {
    const result = routeCapabilities(
      { task: 'Implement a database feature', domain: 'database' },
      veldraEngineeringAgents,
      [],
      policy,
    );

    expect(result.selected_agents).not.toContain('disabled-unrelated-agent');
    expect(result.policy.excluded).toContain('disabled-unrelated-agent');
  });

  it('resolves dependencies before a skill and excludes a skill with a blocked dependency', () => {
    const dependency = minimalSkill({ id: 'high-risk-dependency', risk_level: 'high' });
    const dependent = minimalSkill({ id: 'dependent-skill', dependencies: ['high-risk-dependency'] });
    const resolved = resolveSkills([dependent, dependency], ['dependent-skill'], policy);

    expect(resolved.orderedSkills).toEqual([]);
    expect(resolved.excluded).toEqual(
      expect.arrayContaining([
        { id: 'high-risk-dependency', reason: 'risk high exceeds policy medium' },
        { id: 'dependent-skill', reason: 'required dependency was not resolved' },
      ]),
    );
  });

  it('blocks an agent whose required tool is not allowed', () => {
    const agent = minimalAgent({ id: 'tool-restricted', required_tools: ['filesystem', 'secret-store'] });
    const result = routeCapabilities({ task: 'Implement Android Kotlin feature' }, [agent], [], policy);

    expect(result.selected_agents).toEqual([]);
    expect(result.blocked_agents).toEqual(['tool-restricted']);
    expect(result.reasons.find((reason) => reason.id === 'tool-restricted')?.message).toMatch(/not allowed/);
  });
});
