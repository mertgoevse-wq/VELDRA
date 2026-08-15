import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText, ToolExecutionError } from 'ai';
import { SubagentService } from './subagentService';
import { subagentsStore } from '~/lib/stores/subagents';
import { recentAgentActivityStore } from '~/lib/orchestrator/subagent-activity-bridge';

/**
 * Block 1 (product-integration mandate, "real agent runtime observability"): proves
 * subagentService.ts's onStepFinish/catch instrumentation actually emits real
 * tool.completed/tool.failed/file.* events into the same activity log
 * SubagentActivityWidget reads, using the same mock-only-the-LLM-boundary pattern as
 * orchestrator-e2e.spec.ts (no VELDRA-owned layer mocked here).
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

function findTaskId(): string {
  const tasks = subagentsStore.get();
  const [taskId] = Object.keys(tasks);
  expect(taskId).toBeTruthy();

  return taskId;
}

async function waitForStatus(taskId: string, status: 'completed' | 'failed') {
  for (let i = 0; i < 50; i++) {
    if (subagentsStore.get()[taskId]?.status === status) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Task ${taskId} never reached status ${status}`);
}

describe('SubagentService real tool/file event instrumentation', () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();
    recentAgentActivityStore.set([]);
    subagentsStore.set({});
  });

  it('emits a real tool.completed event for a real tool call from onStepFinish', async () => {
    vi.mocked(generateText).mockImplementation(async (options: any) => {
      await options.onStepFinish?.({
        toolResults: [
          { toolCallId: 'call-1', toolName: 'run_command', args: { cmd: 'npm test' }, result: { ok: true } },
        ],
      });
      return { text: 'done' } as any;
    });

    await SubagentService.getInstance().spawnSubagent({
      model: 'Google:gemini-1.5-pro',
      systemPrompt: 'system',
      initialPrompt: 'prompt',
      apiKeys: { Google: 'test-key' },
    });

    const taskId = findTaskId();
    await waitForStatus(taskId, 'completed');

    const events = recentAgentActivityStore.get();
    const toolEvent = events.find((e) => e.type === 'tool.completed' && e.taskId === taskId);
    expect(toolEvent).toBeTruthy();
    expect(toolEvent!.data).toMatchObject({ toolName: 'run_command', toolCallId: 'call-1' });
  });

  it('emits a real file.changed event when a tool call looks like a file write with a real path', async () => {
    vi.mocked(generateText).mockImplementation(async (options: any) => {
      await options.onStepFinish?.({
        toolResults: [
          {
            toolCallId: 'call-2',
            toolName: 'write_file',
            args: { path: 'src/index.ts', content: 'export {}' },
            result: { ok: true },
          },
        ],
      });
      return { text: 'done' } as any;
    });

    await SubagentService.getInstance().spawnSubagent({
      model: 'Google:gemini-1.5-pro',
      systemPrompt: 'system',
      initialPrompt: 'prompt',
      apiKeys: { Google: 'test-key' },
    });

    const taskId = findTaskId();
    await waitForStatus(taskId, 'completed');

    const events = recentAgentActivityStore.get();
    const fileEvent = events.find((e) => e.type === 'file.changed' && e.taskId === taskId);
    expect(fileEvent).toBeTruthy();
    expect(fileEvent!.data).toMatchObject({ path: 'src/index.ts', toolName: 'write_file' });
  });

  it('does NOT emit a file.* event for a tool call with no recognizable path arg (no guessing)', async () => {
    vi.mocked(generateText).mockImplementation(async (options: any) => {
      await options.onStepFinish?.({
        toolResults: [{ toolCallId: 'call-3', toolName: 'write_file', args: { unrelated: true }, result: {} }],
      });
      return { text: 'done' } as any;
    });

    await SubagentService.getInstance().spawnSubagent({
      model: 'Google:gemini-1.5-pro',
      systemPrompt: 'system',
      initialPrompt: 'prompt',
      apiKeys: { Google: 'test-key' },
    });

    const taskId = findTaskId();
    await waitForStatus(taskId, 'completed');

    const events = recentAgentActivityStore.get();
    expect(events.some((e) => e.type === 'file.read' || e.type === 'file.changed')).toBe(false);
    expect(events.some((e) => e.type === 'tool.completed' && e.taskId === taskId)).toBe(true);
  });

  it('emits a real tool.failed event, honestly attributed, when the AI SDK reports a ToolExecutionError', async () => {
    vi.mocked(generateText).mockImplementation(async () => {
      throw new ToolExecutionError({
        toolName: 'flaky_tool',
        toolArgs: { foo: 'bar' },
        toolCallId: 'call-4',
        cause: new Error('boom'),
      });
    });

    await SubagentService.getInstance().spawnSubagent({
      model: 'Google:gemini-1.5-pro',
      systemPrompt: 'system',
      initialPrompt: 'prompt',
      apiKeys: { Google: 'test-key' },
    });

    const taskId = findTaskId();
    await waitForStatus(taskId, 'failed');

    const events = recentAgentActivityStore.get();
    const failEvent = events.find((e) => e.type === 'tool.failed' && e.taskId === taskId);
    expect(failEvent).toBeTruthy();
    expect(failEvent!.data).toMatchObject({ toolName: 'flaky_tool', toolCallId: 'call-4' });
  });

  it('does NOT fabricate a tool.failed event when the failure is not attributable to a specific tool', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('provider unavailable'));

    await SubagentService.getInstance().spawnSubagent({
      model: 'Google:gemini-1.5-pro',
      systemPrompt: 'system',
      initialPrompt: 'prompt',
      apiKeys: { Google: 'test-key' },
    });

    const taskId = findTaskId();
    await waitForStatus(taskId, 'failed');

    const events = recentAgentActivityStore.get();
    expect(events.some((e) => e.type === 'tool.failed')).toBe(false);
  });
});
