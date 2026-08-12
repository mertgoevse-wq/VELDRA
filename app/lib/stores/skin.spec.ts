import { describe, expect, it } from 'vitest';
import { isSkin, SKIN_OPTIONS, SKINS } from './skin';

describe('skin registry', () => {
  it('keeps the user-facing options aligned with the eight supported skin values', () => {
    expect(SKIN_OPTIONS.map((option) => option.value)).toEqual([...SKINS]);
    expect(new Set(SKIN_OPTIONS.map((option) => option.label)).size).toBe(SKINS.length);
  });

  it('rejects unknown or legacy values at the runtime boundary', () => {
    expect(isSkin('core')).toBe(true);
    expect(isSkin('minimal')).toBe(true);
    expect(isSkin('veldra')).toBe(false);
    expect(isSkin('obsidian')).toBe(false);
    expect(isSkin(null)).toBe(false);
  });
});
