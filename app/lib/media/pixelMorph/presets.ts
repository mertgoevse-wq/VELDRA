export interface PixelMorphPreset {
  id: string;
  font: string;
  particleSize: number;

  /** Fraction of canvas height where dissolved particles settle (0 = top, 1 = bottom). */
  poolLine: number;
  poolJitter: number;
  dissolveMs: number;
  poolMs: number;
  reformMs: number;
}

/*
 * A small, deliberately short list of named presets rather than a general-purpose config
 * surface -- per the mandate's explicit "a small number of beautiful presets instead of many
 * fragile special cases." Add a new preset here when a second real call site needs one (e.g. a
 * splash/loading-state variant); don't grow this into per-caller inline configs.
 */
export const PIXEL_MORPH_PRESETS: Record<string, PixelMorphPreset> = {
  greeting: {
    id: 'greeting',
    font: '500 20px var(--veldra-font-brand, ui-sans-serif), sans-serif',
    particleSize: 2,
    poolLine: 0.78,
    poolJitter: 3,
    dissolveMs: 550,
    poolMs: 320,
    reformMs: 650,
  },
};
