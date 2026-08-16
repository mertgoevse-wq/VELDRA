// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * device.ts generates its ID at module load (a real, deliberate module-level side effect --
 * matches entitlement.ts's existing pattern in this codebase). Testing that "generate once,
 * then reuse" behavior requires re-importing a fresh module instance per test via
 * vi.resetModules(), the standard way to test module-load-time initialization in Vitest.
 */
describe('device identity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('generates a real UUID-shaped device ID and persists it to localStorage', async () => {
    const { getDeviceId } = await import('./device');
    const id = getDeviceId();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(localStorage.getItem('veldra_device_id')).toBe(id);
  });

  it('reuses the same ID across a fresh module load instead of generating a new one every time', async () => {
    const first = (await import('./device')).getDeviceId();

    vi.resetModules();

    const second = (await import('./device')).getDeviceId();

    expect(second).toBe(first);
  });

  it('produces a different ID after localStorage is cleared (a new installation, by design)', async () => {
    const first = (await import('./device')).getDeviceId();

    localStorage.clear();
    vi.resetModules();

    const second = (await import('./device')).getDeviceId();

    expect(second).not.toBe(first);
  });
});
