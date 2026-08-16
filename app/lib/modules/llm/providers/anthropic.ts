import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { createAnthropic } from '@ai-sdk/anthropic';

export default class AnthropicProvider extends BaseProvider {
  name = 'Anthropic';
  getApiKeyLink = 'https://console.anthropic.com/settings/keys';

  config = {
    apiTokenKey: 'ANTHROPIC_API_KEY',
  };

  staticModels: ModelInfo[] = [
    /*
     * Essential fallback models -- used only when no API key is configured or the live
     * /v1/models fetch below fails, so these must always be genuinely current, never
     * deprecated/retired ids. (Previously hardcoded claude-3-5-sonnet-20241022, which
     * retired 2025-10-28 and 404s -- a user without a working dynamic fetch could select a
     * dead model. Replaced with the current Opus/Sonnet/Haiku tier, same shape as before.)
     */
    {
      name: 'claude-opus-5',
      label: 'Claude Opus 5',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-sonnet-5',
      label: 'Claude Sonnet 5',
      provider: 'Anthropic',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'claude-haiku-4-5',
      label: 'Claude Haiku 4.5',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.anthropic.com/v1/models`, {
      headers: {
        'x-api-key': `${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter((model: any) => model.type === 'model' && !staticModelIds.includes(model.id));

    return data.map((m: any) => {
      /*
       * The Models API's own fields are authoritative when present: max_input_tokens is the
       * context window, max_tokens is the output cap (both added to /v1/models responses
       * 2026-03) -- these were previously swapped (max_tokens was misread as context window),
       * which silently mis-sized every model whose response included it.
       */
      let contextWindow = 32000; // default fallback, only used if the API omits max_input_tokens

      if (m.max_input_tokens) {
        contextWindow = m.max_input_tokens;
      } else if (
        m.id?.includes('claude-opus-4') ||
        m.id?.includes('claude-opus-5') ||
        m.id?.includes('claude-sonnet-4') ||
        m.id?.includes('claude-sonnet-5') ||
        m.id?.includes('claude-fable') ||
        m.id?.includes('claude-mythos')
      ) {
        contextWindow = 1000000; // current Opus/Sonnet/Fable/Mythos generations: 1M context
      } else if (m.id?.includes('claude-haiku-4')) {
        contextWindow = 200000; // Haiku 4.5: 200k context
      } else if (m.id?.includes('claude-3-5-sonnet')) {
        contextWindow = 200000; // Claude 3.5 Sonnet has 200k context
      } else if (m.id?.includes('claude-3-haiku')) {
        contextWindow = 200000; // Claude 3 Haiku has 200k context
      } else if (m.id?.includes('claude-3-opus')) {
        contextWindow = 200000; // Claude 3 Opus has 200k context
      } else if (m.id?.includes('claude-3-sonnet')) {
        contextWindow = 200000; // Claude 3 Sonnet has 200k context
      }

      let maxCompletionTokens = 128000; // default for older Claude 3 models

      if (m.max_tokens) {
        maxCompletionTokens = m.max_tokens;
      } else if (m.id?.includes('claude-haiku-4')) {
        maxCompletionTokens = 64000; // Haiku 4.5: 64K output limit
      } else if (
        m.id?.includes('claude-opus-4') ||
        m.id?.includes('claude-opus-5') ||
        m.id?.includes('claude-sonnet-4') ||
        m.id?.includes('claude-sonnet-5') ||
        m.id?.includes('claude-fable') ||
        m.id?.includes('claude-mythos')
      ) {
        maxCompletionTokens = 128000; // current-generation models: 128K output limit
      } else if (m.id?.includes('claude-4')) {
        maxCompletionTokens = 32000; // unrecognized older Claude 4 models: conservative default
      }

      return {
        name: m.id,
        label: `${m.display_name} (${Math.floor(contextWindow / 1000)}k context)`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens,
      };
    });
  }

  getModelInstance: (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModelV1 = (options) => {
    const { apiKeys, providerSettings, serverEnv, model } = options;
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });
    const anthropic = createAnthropic({
      apiKey,
      headers: { 'anthropic-beta': 'output-128k-2025-02-19' },
    });

    return anthropic(model);
  };
}
