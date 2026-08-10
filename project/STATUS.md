# VELDRA Status

**Updated:** 2026-08-10
**Branch:** `main`
**Current commit:** `27640bb` — "fix(android): remove dead/unreachable AndroidApiClient methods (Loop 8)"
**Remote:** `origin/main` (`git@github.com:mertgoevse-wq/VELDRA.git`)

## Provider/model router audit on Android + dead-code cleanup (2026-08-10, eighth loop)

Audited whether Android's provider/model *selection* is actually functional end-to-end, not just chat-sending (already fixed in earlier loops). Result: **it already works**, no gap found — `ModelSelector.tsx` (the same component desktop uses) renders in Android's chat composer, embeds `[Model:]`/`[Provider:]` tags into the outgoing message, and `api.android.chat.ts` delegates to the identical shared `chatAction()`/`stream-text.ts` path desktop uses, which parses those tags and resolves the backend's own per-provider server-side credential. "Auto (capability router)" is live on Android too — same code path, not desktop-only.

What the audit did find: `AndroidApiClient.ts` had four methods (`sendChatMessage`, `streamChatResponse`, `enhancePrompt`, `validateProviderConfig`) called nowhere in the app and pointing at routes that either don't exist at all (`enhancePrompt` → bare `/enhance`, not `/api/android/enhance`; `validateProviderConfig` → `/provider-config/validate`, never implemented) or that the real chat path never uses. The real, working chat/enhance/models functionality is fully implemented elsewhere and bypasses this class except for `.health()`. Removed the four dead methods and their exclusively-associated types rather than continue shipping API surface that will always fail if called — this is exactly the "fake API" class of bug the project's own no-fake-success rule targets.

**Validated**: 258/258 tests, typecheck clean, lint clean, Android web build clean, native Gradle build succeeds, debug APK builds (size/permissions unchanged). No test file existed for `AndroidApiClient.ts`; grep-confirmed nothing else referenced the removed surface.

**Next highest-value step**: continue the newest mandate's loop sequence (Loop 9: agent tool loop, Loop 10: remote runtime, or device validation of the growing Android-UI backlog if a device becomes available) — see `project/SESSION-HANDOFF.md` for the specific next call.

## Editor/preview narrow-viewport rendering fixed (2026-08-10, seventh loop)

Static audit (Explore agent, no device) of the editor/preview/terminal layout now that it's actually reachable on Android (loop 3 mounted `Workbench` there) — nothing had ever checked whether this desktop-authored three-panel layout renders usably on a 360-412px phone screen. Found six real bugs, one of them a crash:

- **Critical**: `EditorPanel.tsx`'s mobile layout rendered `<TerminalTabs />` (root element is a `react-resizable-panels` `Panel`) inside `MobileTerminalDrawer` with no `PanelGroup` ancestor. `Panel` throws `"must be rendered within a PanelGroup container"` outside one (confirmed directly in the library source) — tapping "Toggle Terminal" on Android would crash the render, not just look cramped. Fixed by wrapping it in a `PanelGroup` (the bottom sheet already controls the actual visible height, so this only exists to satisfy the context requirement).
- `Workbench.client.tsx`'s code-view action-button row used `overflow-y-auto` on a horizontal `flex` row (axis mistake) — buttons got clipped by the parent's `overflow-hidden` instead of becoming scrollable. Fixed to `overflow-x-auto` + `max-w-full`.
- `mobile.scss`'s `.workbench-container` / `.workbench-container > div` rules (meant to strip padding/rounded corners on mobile) never matched anything — dead CSS, the class name was never attached to the actual panel wrapper despite the DOM structure matching the CSS author's intent exactly. Added the class.
- `android.css`'s Workbench clearance override only handled the bottom edge (bottom-nav clash, from loop 3); the top still reserved `--header-height` (48px) for a desktop app-header bar that `AndroidShell` never renders above the Files/Preview panel — a dead empty gap on an already-cramped screen. Added a `top: 0` override scoped to `.android-shell`.
- `Preview.tsx`'s toolbar (reload/selection/device-mode/inspector/fullscreen/window-size buttons + address bar) had no wrap or scroll; combined with `mobile.scss`'s 44px min-touch-target rule the buttons alone need ~330-420px, more than a 360-412px screen has. Added `flex-wrap` plus a `min-w-[140px]` floor on the address bar so it wraps to its own row instead of getting squeezed unreadable.
- `FileModifiedDropdown`'s popover was a fixed 320px, right-aligned, no collision detection — could run off the left edge of a ~360px viewport. Capped to `min(20rem, calc(100vw-1.5rem))`.
- CodeMirror's editor/gutter font defaulted to a fixed 12px with no mobile override anywhere in the codebase (confirmed via grep). Bumped to 15px/13px when `isMobileDevice()`.

**Deliberately not fixed this slice** (documented, not silently dropped): the device-mode resize-handle stays a visually 15px hit target (uses Pointer Events so it's not literally mouse-only, just below a comfortable touch-target size) and the window-size dropdown still offers desktop-scale presets (up to 3840px) with no scale-to-fit — both are part of the opt-in device-frame-simulation feature, not the core editor/preview path everyone uses.

**Validated**: 258/258 tests (unchanged — this slice is CSS/layout-only, no new logic to unit test), typecheck clean, lint clean, Cloudflare build clean, Android web build clean, native Gradle build succeeds, debug APK builds (8.98 MB, `com.veldra.app` v1.0, targetSdk 35, permissions unchanged — verified via `aapt dump badging`). **NOT VERIFIED**: none of this has rendered on an actual device or even a browser at a narrow viewport width — the terminal-crash fix is confirmed by reading `react-resizable-panels`' own source (`Panel` component throws without `PanelGroupContext`, confirmed by grep in `node_modules`), not by reproducing the crash and then not-reproducing it. **NEEDS DEVICE VALIDATION** like every other Android UI slice this session.

## Workspace persistence hardening + parser→ActionRunner integration test (2026-08-10, sixth loop)

**Phase B — persistence hardening.** Read `FilesStore#persistFallbackState()` directly and found a real silent-data-loss bug: on a failed IndexedDB write (device storage full is realistic now that binary file import exists), the error was only logged to the console. `createFile()`/`saveFile()` etc. already updated the in-memory files map and returned success *before* persistence was attempted, so the UI showed a change as saved while it silently never reached disk — an app restart would lose it with zero warning.

- `app/lib/stores/androidPersistenceHealth.ts` (+ `.spec.ts`): reactive `ok`/`quota-exceeded`/`error` status atom `FilesStore` updates on every persist attempt.
- `files.ts`: classifies `QuotaExceededError` distinctly, updates the health store, shows a de-duplicated toast (only on the failure transition, not every write).
- `AndroidFallbackBanner.tsx`: shows a persistent, high-visibility warning instead of a toast the user could miss mid-stream.
- `androidFallbackStorage.ts` (+ `.spec.ts`, 14 tests): added `isValidWorkspaceState()`/`isValidSessionState()` — IndexedDB enforces no schema, so a record malformed by an interrupted write or future incompatible version previously propagated straight into `FilesStore` unvalidated. Now discarded in favor of the safe default with a logged warning.

**Phase C — first real integration test for the core product loop.** Neither `message-parser.spec.ts` (tests the parser in isolation) nor `action-runner.spec.ts` (tests `ActionRunner` with hand-built fixtures) covered the actual seam: raw streamed model text → parser → `ActionRunner` → a real file write. Added `app/lib/runtime/parser-to-action-runner.spec.ts` (4 tests) wiring `EnhancedStreamingMessageParser` to a real `ActionRunner` with the exact callback sequencing `useMessageParser.ts` uses in production, covering: single complete response, streamed multi-chunk response, multi-file artifact (landing page scenario), and a plain conversational response correctly producing zero file writes. This is the deterministic, credential-free version of the "hello.txt" acceptance test the product mandate keeps asking for.

**Validated**: 258/258 tests (was 234; +24 new across both slices), typecheck clean, lint clean, Cloudflare build clean, Android web build clean, debug APK builds (8.98 MB). New integration test verified non-flaky across 4 consecutive full-suite runs. **NOT VERIFIED**: an actual `QuotaExceededError` or genuinely corrupted IndexedDB record on a real device (persistence hardening); the full chain has never run against a live, credentialed LLM (integration test uses a fixed model-output string, not a real streamed response) — both **NEED DEVICE / CREDENTIAL VALIDATION.**

## Native file import/export (2026-08-10, fifth loop)

Researched existing import/export first: `ImportFolderButton.tsx`/`ImportButtons.tsx` only ever create a *new chat* from a synthetic message, explicitly skip binary files, and never touch `FilesStore` — there was no way to import a file into an *already open* project. `workbenchStore.downloadZip()` silently dropped every binary file from every exported zip — a real, pre-existing bug, fixed in the same slice since it directly blocked re-exporting anything imported through the new path.

- `app/lib/services/workspaceFileImport.ts` (+ `.spec.ts`, 7 tests): `importFilesIntoWorkspace()` takes `File` objects from a plain `<input type="file">` picker (works in Android WebView via the native file chooser — no Capacitor plugin needed for import) and writes them through `workbenchStore.createFile()`/`createFolder()`, the same path the agent's artifact system uses. Handles binary files correctly (`Uint8Array`, not decoded text). Reuses existing `fileUtils.ts` helpers rather than reimplementing them. Wired into the Workbench's Sync dropdown as "Import Files"/"Import Folder".
- Fixed alongside it: "Sync Files" called `window.showDirectoryPicker()` with no feature detection (Chromium-desktop-only API) — now hidden when unsupported instead of present-but-broken.
- Export, Android-specific: `downloadZip()` now branches on `isCapacitor()`. Blob-download links have no reliable landing spot in the Android WebView, so on Android the zip is written to `Directory.Cache` (via new `@capacitor/filesystem@^7.1.8`) and handed to the native share sheet (`@capacitor/share@^7.0.4`, MIT, both official Capacitor plugins) so the user picks where it lands. Desktop/web keeps the unchanged `saveAs()` path. No new Android permissions required.

**Validated**: 234/234 tests (+7 new), typecheck clean, lint clean, Cloudflare build clean, Android web build clean, native Gradle build succeeds with both new plugin modules compiling and linking, debug APK builds (8.98 MB, no new permissions). **NOT VERIFIED**: on-device behavior of the native file picker or the share sheet — confirmed by successful build and unit tests only. **NEEDS DEVICE VALIDATION.**

## Chat history + back button fixed (2026-08-10, fourth loop)

Both items the previous loop found and deliberately deferred are now fixed:

- **Chat history (Priority 2)**: was completely broken on Android — every app launch was a brand-new chat, saved conversations could never be reopened, because bolt.diy's chat identity is entirely URL-path-based (`/chat/:id` via Remix loaders) and the Android build's `@remix-run/react` shim makes `useLoaderData()`/`useNavigate()` no-ops. Fixed with a new `androidActiveChatId` store (`app/lib/stores/androidChatSession.ts`) that substitutes for the URL-derived chat id only on Android, changed only by explicit user actions (tap history item, start new chat, duplicate/import) — never by the "first message gets a persistent id" flow, so sending a message never interrupts itself mid-stream by remounting. `Chat.client.tsx`'s `ChatImpl` is now keyed on this store so switching chats actually resets `useChat()`'s message state (there's no route change to do that for free, unlike the web build). Desktop/web chat identity is untouched.
- **Android back button (Priority 3)**: no handler existed anywhere. Added `@capacitor/app@^7.1.2` (MIT, official Capacitor plugin), synced into the native Android project, registered a `backButton` listener in `AndroidShell.tsx`: Workbench overlay open → close it; non-chat tab → switch to chat; otherwise → `App.exitApp()`. Verified: native `capacitor-app` Gradle module compiles and links (`:capacitor-app:assembleDebug` succeeded), debug APK builds with no new Android permissions.

**Deliberately NOT handled** (documented, not silently dropped): drawers/dialogs owned by deeper components (`MobileFileTreeDrawer`, `MobileTerminalDrawer`, Settings `ControlPanel` sub-panels, delete-confirmation dialogs) have local state the shell-level back listener can't see — back currently skips past them to the tab/overlay level while they're open. A correct fix needs a shared "back handler stack" components can register into; that's a distinct, larger architectural addition for a future loop, not a same-slice extension.

**Validated**: 227/227 tests (+3 new for the chat-session store), typecheck clean, lint clean, Cloudflare build clean, Android web build clean, native Gradle build succeeds, debug APK builds (9.36 MB). **NOT VERIFIED**: actual on-device behavior of either fix — chat switching without visual glitches, and the hardware back button actually doing the right thing when pressed. Both are confirmed correct by code inspection and successful builds only. **NEEDS DEVICE VALIDATION.**

## Critical gap found and fixed: agent file changes were invisible on Android (2026-08-10)

A deep audit (see `project/SESSION-HANDOFF.md` for the full trail) found that `AndroidShell.tsx` — the actual React root the shipped Android app uses (confirmed: the Android build does **not** use Remix routing at all; `android-main.tsx` mounts `AndroidShell` in a bare `MemoryRouter`, so `app/routes/_index.tsx` is dead code for the shipped app) — only ever rendered the `chat` and `settings` tabs. `BottomNav` already had `files`/`preview` buttons, but they were hardcoded `disabled` (`workbenchAvailable={false}`) and had **no render branch at all** even if enabled. `ActionRunner`/`FilesStore` were already correctly persisting agent-created files (confirmed the loop before this one), but there was no UI path to ever see them — the mandate's central acceptance test ("create hello.txt, show me the diff") was a dead end on Android regardless of whether chat/model/agent worked.

Fixed by reusing the existing desktop `Workbench.client.tsx` (file tree, editor, code/diff slider, preview — unmodified) instead of building a second file/diff UI:
- `AndroidShell.tsx` now lazy-mounts `Workbench` and drives `workbenchStore.showWorkbench`/`currentView` from the bottom-nav tab state.
- `android.css` gained an `.android-shell`-scoped clearance fix — the Workbench panel is `position:fixed` and was extending under the opaque, higher-z-index bottom nav bar.
- `src/android-main.tsx` now imports `index.scss` (previously only `android.css` loaded). Workbench/EditorPanel/DiffView/CodeMirror/TerminalTabs depend on CSS custom properties (`--header-height`, `--workbench-left`, `.z-workbench`) and component styles defined there — undefined without it. This also finally loads `mobile.scss`, whose header comment already names the Galaxy A56 as a target device; it was written for exactly this integration but never wired up.
- `Chat.client.tsx`: a `fetch()`-level network failure (unreachable Android backend) previously surfaced as a generic "unexpected error occurred" instead of a clear message — now detects it and names the configured backend URL.

**Validated**: 224/224 tests, typecheck clean, lint clean, Cloudflare build clean, Android web build (`android:webbuild`) clean, debug APK builds successfully (`BUILD SUCCESSFUL in 9s`). **NOT VERIFIED**: on-device visual correctness — drawer slide animation, exact bottom-nav clearance, overall Workbench layout on a real 360–412px viewport. This is a CSS/layout change confirmed to compile and build but not confirmed to look right; **NEEDS DEVICE VALIDATION**.

**Found, documented, deliberately deferred (not a silent drop):**
- Android hardware back button has no handler anywhere in the app. Fixing this needs the `@capacitor/app` plugin — a new native dependency touching Gradle/Capacitor config, a bigger decision than a same-slice fix.
- Chat history navigation is confirmed broken on Android: `HistoryItem.tsx` navigates via `<a href="/chat/...">`, but the Android build's `@remix-run/react` shim (`src/shims/remix-react.tsx`) makes `useLoaderData()` always return `{}` and `useNavigate()` a no-op — a saved chat can never be reopened; every launch is a fresh session. Pre-existing, not introduced this loop.

## Validation baseline (2026-08-10, this session/environment)

| Check | Result |
|---|---|
| Git status/fetch | Clean; `main` synchronized with `origin/main` |
| `pnpm install` | Was blocked by a GitHub 403 fetching `@electron/node-gyp`'s tarball; fixed with the same `pnpm.overrides` entry already proven in the bolt-android source (`npm:@electron/node-gyp@10.2.0-electron.2`) |
| `pnpm test` | Passed: 27 files / 224 tests (was 205 at session start; +19 across the Android bridge slices) |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed: 0 errors (142 auto-fixable formatting/style findings resolved via `lint:fix` earlier this session, re-verified with tests/typecheck) |
| `pnpm build` | **Passed** in this environment (15 GB RAM) — the previously documented Miniflare/tcmalloc 1 GiB OOM does not reproduce here; environment-dependent, not a code defect |
| Android debug APK | **Built successfully three times** this session — initial chat bridge, model-selector/enhance-prompt fixes, then the Workbench-visibility fix (`BUILD SUCCESSFUL in 9s`, `app-debug.apk`, 8.98 MB, `com.veldra.app` v1.0, targetSdk 35, minSdk 23). Delivered to the product owner each time. Android SDK (platform 35, build-tools 35.0.0, platform-tools) installed ad hoc at `/opt/android-sdk` in this ephemeral container — **not persisted**; a future session/CI run needs the SDK available again (the repo's `.github/workflows/android-debug-apk.yml` already handles this for CI). Java 21 and Gradle were already present in this environment. |
| Secret scan | No private-key or obvious literal-token findings; `.env.example` and `.env.production` remain tracked templates/configuration files and require review before release |

## Android LLM chat bridge (2026-08-10)

Implemented per `docs/ANDROID_LLM_API_BRIDGE.md` Option B: the Android app (no server process of its own) sends chat/model requests to a Bearer-token-authenticated bridge on the same backend deployment that already serves `/api/chat` for the web app.

- `app/routes/api.android.{health,models,chat}.ts` — new routes, gated by `checkAndroidApiAuth()` (`app/lib/.server/android-auth.ts`, constant-time comparison against `ANDROID_API_BACKEND_TOKEN`, fails closed with 500 if unconfigured).
- `chatAction()` moved from the `api.chat.ts` route file into `app/lib/.server/llm/chat-action.ts` so both `api.chat.ts` (cookie-authenticated) and `api.android.chat.ts` (Bearer-authenticated) can import the identical streaming/MCP/context-selection logic — no duplicated chat logic, no per-platform provider special-casing.
- `api.android.chat.ts` strips the `Cookie` header before delegating, so `apiKeys`/`providerSettings` resolve to `{}` and `BaseProvider`'s existing `serverEnv`/`process.env` fallback chain supplies provider credentials from this backend's own environment — provider API keys never reach the Android app or its local storage.
- `app/lib/android-api/backend-config.ts` reads the Android app's locally-stored backend URL/token (`AndroidSettingsPanel.tsx` already wrote these keys); `Chat.client.tsx` now points `useChat()` at the Android backend when `isCapacitor()` and a backend is configured, and blocks sending with a toast otherwise instead of calling a route that can't exist in-app.
- **Tested**: auth gate (9 cases) and backend-config parsing (4 cases) — 218/218 total tests at that point, clean typecheck/lint/build.
- **NOT YET VERIFIED**: real end-to-end streaming against a live provider from a physical device — no provider credentials exist in this environment. This is the next highest-value step (see Known blockers).

## Android chat vertical slice completed (2026-08-10, same session, follow-up loop)

The chat bridge above only covered `chatAction()`. Auditing the rest of the chat surface for the identical bug class (`fetch('/api/...')` calls that don't exist inside the Android WebView) found and fixed three more breaks that were silently blocking the chat bridge from being usable end-to-end:

- `BaseChat.tsx` fetched `/api/models` directly — the model selector had **no models to show on Android** even though `api.android.models.ts` already worked. Fixed via `getAndroidModelsRequest()` in `app/lib/android-api/backend-config.ts`.
- `ChatBox.tsx` rendered the per-provider `APIKeyManager` text-entry UI on Android, where a typed-in key is silently dropped (Cookie header is stripped before `chatAction()`). Replaced with a notice pointing at the real configuration surface (Settings → Android API Backend) on Android.
- `usePromptEnhancer.ts`'s "Enhance prompt" button called `/api/enhancer` directly, same broken pattern. Fixed the same way as chat: `enhancerAction()` extracted to `app/lib/.server/llm/enhancer-action.ts`, new `app/routes/api.android.enhance.ts` route, `getAndroidEnhanceRequest()` helper.
- `AndroidApiClient.ts`'s `health()`/`listModels()` methods called bare `/health`/`/models` paths that don't match the real `/api/android/*` routes — the Settings panel's "Test API Backend" button was calling a URL that 404s. Fixed; documented in-code which of its other methods (`sendChatMessage`, `streamChatResponse`, `enhancePrompt`, `validateProviderConfig`) still have no backing server route, rather than leaving them silently wrong.
- `docs/ANDROID_LLM_API_BRIDGE.md` updated with a table of the real implemented paths vs. the original design draft's bare paths.

**Tested**: 224/224 tests (was 218), clean typecheck/lint/build. **NOT YET VERIFIED**: still needs a deployed backend with `ANDROID_API_BACKEND_TOKEN` + a real provider key, and the URL/token entered in the Android app, to confirm an actual on-device streamed response.

### Architectural finding: the first agent/tool workflow does not need new code

Investigated what it would take to make "user types `create hello.txt with content Hello VELDRA`" actually create a file on Android (the mandate's first vertical-slice acceptance test), expecting to need a new tool-calling system. It does not exist as a gap:

- bolt.diy's existing `<boltArtifact>`/`<boltAction type="file">` streamed-tag mechanism (`app/lib/runtime/message-parser.ts` → `useMessageParser` → `workbenchStore.addArtifact`/`runAction` → `ActionRunner`) is provider-neutral, already reused verbatim by Android chat (same `Chat.client.tsx`/`Workbench.client.tsx` components, `chatMode` defaults to `'build'` which is what activates the artifact system prompt).
- `ActionRunner`'s file-action path already branches to `FilesStore.saveFile()` when `usesLocalWorkspaceForFileActions()` is true (Android fallback mode), which persists to IndexedDB and updates the same modified-files tracking `DiffView.tsx` reads from — no Android-specific code path needed, none is missing.
- `Workbench.client.tsx` (file tree, action list, diff view) has zero `isCapacitor()` gating — it renders identically on Android.
- Confirmed **NOT implemented**: MCPService's AI-SDK-native tool-calling plumbing has no built-in `read_file`/`write_file` tools (only user-configured MCP servers) — but this is irrelevant, since file creation already happens through the artifact mechanism, not AI-SDK tool calls. Building a second, parallel tool-calling system for this would have duplicated working functionality (explicitly against the project's "extend, don't duplicate" rule) instead of fixing an actual gap.
- Confirmed **NOT implemented**: `@capacitor/filesystem` — Android file writes land in IndexedDB (app-private), not the device's real filesystem or a synced Remote Runtime workspace. This is a real, separate limitation (files are visible in VELDRA's own UI but not in an Android file manager), not a blocker for the "create a file, see it in chat/diff" acceptance test itself.

**Conclusion**: the hello.txt-style first agent workflow is very likely to already work end-to-end on a real device now that model selection is fixed, contingent only on a configured provider — but this is an inference from static analysis, not a device observation. Still **NOT VERIFIED** per the project's no-fake-success rule; needs an actual device run to confirm, not further implementation work.

## State matrix

| Area | Status | Next step |
|---|---|---|
| Branding / Android identity | Implemented foundations | Generate raster variants and device-verify when Android tooling is available |
| Web UI / Image Studio | Contract and unavailable state; no fake provider | Integrate only a verified image provider |
| LLM providers / NIM / Bedrock | Existing providers; NIM dynamic and credential-gated | Verify provider IDs/capabilities without live-cost requests |
| Model catalog / routing / reasoning | Provider-neutral contracts and capability routing | Wire verified catalog snapshots to runtime policy |
| Budget / entitlement | Pure bounded policies and tests | Integrate one policy boundary into execution lifecycle |
| Local models / Hugging Face / device profiles | Existing provider/settings foundations; no compatibility profiler | Add evidence-backed metadata and device scoring contracts |
| Execution / sandbox | WebContainer provider registered; Android/local file actions use FilesStore callbacks; bounded registry status is visible in Runtime Settings | Add a real session bridge before routing shell/build/start actions |
| Remote Runtime / sandbox | Allowlisted command profiles, path checks, auth, preview status | Add a registered provider adapter and integration tests before routing actions |
| Agents / skills / subagents / Gauntlet | Bounded orchestration/studio foundations; no autonomous shell execution | Define explicit permissioned runtime adapter |
| Git / updates | Remote Git workflow and VELDRA update manifest foundations | Keep push/release paths explicitly verified and non-secret |
| Security | Auth/CORS repair implemented and tested at policy level; no default runtime credential | Add package-level integration tests when runtime dependencies are available |
| Documentation | Handoff, status, and roadmap synchronized for the execution-status slice | Maintain docs with each meaningful slice |

## Current execution integration

- `app/lib/execution/runtime-status.ts` reports registry-backed provider status without booting providers or mutating runtime mode.
- The runtime-mode-to-provider mapping is an explicit interim boundary: WebContainer maps to `webcontainer`; Android fallback intentionally has no sandbox provider; Remote Runtime remains unregistered until a provider adapter implements the sandbox session contract.
- WebContainer status requires the registered provider to be available and to advertise an interactive shell.
- Android fallback is reported as `not-required` because it intentionally has no sandbox command provider.
- Runtime Settings performs at most three bounded registration checks and labels the result as registry information; it does not claim ActionRunner has switched to provider-neutral sessions.
- ActionRunner keeps the established direct WebContainer/BoltShell path for browser/Desktop Remote, while Android fallback and Android Remote file/history actions use explicit FilesStore callbacks.
- Shell/build/start actions remain capability-gated; a provider-neutral session bridge is still required before routing command execution.

## Previous validation and security baseline

- Remote Runtime security policy tests: 7/7 focused tests passed in the symlink-boundary slice; root validation previously reached 22/22 files and 182/182 tests.
- Root typecheck and focused ESLint passed for the prior security and execution slices.
- `git diff --check` and secret-pattern scans passed for prior pushed slices.
- Remote Runtime package compilation remains blocked where package-local dependencies are absent; no dependency installation was performed.
- Production build remains blocked by the Miniflare/tcmalloc address-space limitation before application build completion.
- Android web build remains blocked by Node heap OOM during chunk generation; no APK or physical-device validation was performed.
- Android validation requires JDK, Android SDK/Gradle, adb, and a physical or CI device; these tools are unavailable in the current environment.

## Known blockers

- Production build requires an environment with sufficient address space for Miniflare/tcmalloc — succeeded in this session's 15 GB environment; still worth tracking since a smaller environment can reproduce the OOM.
- Physical-device/APK-install verification still requires the product owner's own device — a debug APK now builds successfully and was delivered; on-device functional testing itself remains **NEEDS DEVICE VALIDATION**.
- Android LLM chat bridge (`/api/android/*`) is implemented and unit-tested but **NEEDS DEVICE + CREDENTIAL VALIDATION**: an `ANDROID_API_BACKEND_TOKEN`-configured backend deployment with at least one real provider API key, plus entering that backend's URL/token in the Android app's Settings, are both required before a real end-to-end streamed response can be confirmed on-device.
- No verified image-generation credentials or local image runtime are available; Image Studio remains unavailable by design.
- Remote Runtime must be configured with `REMOTE_RUNTIME_TOKEN`; predictable defaults are not accepted.
- Live Bedrock/NVIDIA connections were not executed because credentials are absent and tests must not incur provider costs.
- ActionRunner has not yet been switched to provider-neutral command sessions; doing so requires a session bridge that preserves terminal lifecycle, file-action semantics, remote capability checks, and Android fallback behavior.

## Documentation and product integrity

- Upstream bolt.diy attribution and MIT licensing remain preserved.
- No fake image, provider, model capability, Android hardware result, or live provider result is represented as verified.
- Historical repositories remain read-only references and are not active VELDRA workspaces.
