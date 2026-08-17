export interface SampledPoint {
  x: number;
  y: number;
}

export interface TextSampleOptions {
  font: string;
  maxPoints: number;
  stride?: number;
}

/**
 * Samples a text string into a sparse set of points covering its lit (alpha-above-threshold)
 * pixels, using an offscreen canvas as the rasterizer. This is the first of what should
 * eventually be several point-source producers sharing PixelMorphEngine's target API (see
 * engine.ts's `setSourcePoints`) -- a future image-alpha sampler for "generated images become
 * pixel fields" / "logos morph" would implement the same SampledPoint[] output shape from a
 * different input (an Asset's bitmap instead of a font glyph), not require a different engine.
 */
export function sampleText(
  text: string,
  canvasWidth: number,
  canvasHeight: number,
  options: TextSampleOptions,
): SampledPoint[] {
  if (canvasWidth <= 0 || canvasHeight <= 0 || !text) {
    return [];
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = canvasWidth;
  offscreen.height = canvasHeight;

  const ctx = offscreen.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return [];
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.font = options.font;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvasWidth / 2, canvasHeight / 2, canvasWidth * 0.94);

  const { data } = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const stride = options.stride ?? 3;
  const candidates: SampledPoint[] = [];

  for (let y = 0; y < canvasHeight; y += stride) {
    for (let x = 0; x < canvasWidth; x += stride) {
      const alpha = data[(y * canvasWidth + x) * 4 + 3];

      if (alpha > 80) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length <= options.maxPoints) {
    return candidates;
  }

  /*
   * Evenly subsample to hit the particle budget rather than truncating the array, which would
   * bias coverage toward whichever glyphs happen to rasterize first (top-left of the string).
   */
  const result: SampledPoint[] = [];
  const step = candidates.length / options.maxPoints;

  for (let i = 0; i < options.maxPoints; i++) {
    result.push(candidates[Math.floor(i * step)]);
  }

  return result;
}
