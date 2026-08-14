# VELDRA — Current State

Last updated: 2026-08-14
Branch: `claude/veldra-android-recovery-85j8ws` (0 commits behind/ahead of `main` other than this recovery work)

## What's working
- Android SPA build (`npm run build:android`) — clean.
- Capacitor sync (`npx cap sync android`) — clean.
- `tsc` / `eslint` — clean (2 pre-existing warnings: empty constructors in skillService.ts, subagentService.ts).
- Chat, file editing, file persistence work in Android fallback mode.

## What's fixed this session
- `AndroidFallbackBanner` was `position:fixed;z-50`, escaping the shell's
  `safe-area-inset-top` padding and floating over the Workbench toolbar
  (`z-workbench: 3`). Moved to normal flex flow; re-anchored the Workbench's
  Android CSS override from `fixed` (viewport-relative) to `absolute`
  (relative to `.android-main`), so both share one coordinate space.
  See `app/components/mobile/AndroidFallbackBanner.tsx`,
  `app/styles/android.css` (`.android-shell .fixed.top-[...]` block).
- Latent bug in `app/components/chat/Markdown.tsx`: `<CodeBlock>` spread
  hast `rest` props *after* explicit `code`/`language`, which could
  silently clobber them (and made `language` type-check as `string`).
  Reordered.

## Known blockers
- No Android SDK in the current CI/agent container (`ANDROID_HOME` unset).
  `gradlew assembleDebug` resolves all Gradle/AGP/Capacitor deps fine and
  fails only at the SDK-location check. APK build + device verification
  need an environment with the SDK installed, or the user's own device/Termux
  setup.
- No real Android device/screenshot capture available in this container —
  visual verification for anything beyond the fixed banner bug is
  code-level only until a real APK can be installed.

## Architecture entry points (don't re-derive these)
- Android shell root: `app/components/mobile/AndroidShell.tsx`
- Android-only CSS overrides: `app/styles/android.css`
- z-index scale (canonical): `app/styles/z-index.scss`
  (`z-prompt: 2`, `z-workbench: 3`, `z-file-tree-breadcrumb`/`z-logo`/`z-sidebar` near 999, `z-max: 999`, `z-toast: 1000`)
- Runtime mode (webcontainer / android-fallback / remote):
  `app/lib/stores/runtime-mode.ts`
- Skin store: `app/lib/stores/skin.ts` (`data-skin` attribute on `<html>`)
- Preview: `app/components/workbench/Preview.tsx`
- Orchestrator (feature-flagged, off by default): `app/lib/orchestrator/`
