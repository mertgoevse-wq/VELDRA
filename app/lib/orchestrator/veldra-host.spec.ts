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

    it('initializes runs as a safe no-op RunStore when no db handle is supplied, and leaves models/capabilities unimplemented', async () => {
      const host = VeldraOrchestratorHost.getInstance();

      /*
       * runs is a real RunStore object even without a db -- OrchestratorHost's own contract
       * says a host that can't persist is still valid, so this degrades rather than being undefined.
       */
      expect(host.runs).toBeDefined();
      await expect(host.runs?.save('run-1', '{}')).resolves.toBeUndefined();
      await expect(host.runs?.load('run-1')).resolves.toBeNull();
      await expect(host.runs?.list()).resolves.toEqual([]);

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

  describe('approvals port (real handoff)', () => {
    it('genuinely suspends until respond() is called, then resolves with the recorded decision', async () => {
      const host = VeldraOrchestratorHost.getInstance();

      const approval = {
        id: 'test-approval',
        kind: 'plan' as const,
        question: 'Should we proceed?',
        context: 'Test context',
        options: ['yes', 'no'],
      };

      let settled = false;
      const responsePromise = host.approvals.request(approval).then((response) => {
        settled = true;
        return response;
      });

      // Not resolved yet -- nothing has decided.
      await Promise.resolve();
      expect(settled).toBe(false);
      expect(host.approvals.listPending()).toContainEqual(approval);

      const responded = host.approvals.respond('test-approval', 'yes', 'looks fine');
      expect(responded).toBe(true);

      const response = await responsePromise;
      expect(response.requestId).toBe('test-approval');
      expect(response.chosen).toBe('yes');
      expect(response.note).toBe('looks fine');
      expect(host.approvals.listPending()).toEqual([]);
    });

    it('respond() returns false for an unknown or already-answered request id', () => {
      const host = VeldraOrchestratorHost.getInstance();

      expect(host.approvals.respond('never-requested', 'yes')).toBe(false);
    });
  });

  describe('policy port (real entitlement gate)', () => {
    it("allows a capability string it does not recognize (not this gate's concern)", async () => {
      const host = VeldraOrchestratorHost.getInstance();

      const denial = await host.policy.check('premium-feature');

      expect(denial).toBeNull();
    });

    it('allows a known capability the current (default FREE) tier does not include -- wait, denies it', async () => {
      const host = VeldraOrchestratorHost.getInstance();

      // Default tier (no entitlementTierStore override in this test) is FREE, which has zero capabilities.
      const denial = await host.policy.check('mcp-servers');

      expect(denial).not.toBeNull();
      expect(denial).toContain('mcp-servers');
    });
  });

  describe('integration scenarios', () => {
    it('supports a full agent execution flow with a real approval decision', async () => {
      const apiKeys = { OPENAI_API_KEY: 'sk-test' };
      const providerSettings = { OpenAI: { baseURL: 'test' } };

      const host = VeldraOrchestratorHost.getInstance(apiKeys, providerSettings);

      // A capability this gate doesn't recognize is allowed by default.
      const policyDenial = await host.policy.check('spawn-agent');
      expect(policyDenial).toBeNull();

      // Request approval, then actually decide it -- no auto-approval to lean on.
      const approvalPromise = host.approvals.request({
        id: 'spawn-approval',
        kind: 'plan',
        question: 'Spawn agent?',
        context: 'Will spawn code reviewer',
        options: ['yes', 'no'],
      });
      host.approvals.respond('spawn-approval', 'yes');

      const approval = await approvalPromise;
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
