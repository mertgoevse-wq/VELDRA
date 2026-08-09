import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

const NVIDIA_NIM_DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MAX_DISCOVERED_MODELS = 500;
const MAX_MODEL_ID_LENGTH = 512;

interface NvidiaNimModelsResponse {
  data?: Array<{ id?: string }>;
}

/** Normalize hosted or self-hosted NIM URLs to the OpenAI-compatible /v1 root. */
export function normalizeNvidiaNimBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '') || NVIDIA_NIM_DEFAULT_BASE_URL;

  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
}

export default class NvidiaNimProvider extends BaseProvider {
  name = 'NvidiaNim';
  getApiKeyLink = 'https://build.nvidia.com/explore/discover';
  labelForGetApiKey = 'Get NVIDIA API key';

  config = {
    baseUrlKey: 'NVIDIA_NIM_BASE_URL',
    apiTokenKey: 'NVIDIA_API_KEY',
    baseUrl: NVIDIA_NIM_DEFAULT_BASE_URL,
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'NVIDIA_NIM_BASE_URL',
      defaultApiTokenKey: 'NVIDIA_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    const response = await fetch(`${normalizeNvidiaNimBaseUrl(baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: this.createTimeoutSignal(),
    });

    if (!response.ok) {
      throw new Error(`NVIDIA NIM model discovery failed: HTTP ${response.status}: ${response.statusText}`);
    }

    const payload = (await response.json()) as NvidiaNimModelsResponse;

    return (Array.isArray(payload.data) ? payload.data : [])
      .filter(
        (model): model is { id: string } =>
          typeof model?.id === 'string' && model.id.length > 0 && model.id.length <= MAX_MODEL_ID_LENGTH,
      )
      .slice(0, MAX_DISCOVERED_MODELS)
      .map((model) => ({
        name: model.id,
        label: model.id,
        provider: this.name,
        // NIM's /v1/models response does not guarantee context metadata. Keep
        // the existing provider contract conservative until a capability probe
        // supplies a verified per-model limit.
        maxTokenAllowed: 8000,
      }));
  }

  getModelInstance(options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: this.convertEnvToRecord(serverEnv),
      defaultBaseUrlKey: 'NVIDIA_NIM_BASE_URL',
      defaultApiTokenKey: 'NVIDIA_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(normalizeNvidiaNimBaseUrl(baseUrl), apiKey, model);
  }
}
