import { json } from '@remix-run/cloudflare';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting, ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';

export interface ModelsResponse {
  modelList: ModelInfo[];
  providers: ProviderInfo[];
  defaultProvider: ProviderInfo;
}

let cachedProviders: ProviderInfo[] | null = null;
let cachedDefaultProvider: ProviderInfo | null = null;

function getProviderInfo(llmManager: LLMManager) {
  if (!cachedProviders) {
    cachedProviders = llmManager.getAllProviders().map((provider) => ({
      name: provider.name,
      staticModels: provider.staticModels,
      getApiKeyLink: provider.getApiKeyLink,
      labelForGetApiKey: provider.labelForGetApiKey,
      icon: provider.icon,
    }));
  }

  if (!cachedDefaultProvider) {
    const defaultProvider = llmManager.getDefaultProvider();
    cachedDefaultProvider = {
      name: defaultProvider.name,
      staticModels: defaultProvider.staticModels,
      getApiKeyLink: defaultProvider.getApiKeyLink,
      labelForGetApiKey: defaultProvider.labelForGetApiKey,
      icon: defaultProvider.icon,
    };
  }

  return { providers: cachedProviders, defaultProvider: cachedDefaultProvider };
}

export interface GetModelsDataOptions {
  provider?: string;
  apiKeys: Record<string, string>;
  providerSettings: Record<string, IProviderSetting>;
  serverEnv?: Record<string, string>;
}

/**
 * Shared by the cookie-authenticated web loader below and the Bearer-token
 * Android bridge (app/routes/api.android.models.ts) -- both resolve
 * apiKeys/providerSettings differently, but the LLMManager lookup itself is
 * identical, so it lives here once instead of twice.
 */
export async function getModelsData(options: GetModelsDataOptions): Promise<ModelsResponse> {
  const llmManager = LLMManager.getInstance(options.serverEnv);
  const { providers, defaultProvider } = getProviderInfo(llmManager);

  let modelList: ModelInfo[] = [];

  if (options.provider) {
    const provider = llmManager.getProvider(options.provider);

    if (provider) {
      modelList = await llmManager.getModelListFromProvider(provider, {
        apiKeys: options.apiKeys,
        providerSettings: options.providerSettings,
        serverEnv: options.serverEnv,
      });
    }
  } else {
    modelList = await llmManager.updateModelList({
      apiKeys: options.apiKeys,
      providerSettings: options.providerSettings,
      serverEnv: options.serverEnv,
    });
  }

  return { modelList, providers, defaultProvider };
}

export async function loader({
  request,
  params,
  context,
}: {
  request: Request;
  params: { provider?: string };
  context: {
    cloudflare?: {
      env: Record<string, string>;
    };
  };
}): Promise<Response> {
  // Get client side maintained API keys and provider settings from cookies
  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  const data = await getModelsData({
    provider: params.provider,
    apiKeys,
    providerSettings,
    serverEnv: context.cloudflare?.env,
  });

  return json<ModelsResponse>(data);
}
