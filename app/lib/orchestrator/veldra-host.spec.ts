import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VeldraOrchestratorHost, getVeldraHost } from './veldra-host';
import type { AgentInvocation } from './adapters';

// Mock VeldraAgentRunner
vi.mock('./veldra-agent-runner', () => ({
  VeldraAgentRunner: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue([
      {
        role: 'test-agent',
        output: 'Test output',
        usedModel: 'test-model',
        tokensIn: 100,
        tokensOut: 50,
        evidence: [],
      },
    ]),
  })),
}));

// Mock logger
vi.mock('~/utils/logger', () => ({
  createScopedLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('VeldraOrchestratorHost', () => {
  beforeEach(() => {
    VeldraOrchestratorHost.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('creates singleton instance', () => {
      const host1 = VeldraOrchestratorHost.getInstance();
      const host2 = VeldraOrchestratorHost.getInstance();

      expect(host1).toBe(host2);
    });

    it('has correct host id', () => {
      const host = VeldraOrchestratorHost.getInstance();

      expect(host.id).toBe('veldra-app');
    });

    it('initializes with all required ports', () => {
      const host = VeldraOrchestratorHost.getInstance();

      expect(host.agents).toBeDefined();
      expect(host.approvals).toBeDefined();
      expect(host.policy).toBeDefined();
    });

    it('initializes with optional ports as undefined', () => {
      const host = VeldraOrchestratorHost.getInstance();

      expect(host.runs).toBeUndefined();
      expect(host.models).toBeUndefined();
      expect(host.capabilities).toBeUndefined();
    });

    it('passes credentials to agent runner', () => {
      const apiKeys = { TEST_KEY: 'test-value' };
      const providerSettings = { provider: 'test' };

      const host = VeldraOrchestratorHost.getInstance(apiKeys, providerSettings);

      expect(host.agents).toBeDefined();
    });
  });

  describe('getVeldraHost convenience function', () => {
    it('returns singleton instance', () => {
      const host1 = getVeldraHost();
      const host2 = getVeldraHost();

      expect(host1).toBe(host2);
    });
  });

  describe('resetInstance', () => {
    it('clears singleton', () => {
      const host1 = VeldraOrchestratorHost.getInstance();

      VeldraOrchestratorHost.resetInstance();

      const host2 = VeldraOrchestratorHost.getInstance();

      expect(host1).not.toBe(host2);
    });
  });

  describe('updateCredentials', () => {
    it('updates agent runner with new credentials', () => {
      const host = VeldraOrchestratorHost.getInstance();
      const initialRunner = host.agents;

      const newApiKeys = { NEW_KEY: 'new-value' };
      const newSettings = { provider: 'new' };

      host.updateCredentials(newApiKeys, newSettings);

      // Agent runner should be recreated
      expect(host.agents).toBeDefined();
      expect(host.agents).not.toBe(initialRunner);
    });
  });

  describe('agents port', () => {
    it('delegates to VeldraAgentRunner', async () => {
      const host = VeldraOrchestratorHost.getInstance();

      const invocations: AgentInvocation[] = [
        {
          role: 'test-agent',
          prompt: 'Test prompt',
          requestedModel: 'test-model',
        },
      ];

      const results = await host.agents.run(invocations, 1);

      expect(results).toHaveLength(1);
      expect(results[0].role).toBe('test-agent');
    });
  });

  describe('approvals port (stub)', () => {
    it('auto-approves requests', async () => {
      const host = VeldraOrchestratorHost.getInstance();

      const approval = {
        id: 'test-approval',
        kind: 'plan' as const,
        question: 'Should we proceed?',
        context: 'Test context',
        options: ['yes', 'no'],
      };

      const response = await host.approvals.request(approval);

      expect(response.requestId).toBe('test-approval');
      expect(response.chosen).toBe('yes');
      expect(response.note).toContain('Auto-approved');
    });

    it('uses first option when multiple provided', async () => {
      const host = VeldraOrchestratorHost.getInstance();

      const approval = {
        id: 'test-approval-2',
        kind: 'destructive-action' as const,
        question: 'Confirm deletion?',
        context: 'About to delete files',
        options: ['cancel', 'confirm'],
      };

      const response = await host.approvals.request(approval);

      expect(response.chosen).toBe('cancel');
    });
  });

  describe('policy port (stub)', () => {
    it('allows all capabilities', async () => {
      const host = VeldraOrchestratorHost.getInstance();

      const denial = await host.policy.check('premium-feature');

      expect(denial).toBeNull();
    });

    it('logs capability checks', async () => {
      const host = VeldraOrchestratorHost.getInstance();

      const denial = await host.policy.check('expensive-model', {
        model: 'gpt-4',
        cost: 1000,
      });

      expect(denial).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('supports full agent execution flow', async () => {
      const apiKeys = { OPENAI_API_KEY: 'sk-test' };
      const providerSettings = { OpenAI: { baseURL: 'test' } };

      const host = VeldraOrchestratorHost.getInstance(apiKeys, providerSettings);

      // Check policy
      const policyDenial = await host.policy.check('spawn-agent');

      expect(policyDenial).toBeNull();

      // Request approval
      const approval = await host.approvals.request({
        id: 'spawn-approval',
        kind: 'plan',
        question: 'Spawn agent?',
        context: 'Will spawn code reviewer',
        options: ['yes', 'no'],
      });

      expect(approval.chosen).toBe('yes');

      // Run agent
      const invocations: AgentInvocation[] = [
        {
          role: 'code-reviewer',
          prompt: 'Review this code',
        },
      ];

      const results = await host.agents.run(invocations, 2);

      expect(results).toHaveLength(1);
      expect(results[0].output).toBeTruthy();
    });
  });
});
