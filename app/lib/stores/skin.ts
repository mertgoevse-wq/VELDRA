import { atom } from 'nanostores';

/**
 * Skins are a named visual layer over the independent light/dark theme. Keeping the values in one
 * registry prevents Settings, persistence, and CSS from drifting apart as new skins are added.
 */
export const SKINS = [
  'core',
  'dark',
  'light',
  'midnight',
  'matrix',
  'aurora',
  'industrial',
  'minimal',
] as const;

export type Skin = (typeof SKINS)[number];

export interface SkinOption {
  value: Skin;
  label: string;
  description: string;
}

export const SKIN_OPTIONS: readonly SkinOption[] = [
  { value: 'core', label: 'VELDRA Core', description: 'Sky-blue technical surfaces and balanced depth.' },
  { value: 'dark', label: 'VELDRA Dark', description: 'A familiar dark workspace with restrained contrast.' },
  { value: 'light', label: 'VELDRA Light', description: 'A crisp, bright workspace for daylight sessions.' },
  { value: 'midnight', label: 'Midnight', description: 'Near-black surfaces for focused late-night work.' },
  { value: 'matrix', label: 'Matrix', description: 'Terminal green on black for a classic hacker feel.' },
  { value: 'aurora', label: 'Aurora', description: 'Atmospheric violet surfaces with a softer glow.' },
  { value: 'industrial', label: 'Industrial', description: 'High-contrast graphite with orange precision accents.' },
  { value: 'minimal', label: 'Minimal', description: 'Monochrome surfaces with minimal visual noise.' },
];

export const kSkin = 'bolt_skin';
export const DEFAULT_SKIN: Skin = 'core';

/** Runtime guard used when reading untrusted localStorage values. */
export function isSkin(value: unknown): value is Skin {
  return typeof value === 'string' && (SKINS as readonly string[]).includes(value);
}

function migratePersistedSkin(value: string | null): Skin | undefined {
  if (isSkin(value)) {
    return value;
  }

  // Older builds called the default skin "veldra" and briefly exposed "obsidian". Keep those
  // installations usable while converging on the eight-value contract used by the current UI.
  if (value === 'veldra' || value === 'obsidian') {
    return DEFAULT_SKIN;
  }

  return undefined;
}

function initStore(): Skin {
  if (!import.meta.env.SSR && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const persistedValue = localStorage.getItem(kSkin);
    const persisted = migratePersistedSkin(persistedValue);

    if (persisted) {
      if (persisted !== persistedValue) {
        localStorage.setItem(kSkin, persisted);
      }

      return persisted;
    }
  }

  return DEFAULT_SKIN;
}

export const skinStore = atom<Skin>(initStore());

export function setSkin(skin: Skin) {
  skinStore.set(skin);
  localStorage.setItem(kSkin, skin);
  document.querySelector('html')?.setAttribute('data-skin', skin);
}
