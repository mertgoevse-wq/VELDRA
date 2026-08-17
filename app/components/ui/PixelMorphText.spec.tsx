// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { PixelMorphText } from './PixelMorphText';

/**
 * Covers the three fallback paths that must all render the same visible plain-text mirror
 * (never a blank, aria-hidden-only canvas):
 *  - prefers-reduced-motion
 *  - the coarse low-end-device heuristic (navigator.hardwareConcurrency <= 2)
 *  - a regression guard for the real bug this file's own audit found: `canvas.getContext('2d')`
 *    returning null (jsdom's actual behavior -- it doesn't implement a 2D context, matching
 *    engine.spec.ts's own note on this) previously fell through to an empty, aria-hidden canvas
 *    with no visible text at all.
 */

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }),
  });
}

function mockHardwareConcurrency(value: number) {
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    writable: true,
    configurable: true,
    value,
  });
}

describe('PixelMorphText', () => {
  afterEach(() => {
    cleanup();
    delete (window as { matchMedia?: unknown }).matchMedia;
    delete (navigator as { hardwareConcurrency?: unknown }).hardwareConcurrency;
  });

  it('renders the plain-text fallback under prefers-reduced-motion', () => {
    mockMatchMedia(true);
    mockHardwareConcurrency(8); // not low-end -- isolating the reduced-motion path

    render(<PixelMorphText text="Hello VELDRA" />);

    const fallback = screen.getByText('Hello VELDRA');
    expect(fallback.tagName).toBe('P');
    expect(fallback).toHaveAttribute('aria-live', 'polite');
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('renders the plain-text fallback under the low-end-device heuristic', () => {
    mockMatchMedia(false);
    mockHardwareConcurrency(2); // <=2 trips isLikelyLowEndDevice()

    render(<PixelMorphText text="Hello VELDRA" />);

    const fallback = screen.getByText('Hello VELDRA');
    expect(fallback.tagName).toBe('P');
    expect(fallback).toHaveAttribute('aria-live', 'polite');
    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('regression: a null 2D context also renders the visible text fallback, not an empty canvas', async () => {
    mockMatchMedia(false);
    mockHardwareConcurrency(8);

    /*
     * Deliberately not stubbing HTMLCanvasElement.prototype.getContext -- jsdom (this project's
     * test environment) already returns null for '2d' by default, which is exactly the
     * real-world failure mode this test guards against (context-budget exhaustion, a blocking
     * extension, a locked-down WebView all surface the same way: getContext returns null).
     */
    render(<PixelMorphText text="Hello VELDRA" />);

    await waitFor(() => {
      const fallback = screen.getByText('Hello VELDRA');
      expect(fallback.tagName).toBe('P');
      expect(fallback).toHaveAttribute('aria-live', 'polite');
    });

    expect(document.querySelector('canvas')).not.toBeInTheDocument();
  });
});
