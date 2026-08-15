# VELDRA — Current State

Last updated: 2026-08-15 (block 5)
Branch: `integration/veldra-bedrock-plus-claude-web` (single active branch — the
`claude/veldra-android-recovery-85j8ws` branch referenced below was cherry-picked in;
work directly on `integration/...` from here on, no new branches)

## Block 5 (2026-08-15) — core product + runtime foundation, session-crash recovery round

A prior session landed the real orchestrator runtime (WorkflowRun state machine, typed
events, real ApprovalPort/PolicyGate/RunStore — see `git log` commit `57f9029` and
`DECISIONS.md`) then crashed before documenting it or finishing the mandate. Recovered
from `git log`, not docs (none existed yet for that work). This block: wired
`spawnSubagentWithOrchestrator()` — the only call site reachable from a live chat
request — through the real `runWorkflow()` driver instead of bypassing it, and fixed a
real approval-deadlock bug found while doing so (FREE tier's zero-cost budget would have
hung the call forever on an unanswerable approval). See `current-session.md` and
`DECISIONS.md` for full detail. No visual/UI work this block; no UI exists yet that could
consume any of this (still gated behind `VELDRA_USE_ORCHESTRATOR`, off by default).
Typecheck/lint (scoped)/test (395/395) verified; no headless browser used or needed since
nothing user-visible changed.

## Block 4 (2026-08-15) — product evolution pass, no headless browser this block

No Chromium/Playwright binary was available in this container (a fresh `npx playwright
install chromium` timed out after 90s) — unlike block 3 below, this block's verification
is typecheck/lint/build plus direct code reading and cross-referencing actual call sites,
NOT visual/screenshot confirmation. Flagging this explicitly rather than silently
skipping it. A future session with browser access should visually confirm:

- Android: selecting the "Code Workspace" or "Project Overview" template now seeds real
  Vite+React starter files (previously only switched tabs).
- Android: the bottom nav no longer disagrees with the Workbench panel's actual visibility
  when it's opened by an artifact-link click or AI file streaming (was: nav says "Chat",
  screen shows Files).
- `UserMessage` renders identically regardless of whether the AI SDK gave it string or
  array content (previously: different alignment, avatar presence, image ordering).
- `SubagentActivityWidget` actually appears in the chat when a subagent is running.

What changed (see `DECISIONS.md`'s 2026-08-15 section and git log for full detail):
deterministic starter-code seeding for Android's project-shaped templates
(`app/lib/templates.ts`, `Chat.client.tsx`, `BaseChat.tsx`); the `activeTab`/
`showWorkbench` state-truth fix (`AndroidShell.tsx`); `UserMessage.tsx` layout
unification; a further hardcoded-hex-to-design-token sweep (`Preview.tsx`,
`Workbench.client.tsx`, `ToolInvocations.tsx`, `SupabaseConnection.tsx`). Orchestrator
UI and unifying desktop's `/git`-route starter import were investigated and explicitly
deferred — see `DECISIONS.md` for why.

## What's working (verified in block 3 via real headless-Chromium screenshots + clicks
against the actual production `build/client` output, served with `vite preview`)
- App boots without crashing and renders the Chat/Files/Preview/Settings tabs correctly.
- Bottom-nav tab switching actually shows/hides the right content (was broken, see below).
- Chat welcome screen (`WelcomeHero.client.tsx` + "Guided Build" flow) renders and is
  interactive: expands to show Platform/Visual style/Integrations fields.
- New-chat button, Settings panel (Runtime Mode card, Android API Backend card) render
  correctly.
- Preview tab's "Live Preview Unavailable" empty state renders correctly (expected in
  android-fallback mode with no configured Remote Runtime).
- `tsc` / `eslint` clean (2 pre-existing warnings). `build:android` + `cap sync android` clean.

## Critical bugs found + fixed this block (both pre-existing, NOT introduced by prior
session's banner fix — found via first-ever real screenshot verification in this repo)
1. **App-crashing production bug**: `vite.android.config.ts`'s `manualChunks` put
   `react`/`react-dom` in an isolated `vendor-react` chunk while `vendor-ai`
   (`@ai-sdk/react`'s `useChat`) and `vendor-ui` (framer-motion/Radix) — both of which
   need React — were separate chunks. Rollup's cross-chunk reference resolution created
   a circular reference where `vendor-ai` read its React binding through `vendor-ui`
   before it was initialized: `Cannot read properties of undefined (reading 'useState')`,
   thrown on every single load, 100% reproducible, full white-screen crash. Fixed by
   merging all React-consuming vendor libs into one `vendor-react` chunk.
2. **Workbench always full-screen regardless of active tab**: `android.css`'s Workbench
   override forced `left: 0 !important; right: 0 !important` unconditionally on the
   Workbench panel. That overrides the component's own `left-0` (open) / `left-[100%]`
   (closed) toggle classes with `!important`, so the Code/Diff/Preview/Export toolbar and
   Files button rendered on top of the Chat tab at all times, regardless of
   `workbenchStore.showWorkbench`. This is almost certainly the actual cause of the
   original bug screenshot's "large unused editor area dominates the screen" / "Files
   control in wrong layer" symptoms — predates this session entirely. Fixed by removing
   the `left`/`right` override and letting the component's own classes govern it (Android
   already forces `w-full` via `isSmallViewport`, so `left:0`+`width:100%` reaches the
   right edge naturally when open).

## Fixed in earlier blocks this session (still valid, not re-verified visually until now
but confirmed still working in this block's screenshots)
- `AndroidFallbackBanner` moved from `fixed`/`z-50` to normal flex flow (no longer
  escapes safe-area padding or floats over the Workbench).
- Back button now closes the chat-history drawer instead of exiting the app.
- 3 full-screen modals (GitCloneButton, BranchSelector, LoadingOverlay) raised from
  `z-50` to the shared `z-max` scale (were under `.mobile-bottom-nav`'s `z-index:100`).
- Copy-code button and other hover-only affordances forced visible on Android (no
  `:hover` in WebView).
- 3 undersized close buttons bumped to 44px touch targets.
- Static live preview: multi-file relative-reference resolution + debounced
  auto-regeneration on file edits (`app/lib/preview/staticPreviewBundle.ts`).
- `.android-card`/`.android-mode-badge`/5 button radii wired to `--veldra-radius-*`.

## Known blockers
- No Android SDK in this container (`ANDROID_HOME` unset) — `gradlew assembleDebug`
  resolves all deps fine, fails only at the SDK-location check. Real APK build and
  on-device testing need an environment with the SDK, or the user's own setup.
- Visual verification this block used headless Chromium (Playwright + the environment's
  pre-installed browser) against the actual production `build/client` output via
  `vite preview --config vite.android.config.ts`, at a Pixel 7 viewport/UA — this is
  the same static assets Capacitor ships into the WebView, so it's a strong proxy, but
  it is not a real device/WebView and cannot catch WebView-specific quirks (Capacitor
  plugin bridges, Android-specific touch/keyboard behavior, hardware back button).

## Architecture entry points (don't re-derive these)
- Android shell root: `app/components/mobile/AndroidShell.tsx`
- Android-only CSS overrides: `app/styles/android.css`
- Android Vite config (manualChunks, entry): `vite.android.config.ts`
- z-index scale (canonical): `app/styles/z-index.scss`
- Runtime mode (webcontainer / android-fallback / remote): `app/lib/stores/runtime-mode.ts`
- Skin store: `app/lib/stores/skin.ts` (`data-skin` attribute on `<html>`)
- Preview: `app/components/workbench/Preview.tsx`, `app/lib/preview/staticPreviewBundle.ts`
- Welcome/home screen: `app/components/chat/WelcomeHero.client.tsx`
- Orchestrator (feature-flagged, off by default): `app/lib/orchestrator/`

## How to screenshot-verify the Android build yourself (no device needed)
```bash
npm run build:android
npx vite preview --config vite.android.config.ts --port 5183 &
# then Playwright/chromium at devices['Pixel 7'], navigate to http://localhost:5183/
```
This serves the exact static output Capacitor bundles into the APK.
