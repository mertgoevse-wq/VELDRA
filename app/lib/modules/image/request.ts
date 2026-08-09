import { isSupportedImageMimeType } from './types';
import type { ImageGenerationOptions, ImageInput } from './types';

const MAX_PROMPT_LENGTH = 20_000;
const MAX_INPUT_BASE64_LENGTH = 1_500_000;
const OPERATIONS = new Set(['text-to-image', 'image-to-image', 'image-edit', 'image-variation']);

function isImageInput(value: unknown): value is ImageInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ImageInput).mimeType === 'string' &&
    isSupportedImageMimeType((value as ImageInput).mimeType) &&
    typeof (value as ImageInput).dataBase64 === 'string' &&
    (value as ImageInput).dataBase64.length > 0 &&
    (value as ImageInput).dataBase64.length <= MAX_INPUT_BASE64_LENGTH &&
    /^[A-Za-z0-9+/]*={0,2}$/.test((value as ImageInput).dataBase64)
  );
}

export function parseImageGenerationRequest(value: unknown):
  | { ok: true; options: ImageGenerationOptions }
  | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: 'Image request must be an object' };
  }

  const input = value as Partial<ImageGenerationOptions>;

  if (typeof input.modelId !== 'string' || !input.modelId.trim()) {
    return { ok: false, error: 'modelId is required' };
  }

  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: 'prompt must be a non-empty string within the allowed length' };
  }

  if (input.operation !== undefined && (typeof input.operation !== 'string' || !OPERATIONS.has(input.operation))) {
    return { ok: false, error: 'operation is not supported' };
  }

  if (input.transparentBackground !== undefined && typeof input.transparentBackground !== 'boolean') {
    return { ok: false, error: 'transparentBackground must be a boolean' };
  }

  for (const [name, value] of [
    ['aspectRatio', input.aspectRatio],
    ['resolution', input.resolution],
    ['quality', input.quality],
    ['negativePrompt', input.negativePrompt],
    ['style', input.style],
  ] as const) {
    if (value !== undefined && typeof value !== 'string') {
      return { ok: false, error: `${name} must be a string` };
    }
  }

  if (input.variants !== undefined && (!Number.isInteger(input.variants) || input.variants < 1 || input.variants > 16)) {
    return { ok: false, error: 'variants must be an integer between 1 and 16' };
  }

  if (input.seed !== undefined && (!Number.isInteger(input.seed) || input.seed < 0)) {
    return { ok: false, error: 'seed must be a non-negative integer' };
  }

  if (input.sourceImage !== undefined && !isImageInput(input.sourceImage)) {
    return { ok: false, error: 'sourceImage must be a supported image input' };
  }

  if (input.maskImage !== undefined && !isImageInput(input.maskImage)) {
    return { ok: false, error: 'maskImage must be a supported image input' };
  }

  const options: ImageGenerationOptions = {
    modelId: input.modelId.trim(),
    prompt: input.prompt.trim(),
    ...(input.operation !== undefined && { operation: input.operation }),
    ...(input.aspectRatio !== undefined && { aspectRatio: input.aspectRatio }),
    ...(input.resolution !== undefined && { resolution: input.resolution }),
    ...(input.quality !== undefined && { quality: input.quality }),
    ...(input.variants !== undefined && { variants: input.variants }),
    ...(input.seed !== undefined && { seed: input.seed }),
    ...(input.negativePrompt !== undefined && { negativePrompt: input.negativePrompt }),
    ...(input.style !== undefined && { style: input.style }),
    ...(input.transparentBackground !== undefined && { transparentBackground: input.transparentBackground }),
    ...(input.sourceImage !== undefined && { sourceImage: input.sourceImage }),
    ...(input.maskImage !== undefined && { maskImage: input.maskImage }),
  };

  return { ok: true, options };
}
