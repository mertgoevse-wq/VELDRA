import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './assets';

describe('image asset byte encoding', () => {
  it('preserves arbitrary binary bytes', () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 200, 255]);
    const restored = base64ToBytes(bytesToBase64(original));

    expect(Array.from(restored)).toEqual(Array.from(original));
  });
});
