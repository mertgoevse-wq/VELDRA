import { BaseProvider } from '../base-provider';
import type { ModelInfo } from '../types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { spawn } from 'node:child_process';
import { WORK_DIR } from '~/utils/constants';

export default class ExternalCLIProvider extends BaseProvider {
  name = 'ExternalCLI';
  getApiKeyLink = '';

  config = {
    apiTokenKey: 'EXTERNAL_CLI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'gemini-cli',
      label: 'Gemini CLI Agent',
      provider: 'ExternalCLI',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'antigravity-cli',
      label: 'Antigravity MCP Agent',
      provider: 'ExternalCLI',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 8192,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    return this.staticModels;
  }

  getModelInstance(options: {
    model: string;
    serverEnv: any;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    return {
      specificationVersion: 'v1',
      provider: this.name,
      modelId: options.model,
      defaultObjectGenerationMode: 'json',
      async doGenerate(callOptions) {
        throw new Error('doGenerate: Not implemented. Use doStream.');
      },
      async doStream(callOptions) {
        // Construct full chat history
        const promptLines = callOptions.prompt.map(msg => {
          let content = '';
          if (typeof msg.content === 'string') {
            content = msg.content;
          } else if (Array.isArray(msg.content)) {
            content = msg.content
              .filter(part => part.type === 'text')
              .map(part => (part as any).text)
              .join('\n');
          }
          return `${msg.role.toUpperCase()}:\n${content}`;
        });
        const promptText = promptLines.join('\n\n');

        const executable = options.model === 'antigravity-cli' 
          ? '/data/data/com.termux/files/home/.local/bin/agy' 
          : '/data/data/com.termux/files/usr/bin/gemini';

        let childProcess: ReturnType<typeof spawn> | null = null;

        return {
          stream: new ReadableStream({
            start(controller) {
              const env = { ...process.env };
              if (options.apiKeys?.EXTERNAL_CLI_API_KEY) {
                env.GEMINI_API_KEY = options.apiKeys.EXTERNAL_CLI_API_KEY;
                env.AGY_API_KEY = options.apiKeys.EXTERNAL_CLI_API_KEY;
              }

              const child = spawn(executable, ['--yolo'], {
                cwd: WORK_DIR,
                env,
                stdio: ['pipe', 'pipe', 'pipe']
              });
              childProcess = child;

              // Write the prompt to stdin to avoid E2BIG argument length limits
              if (child.stdin) {
                child.stdin.write(promptText);
                child.stdin.end();
              }

              let stderrBuffer = '';

              const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

              child.stdout.on('data', (chunk: Buffer) => {
                const text = stripAnsi(chunk.toString('utf8'));
                controller.enqueue({
                  type: 'text-delta',
                  textDelta: text
                });
              });

              child.stderr.on('data', (chunk: Buffer) => {
                stderrBuffer += chunk.toString('utf8');
              });

              child.on('close', (code) => {
                if (code !== 0) {
                  controller.error(new Error(`Process exited with code ${code}\nStderr:\n${stripAnsi(stderrBuffer)}`));
                } else {
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { promptTokens: 0, completionTokens: 0 }
                  });
                  controller.close();
                }
              });

              child.on('error', (err) => {
                controller.error(err);
              });
            },
            cancel() {
              if (childProcess) {
                childProcess.kill('SIGTERM');
              }
            }
          }),
          warnings: []
        };
      },
    } as unknown as LanguageModelV1;
  }
}
