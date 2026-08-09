import { describe, expect, it } from 'vitest';
import { createImageJob, transitionImageJob } from './types';

const options = {
  modelId: 'verified-test-model',
  prompt: 'A dark neon workbench logo',
  aspectRatio: '1:1',
};

const result = {
  provider: 'TestProvider',
  modelId: options.modelId,
  images: [{ mimeType: 'image/png', dataBase64: 'AA==' }],
  createdAt: '2026-08-09T00:00:00.000Z',
};

describe('image job lifecycle', () => {
  it('moves a job from queued to running to completed', () => {
    const queued = createImageJob(options, 'job-1');
    const running = transitionImageJob(queued, { type: 'start', provider: 'TestProvider' });
    const completed = transitionImageJob(running, { type: 'complete', result });

    expect(queued.status).toBe('queued');
    expect(running.status).toBe('running');
    expect(completed.status).toBe('completed');
    expect(completed.metadata.provider).toBe('TestProvider');
    expect(completed.metadata.options).toEqual({ modelId: options.modelId, aspectRatio: '1:1' });
  });

  it('does not store source image bytes in job metadata', () => {
    const job = createImageJob({ ...options, sourceImage: { mimeType: 'image/png', dataBase64: 'AA==' } }, 'job-input');

    expect(job.metadata.options).toEqual({
      modelId: options.modelId,
      aspectRatio: '1:1',
      sourceImage: { mimeType: 'image/png', base64Length: 4 },
    });
    expect(JSON.stringify(job)).not.toContain('AA==');
  });

  it('rejects completion before a job starts', () => {
    const queued = createImageJob(options, 'job-2');

    expect(() => transitionImageJob(queued, { type: 'complete', result })).toThrow(/from queued/);
  });

  it('supports cancellation and protects terminal jobs', () => {
    const queued = createImageJob(options, 'job-3');
    const cancelled = transitionImageJob(queued, { type: 'cancel' });

    expect(cancelled.status).toBe('cancelled');
    expect(() => transitionImageJob(cancelled, { type: 'start', provider: 'TestProvider' })).toThrow(/terminal/);
  });
});
