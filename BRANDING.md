# Branding Guide — VELDRA

## Identity

- **Product name:** VELDRA
- **Display name:** VELDRA
- **Android app label:** VELDRA
- **Android package:** `com.veldra.app`
- **Canonical repository:** `github.com/mertgoevse-wq/VELDRA`
- **Product owner:** Mert Gövse

## Product assets

VELDRA uses original product assets that are separate from upstream branding:

- `public/veldra-mark-dark.png` — the real brand mark (V + cursor + sparkle), extracted from the approved reference photo, for use on dark surfaces (cream mark, sky-blue sparkle)
- `public/veldra-mark-light.png` — the same mark silhouette, recolored solid navy, for use on light surfaces
- `public/veldra-social-preview.png` — repository/social preview, a direct crop of the approved reference photo
- `public/favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `apple-touch-icon-precomposed.png`, `veldra-icon-192.png`, `veldra-icon-512.png` — all resized directly from `public/assets/brand/veldra-favicon.jpg` (the approved reference photo already has the correct dark-navy square icon design; no redraw needed)
- `public/assets/brand/` — raw source photos: `veldra-favicon.jpg` (favicon/touch-icon/app-icon source), `veldra-logo-master.jpg` (mark-extraction source), `veldra-social-preview.jpg` (social card source), `veldra-app-icon.jpg` (mockup reference only, has a baked-in bezel), `veldra-github-banner.jpg`, `veldra-hero-art.jpg`, `veldra-brand-background.jpg`

The legacy `public/logo-dark*.png`/`public/logo-light*.png` and `public/bolt-diy-android-*.svg` files were removed (2026-08-10). `public/favicon.svg`, `public/logo.svg` (unbranded raw bolt.diy files, never referenced anywhere), and `public/veldra-logo.svg`/`veldra-favicon.svg`/`veldra-icon.svg` (hand-drawn VELDRA-named SVGs that had drifted into a lightning-bolt zigzag shape — the same silhouette language as bolt.diy's own mark, not the approved V+cursor+sparkle mark) were removed in a later pass (see "Brand mark correction" below) once nothing in `app/` referenced them anymore.

## Brand mark correction — real reference images, not an invented redraw

An earlier pass in this session hand-drew a new SVG mark (a checkmark-style "V" in a warm amber palette) without going back to the actual approved reference images. The product owner rejected that result and re-supplied the same 7 source photos (verified byte-identical via md5sum to what was already in `public/assets/brand/` — no new assets, no duplication) as the binding visual reference, with an explicit instruction not to invent a new logo: derive optimized web formats from the originals, keep the visual identity.

Real problem found on inspection: `public/assets/brand/veldra-logo-master.jpg` (and `veldra-favicon.jpg`) show the actual mark clearly — a "V" merged with a mouse-cursor pointer, warm cream (`~#EFEADA`) with a sky-blue sparkle accent (`~#83C8EF`, sampled directly from the pixels), on a dark navy background. This is not purple, and not amber — both of this session's earlier guesses were wrong.

No vector tracing tool is available in this environment (checked: no potrace, cairosvg, or vtracer), so per the product owner's own instruction the mark is used as a raster derivative rather than redrawn: `veldra-mark-dark.png`/`veldra-mark-light.png` are produced by luminance-based alpha extraction directly from `veldra-logo-master.jpg` (background pixels ~lum 30-65, mark/sparkle pixels ~lum 184-237 — cleanly separable, verified by sampling actual pixel values before choosing the threshold), not a hand-drawn approximation. `Header.tsx` swaps between the two variants via `dark:`/light Tailwind classes and pairs the mark with real "VELDRA" text (Space Grotesk, the brand font from Slice 10) instead of baking text into the image — the wordmark color now follows the theme token system instead of being a hardcoded SVG fill.

**Still open, not silently skipped**: the Android adaptive launcher icon (`android/app/src/main/res/drawable/veldra_launcher_foreground.xml`) still uses the old lightning-bolt vector — left untouched because `android/` is explicitly off-limits to Claude per this repo's own CLAUDE.md (reserved for the Android-build-host workflow). A separate, large cleanup is also still open: ~42 files use Tailwind's own default `purple-*` utility classes (e.g. `text-purple-500`) rather than the `accent-*` token that was just repalette'd, so those spots still render bolt-purple. Scoped as its own follow-up slice given the size (mechanical `purple-N` → `accent-N` replacement across Settings tabs and shared UI components), not done in this pass.

## Where each of the 7 brand-source images is actually used (2026-08-10, Loop 19)

Existing before this pass — derived PNGs already wired into the app:
- `veldra-favicon.jpg` → `apple-touch-icon.png`, `favicon-16x16.png`/`favicon-32x32.png`, `veldra-icon-192.png`/`veldra-icon-512.png` (linked in `app/root.tsx`)
- `veldra-social-preview.jpg` → `veldra-social-preview.png` (OG/Twitter meta tags in `app/routes/_index.tsx`)

New this pass:
- `veldra-hero-art.jpg` → resized/compressed to `public/veldra-hero-art.webp`+`.jpg` (2.9MB source → ~155KB), shown above the "Where ideas begin" headline in the chat welcome screen (`app/components/chat/BaseChat.tsx`, `#intro` block), desktop only (`lg:` and up) since the illustration's embedded labels aren't legible at mobile widths — lazy-loaded, not rendered on mobile at all.
- `veldra-brand-background.jpg` → resized/compressed to `public/veldra-brand-background.webp` (2.1MB source → ~19KB), used as a faint (8% opacity), masked repeating texture behind the same welcome screen, dark theme + desktop only (the texture's fixed navy background doesn't suit a light theme).
- `veldra-github-banner.jpg` → now the README hero image (`README.md`), referenced directly from `public/assets/brand/` since it's documentation-only and not part of the app bundle.
- `veldra-logo-master.jpg` → source for the alpha-extracted `veldra-mark-dark.png`/`veldra-mark-light.png` used in `Header.tsx` (see "Brand mark correction" above).
- `veldra-app-icon.jpg` → a rendered app-icon mockup (icon already on a rounded-square backdrop with shadow), not a clean icon source — used here as a visual reference only, not run through the icon generator:

![VELDRA app icon](./public/assets/brand/veldra-app-icon.jpg)

## Visual direction

- Dark navy surfaces with a sky-blue accent (`uno.config.ts`'s `accent` scale, 500 = `#50ADE2`), sampled from the approved brand mark — not bolt.diy's purple
- The V + cursor + sparkle mark, warm cream on dark surfaces / solid navy on light surfaces
- Clear geometric mark and restrained typography
- Professional developer-tool aesthetic
- No copied upstream wordmarks, logos, or mascots
- Platform assets are derived from the approved brand photos (`public/assets/brand/`), not redrawn from scratch

## Upstream attribution and license

VELDRA is derived from the open-source `bolt.diy` project by StackBlitz Labs and contributors. The upstream MIT license, copyright notices, trademarks, and attribution remain in `LICENSE` and `NOTICE.md`. These references describe technical origin and legal attribution; they are not VELDRA product branding.
