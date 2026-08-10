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
      /*
       * The job was already transitioned to 'running' above -- without this it would stay stuck
       * there forever (job lifecycle is documented as always reaching a terminal state: queued/
       * running/completed/failed/cancelled). The caller (api.image.ts) still gets the original
       * error to distinguish "provider unavailable" (503) from "job ran and failed" (502); this
       * only fixes the job object's own internal consistency, which matters to any future caller
       * that inspects/persists it rather than discarding it on catch, as today's single route does.
       */
      error.job = transitionImageJob(job, { type: 'fail', error: error.message });
      throw error;
    }

    if (optionsForRun.signal?.aborted) {
      return { job: transitionImageJob(job, { type: 'cancel' }) };
    }

    const message = error instanceof Error ? error.message : 'Image generation failed';

    return { job: transitionImageJob(job, { type: 'fail', error: message }) };
  }
}
