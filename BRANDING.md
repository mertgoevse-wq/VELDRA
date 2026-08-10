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

- `public/veldra-logo.svg` — web and documentation wordmark
- `public/veldra-icon.svg` — square app icon source
- `public/veldra-favicon.svg` — browser favicon
- `public/veldra-social-preview.png` — repository/social preview source (raster; see "New brand assets" below)
- `public/assets/brand/` — newly supplied raw source images (logomark variants, hero banners, concept illustration, pattern texture) the generated web/social assets above were derived from

The legacy `public/logo-dark*.png`/`public/logo-light*.png` and `public/bolt-diy-android-*.svg` files were removed (2026-08-10): confirmed via repository-wide search that no code, config, or build script referenced them by name, and they carried old bolt.diy branding.

## New brand assets (2026-08-10)

A refreshed VELDRA mark (a stylized "V" combined with a cursor/click shape and a sparkle, in cream-on-navy) was supplied as raster source images and used to regenerate the web-facing icons: `apple-touch-icon.png`, `favicon-16x16.png`/`favicon-32x32.png`, `veldra-icon-192.png`/`veldra-icon-512.png`, and `veldra-social-preview.png` (all generated from `public/assets/brand/veldra-logomark-v3.jpg` / `veldra-hero-banner.jpg` via Pillow).

**Not yet updated to match**: `public/veldra-icon.svg`, `public/veldra-logo.svg`, `public/veldra-favicon.svg`, and the Android adaptive launcher icon (`android/app/src/main/res/drawable/veldra_launcher_foreground.xml`) still use the earlier abstract lightning-bolt vector mark, not the new logomark. Redrawing the new mark as a clean vector (rather than tracing/rasterizing the JPG source, which would be a quality regression for these specific vector-native assets) is a scoped follow-up, not done in this pass.

## Visual direction

- Deep indigo surfaces with violet accents
- Clear geometric mark and restrained typography
- Professional developer-tool aesthetic
- No copied upstream wordmarks, logos, or mascots
- Platform assets should be derived from the VELDRA SVG sources where tooling permits

## Upstream attribution and license

VELDRA is derived from the open-source `bolt.diy` project by StackBlitz Labs and contributors. The upstream MIT license, copyright notices, trademarks, and attribution remain in `LICENSE` and `NOTICE.md`. These references describe technical origin and legal attribution; they are not VELDRA product branding.
