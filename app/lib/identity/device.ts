/**
 * Device Identity
 *
 * Block 6 (multi-device/project synchronization foundation) requires separating DEVICE
 * identity from PROJECT identity -- they answer different questions ("which installation of
 * VELDRA is this" vs. "which project's files are these") and conflating them is exactly how
 * a future sync/conflict-resolution feature ends up unable to tell "I edited this on my
 * phone, then again on my laptop" apart from "two different projects happen to have the same
 * name." Nothing in the codebase had ANY device-identity concept before this (confirmed by
 * search) -- this is new, minimal, and deliberately does nothing beyond generate and persist
 * a stable local identifier. It is NOT sent anywhere over the network by anything today; a
 * future sync provider that needs it must opt in explicitly, not inherit silent tracking.
 *
 * Threat model note: this ID is stored in plaintext localStorage (the same store used for
 * every other client preference in this codebase -- see STORAGE_AND_SYNC.md). It identifies
 * an *installation*, not a person -- clearing site data creates a new one. Treat it as a
 * low-sensitivity correlation ID, not a security credential.
 */

import { atom } from 'nanostores';

const DEVICE_ID_STORAGE_KEY = 'veldra_device_id';

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  /*
   * Fallback for environments without crypto.randomUUID (older WebViews) -- not
   * cryptographically strong, and doesn't need to be: this is a correlation ID, not a secret.
   */
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);

    if (existing) {
      return existing;
    }

    const created = generateDeviceId();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);

    return created;
  } catch {
    /*
     * localStorage unavailable (SSR, privacy mode) -- fall back to a session-only ID rather
     * than throwing; a caller that needs persistence across reloads will simply get a new one.
     */
    return generateDeviceId();
  }
}

export const deviceIdStore = atom<string>(loadOrCreateDeviceId());

/** Returns the current device's stable ID without needing to subscribe to the store. */
export function getDeviceId(): string {
  return deviceIdStore.get();
}
