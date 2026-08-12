// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getImageFiles, processImageFiles } from './composer';

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

describe('processImageFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters to images and reads every one as a data URL', async () => {
    const image = new File(['pixel-bytes'], 'design.png', { type: 'image/png' });
    const text = new File(['notes'], 'notes.txt', { type: 'text/plain' });

    const result = await processImageFiles([image, text]);

    expect(result.failedCount).toBe(0);
    expect(result.successfulFiles).toEqual([image]);
    expect(result.imageData).toHaveLength(1);
    expect(result.imageData[0]).toMatch(/^data:image\/png;base64,/);
  });

  it('isolates a single unreadable file instead of failing the whole batch', async () => {
    /*
     * Regression test for the gap the BaseChat.tsx paperclip/paste handlers used to have (a bare
     * FileReader with no error handling at all): a corrupt/unreadable file in a multi-file
     * selection must not drop the files that DID read successfully.
     */
    const good = new File(['ok'], 'good.png', { type: 'image/png' });
    const bad = new File(['bad'], 'bad.png', { type: 'image/png' });

    const originalFileReader = globalThis.FileReader;

    class FlakyFileReader extends originalFileReader {
      readAsDataURL(file: Blob) {
        if ((file as File).name === 'bad.png') {
          setTimeout(() => this.dispatchEvent(new Event('error')));
          return;
        }

        super.readAsDataURL(file);
      }
    }

    vi.stubGlobal('FileReader', FlakyFileReader);

    const result = await processImageFiles([good, bad]);

    expect(result.failedCount).toBe(1);
    expect(result.successfulFiles).toEqual([good]);
    expect(result.imageData).toHaveLength(1);
  });

  it('returns an empty result when nothing dropped/pasted is an image', async () => {
    const pdf = new File(['%PDF'], 'brief.pdf', { type: 'application/pdf' });

    const result = await processImageFiles([pdf]);

    expect(result).toEqual({ successfulFiles: [], imageData: [], failedCount: 0 });
  });
});
