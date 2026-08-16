# VELDRA — Current State

Last updated: 2026-08-16 (block 8)
Branch: `integration/veldra-bedrock-plus-claude-web` (single active branch — the
`claude/veldra-android-recovery-85j8ws` branch referenced below was cherry-picked in;
work directly on `integration/...` from here on, no new branches)

## Block 8 (2026-08-16) — multi-file consistency audit: one critical data-loss bug fixed, delete propagation closed

Deep audit of the file lifecycle (editor → workbenchStore.files → FilesStore → IndexedDB
persistence → RemoteWorkspaceSync → Remote Runtime → Preview), run via two parallel
investigation agents plus direct code tracing. Two real, previously-undiscovered bugs
fixed, both with zero prior test coverage:

1. **Critical, real data loss**: `Workbench.client.tsx`'s `useEffect(() =>
   workbenchStore.setDocuments(files), [files])` re-runs on EVERY change to
   `workbenchStore.files` — including a completely unrelated file. `EditorStore
   .setDocuments` rebuilt every open document's `value` unconditionally from the
   persisted `dirent.content`, so a user's in-progress unsaved edit in file A was
   silently reverted whenever ANY file changed anywhere (e.g. an agent writing file B
   in the background), while `unsavedFiles` kept claiming A was still "modified" —
   doubly misleading. Fixed: `setDocuments(files, unsavedFiles)` now preserves the
   in-memory `value` for any path present in `unsavedFiles`, and `WorkbenchStore
   .setDocuments` threads its own `unsavedFiles` through. `editor.spec.ts` (new, first
   test coverage for `EditorStore`) and `workbench.spec.ts` (new, first for
   `WorkbenchStore`) prove the fix on the real singleton wiring, plus prove externally-
   changed files the user HASN'T touched still refresh normally (no regression).
2. **Delete never propagated to Remote Runtime**: `pushLocalWorkspaceToRemote` only
   ever sent the file-write map; the server's `PUT /files` had no delete capability at
   all (`RemoteRuntimeClient.syncFiles` was pure overwrite). A file deleted locally
   stayed on the remote workspace forever. Compounding it, `pullRemoteWorkspaceToLocal`
   could silently resurrect that same locally-deleted file — its merge only skipped a
   remote file when local content *differed*, and a deleted file has no local content
   to differ from. Fixed end-to-end, real server change included (this repo does
   contain the actual `remote-runtime/` server, not just a client stub):
   `remote-runtime/src/files.ts`'s new `deleteWorkspaceFiles()` (path-traversal-safe,
   idempotent), wired into `PUT /workspace/:id/files` via an optional `deletedPaths`
   field; `RemoteRuntimeClient.syncFiles(files, deletedPaths?)` sends it;
   `pushLocalWorkspaceToRemote` now passes `deletedPaths` through; `pullRemoteWorkspaceToLocal`
   now records deleted-but-still-remote files as an honest conflict instead of
   resurrecting them. New tests: `remote-runtime/src/files.spec.ts` (real filesystem,
   same convention as `security.spec.ts`), `RemoteWorkspaceSync.spec.ts` (new — first
   coverage for this file — real fake-indexeddb-backed round-trip, only the HTTP
   client spied).

Also fixed the same round: a real stale-response race in `Preview.tsx`'s
`refreshRemotePreview` (two overlapping refreshes — e.g. a manual click landing while
the agent-start signal also fires one — had no ordering guard, so an older, slower
response could resolve after a newer one and clobber state back to stale data). Fixed
with a request-ID guard; regression test added to `Preview.spec.tsx`.

Investigated and deliberately NOT changed (real findings, low enough
confidence/severity/exposure to defer rather than fix speculatively): (a) file
**rename** does not exist as a feature anywhere in the codebase (no bug, just
unbuilt — the only way to "rename" today is delete + agent recreates under a new
path); (b) `files.ts`'s chat-ID-switch `MutationObserver` only reloads file-lock
state, not `files`/`deletedPaths`/`modifiedFiles` — flagged, not confirmed as an
actual bug, not traced further; (c) two concurrently-active `ActionRunner` instances
(one per artifact) have no cross-runner write-ordering guarantee for the same file
path — real gap, but the normal chat pipeline processes one artifact at a time, so
practical exposure looks low; not fixed without a concrete reproduction.

501/501 tests (was 489 at block start), typecheck clean, lint clean.
`app/lib/languages/capabilities.spec.ts`'s CodeMirror-resolution test is pre-existing-flaky
under full-suite parallel load (hits its default 5000ms timeout under contention; passes in
~1.7s standalone) — unrelated to this block, not touched, noted here so a future run isn't
mistaken for a regression.

## Block 7 (2026-08-16) — real end-to-end creation-loop proof, Live Preview hardening, Terminal/Preview state consistency

**Honest gap this block closed**: every prior round proved the Remote Runtime build/start
bridge piece-by-piece (action-runner.ts's sync/build/start unit tests, the Preview refresh
signal's own unit test) but nothing had ever stitched them into one proof that the actual
product loop — a user prompt turning into real files, a real remote dev server, and a real
rendered preview — works end-to-end. `app/lib/runtime/creation-loop-e2e.spec.ts` (new) now
does exactly that through genuine wiring: `workbenchStore.addArtifact()`'s real
`ActionRunner`, real `FilesStore.saveFile`, the real (unmocked)
`RemoteWorkspaceSync.pushLocalWorkspaceToRemote`, and a real `fake-indexeddb`-backed
`androidFallbackStorage` round-trip (new devDependency — this environment has no native
IndexedDB, matching the WebContainer boundary Node can't provide either). Only the Remote
Runtime HTTP server and WebContainer are mocked. Proves: file action → real workbench file
content → real sync carrying that exact content → real `npm run dev` → real Preview signal
→ real rendered iframe with the real URL → a second edit → re-sync carries the *new* content
→ signal fires again. A second test proves a real build failure is represented honestly
end-to-end (failed action state, no Preview signal, Preview still shows "Unavailable").

`Preview.tsx` had **zero** test coverage before this block (confirmed by search — first
`.spec.tsx` for this file ever). `Preview.spec.tsx` (new, 7 tests) proves it never invents
success: not-configured, running-with-no-URL-yet (never fabricates a URL), failed, network
disconnect, agent-triggered refresh, config cleared mid-session.

Terminal/Preview state consistency gap found and fixed: `TerminalTabs.tsx`'s
`RemoteCommandPanel` (the manual "Terminal Unavailable" fallback UI on Remote Runtime,
distinct from the agent's own start path) never told Preview when the user manually ran
`npm run dev`, nor when a running command exited/crashed — Preview stayed stale until a
manual refresh click. Fixed symmetrically: `triggerRemotePreviewRefresh()` now fires on a
successful manual dev-server start AND on any command exit event. `RemoteCommandPanel`
exported from `TerminalTabs.tsx` and tested in isolation (4 new tests) — rendering the full
`TerminalTabs`/`Panel` tree hit a genuine jsdom limitation (`react-resizable-panels` needs
real `ResizeObserver`-driven layout measurement jsdom doesn't provide); `RemoteCommandPanel`
itself has no dependency on the `Panel` tree, so isolating it is strictly better, not a
workaround.

Real bug found and fixed while writing the first `.tsx` component test that transitively
imports `~/lib/webcontainer`: `import.meta.hot?.data.x` was unguarded (`?.` only covered
`.hot`, not `.data`) across `files.ts`/`editor.ts`/`terminal.ts`/`workbench.ts`/
`webcontainer/index.ts`. Confirmed to actually throw under Vitest + `@vitejs/plugin-react`
(where `import.meta.hot` is truthy but `.data` isn't) — any such environment would have
crashed the whole app at module load. Fixed with consistent `?.data?.` chaining everywhere.

489/489 tests (was 476), typecheck clean, lint clean. Commits: `fa04fef`, `95f9b13`.

## Block 6 (2026-08-16) — real visual verification, Android production build was fully broken

**Correction to this doc's own "What's working" section below (block 3, unchanged since
2026-08-15)**: "App boots without crashing" was true when written but had gone stale --
the Android production build had been completely broken (permanent splash screen, never
rendered) since some point after block 3, and nobody had re-run a real
build+screenshot check since, so it went undetected through several rounds of code-only
verification (typecheck/lint/test, which a Vite chunk-splitting bug doesn't touch). Found
and fixed via this block's first real Android build+screenshot pass since block 3 --
environment now has a working headless Chromium (`playwright install-deps chromium`
resolved a missing `libatk-1.0.so.0` system library that blocked every earlier attempt
this session). Root cause and fix: commit `0daefef` -- four cross-chunk circular-reference
crashes found in sequence (`ai/mcp-stdio`'s node:child_process import broke the build
outright first, fixed separately as `e08e61e`; then three distinct "reading X before
initialization" React/CodeMirror crashes chasing different `manualChunks` boundaries).
Consolidated `vite.android.config.ts`'s manual chunking to one shared chunk for
everything React-adjacent, keeping only `vendor-shiki` split (confirmed safe, no React
dependency). Verified via real screenshot: welcome screen renders correctly (Guided
Build, provider/model selectors, composer, honest "Android Fallback Mode" banner). See
`DECISIONS.md`'s 2026-08-16 entry for the full crash-by-crash trail.

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
