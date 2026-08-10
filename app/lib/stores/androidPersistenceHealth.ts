import { atom } from 'nanostores';

export type AndroidPersistenceStatus = 'ok' | 'quota-exceeded' | 'error';

export interface AndroidPersistenceHealth {
  status: AndroidPersistenceStatus;
  message?: string;
  failedAt?: number;
}

/**
 * Tracks whether FilesStore's Android IndexedDB fallback persistence is actually succeeding.
 * Previously, a failed save was only logged to the console -- the in-memory file change looked
 * successful in the UI (createFile()/saveFile() always returned true regardless of whether the
 * write reached IndexedDB), so a device storage-full condition silently lost every unsaved
 * change on the next app restart with zero warning. AndroidFallbackBanner subscribes to this so
 * the user gets an ongoing, visible warning instead of a single toast they could miss mid-stream.
 */
export const androidPersistenceHealth = atom<AndroidPersistenceHealth>({ status: 'ok' });
