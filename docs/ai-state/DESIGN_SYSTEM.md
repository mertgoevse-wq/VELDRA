# VELDRA — Design System State

## Token layer (real, desktop-covered)
`app/lib/stores/skin.ts` sets `data-skin` on `<html>`. `app/styles/variables.scss`
(~lines 274-625) defines `--veldra-radius-*`, `--veldra-shadow-*`,
`--veldra-backdrop-blur/saturate`, `--veldra-border-width`, `--veldra-motion-*`,
plus per-skin `[data-theme][data-skin]` overrides for all 11 skins
(veldra/glass/liquidglass/spatial/neomorphism/claymorphism/skeuomorphism/
minimalism/maximalism/brutalism/obsidian). These flow into the shared
`veldra-surface` / `veldra-control` UnoCSS shortcuts used by Button/Dialog/Card/
Composer on desktop.

## Correction (2026-08-17): the "Gap" below was already stale the day it was written
The claim that `android.css` "never reads" the token layer was checked against current code by a
dedicated docs-staleness audit and found false — not just now-stale, false even at the moment this
doc's own commit (`784d7d24`) landed. `app/styles/android.css` contains 42 separate usages of
`--veldra-radius-*`/`--veldra-shadow-*`/`--veldra-backdrop-*`/`--veldra-motion-*`/
`--veldra-border-width`. Specifically: `.android-card` reads
`border-radius: var(--veldra-radius-lg, 12px)`, `box-shadow: var(--veldra-shadow-md, none)`,
`backdrop-filter: blur(var(--veldra-backdrop-blur, 0px))`, and a `--veldra-motion-*`-driven
transition; `.android-mode-badge` reads `var(--veldra-radius-full, 20px)`; `.chat-history-drawer`
reads `--veldra-radius-xl` plus shadow/backdrop tokens. The `12px`/`20px` figures this doc quoted
as "fixed" were actually the `var()` fallback values, not the rendered value once a skin sets the
real token — a real reading mistake, not just drift.

**Only two spots genuinely still use hardcoded literal colors** rather than tokens:
`.android-storage-saved`/`.android-storage-empty` and `.android-danger-btn` (literal
`rgba(...)`) — both semantic status colors, which this doc's own "Recommended path" already
correctly notes may be intentionally non-token (success/danger colors are usually not meant to
shift per-skin).

The `#0A0A0A`/`#1A1A1A`/`#FAFAFA`/`#E5E5E5` hardcoded-hex claims for
`AndroidSettingsPanel.tsx`/`GitHubSyncPanel.tsx` below were also already fixed by the time this
doc was written (commit `fbbad9354`, landed *before* this doc's own commit) — verified: zero
occurrences of either in current code. What genuinely remains, confirmed accurate:
- `app/components/mobile/AndroidSettingsPanel.tsx`: `#f59e0b`/`#10b981` (deliberately left as-is
  by `fbbad9354`'s own commit message — a semantic status-badge color pair), plus raw Tailwind
  palette classes (`accent-600/700`, `green-500`, `red-500`, `amber-400`, `gray-500`).
- `app/components/mobile/GitHubSyncPanel.tsx`: raw Tailwind palette classes (`blue-50/600/800/950`,
  `green-400/600`, `red-500/600`, `amber-500/600/800/950`, `gray-400`) — the hex-class portion is
  gone, the palette-class portion remains.
- `app/components/mobile/AndroidFallbackBanner.tsx`: raw `amber-600`/`red-700` — not re-checked
  this round, carried forward from the original claim.

`AndroidShell.tsx` does write `data-skin` (duplicating logic already in `skin.ts`/`root.tsx` —
minor redundancy, not a bug), so components using `--bolt-elements-*`/`--veldra-shadow-sm` do
respond to skin changes. Net effect, corrected: Android chrome is **more** skin-aware than this
doc previously claimed (radius/shadow/blur/motion do vary per-skin on `.android-card`/
`.android-mode-badge`/`.chat-history-drawer`), though the raw-Tailwind-palette-class spots above
are real, still-open token-adoption gaps.

## Recommended path
1. ~~Add `--veldra-radius-card` etc. consumption to `.android-card`/`.android-mode-badge`~~ —
   already done; not a real gap.
2. `AndroidSettingsPanel.tsx` / `GitHubSyncPanel.tsx` raw Tailwind-palette-class usage (not hex —
   that part's already fixed) is a larger, separate refactor (many call sites) — track as its own
   follow-up block rather than folding into an unrelated change.
