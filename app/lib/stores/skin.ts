import { atom } from 'nanostores';

/*
 * A skin is a named design language layered on top of the light/dark mode from theme.ts via a
 * separate `data-skin` attribute, so switching skins never touches the light/dark toggle.
 * 'veldra' has no CSS override (see variables.scss) and is a deliberate no-op — it's the
 * palette+structure already shipping today, kept as the explicit default rather than an
 * implicit one. The other 9 are real, distinct design languages (radius/shadow/blur/border,
 * not palette swaps — see variables.scss's "VELDRA skin-structural layer"), plus 'obsidian',
 * a dark-palette-only variant kept from an earlier loop.
 */
export const SKINS = [
  'veldra',
  'glass',
  'liquidglass',
  'spatial',
  'neomorphism',
  'claymorphism',
  'skeuomorphism',
  'minimalism',
  'maximalism',
  'brutalism',
  'obsidian',
] as const;

export type Skin = (typeof SKINS)[number];

export const SKIN_LABELS: Record<Skin, string> = {
  veldra: 'VELDRA',
  glass: 'Glassmorphism',
  liquidglass: 'Liquid Glass',
  spatial: 'Spatial UI',
  neomorphism: 'Neomorphism',
  claymorphism: 'Claymorphism',
  skeuomorphism: 'Skeuomorphism',
  minimalism: 'Minimalism',
  maximalism: 'Maximalism',
  brutalism: 'Brutalism',
  obsidian: 'Obsidian',
};

export const SKIN_DESCRIPTIONS: Record<Skin, string> = {
  veldra: 'Soft, calm, premium — the VELDRA default.',
  glass: 'Frosted translucent panels with a soft blur.',
  liquidglass: 'Fluid, luminous, high-blur glass with large concentric shapes.',
  spatial: 'Layered depth with soft, generous shadows.',
  neomorphism: 'Soft extruded surfaces, no borders, dual-tone shadow.',
  claymorphism: 'Pillowy, oversized rounded corners, puffy shadow.',
  skeuomorphism: 'Warm, tactile surfaces with a raised, physical feel.',
  minimalism: 'Flat, quiet, almost no shadow or motion.',
  maximalism: 'Bold accent borders, saturated shadow, expressive.',
  brutalism: 'Raw, square corners, thick border, hard offset shadow.',
  obsidian: 'Deep near-black dark-mode palette.',
};

export const kSkin = 'bolt_skin';

export const DEFAULT_SKIN: Skin = 'veldra';

export const skinStore = atom<Skin>(initStore());

function isSkin(value: string | null): value is Skin {
  return !!value && (SKINS as readonly string[]).includes(value);
}

function initStore(): Skin {
  if (!import.meta.env.SSR) {
    const persisted = localStorage.getItem(kSkin);

    if (isSkin(persisted)) {
      return persisted;
    }
  }

  return DEFAULT_SKIN;
}

export function setSkin(skin: Skin) {
  skinStore.set(skin);
  localStorage.setItem(kSkin, skin);
  document.querySelector('html')?.setAttribute('data-skin', skin);
}
