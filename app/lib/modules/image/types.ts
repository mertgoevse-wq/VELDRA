export type ImageInputType = 'text' | 'image' | 'mask';
export type ImageOutputType = 'image';
export type ImageOperation = 'text-to-image' | 'image-to-image' | 'image-edit' | 'image-variation';
export type ImageJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ImageAvailability = 'available' | 'unavailable' | 'unknown';
export type ImageAccessTier = 'free' | 'premium' | 'developer' | 'local' | 'unknown';

export interface ImageCapabilities {
  operations: ImageOperation[];
  inputTypes: ImageInputType[];
  outputTypes: ImageOutputType[];
  supportedAspectRatios: string[];
  supportedResolutions: string[];
  maxResolution?: { width: number; height: number };
  supportsQuality: boolean;
  supportsVariants: boolean;
  maxVariants?: number;
  supportsSeed: boolean;
  supportsNegativePrompt: boolean;
  supportsStyle: boolean;
  supportsTransparentBackground: boolean;
}

export interface ImageModelInfo {
  id: string;
  displayName: string;
  provider: string;
  modality: 'image';
  status: 'active' | 'deprecated' | 'unverified';
  availability: ImageAvailability;
  region?: string;
  inputTypes: ImageInputType[];
  outputTypes: ImageOutputType[];
  capabilities: ImageCapabilities;
  costDescription: string;
  accessTier: ImageAccessTier;
  local: boolean;
  apiAvailable: boolean;
  useCases: string[];
}

export interface ImageGenerationOptions {
  prompt: string;
  modelId: string;
  operation?: ImageOperation;
  aspectRatio?: string;
  resolution?: string;
  quality?: string;
  variants?: number;
  seed?: number;
  negativePrompt?: string;
  style?: string;
  transparentBackground?: boolean;
  sourceImage?: ImageInput;
  maskImage?: ImageInput;
}

export interface ImageInput {
  mimeType: string;
  dataBase64: string;
}

export interface GeneratedImage {
  mimeType: string;
  dataBase64: string;
  width?: number;
  height?: number;
}

const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const MAX_GENERATED_IMAGE_BASE64_LENGTH = 12_000_000;

export function isSupportedImageMimeType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function isValidGeneratedImage(image: GeneratedImage): boolean {
  return (
    isSupportedImageMimeType(image.mimeType) &&
    image.dataBase64.length > 0 &&
    image.dataBase64.length <= MAX_GENERATED_IMAGE_BASE64_LENGTH &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(image.dataBase64)
  );
}

export interface ImageGenerationResult {
  provider: string;
  modelId: string;
  images: GeneratedImage[];
  createdAt: string;
  cost?: { amount?: number; currency?: string; description?: string };
}

export interface ImageProvider {
  readonly name: string;
  getModels(): readonly ImageModelInfo[];
  generate(options: ImageGenerationOptions, signal?: AbortSignal): Promise<ImageGenerationResult>;
}

export interface ImageJobMetadata {
  provider?: string;
  modelId: string;
  prompt: string;
  options: Omit<ImageGenerationOptions, 'prompt' | 'sourceImage' | 'maskImage'> & {
    sourceImage?: { mimeType: string; base64Length: number };
    maskImage?: { mimeType: string; base64Length: number };
  };
  createdAt: string;
  completedAt?: string;
  outputFiles: string[];
  cost?: ImageGenerationResult['cost'];
  error?: string;
}

export interface ImageJob {
  id: string;
  status: ImageJobStatus;
  metadata: ImageJobMetadata;
}

export type ImageJobEvent =
  | { type: 'start'; provider: string }
  | { type: 'complete'; result: ImageGenerationResult }
  | { type: 'fail'; error: string }
  | { type: 'cancel' };

export class ImageGenerationUnavailableError extends Error {
  readonly code = 'image_generation_not_configured';

  /**
   * Set by runImageJob() before rethrowing, so a caller that persists/inspects jobs (unlike
   * api.image.ts's current single-request flow, which only needs the error itself) can still see
   * the job reached its terminal 'failed' state rather than being left stuck in 'running'.
   */
  job?: ImageJob;

  constructor(message = 'No image generation provider is configured') {
    super(message);
    this.name = 'ImageGenerationUnavailableError';
  }
}

export function createImageJob(options: ImageGenerationOptions, id: string = crypto.randomUUID()): ImageJob {
  const { prompt, sourceImage, maskImage, ...jobOptions } = options;
  const metadataOptions = {
    ...jobOptions,
    ...(sourceImage && {
      sourceImage: { mimeType: sourceImage.mimeType, base64Length: sourceImage.dataBase64.length },
    }),
    ...(maskImage && { maskImage: { mimeType: maskImage.mimeType, base64Length: maskImage.dataBase64.length } }),
  };

  return {
    id,
    status: 'queued',
    metadata: {
      modelId: options.modelId,
      prompt,
      options: metadataOptions,
      createdAt: new Date().toISOString(),
      outputFiles: [],
    },
  };
}

export function transitionImageJob(job: ImageJob, event: ImageJobEvent): ImageJob {
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    throw new Error(`Cannot transition a terminal image job (${job.status})`);
  }

  if (event.type === 'cancel') {
    if (job.status !== 'queued' && job.status !== 'running') {
      throw new Error(`Cannot cancel image job from ${job.status}`);
    }

    return { ...job, status: 'cancelled' };
  }

  if (event.type === 'start') {
    if (job.status !== 'queued') {
      throw new Error(`Cannot start image job from ${job.status}`);
    }

    return {
      ...job,
      status: 'running',
      metadata: { ...job.metadata, provider: event.provider },
    };
  }

  if (job.status !== 'running') {
    throw new Error(`Cannot complete, fail, or cancel image job from ${job.status}`);
  }

  if (event.type === 'complete') {
    return {
      ...job,
      status: 'completed',
      metadata: {
        ...job.metadata,
        provider: event.result.provider,
        completedAt: new Date().toISOString(),
        cost: event.result.cost,
      },
    };
  }

  if (event.type === 'fail') {
    return { ...job, status: 'failed', metadata: { ...job.metadata, error: event.error } };
  }

  throw new Error('Unsupported image job event');
}
