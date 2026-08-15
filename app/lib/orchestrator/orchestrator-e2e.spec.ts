import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateText } from 'ai';
import { spawnSubagentWithOrchestrator } from './integration';
import { VeldraOrchestratorHost } from './veldra-host';
import { entitlementTierStore } from '~/lib/stores/entitlement';
import { subagentsStore } from '~/lib/stores/subagents';

/**
 * Phase 1 of the "core product + runtime foundation" mandate's live-wiring goal: prove the
 * orchestrator path actually works end-to-end through every VELDRA-authored layer --
 * integration.ts -> runWorkflow() -> VeldraAgentRunner -> SubagentService -> subagentsStore
 * -> back up through Evidence -> WorkflowRun 'completed' -> the message the chat tool call
 * returns -- with nothing in that chain mocked except the two boundaries this environment
 * genuinely cannot provide: a live LLM call (ai's generateText) and an active sandbox
 * session (WebContainer, browser-only). Every other spec file covering this code mocks at
 * least one VELDRA-owned layer (host, agent runner, or subagent service); this one doesn't,
 * so it's the actual answer to "does the wiring work," not just "does each piece work in
 * isolation."
 */

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn() };
});

vi.mock('~/lib/execution/runtime-status', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/execution/runtime-status')>();
  return {
    ...actual,
    getActiveSandboxSession: vi.fn().mockResolvedValue({ id: 'test-session' }),
  };
});

describe('Orchestrator end-to-end (real runtime, mocked only at the LLM + sandbox boundary)', () => {
  const originalTier = entitlementTierStore.get();

  beforeEach(() => {
    process.env.VELDRA_USE_ORCHESTRATOR = 'true';
    entitlementTierStore.set('PREMIUM');
    VeldraOrchestratorHost.resetInstance();
    vi.mocked(generateText).mockReset();
  });

  afterEach(() => {
    delete process.env.VELDRA_USE_ORCHESTRATOR;
    entitlementTierStore.set(originalTier);
    VeldraOrchestratorHost.resetInstance();
  });

  it('drives a real subagent spawn all the way to a completed WorkflowRun', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: 'Task complete: built the requested feature.' } as any);

    const result = await spawnSubagentWithOrchestrator(
      {
        model: 'Google:gemini-1.5-pro',
        systemPrompt: 'You are a helpful subagent.',
        initialPrompt: 'Say hello.',
      },
      { Google: 'test-key' },
      {},
    );

    expect(result).toContain('Subagent spawned via orchestrator');

    const taskId = result.match(/Task ID: (subagent-\d+-\w+)/)?.[1];
    expect(taskId).toBeTruthy();

    const task = subagentsStore.get()[taskId as string];
    expect(task?.status).toBe('completed');
    expect(task?.result).toBe('Task complete: built the requested feature.');
  }, 10000);

  it('falls back to the legacy path when the real LLM call fails, without hanging', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('provider unavailable'));

    const result = await spawnSubagentWithOrchestrator(
      {
        model: 'Google:gemini-1.5-pro',
        systemPrompt: 'You are a helpful subagent.',
        initialPrompt: 'Say hello.',
      },
      { Google: 'test-key' },
      {},
    );

    /*
     * Legacy's own fire-and-forget contract: a Task ID message returns immediately, even
     * though that spawn will itself also fail once the (still-mocked) LLM call rejects.
     */
    expect(result).toMatch(/Task ID: subagent-\d+-\w+/);
  }, 10000);
});
