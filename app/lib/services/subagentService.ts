import { getActiveSandboxSession } from '~/lib/execution/runtime-status';
import { createScopedLogger } from '~/utils/logger';
import { LLMManager } from '~/lib/modules/llm/manager';
import { generateText, type Message } from 'ai';
import { subagentsStore } from '~/lib/stores/subagents';

const logger = createScopedLogger('subagent-service');

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
        serverEnv: llmManager.env,
        apiKeys: options.apiKeys,
        providerSettings: options.providerSettings,
      });

      const { MCPService } = await import('~/lib/services/mcpService');
      const tools = MCPService.getInstance().tools;

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
        tools: tools,
        maxSteps: 5,
      }).then(result => {
        logger.info(`Subagent ${taskId} completed task. Result:\n${result.text}`);
        subagentsStore.setKey(taskId, {
          ...subagentsStore.get()[taskId],
          status: 'completed',
          result: result.text,
          completedAt: Date.now(),
        });
      }).catch(error => {
        logger.error(`Subagent ${taskId} execution failed`, error);
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
