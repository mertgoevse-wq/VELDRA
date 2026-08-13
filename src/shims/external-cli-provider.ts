/**
 * No-op stub for ExternalCLIProvider in Android SPA builds.
 * The real provider uses node:child_process which is unavailable in browsers.
 */

import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class ExternalCLIProvider extends BaseProvider {
  name = 'ExternalCLI';
  getApiKeyLink = '';

  config = {
    apiTokenKey: 'EXTERNAL_CLI_API_KEY',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    _apiKeys?: Record<string, string>,
    _settings?: IProviderSetting,
    _serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    return [];
  }

  getModelInstance(_options: {
    model: string;
    serverEnv: any;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    throw new Error('ExternalCLI provider is not available on Android');
  }
}
