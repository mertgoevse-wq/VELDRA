import { describe, expect, it } from 'vitest';
import { runImageJob } from './jobs';
import type { ImageGenerationOptions, ImageProvider } from './types';

const options: ImageGenerationOptions = { modelId: 'test-model', prompt: 'A test image' };

function provider(generate: ImageProvider['generate']): ImageProvider {
  return {
    name: 'TestProvider',
    getModels: () => [],
    generate,
  };
}

describe('runImageJob', () => {
  it('records a completed result', async () => {
    const execution = await runImageJob(
      provider(async () => ({
        provider: 'TestProvider',
        modelId: 'test-model',
        images: [{ mimeType: 'image/png', dataBase64: 'AA==' }],
        createdAt: '2026-08-09T00:00:00.000Z',
      })),
      options,
      { id: 'success-job' },
    );

    expect(execution.job.status).toBe('completed');
    expect(execution.result?.images).toHaveLength(1);
  });

  it('records provider failures without leaking secrets', async () => {
    const execution = await runImageJob(
      provider(async () => {
        throw new Error('Provider unavailable');
      }),
      options,
      { id: 'failed-job' },
    );

    expect(execution.job.status).toBe('failed');
    expect(execution.job.metadata.error).toBe('Provider unavailable');
    expect(JSON.stringify(execution.job)).not.toContain('apiKey');
  });

  it('cancels before invoking a provider when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    let called = false;

    const execution = await runImageJob(
      provider(async () => {
        called = true;
        throw new Error('should not run');
      }),
      options,
      { id: 'cancelled-job', signal: controller.signal },
    );

    expect(execution.job.status).toBe('cancelled');
    expect(called).toBe(false);
  });
});
