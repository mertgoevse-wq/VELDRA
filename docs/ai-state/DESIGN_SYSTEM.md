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

## Gap: Android chrome does not consume the token layer
`app/styles/android.css` and Android-only components never read
`--veldra-radius-*` / `--veldra-shadow-*` / `--veldra-backdrop-blur` /
`--veldra-motion-*`. They only vary by `--bolt-elements-*` color variables
(which do get skin-tinted) — so on Android, switching skins changes color
only, never radius/shadow/blur/motion, i.e. the actual differentiator between
e.g. brutalism and claymorphism is invisible on Android.

Confirmed hardcoded/bypassing spots (audited this session, not yet fixed):
- `app/styles/android.css`: `.android-card` (fixed 12px radius),
  `.android-mode-badge` (fixed 20px radius), `.android-storage-saved/empty`,
  `.android-danger-btn` (literal `rgba(...)` instead of tokens),
  `.chat-history-drawer`.
- `app/components/mobile/AndroidSettingsPanel.tsx`: raw hex
  (`#f59e0b`/`#10b981`/`#0A0A0A`) and raw Tailwind palette classes
  (`accent-600/700`, `green-500`, `red-500`, `amber-400`, `gray-500`).
- `app/components/mobile/GitHubSyncPanel.tsx`: extensive
  `bg-[#0A0A0A]`/`bg-[#FAFAFA]`/`border-[#E5E5E5]` arbitrary hex classes plus
  raw Tailwind palette colors.
- `app/components/mobile/AndroidFallbackBanner.tsx`: raw `amber-600`/`red-700`.

`AndroidShell.tsx` does write `data-skin` (duplicating logic already in
`skin.ts`/`root.tsx` — minor redundancy, not a bug), so the *few* components
that do use `--bolt-elements-*`/`--veldra-shadow-sm` do respond to skin
changes. The Android shell is effectively theme-aware (light/dark) but not
meaningfully skin-aware.

## Recommended path (not yet implemented — sizing exceeds one block)
1. Add `--veldra-radius-card`, `--veldra-radius-badge` etc. consumption to
   `android.css`'s `.android-card`/`.android-mode-badge`/status pill rules —
   contained, high-leverage, low-risk.
   Status color pills (storage-saved/danger-btn) can move to existing
   semantic tokens if/when one exists, otherwise leave as intentional
   semantic (not skin-varying) color — success/danger colors are usually
   NOT meant to shift per-skin.
2. `AndroidSettingsPanel.tsx` / `GitHubSyncPanel.tsx` raw hex/Tailwind-palette
   usage is a larger, separate refactor (many call sites) — track as its own
   follow-up block rather than folding into an unrelated change.
