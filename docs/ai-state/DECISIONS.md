# VELDRA — Decisions Log

- **Android overlays**: only modals/drawers/sheets/toasts may use
  `position: fixed`, anchored to the viewport. Everything else (banners,
  toolbars, tab content) must participate in normal flex flow inside
  `.android-shell` / `.android-main`, or be `position: absolute` anchored
  to `.android-main` (which is `position: relative`). Rationale: a fixed
  element is positioned relative to the *viewport*, not its parent's
  padding box — it silently escapes safe-area padding and any sibling
  that takes up variable vertical space (banners, in particular).
- **z-index**: use the scale in `app/styles/z-index.scss`
  (`z-prompt`, `z-workbench`, `z-toast`, `z-max`, ...). Do not invent new
  ad-hoc `z-50`/`z-100` values on Android-only components — that was the
  root cause of the fallback-banner-over-workbench bug.
- **npm install**: use `--legacy-peer-deps` in this environment
  (pre-existing `wrangler`/`@remix-run/dev` conflict, unrelated to Android
  work — do not attempt to resolve by downgrading `wrangler` without an
  explicit user request).
