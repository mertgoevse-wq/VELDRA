import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnSubagentWithOrchestrator, isOrchestratorEnabled, getOrchestratorStatus } from './integration';
import { entitlementTierStore } from '~/lib/stores/entitlement';
import type { SpawnSubagentOptions } from '~/lib/services/subagentService';

// Mock VeldraOrchestratorHost
const mockRun = vi.fn();
const mockPolicyCheck = vi.fn();

vi.mock('./veldra-host', () => ({
  getVeldraHost: vi.fn(() => ({
    agents: {
      run: mockRun,
    },
    policy: {
      check: mockPolicyCheck,
    },
    approvals: {
      request: vi.fn(),
    },
  })),
  VeldraOrchestratorHost: vi.fn(),
}));

// Mock SubagentService
const mockSpawnSubagent = vi.fn();

vi.mock('~/lib/services/subagentService', () => ({
  SubagentService: {
    getInstance: vi.fn(() => ({
      spawnSubagent: mockSpawnSubagent,
    })),
  },
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

describe('Orchestrator Integration', () => {
  const testOptions: SpawnSubagentOptions = {
    model: 'test-model',
    systemPrompt: 'Test system prompt',
    initialPrompt: 'Test initial prompt',
  };

  const originalTier = entitlementTierStore.get();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: orchestrator disabled
    process.env.VELDRA_USE_ORCHESTRATOR = 'false';
  });

  afterEach(() => {
    delete process.env.VELDRA_USE_ORCHESTRATOR;
    entitlementTierStore.set(originalTier);
  });

  describe('spawnSubagentWithOrchestrator', () => {
    describe('when orchestrator is disabled', () => {
      it('uses legacy SubagentService directly', async () => {
        process.env.VELDRA_USE_ORCHESTRATOR = 'false';

        mockSpawnSubagent.mockResolvedValue('Task ID: legacy-123');

        const result = await spawnSubagentWithOrchestrator(testOptions);

        expect(result).toBe('Task ID: legacy-123');
        expect(mockSpawnSubagent).toHaveBeenCalledWith(testOptions);
        expect(mockRun).not.toHaveBeenCalled();
      });
    });

    describe('when orchestrator is enabled', () => {
      beforeEach(() => {
        process.env.VELDRA_USE_ORCHESTRATOR = 'true';

        /*
         * PREMIUM has a real, non-zero budget on every limit -- see entitlement.ts's
         * TIER_BUDGETS. FREE's zero maxCostMinor is covered by its own preflight test below.
         */
        entitlementTierStore.set('PREMIUM');
      });

      it('drives the run through runWorkflow and returns the Task ID from evidence', async () => {
        mockPolicyCheck.mockResolvedValue(null); // Policy allows
        mockRun.mockResolvedValue([
          {
            role: 'subagent',
            output: 'Test output',
            evidence: [
              {
                kind: 'command-output',
                outcome: 'pass',
                source: 'subagent:orch-task-123',
                summary: 'Subagent completed',
                collectedAt: Date.now(),
              },
            ],
          },
        ]);

        const result = await spawnSubagentWithOrchestrator(testOptions);

        expect(result).toContain('orch-task-123');
        expect(mockPolicyCheck).toHaveBeenCalledWith(
          'spawn-subagent',
          expect.objectContaining({ goalId: expect.any(String) }),
        );
        expect(mockRun).toHaveBeenCalledWith(
          [
            {
              role: 'subagent',
              prompt: 'Test initial prompt',
              requestedModel: 'test-model',
            },
          ],
          1,
        );
        expect(mockSpawnSubagent).not.toHaveBeenCalled();
      });

      it('falls back to legacy when policy denies', async () => {
        mockPolicyCheck.mockResolvedValue('Feature not available in free tier');
        mockSpawnSubagent.mockResolvedValue('Task ID: legacy-fallback-123');

        const result = await spawnSubagentWithOrchestrator(testOptions);

        expect(result).toBe('Task ID: legacy-fallback-123');
        expect(mockPolicyCheck).toHaveBeenCalled();
        expect(mockRun).not.toHaveBeenCalled();
        expect(mockSpawnSubagent).toHaveBeenCalledWith(testOptions);
      });

      it('falls back to legacy without ever calling agents.run when the tier cannot afford one iteration', async () => {
        /*
         * FREE tier's maxCostMinor: 0 would otherwise trip runWorkflow's very first budget
         * check and call host.approvals.request(), which suspends forever with no UI to
         * answer it (see veldra-approvals.ts) -- the preflight check in integration.ts
         * must catch this before runWorkflow is ever invoked.
         */
        entitlementTierStore.set('FREE');
        mockPolicyCheck.mockResolvedValue(null);
        mockSpawnSubagent.mockResolvedValue('Task ID: legacy-fallback-free');

        const result = await spawnSubagentWithOrchestrator(testOptions);

        expect(result).toBe('Task ID: legacy-fallback-free');
        expect(mockRun).not.toHaveBeenCalled();
        expect(mockPolicyCheck).not.toHaveBeenCalled();
        expect(mockSpawnSubagent).toHaveBeenCalledWith(testOptions);
      });

      it('falls back to legacy when the task has no evidence (not treated as verified)', async () => {
        mockPolicyCheck.mockResolvedValue(null);
        mockRun.mockResolvedValue([
          {
            role: 'subagent',
            output: 'Some output without any evidence',
            evidence: [],
          },
        ]);
        mockSpawnSubagent.mockResolvedValue('Task ID: legacy-fallback-456');

        const result = await spawnSubagentWithOrchestrator(testOptions);

        expect(result).toBe('Task ID: legacy-fallback-456');
        expect(mockSpawnSubagent).toHaveBeenCalledWith(testOptions);
      });

      it('falls back to legacy when orchestrator throws error', async () => {
        mockPolicyCheck.mockResolvedValue(null);
        mockRun.mockRejectedValue(new Error('Orchestrator internal error'));
        mockSpawnSubagent.mockResolvedValue('Task ID: legacy-fallback-789');

        const result = await spawnSubagentWithOrchestrator(testOptions);

        expect(result).toBe('Task ID: legacy-fallback-789');
        expect(mockSpawnSubagent).toHaveBeenCalledWith(testOptions);
      });

      it('returns an output-based fallback message when evidence passes but carries no subagent: source', async () => {
        mockPolicyCheck.mockResolvedValue(null);
        mockRun.mockResolvedValue([
          {
            role: 'subagent',
            output: 'Some output without task ID in evidence',
            evidence: [
              {
                kind: 'command-output',
                outcome: 'pass',
                source: 'external-check',
                summary: 'Subagent completed',
                collectedAt: Date.now(),
              },
            ],
          },
        ]);

        const result = await spawnSubagentWithOrchestrator(testOptions);

        expect(result).toContain('Subagent spawned via orchestrator');
        expect(result).toContain('Some output');
      });
    });
  });

  describe('isOrchestratorEnabled', () => {
    it('returns false when disabled', () => {
      process.env.VELDRA_USE_ORCHESTRATOR = 'false';

      // Re-import to pick up env change
      expect(isOrchestratorEnabled()).toBe(false);
    });

    it('returns false when env var not set', () => {
      delete process.env.VELDRA_USE_ORCHESTRATOR;

      expect(isOrchestratorEnabled()).toBe(false);
    });
  });

  describe('getOrchestratorStatus', () => {
    it('returns legacy mode when disabled', () => {
      process.env.VELDRA_USE_ORCHESTRATOR = 'false';

      const status = getOrchestratorStatus();

      expect(status.enabled).toBe(false);
      expect(status.mode).toBe('legacy');
      expect(status.host).toBe('veldra-app');
    });
  });
});
