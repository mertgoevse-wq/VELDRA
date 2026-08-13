import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VeldraAgentRunner } from './veldra-agent-runner';
import type { AgentInvocation } from './adapters';
import { subagentsStore } from '~/lib/stores/subagents';

// Mock SubagentService
vi.mock('~/lib/services/subagentService', () => ({
  SubagentService: {
    getInstance: vi.fn(() => ({
      spawnSubagent: vi.fn(),
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

describe('VeldraAgentRunner', () => {
  let runner: VeldraAgentRunner;
  let mockSpawnSubagent: any;

  beforeEach(() => {
    // Clear subagents store
    subagentsStore.set({});

    // Create runner with mock dependencies
    runner = new VeldraAgentRunner({}, {});

    // Get mocked spawn function
    const { SubagentService } = require('~/lib/services/subagentService');
    mockSpawnSubagent = SubagentService.getInstance().spawnSubagent;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('run', () => {
    it('returns empty array for zero invocations', async () => {
      const results = await runner.run([], 2);
      expect(results).toEqual([]);
    });

    it('runs a single invocation successfully', async () => {
      const taskId = 'subagent-123-abc';

      // Mock spawn to return taskId message
      mockSpawnSubagent.mockResolvedValue(
        `Subagent spawned successfully in the background with Task ID: ${taskId}. It will perform its work asynchronously.`,
      );

      // Simulate task completion in store
      setTimeout(() => {
        subagentsStore.setKey(taskId, {
          taskId,
          model: 'Google:gemini-1.5-pro',
          systemPrompt: 'Test',
          task: 'Test task',
          status: 'completed',
          result: 'Test result',
          createdAt: Date.now(),
          completedAt: Date.now(),
        });
      }, 100);

      const invocations: AgentInvocation[] = [
        {
          role: 'code-reviewer',
          prompt: 'Review this code',
          requestedModel: 'Google:gemini-1.5-pro',
        },
      ];

      const results = await runner.run(invocations, 1);

      expect(results).toHaveLength(1);
      expect(results[0].role).toBe('code-reviewer');
      expect(results[0].output).toBe('Test result');
      expect(results[0].usedModel).toBe('Google:gemini-1.5-pro');
      expect(results[0].evidence).toHaveLength(1);
      expect(results[0].evidence[0].outcome).toBe('pass');
    });

    it('handles failed invocation with error evidence', async () => {
      const taskId = 'subagent-456-def';

      mockSpawnSubagent.mockResolvedValue(
        `Subagent spawned successfully in the background with Task ID: ${taskId}. It will perform its work asynchronously.`,
      );

      // Simulate task failure in store
      setTimeout(() => {
        subagentsStore.setKey(taskId, {
          taskId,
          model: 'Google:gemini-1.5-pro',
          systemPrompt: 'Test',
          task: 'Test task',
          status: 'failed',
          error: 'Model error: rate limit exceeded',
          createdAt: Date.now(),
          completedAt: Date.now(),
        });
      }, 100);

      const invocations: AgentInvocation[] = [
        {
          role: 'tester',
          prompt: 'Write tests',
        },
      ];

      const results = await runner.run(invocations, 1);

      expect(results).toHaveLength(1);
      expect(results[0].role).toBe('tester');
      expect(results[0].output).toBe('');
      expect(results[0].evidence[0].outcome).toBe('fail');
      expect(results[0].evidence[0].detail).toBe('Model error: rate limit exceeded');
    });

    it('respects maxConcurrency limit', async () => {
      const taskIds = ['subagent-1-a', 'subagent-2-b', 'subagent-3-c', 'subagent-4-d'];

      mockSpawnSubagent.mockImplementation((opts: any) => {
        const taskId = `subagent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        return Promise.resolve(`Task ID: ${taskId}`);
      });

      // Track concurrent executions
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const originalSpawn = mockSpawnSubagent;
      mockSpawnSubagent.mockImplementation(async (opts: any) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

        const taskId = `subagent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Complete immediately
        subagentsStore.setKey(taskId, {
          taskId,
          model: opts.model,
          systemPrompt: opts.systemPrompt,
          task: opts.initialPrompt,
          status: 'completed',
          result: 'Done',
          createdAt: Date.now(),
          completedAt: Date.now(),
        });

        currentConcurrent--;
        return `Task ID: ${taskId}`;
      });

      const invocations: AgentInvocation[] = [
        { role: 'agent-1', prompt: 'Task 1' },
        { role: 'agent-2', prompt: 'Task 2' },
        { role: 'agent-3', prompt: 'Task 3' },
        { role: 'agent-4', prompt: 'Task 4' },
      ];

      const results = await runner.run(invocations, 2);

      expect(results).toHaveLength(4);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('maps orchestrator roles to appropriate system prompts', async () => {
      const taskId = 'subagent-789-ghi';

      mockSpawnSubagent.mockImplementation((opts: any) => {
        // Verify system prompt contains role-specific content
        expect(opts.systemPrompt).toContain('security expert');
        return Promise.resolve(`Task ID: ${taskId}`);
      });

      setTimeout(() => {
        subagentsStore.setKey(taskId, {
          taskId,
          model: 'Google:gemini-1.5-pro',
          systemPrompt: '',
          task: '',
          status: 'completed',
          result: 'Security review complete',
          createdAt: Date.now(),
          completedAt: Date.now(),
        });
      }, 100);

      const invocations: AgentInvocation[] = [
        {
          role: 'security-reviewer',
          prompt: 'Review for vulnerabilities',
        },
      ];

      await runner.run(invocations, 1);

      expect(mockSpawnSubagent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('security expert'),
        }),
      );
    });

    it('estimates token usage for budget tracking', async () => {
      const taskId = 'subagent-999-xyz';

      mockSpawnSubagent.mockResolvedValue(`Task ID: ${taskId}`);

      setTimeout(() => {
        subagentsStore.setKey(taskId, {
          taskId,
          model: 'Google:gemini-1.5-pro',
          systemPrompt: '',
          task: '',
          status: 'completed',
          result: 'This is a result with some text',
          createdAt: Date.now(),
          completedAt: Date.now(),
        });
      }, 100);

      const invocations: AgentInvocation[] = [
        {
          role: 'researcher',
          prompt: 'Research this topic in detail',
        },
      ];

      const results = await runner.run(invocations, 1);

      expect(results[0].tokensIn).toBeGreaterThan(0);
      expect(results[0].tokensOut).toBeGreaterThan(0);
      // Rough check: ~4 chars per token
      expect(results[0].tokensIn).toBeCloseTo(
        Math.ceil('Research this topic in detail'.length / 4),
        0,
      );
    });

    it('handles spawn failure gracefully', async () => {
      mockSpawnSubagent.mockRejectedValue(new Error('Provider unavailable'));

      const invocations: AgentInvocation[] = [
        {
          role: 'code-reviewer',
          prompt: 'Review code',
        },
      ];

      const results = await runner.run(invocations, 1);

      expect(results).toHaveLength(1);
      expect(results[0].output).toBe('');
      expect(results[0].evidence[0].outcome).toBe('fail');
      expect(results[0].evidence[0].detail).toContain('Provider unavailable');
    });
  });
});
