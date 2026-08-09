import type { ImageGenerationOptions, ImageModelInfo } from './types';

export function validateImageGenerationOptions(model: ImageModelInfo, options: ImageGenerationOptions): string[] {
  const errors: string[] = [];
  const capabilities = model.capabilities;

  if (!options.prompt.trim()) {
    errors.push('A prompt is required.');
  }

  if (options.operation && !capabilities.operations.includes(options.operation)) {
    errors.push(`Operation "${options.operation}" is not supported by ${model.displayName}.`);
  }

  if (options.aspectRatio && !capabilities.supportedAspectRatios.includes(options.aspectRatio)) {
    errors.push(`Aspect ratio "${options.aspectRatio}" is not supported by ${model.displayName}.`);
  }

  if (options.resolution && !capabilities.supportedResolutions.includes(options.resolution)) {
    errors.push(`Resolution "${options.resolution}" is not supported by ${model.displayName}.`);
  }

  if (options.quality && !capabilities.supportsQuality) {
    errors.push(`Quality controls are not supported by ${model.displayName}.`);
  }

  if (options.variants !== undefined) {
    if (!capabilities.supportsVariants) {
      errors.push(`Multiple variants are not supported by ${model.displayName}.`);
    } else if (options.variants < 1 || options.variants > (capabilities.maxVariants ?? 1)) {
      errors.push(`Variants must be between 1 and ${capabilities.maxVariants ?? 1}.`);
    }
  }

  if (options.seed !== undefined && !capabilities.supportsSeed) {
    errors.push(`Seed control is not supported by ${model.displayName}.`);
  }

  if (options.negativePrompt && !capabilities.supportsNegativePrompt) {
    errors.push(`Negative prompts are not supported by ${model.displayName}.`);
  }

  if (options.style && !capabilities.supportsStyle) {
    errors.push(`Style presets are not supported by ${model.displayName}.`);
  }

  if (options.transparentBackground && !capabilities.supportsTransparentBackground) {
    errors.push(`Transparent backgrounds are not supported by ${model.displayName}.`);
  }

  return errors;
}
