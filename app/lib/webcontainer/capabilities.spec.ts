import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectWebContainerSupport } from './capabilities';

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: capacitor }));

describe('WebContainer capability detection', () => {
  beforeEach(() => {
    capacitor.isNativePlatform.mockReturnValue(false);
    vi.stubGlobal('crossOriginIsolated', true);
    vi.stubGlobal('SharedArrayBuffer', class SharedArrayBuffer {});
  });

  it('rejects native Capacitor runtimes', () => {
    capacitor.isNativePlatform.mockReturnValue(true);

    expect(detectWebContainerSupport()).toEqual({ supported: false, reason: 'native-runtime' });
  });

  it('rejects browser contexts without cross-origin isolation', () => {
    vi.stubGlobal('crossOriginIsolated', false);

    expect(detectWebContainerSupport()).toEqual({ supported: false, reason: 'cross-origin-isolation' });
  });

  it('rejects environments without SharedArrayBuffer', () => {
    vi.stubGlobal('SharedArrayBuffer', undefined);

    expect(detectWebContainerSupport()).toEqual({ supported: false, reason: 'shared-array-buffer' });
  });

  it('accepts an isolated browser with SharedArrayBuffer', () => {
    expect(detectWebContainerSupport()).toEqual({ supported: true });
  });
});
