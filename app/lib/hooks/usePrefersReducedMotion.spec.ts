// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  let matches = initialMatches;

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mediaQueryList),
  });

  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    cleanup();
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('reflects the current matchMedia value on mount', () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
  });

  it('returns false when the OS has no reduced-motion preference', () => {
    mockMatchMedia(false);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });

  it('reacts live to the OS preference changing while mounted', () => {
    const control = mockMatchMedia(false);

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => control.setMatches(true));
    expect(result.current).toBe(true);

    act(() => control.setMatches(false));
    expect(result.current).toBe(false);
  });

  it('does not crash when window.matchMedia is unavailable, and reports false', () => {
    // Deliberately simulating an environment without matchMedia.
    delete (window as { matchMedia?: unknown }).matchMedia;

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });
});
