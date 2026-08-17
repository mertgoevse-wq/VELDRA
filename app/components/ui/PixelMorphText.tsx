import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '~/lib/hooks/usePrefersReducedMotion';
import { PixelMorphEngine } from '~/lib/media/pixelMorph/engine';
import { PIXEL_MORPH_PRESETS } from '~/lib/media/pixelMorph/presets';

interface PixelMorphTextProps {
  text: string;
  preset?: keyof typeof PIXEL_MORPH_PRESETS;
  className?: string;
  maxParticles?: number;
}

const DEFAULT_MAX_PARTICLES = 480;

/**
 * A modest, coarse "is this worth animating" signal, not a real capability probe -- checking
 * actual sustained frame timing would need the RAF loop already running to measure it. Devices
 * with very few logical cores are the ones most likely to also be low-end/older Android
 * hardware, per the mandate's explicit "low-end Android fallback" requirement.
 */
function isLikelyLowEndDevice(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
    ? navigator.hardwareConcurrency <= 2
    : false;
}

/**
 * Reusable pixel-dissolve text transition -- the engine behind the home greeting's rotating
 * line (see app/components/chat/WelcomeHero.client.tsx), built as a standalone component so the
 * same PixelMorphEngine/preset pair can back a splash or loading-state variant later without
 * duplicating the canvas/RAF/accessibility plumbing here. See engine.ts's own doc comment for
 * the simulation itself; this component owns only DOM/canvas concerns:
 *
 * - Real screen-reader accessibility: the canvas is `aria-hidden`, and a visually-hidden
 *   `aria-live="polite"` text mirror carries the actual content, so the animation is decorative
 *   rather than the only way to read the text.
 * - `prefers-reduced-motion` (via the shared, reactive usePrefersReducedMotion hook) and a
 *   coarse low-end-device heuristic both fall back to plain static text -- no canvas, no RAF
 *   loop at all, not just a disabled animation.
 * - Pauses the RAF loop entirely (not just skips drawing) when the tab/app is backgrounded
 *   (`document.visibilitychange`), and always cancels it on unmount.
 * - DPR-aware canvas sizing for crisp particles on high-density (most real Android) displays.
 */
export function PixelMorphText({ text, preset = 'greeting', className, maxParticles }: PixelMorphTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixelMorphEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();
  const useFallback = prefersReducedMotion || isLikelyLowEndDevice();

  /*
   * Keep the engine's target text current even while the fallback path is active, so switching
   * away from reduced-motion mid-session (a live OS toggle) resumes on the right text.
   */
  useEffect(() => {
    engineRef.current?.setText(text);
  }, [text]);

  useEffect(() => {
    if (useFallback) {
      return undefined;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;

    if (!container || !canvas) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return undefined;
    }

    const engine = new PixelMorphEngine({
      preset: PIXEL_MORPH_PRESETS[preset],
      maxParticles: maxParticles ?? DEFAULT_MAX_PARTICLES,
    });
    engineRef.current = engine;

    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();

      if (width <= 0 || height <= 0) {
        return;
      }

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      engine.resize(width, height);
      engine.setText(text);
    };

    applySize();

    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(container);

    let running = true;

    const frame = (timestamp: number) => {
      if (!running) {
        return;
      }

      const last = lastFrameTimeRef.current;
      const dt = last === null ? 16 : Math.min(64, timestamp - last);
      lastFrameTimeRef.current = timestamp;

      engine.update(dt);
      engine.render(ctx, getComputedStyle(container).color);

      rafRef.current = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      lastFrameTimeRef.current = null;
    };

    const start = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(frame);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    if (!document.hidden) {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      running = false;
      stop();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      engineRef.current = null;
    };

    /*
     * Only (re)build the engine/RAF loop when the fallback mode or preset changes -- `text`
     * updates flow through the separate effect above via engine.setText().
     */
  }, [useFallback, preset, maxParticles]);

  if (useFallback) {
    return (
      <p aria-live="polite" className={className}>
        {text}
      </p>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} aria-hidden="true" className="block w-full h-full" />
      <span className="sr-only" aria-live="polite">
        {text}
      </span>
    </div>
  );
}
