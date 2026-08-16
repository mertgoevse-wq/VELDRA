import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';

export type ModelStatus = 'current' | 'deprecated' | 'retired';

export interface ModelInfo {
  name: string;
  label: string;
  provider: string;

  /** Maximum context window size (input tokens) - how many tokens the model can process */
  maxTokenAllowed: number;

  /** Maximum completion/output tokens - how many tokens the model can generate. If not specified, falls back to provider defaults */
  maxCompletionTokens?: number;

  /**
   * Lifecycle status as of this VELDRA release. Omitted means 'current' -- only set
   * explicitly for a model a provider's API may still serve/list but that is known to be on
   * its way out or already dead. 'retired' entries are filtered out of every list
   * LLMManager returns (see manager.ts) so a dead model id can never reach the picker UI,
   * even as a static fallback when live discovery is unavailable.
   */
  status?: ModelStatus;
}

export interface ProviderInfo {
  name: string;
  staticModels: ModelInfo[];
  getDynamicModels?: (
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ) => Promise<ModelInfo[]>;
  getModelInstance: (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModelV1;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;
}
export interface ProviderConfig {
  baseUrlKey?: string;
  baseUrl?: string;
  apiTokenKey?: string;
}
