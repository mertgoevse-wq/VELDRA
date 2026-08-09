import { describe, expect, it } from 'vitest';
import { parseImageGenerationRequest } from './request';

describe('parseImageGenerationRequest', () => {
  it('normalizes a valid request', () => {
    const parsed = parseImageGenerationRequest({
      modelId: 'model-1',
      prompt: '  A VELDRA icon  ',
      variants: 2,
      sourceImage: { mimeType: 'image/png', dataBase64: 'AA==' },
    });

    expect(parsed).toEqual({
      ok: true,
      options: {
        modelId: 'model-1',
        prompt: 'A VELDRA icon',
        variants: 2,
        sourceImage: { mimeType: 'image/png', dataBase64: 'AA==' },
      },
    });
  });

  it('rejects malformed scalar values and unsupported input MIME types', () => {
    expect(parseImageGenerationRequest({ modelId: 'model-1', prompt: 42 }).ok).toBe(false);
    expect(
      parseImageGenerationRequest({
        modelId: 'model-1',
        prompt: 'A VELDRA icon',
        sourceImage: { mimeType: 'text/plain', dataBase64: 'AA==' },
      }),
    ).toEqual({ ok: false, error: 'sourceImage must be a supported image input' });
  });

  it('rejects invalid numeric bounds', () => {
    expect(parseImageGenerationRequest({ modelId: 'model-1', prompt: 'A', variants: 0 })).toEqual({
      ok: false,
      error: 'variants must be an integer between 1 and 16',
    });
    expect(parseImageGenerationRequest({ modelId: 'model-1', prompt: 'A', seed: -1 })).toEqual({
      ok: false,
      error: 'seed must be a non-negative integer',
    });
  });
});
