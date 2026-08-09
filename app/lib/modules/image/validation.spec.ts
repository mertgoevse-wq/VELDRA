import { describe, expect, it } from 'vitest';
import { validateImageGenerationOptions } from './validation';
import type { ImageModelInfo } from './types';

const model: ImageModelInfo = {
  id: 'verified-test-model',
  displayName: 'Verified Test Image Model',
  provider: 'TestProvider',
  modality: 'image',
  status: 'active',
  availability: 'available',
  inputTypes: ['text'],
  outputTypes: ['image'],
  capabilities: {
    operations: ['text-to-image'],
    inputTypes: ['text'],
    outputTypes: ['image'],
    supportedAspectRatios: ['1:1', '16:9'],
    supportedResolutions: ['1024x1024'],
    supportsQuality: false,
    supportsVariants: true,
    maxVariants: 2,
    supportsSeed: false,
    supportsNegativePrompt: false,
    supportsStyle: true,
    supportsTransparentBackground: false,
  },
  costDescription: 'test-only',
  accessTier: 'unknown',
  local: false,
  apiAvailable: true,
  useCases: ['test'],
};

describe('image generation option validation', () => {
  it('accepts options supported by the selected model', () => {
    expect(
      validateImageGenerationOptions(model, {
        modelId: model.id,
        prompt: 'A logo',
        aspectRatio: '16:9',
        resolution: '1024x1024',
        variants: 2,
        style: 'minimal',
      }),
    ).toEqual([]);
  });

  it('reports unsupported options instead of silently sending them', () => {
    const errors = validateImageGenerationOptions(model, {
      modelId: model.id,
      prompt: 'A logo',
      aspectRatio: '3:2',
      resolution: '2048x2048',
      variants: 3,
      seed: 7,
      negativePrompt: 'blur',
      transparentBackground: true,
    });

    expect(errors).toHaveLength(7);
    expect(errors.join(' ')).toMatch(/not supported/);
  });
});
