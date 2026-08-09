import { ImageGenerationUnavailableError } from './types';
import type { ImageGenerationOptions, ImageGenerationResult, ImageJob, ImageProvider } from './types';
import { createImageJob, transitionImageJob } from './types';

export interface ImageJobRunResult {
  job: ImageJob;
  result?: ImageGenerationResult;
}

export async function runImageJob(
  provider: ImageProvider,
  options: ImageGenerationOptions,
  optionsForRun: { id?: string; signal?: AbortSignal } = {},
): Promise<ImageJobRunResult> {
  let job = createImageJob(options, optionsForRun.id);

  if (optionsForRun.signal?.aborted) {
    return { job: transitionImageJob(job, { type: 'cancel' }) };
  }

  job = transitionImageJob(job, { type: 'start', provider: provider.name });

  try {
    const result = await provider.generate(options, optionsForRun.signal);

    if (optionsForRun.signal?.aborted) {
      return { job: transitionImageJob(job, { type: 'cancel' }) };
    }

    return { job: transitionImageJob(job, { type: 'complete', result }), result };
  } catch (error) {
    if (error instanceof ImageGenerationUnavailableError) {
      throw error;
    }

    if (optionsForRun.signal?.aborted) {
      return { job: transitionImageJob(job, { type: 'cancel' }) };
    }

    const message = error instanceof Error ? error.message : 'Image generation failed';

    return { job: transitionImageJob(job, { type: 'fail', error: message }) };
  }
}
