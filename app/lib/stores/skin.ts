import { atom } from 'nanostores';

/*
 * A skin is a named palette layered on top of the light/dark mode from theme.ts via a
 * separate `data-skin` attribute, so switching skins never touches the light/dark toggle.
 * 'veldra' has no CSS override (see variables.scss) and is a deliberate no-op — it's the
 * palette already shipping today, kept as the explicit default rather than an implicit one.
 */
export type Skin = 'core' | 'dark' | 'light' | 'midnight' | 'matrix' | 'aurora' | 'industrial' | 'minimal';

export const kSkin = 'bolt_skin';

export const DEFAULT_SKIN: Skin = 'core';

export const skinStore = atom<Skin>(initStore());

function initStore(): Skin {
  if (!import.meta.env.SSR) {
    const persisted = localStorage.getItem(kSkin) as Skin | null;

    if (['core', 'dark', 'light', 'midnight', 'matrix', 'aurora', 'industrial', 'minimal'].includes(persisted as string)) {
      return persisted!;
    }
  }

  return DEFAULT_SKIN;
}

export function setSkin(skin: Skin) {
  skinStore.set(skin);
  localStorage.setItem(kSkin, skin);
  document.querySelector('html')?.setAttribute('data-skin', skin);
}
