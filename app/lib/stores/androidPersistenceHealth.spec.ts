import { afterEach, describe, expect, it } from 'vitest';
import { androidPersistenceHealth } from './androidPersistenceHealth';

describe('androidPersistenceHealth', () => {
  afterEach(() => {
    androidPersistenceHealth.set({ status: 'ok' });
  });

  it('starts as ok', () => {
    expect(androidPersistenceHealth.get()).toEqual({ status: 'ok' });
  });

  it('holds a quota-exceeded failure with its message', () => {
    androidPersistenceHealth.set({ status: 'quota-exceeded', message: 'Storage full', failedAt: 123 });
    expect(androidPersistenceHealth.get()).toEqual({
      status: 'quota-exceeded',
      message: 'Storage full',
      failedAt: 123,
    });
  });

  it('can recover back to ok', () => {
    androidPersistenceHealth.set({ status: 'error', message: 'boom', failedAt: 1 });
    androidPersistenceHealth.set({ status: 'ok' });
    expect(androidPersistenceHealth.get()).toEqual({ status: 'ok' });
  });
});
