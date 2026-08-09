import { describe, expect, it } from 'vitest';
import { buildCapabilityIndex } from '@studio/catalog/capability-index';
import { createContentAdapter } from '@studio/catalog/content-adapter';
import { veldraEngineeringAgents, veldraEngineeringSkills } from '@studio/catalog/examples/veldra-engineering';
import { loadProgressiveSkills } from '@studio/catalog/skill-loader';
import { veldraFoundationAgents } from '@studio/catalog/veldra-roles';
import { generateEngineeringPrompt } from '@studio/prompts/engineering-prompt';
import { routeCapabilities } from '@studio/orchestration/capability-router';
import {
  advanceEngineeringLoop,
  createEngineeringLoop,
  recordLoopFeedback,
  startNextEngineeringIteration,
} from '@studio/orchestration/engineering-loop';
import {
  canCompleteGauntlet,
  createGauntletRun,
  hasBudgetRemaining,
  hasNonConvergingFailure,
  recordUsage,
  recordFailure,
  updateReviewGate,
} from '@studio/orchestration/gauntlet';
import type { RoutingPolicy } from '@studio/catalog/types';

const policy: RoutingPolicy = {
  maxRisk: 'medium',
  allowedTools: ['filesystem', 'git', 'testing'],
  maxAgents: 3,
  maxSkills: 5,
};

describe('Veldra capability engine', () => {
  it('builds a deterministic index with content availability and provenance', () => {
    const first = buildCapabilityIndex(
      [...veldraEngineeringSkills, ...veldraEngineeringAgents],
      '2026-08-08T00:00:00.000Z',
    );
    const second = buildCapabilityIndex(
      [...veldraEngineeringAgents, ...veldraEngineeringSkills],
      '2026-08-08T00:00:00.000Z',
    );
    expect(first).toEqual(second);
    expect(first.entries[0]).toHaveProperty('provenance');
    expect(first.entries.every((entry) => entry.localPath.length > 0)).toBe(true);
  });

  it('loads only a selected permissive skill and preserves provenance', async () => {
    const source = {
      id: 'veldra-core',
      repository: 'local://veldra',
      revision: 'working-tree',
      trusted: true,
      read: async (path: string) => `content:${path}`,
    };
    const adapter = createContentAdapter(veldraEngineeringSkills, [source]);
    const result = await loadProgressiveSkills(veldraEngineeringSkills, ['android-native'], policy, adapter);
    expect(result.discovered).toHaveLength(veldraEngineeringSkills.length);
    expect(result.selected).toEqual(['android-native']);
    expect(result.loaded).toHaveLength(1);
    expect(result.loaded[0].provenance.sourceId).toBe('veldra-core');
    expect(result.loaded[0].content).toContain('veldra-engineering');
  });

  it('blocks non-permissive content with a traceable failure', async () => {
    const restricted = {
      ...veldraEngineeringSkills[0],
      license: { spdx: 'NOASSERTION', status: 'unknown' as const },
      enabled: false,
    };
    const adapter = createContentAdapter(
      [restricted],
      [
        {
          id: restricted.source.sourceId,
          repository: restricted.source.repository,
          revision: restricted.source.revision,
          trusted: true,
          read: async () => 'secret',
        },
      ],
    );
    const result = await adapter.load({ id: restricted.id });
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe('LICENSE_BLOCKED');
    }
  });

  it('generates a compact structured engineering prompt', () => {
    const routing = routeCapabilities(
      {
        task: 'Analyze Veldra Android architecture and implement native integration',
        domain: 'android',
        language: 'kotlin',
        risk: 'medium',
      },
      veldraEngineeringAgents,
      veldraEngineeringSkills,
      policy,
    );
    const prompt = generateEngineeringPrompt({
      role: 'Veldra implementation lead',
      request: { task: 'Implement a native Android integration', goal: 'Create a bounded, tested integration slice' },
      routing,
      projectState: 'Capacitor shell and provider-independent studio foundation exist.',
      constraints: ['Do not change the execution contract', 'Do not copy external prompts'],
      tools: ['filesystem', 'git', 'testing'],
      expectedOutput: ['small implementation slice', 'tests'],
      verification: ['run focused tests', 'review provenance'],
      failureConditions: ['policy violation', 'missing test evidence'],
      securityConstraints: ['no secrets', 'approval for security changes'],
      licenseConstraints: ['preserve provenance', 'load only permissive or internal content'],
      acceptanceCriteria: ['deterministic selection', 'documented result'],
      nextLoopConditions: ['retry only with changed capability after repeated failure'],
    });
    expect(prompt.text).toContain('ROLE');
    expect(prompt.text).toContain('SELECTED SKILLS');
    expect(prompt.text).toContain('LICENSE CONSTRAINTS');
    expect(prompt.text.length).toBeLessThan(5000);
  });

  it('bounds loop iterations and accumulates feedback', () => {
    let loop = createEngineeringLoop(2, '2026-08-08T00:00:00.000Z');
    loop = recordLoopFeedback(loop, { worked: ['deterministic routing'], missingSkills: ['security-hardening'] });

    const stages = [
      'RESEARCH',
      'GENERATE_PROMPT',
      'SELECT_CAPABILITIES',
      'LOAD_CONTENT',
      'IMPLEMENT',
      'TEST',
      'REVIEW',
      'VERIFY',
      'DOCUMENT',
      'ASSESS_REMAINING_WORK',
      'NEXT_LOOP',
    ] as const;

    for (const state of stages) {
      loop = advanceEngineeringLoop(loop, state, undefined, '2026-08-08T00:00:30.000Z');
    }
    loop = startNextEngineeringIteration(loop, 'retry with added security skill', '2026-08-08T00:01:00.000Z');

    let current = loop;

    for (const state of stages) {
      current = advanceEngineeringLoop(current, state, undefined, '2026-08-08T00:01:30.000Z');
    }

    const exhausted = startNextEngineeringIteration(current, 'stop', '2026-08-08T00:02:00.000Z');
    expect(loop.iteration).toBe(2);
    expect(loop.feedback.missingSkills).toEqual(['security-hardening']);
    expect(exhausted.blockedReason).toBe('iteration budget exhausted');
  });

  it('detects repeated failures and prevents completion without all gates', () => {
    let run = createGauntletRun({
      runId: 'run-1',
      goal: 'test',
      maxIterations: 2,
      timeBudgetMs: 1000,
      contextBudget: 100,
      costBudget: 10,
      startedAt: '2026-08-08T00:00:00.000Z',
    });
    run = recordFailure(run, { id: 'TYPECHECK_FAILURE_Y', kind: 'typecheck', message: 'bad type' });
    run = recordFailure(run, { id: 'TYPECHECK_FAILURE_Y', kind: 'typecheck', message: 'bad type' });
    // D-13: a failure repeating 3 times (not 2) is what stops the run — the first repeat is tolerated.
    expect(hasNonConvergingFailure(run)).toBe(false);
    expect(run.status).not.toBe('BLOCKED');
    run = recordFailure(run, { id: 'TYPECHECK_FAILURE_Y', kind: 'typecheck', message: 'bad type' });
    expect(hasNonConvergingFailure(run)).toBe(true);
    expect(run.status).toBe('BLOCKED');
    expect(run.approvalState).toBe('pending');
    expect(canCompleteGauntlet(run)).toBe(false);
    expect(hasBudgetRemaining(run)).toBe(true);
    run = recordUsage(run, { context: 100, cost: 10 });
    // D-13: reaching the limit counts as exhausted, not just exceeding it.
    expect(hasBudgetRemaining(run)).toBe(false);
    run = updateReviewGate(run, 'ARCHITECTURE', 'passed', ['evidence']);
    expect(run.reviews.find((gate) => gate.name === 'ARCHITECTURE')?.status).toBe('passed');
  });

  it('provides original internal Veldra roles without external prompt content', () => {
    expect(veldraFoundationAgents.map((agent) => agent.id)).toEqual([
      'product-director',
      'architecture-agent',
      'research-agent',
      'implementation-agent',
      'testing-agent',
      'security-agent',
      'verification-agent',
      'documentation-agent',
    ]);
    expect(veldraFoundationAgents.every((agent) => agent.source.sourceId === 'veldra-core')).toBe(true);
  });
});
