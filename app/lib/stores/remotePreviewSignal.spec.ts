import { describe, it, expect } from 'vitest';
import { remotePreviewRefreshSignal, triggerRemotePreviewRefresh } from './remotePreviewSignal';

describe('remotePreviewRefreshSignal', () => {
  it('increments on each real trigger, so a subscriber sees a new value every time', () => {
    const before = remotePreviewRefreshSignal.get();

    triggerRemotePreviewRefresh();
    expect(remotePreviewRefreshSignal.get()).toBe(before + 1);

    triggerRemotePreviewRefresh();
    expect(remotePreviewRefreshSignal.get()).toBe(before + 2);
  });
});
