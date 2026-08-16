import { getActiveSandboxSession } from '~/lib/execution/runtime-status';
import { createScopedLogger } from '~/utils/logger';
import { LLMManager } from '~/lib/modules/llm/manager';
import { generateText, ToolExecutionError, type StepResult, type ToolSet } from 'ai';
import { subagentsStore } from '~/lib/stores/subagents';
import { createWorkflowEvent } from '~/lib/orchestrator/events';
import { AMBIENT_SUBAGENT_RUN_ID, recordActivityEvent } from '~/lib/orchestrator/subagent-activity-bridge';
import { classifyFileToolCall, extractFilePath, summarizeForEvent } from './subagent-tool-events';

const logger = createScopedLogger('subagent-service');

/**
 * Real per-step tool instrumentation, emitted into the same activity log
 * SubagentActivityWidget already reads (see subagent-activity-bridge.ts). Only ever
 * called with data the AI SDK actually produced for a real, completed tool call --
 * never synthesized. onStepFinish fires once a step (LLM call + any tool calls within
 * it) has already finished, so there is no honest "tool.started" moment available here
 * -- only tool.completed, reported after the fact.
 */
function emitToolStepEvents(taskId: string, step: StepResult<ToolSet>): void {
  for (const toolResult of step.toolResults) {
    const { toolName, toolCallId, args, result } = toolResult as unknown as {
      toolName: string;
      toolCallId: string;
      args: unknown;
      result: unknown;
    };

    const toolEvent = createWorkflowEvent(
      AMBIENT_SUBAGENT_RUN_ID,
      'tool.completed',
      { toolName, toolCallId, args: summarizeForEvent(args), result: summarizeForEvent(result) },
      taskId,
    );
    recordActivityEvent(toolEvent);

    const fileEventKind = classifyFileToolCall(toolName, args);

    if (fileEventKind) {
      const path = extractFilePath(args);
      const fileEvent = createWorkflowEvent(AMBIENT_SUBAGENT_RUN_ID, fileEventKind, { path, toolName }, taskId);
      recordActivityEvent(fileEvent);
    }
  }
}

/**
 * Honest tool-failure attribution: only emitted when the AI SDK itself identifies which
 * tool call threw (ToolExecutionError carries toolName/toolArgs/toolCallId) -- never
 * guessed when the failure is ambiguous (e.g. the LLM call itself failed, not a tool).
 */
function emitToolFailureIfAttributable(taskId: string, error: unknown): void {
  if (!ToolExecutionError.isInstance(error)) {
    return;
  }

  const event = createWorkflowEvent(
    AMBIENT_SUBAGENT_RUN_ID,
    'tool.failed',
    {
      toolName: error.toolName,
      toolCallId: error.toolCallId,
      args: summarizeForEvent(error.toolArgs),
      error: summarizeForEvent(error.message),
    },
    taskId,
  );
  recordActivityEvent(event);
}

export interface SpawnSubagentOptions {
  model: string;
  systemPrompt: string;
  initialPrompt: string;
  providerSettings?: any;
  apiKeys?: any;
}

export class SubagentService {
  private static _instance: SubagentService;

  private constructor() {}

  static getInstance(): SubagentService {
    if (!SubagentService._instance) {
      SubagentService._instance = new SubagentService();
    }

    return SubagentService._instance;
  }

  async spawnSubagent(options: SpawnSubagentOptions): Promise<string> {
    const session = await getActiveSandboxSession();

    if (!session) {
      throw new Error('No active sandbox session to run subagent in.');
    }

    logger.info(`Spawning subagent with model ${options.model}...`);

    try {
      const llmManager = LLMManager.getInstance();

      // Attempt to resolve provider from model string format "Provider:Model"
      let providerName = 'Google';
      let modelId = options.model;

      if (options.model.includes(':')) {
        const parts = options.model.split(':');
        providerName = parts[0];
        modelId = parts[1];
      }

      const provider = llmManager.getProvider(providerName);

      if (!provider) {
        throw new Error(`Provider ${providerName} not found`);
      }

      const modelInstance = provider.getModelInstance({
        model: modelId,
        serverEnv: (llmManager.env || {}) as any,
        apiKeys: options.apiKeys,
        providerSettings: options.providerSettings,
      });

      const { MCPService: mcpService } = await import('~/lib/services/mcpService');
      const tools = mcpService.getInstance().tools;

      const taskId = `subagent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      subagentsStore.setKey(taskId, {
        taskId,
        model: options.model,
        systemPrompt: options.systemPrompt,
        task: options.initialPrompt,
        status: 'running',
        createdAt: Date.now(),
      });

      // Run asynchronously without blocking the main agent
      generateText({
        model: modelInstance,
        system: options.systemPrompt,
        prompt: options.initialPrompt,
        maxTokens: 4096,
        temperature: 0.1,
        tools,
        maxSteps: 5,
        onStepFinish: (step) => emitToolStepEvents(taskId, step),
      })
        .then((result) => {
          logger.info(`Subagent ${taskId} completed task. Result:\n${result.text}`);
          subagentsStore.setKey(taskId, {
            ...subagentsStore.get()[taskId],
            status: 'completed',
            result: result.text,
            completedAt: Date.now(),
          });
        })
        .catch((error) => {
          logger.error(`Subagent ${taskId} execution failed`, error);
          emitToolFailureIfAttributable(taskId, error);
          subagentsStore.setKey(taskId, {
            ...subagentsStore.get()[taskId],
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            completedAt: Date.now(),
          });
        });

      return `Subagent spawned successfully in the background with Task ID: ${taskId}. It will perform its work asynchronously.`;
    } catch (error) {
      logger.error('Subagent execution failed to start', error);
      throw new Error(`Subagent failed to start: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
