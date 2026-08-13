import { describe, expect, it } from 'vitest';
import { SKINS, SKIN_LABELS, SKIN_DESCRIPTIONS, DEFAULT_SKIN } from './skin';

describe('skin registry', () => {
  it('keeps labels and descriptions aligned with the supported skin values', () => {
    const labelKeys = Object.keys(SKIN_LABELS);
    const descKeys = Object.keys(SKIN_DESCRIPTIONS);
    expect(labelKeys).toEqual([...SKINS]);
    expect(descKeys).toEqual([...SKINS]);
  });

  it('has a valid default skin', () => {
    expect((SKINS as readonly string[]).includes(DEFAULT_SKIN)).toBe(true);
  });

  it('contains the expected number of skins', () => {
    expect(SKINS.length).toBe(11);
  });
});
