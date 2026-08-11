import { describe, expect, it } from 'vitest';
import { getImageFiles } from './composer';

describe('getImageFiles', () => {
  it('keeps image files and rejects unsupported dropped files', () => {
    const image = { type: 'image/png', name: 'design.png' } as File;
    const text = { type: 'text/plain', name: 'notes.txt' } as File;
    const empty = { type: '', name: 'unknown' } as File;

    expect(getImageFiles([image, text, empty])).toEqual([image]);
  });

  it('returns an empty list when no images are dropped', () => {
    expect(getImageFiles([{ type: 'application/pdf', name: 'brief.pdf' } as File])).toEqual([]);
  });
});
