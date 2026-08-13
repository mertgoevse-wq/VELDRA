import type { AgentInvocation, AgentResult, AgentRunner } from './adapters';
import { SubagentService } from '~/lib/services/subagentService';
import { subagentsStore } from '~/lib/stores/subagents';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('veldra-agent-runner');

/**
 * VELDRA's concrete AgentRunner implementation.
 *
 * Bridges the orchestrator core (portable contracts) to VELDRA's product
 * SubagentService (actual LLM invocation). Handles concurrency limits and
 * converts between orchestrator types and SubagentService types.
 *
 * Usage:
 *   const runner = new VeldraAgentRunner(apiKeys, providerSettings);
 *   const results = await runner.run(invocations, maxConcurrency);
 */
export class VeldraAgentRunner implements AgentRunner {
  private subagentService: SubagentService;
  private apiKeys: any;
  private providerSettings: any;

  constructor(apiKeys: any = {}, providerSettings: any = {}) {
    this.subagentService = SubagentService.getInstance();
    this.apiKeys = apiKeys;
    this.providerSettings = providerSettings;
  }

  /**
   * Runs invocations with concurrency limit, honouring maxConcurrency.
   *
   * @param invocations - Agent invocations from orchestrator core
   * @param maxConcurrency - Maximum parallel agents (from Budget)
   * @returns Results with usage tracking and evidence
   */
  async run(invocations: AgentInvocation[], maxConcurrency: number): Promise<AgentResult[]> {
    if (invocations.length === 0) {
      return [];
    }

    logger.info(`Running ${invocations.length} agent(s) with max concurrency ${maxConcurrency}`);

    // Semaphore pattern: limit concurrent spawns
    const results: AgentResult[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < invocations.length; i++) {
      const invocation = invocations[i];

      // Wait if at concurrency limit
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }

      // Spawn agent and track
      const promise = this.runSingleAgent(invocation, i)
        .then((result) => {
          results[i] = result;
        })
        .catch((error) => {
          logger.error(`Agent ${i} (${invocation.role}) failed`, error);
          results[i] = this.createFailedResult(invocation, error);
        })
        .finally(() => {
          // Remove from executing pool
          const index = executing.indexOf(promise);
          if (index > -1) {
            executing.splice(index, 1);
          }
        });

      executing.push(promise);
    }

    // Wait for all remaining
    await Promise.all(executing);

    return results;
  }

  private async runSingleAgent(invocation: AgentInvocation, index: number): Promise<AgentResult> {
    const startTime = Date.now();

    // Map orchestrator role to system prompt
    const systemPrompt = this.getSystemPromptForRole(invocation.role);

    // Determine model (use requested or fallback)
    const model = invocation.requestedModel || 'Google:gemini-1.5-pro';

    logger.info(`Spawning agent ${index} (${invocation.role}) with model ${model}`);

    // Spawn via SubagentService
    const taskIdMessage = await this.subagentService.spawnSubagent({
      model,
      systemPrompt,
      initialPrompt: invocation.prompt,
      apiKeys: this.apiKeys,
      providerSettings: this.providerSettings,
    });

    // Extract taskId from message
    const taskId = this.extractTaskId(taskIdMessage);
    if (!taskId) {
      throw new Error(`Failed to extract taskId from spawn message: ${taskIdMessage}`);
    }

    // Poll for completion
    const result = await this.waitForCompletion(taskId);
    const elapsed = Date.now() - startTime;

    logger.info(`Agent ${index} (${invocation.role}) completed in ${elapsed}ms`);

    return {
      role: invocation.role,
      output: result.result || '',
      usedModel: model,
      tokensIn: this.estimateTokens(invocation.prompt),
      tokensOut: this.estimateTokens(result.result || ''),
      costMinor: undefined, // Actual cost tracking requires provider integration
      evidence: [
        {
          kind: 'command-output',
          outcome: result.status === 'completed' ? 'pass' : 'fail',
          source: `subagent:${taskId}`,
          summary: `Subagent ${invocation.role} ${result.status}`,
          detail: result.error,
          collectedAt: Date.now(),
        },
      ],
    };
  }

  private extractTaskId(message: string): string | null {
    const match = message.match(/Task ID: (subagent-\d+-\w+)/);
    return match ? match[1] : null;
  }

  private async waitForCompletion(taskId: string, timeoutMs: number = 300000): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 500; // 500ms polling

    while (Date.now() - startTime < timeoutMs) {
      const tasks = subagentsStore.get();
      const task = tasks[taskId];

      if (!task) {
        throw new Error(`Task ${taskId} not found in subagents store`);
      }

      if (task.status === 'completed' || task.status === 'failed') {
        return task;
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Agent execution timed out after ${timeoutMs}ms`);
  }

  private getSystemPromptForRole(role: string): string {
    // Map orchestrator roles to system prompts
    // This is a simple mapping; could be enhanced with a registry
    const rolePrompts: Record<string, string> = {
      'security-reviewer': `You are a security expert reviewing code for vulnerabilities.
Focus on: OWASP Top 10, credential leaks, injection attacks, auth issues.
Output: structured findings with severity ratings.`,

      'code-reviewer': `You are a code quality reviewer.
Focus on: architecture, patterns, maintainability, test coverage.
Output: structured findings with priority levels.`,

      'researcher': `You are a research agent investigating external documentation.
Focus on: finding relevant sources, synthesizing information, citing references.
Output: research report with sources cited.`,

      'architect': `You are an architecture reviewer.
Focus on: system design, provider neutrality, separation of concerns.
Output: architectural analysis with recommendations.`,

      'tester': `You are a test engineer.
Focus on: test coverage, test quality, edge cases, failure scenarios.
Output: test plan or test implementation.`,

      default: `You are an AI assistant helping with software development.
Follow best practices and provide clear, actionable output.`,
    };

    return rolePrompts[role] || rolePrompts.default;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  private createFailedResult(invocation: AgentInvocation, error: unknown): AgentResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      role: invocation.role,
      output: '',
      usedModel: invocation.requestedModel,
      tokensIn: this.estimateTokens(invocation.prompt),
      tokensOut: 0,
      evidence: [
        {
          kind: 'command-output',
          outcome: 'fail',
          source: `agent:${invocation.role}`,
          summary: `Agent ${invocation.role} failed to execute`,
          detail: errorMessage,
          collectedAt: Date.now(),
        },
      ],
    };
  }
}
