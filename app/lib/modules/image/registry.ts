import { ImageGenerationUnavailableError } from './types';
import type { ImageGenerationOptions, ImageModelInfo, ImageProvider, ImageGenerationResult } from './types';

/**
 * Image models are intentionally not marked available until a real provider
 * integration and credentials are configured. This prevents the UI from
 * offering a model ID that has not been verified for this deployment.
 */
export const IMAGE_MODEL_CATALOG: readonly ImageModelInfo[] = [];

export class UnconfiguredImageProvider implements ImageProvider {
  readonly name = 'Unconfigured';

  getModels(): readonly ImageModelInfo[] {
    return IMAGE_MODEL_CATALOG;
  }

  async generate(_options: ImageGenerationOptions, _signal?: AbortSignal): Promise<ImageGenerationResult> {
    throw new ImageGenerationUnavailableError(
      'Image generation is not configured. Add a verified image provider and credentials before generating.',
    );
  }
}

export interface ImageProviderRegistry {
  getProvider(name: string): ImageProvider | undefined;
  getProviderForModel(modelId: string): ImageProvider | undefined;
  getProviders(): readonly ImageProvider[];
  getModels(): readonly ImageModelInfo[];
}

export function createImageProviderRegistry(providers: readonly ImageProvider[] = []): ImageProviderRegistry {
  const providerMap = new Map(providers.map((provider) => [provider.name, provider]));

  return {
    getProvider: (name) => providerMap.get(name),
    getProviderForModel: (modelId) =>
      providers.find((provider) => provider.getModels().some((model) => model.id === modelId)),
    getProviders: () => providers,
    getModels: () => providers.flatMap((provider) => provider.getModels()),
  };
}

export const imageProviderRegistry = createImageProviderRegistry();
export const unavailableImageProvider = new UnconfiguredImageProvider();
