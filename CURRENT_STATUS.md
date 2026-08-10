# VELDRA — Current Status

**Last updated:** 2026-08-09
**Branch:** `main`  
**Git sync:** local `main` is synchronized with the canonical private repository `origin/main`
**Target device:** Samsung Galaxy A56 (Android 15, 1080×2340)

> **Current validation note — 2026-08-09:** The local Auto capability-router MVP slice passes the full root suite (23/23 files, 187/187 tests), focused router tests (13/13), root typecheck, focused ESLint, `git diff --check`, and secret scanning. It adds an explicit Auto model option and resolves it to a concrete model within the selected provider before the existing streaming/provider path. Production and Android builds remain blocked by the previously documented environment OOM limits; commit/push is pending.

---

## What Has Been Implemented

### Phase 1: Capacitor WebView Shell ✅ COMPLETE

**Commit `de15701` — "feat: add android capacitor shell"**

| Item | Status | Details |
|------|--------|---------|
| Capacitor installed | ✅ | v7.6.7 (core, cli, android) — chosen for Node 20 compat |
| `capacitor.config.ts` | ✅ | appId `com.veldra.app`, webDir `build/client`, debug flags, splash screen |
| Android project scaffolded | ✅ | `cap add android` — Gradle, MainActivity, manifests, resources, splash icons |
| npm scripts | ✅ | 7 scripts: `android:init`, `android:sync`, `android:copy`, `android:open`, `android:build`, `android:run`, `android:clean` |
| `cap copy android` tested | ✅ | Web assets copy to `android/app/src/main/assets/public/` successfully |

### Adapter Layer (Phase 0) ✅ COMPLETE

**6 files in `app/lib/adapters/`:**

| File | Purpose | Lines |
|------|---------|-------|
| `types.ts` | `PlatformAdapter`, `FilesystemAdapter`, `TerminalAdapter`, `PreviewAdapter` interfaces | 85 |
| `platform.ts` | `isCapacitor()`, `isElectron()`, `isWebContainerSupported()`, `getPlatformInfo()` | 95 |
| `android-adapter.ts` | `AndroidAdapter` — no-op terminal, empty preview, stub FS | 180 |
| `webcontainer-adapter.ts` | `WebContainerAdapter` — wraps real `@webcontainer/api` | 160 |
| `index.ts` | Factory: `getAdapter()` picks adapter based on platform at runtime | 55 |
| `README.md` | Adapter layer documentation | 75 |

### Store Fallback Guards ✅ COMPLETE

| File | Change | Behavior on Android |
|------|--------|---------------------|
| `app/lib/webcontainer/index.ts` | Guarded boot — checks `isWebContainerSupported()` before calling `WebContainer.boot()` | Returns null promise instead of crashing |
| `app/lib/stores/terminal.ts` | `#isFallbackMode` flag, skips `webcontainer.spawn()` when true | Terminal tabs render empty, no crash |
| `app/lib/stores/files.ts` | `#isFallbackMode` flag, updates in-memory nanostores map when true | File tree updates work, no WebContainer FS persistence |

### Runtime Adapter Layer (Phase 1) ✅ COMPLETE

**Commit `d13332c` — "feat: add runtime adapter layer"**

| File | Purpose |
|------|---------|
| `src/mobile/adapters/runtime/RuntimeAdapter.ts` | High-level interface: boot, FS, terminal, commands, dev server, preview, capabilities |
| `src/mobile/adapters/runtime/WebContainerRuntimeAdapter.ts` | Desktop: delegates to `@webcontainer/api` |
| `src/mobile/adapters/runtime/AndroidFallbackRuntimeAdapter.ts` | Android: in-memory FS, stub terminal, unsupported messages |
| `src/mobile/adapters/runtime/index.ts` | Factory: `getRuntimeAdapter()`, `hasFullRuntime()`, `isFallbackMode()` |

### Android Runtime Fallback Mode ✅ COMPLETE

**Commit `aa05bed` — "feat: add android runtime fallback mode"**

| File | Purpose |
|------|---------|
| `app/lib/stores/runtime-mode.ts` | Runtime mode store: detects platform, persists mode override + remote URL, capability flags |
| `app/components/mobile/RuntimeModeBanner.tsx` | Dismissible amber banner in chat: explains fallback mode |
| `app/components/@settings/tabs/runtime/RuntimeModeTab.tsx` | Settings tab: mode selection, remote URL input, capability matrix |
| `app/components/@settings/core/types.ts` | Added 'runtime' tab type |
| `app/components/@settings/core/constants.tsx` | Added runtime tab icon, label, description, default config |
| `app/components/@settings/core/ControlPanel.tsx` | Wired RuntimeModeTab into getTabComponent |
| `app/components/chat/BaseChat.tsx` | RuntimeModeBanner at top of chat column |

### GitHub Sync Panel ✅ COMPLETE

**Commit (this) — "feat: add mobile github sync panel"**

| File | Purpose |
|------|---------|
| `app/lib/stores/github-sync.ts` | GitHub sync store: repo URL, branch, sync status, uncommitted count |
| `app/components/mobile/GitHubSyncPanel.tsx` | Mobile-friendly sync panel: config, status, disabled commit/push buttons with explanations |
| `app/components/@settings/tabs/github/GitHubTab.tsx` | Added GitHubSyncPanel section below existing GitHub integration |
| `README_ANDROID.md` | Added GitHub setup docs: token connection, commit/push limitations, troubleshooting, TODO |

### Documentation ✅ COMPLETE

| File | Content |
|------|---------|
| `PORTING_REPORT.md` | Full dependency audit: 8 sections covering WebContainer (11 imports), terminal (5 files), FS (22 call sites), Electron (isolated), keyboard shortcuts (14 files), fixed layouts (11 issues), unsupported WebView APIs (6), 33 server-side API routes |
| `TODO_NEXT.md` | 6-phase implementation plan with checkboxes, build commands, dependency notes |
| `README_ANDROID.md` | Beginner setup guide: prerequisites, install, build, sync, open, device testing |
| `src/mobile/adapters/README.md` | Adapter architecture, interface definitions, exact file change list (~45 files across phases), dependency disposition |
| `app/lib/adapters/README.md` | Adapter layer usage docs with code examples |

---

## Current Architecture

```
VELDRA/
├── app/                         # Remix/Vite web app (unchanged from upstream)
│   ├── lib/
│   │   ├── adapters/            # NEW — platform abstraction layer
│   │   │   ├── types.ts         #   PlatformAdapter interface
│   │   │   ├── platform.ts      #   Runtime detection (Capacitor/Android/touch/SAB)
│   │   │   ├── android-adapter.ts     #   Fallback for Android
│   │   │   ├── webcontainer-adapter.ts #  Wraps @webcontainer/api
│   │   │   └── index.ts         #   Factory: getAdapter()
│   │   ├── webcontainer/
│   │   │   └── index.ts         # MODIFIED — guarded boot
│   │   └── stores/
│   │       ├── terminal.ts      # MODIFIED — fallback mode
│   │       └── files.ts         # MODIFIED — fallback mode
│   ├── components/              # UI components (UNCHANGED — Phase 2 will modify)
│   ├── routes/                  # 33 API routes + pages (UNCHANGED — Phase 5 will modify)
│   └── styles/
│       └── variables.scss       # CSS vars (UNCHANGED — Phase 2 will add mobile overrides)
├── android/                     # NEW — Capacitor native Android project
│   ├── app/
│   │   ├── build.gradle         #   compileSdk 35, minSdk 23, targetSdk 35
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/veldra/app/MainActivity.java
│   │   │   └── res/             #   icons, splash, strings, styles
│   │   └── ...
│   ├── build.gradle
│   ├── variables.gradle
│   └── settings.gradle
├── capacitor.config.ts          # NEW — Capacitor config
├── PORTING_REPORT.md            # NEW — dependency audit
├── TODO_NEXT.md                 # NEW — phased plan
├── README_ANDROID.md            # NEW — setup guide
├── docs/ANDROID_DEVICE_TEST_PLAN.md # NEW — device testing plan
├── src/mobile/adapters/         # NEW — mobile adapter docs
│   └── README.md
└── package.json                 # MODIFIED — Capacitor deps + 7 android scripts
```

**Key principle:** All changes are additive or guarded. The desktop web app runs identically to upstream. Adapters only activate when `isCapacitor()` or `!isWebContainerSupported()` returns true.

---

## Android / Capacitor / WebView Status

| Aspect | Status | Notes |
|--------|--------|-------|
| Capacitor installed | ✅ Working | v7.6.7, `cap copy` succeeds |
| Android project | ✅ Scaffolded | `com.veldra.app`, minSdk 23, targetSdk 35 |
| Web build → Android | ✅ Pipeline exists | `npm run android:sync` → `android:webbuild` → `cap sync android` |
| WebContainer on Android | ❌ Not available | SharedArrayBuffer unsupported in WebView — guarded, app doesn't crash |
| Terminal on Android | ⚠️ Polished fallback | Replaces empty xterm with designed screen & settings redirection |
| File system on Android | ✅ IndexedDB persistence | In-memory store + IndexedDB auto-save/restore across restarts |
| Android WebView shell | ✅ Real UI loads | `android:webbuild` → `build/client/index.html` → Capacitor |
| Preview on Android | ✅ Remote/static preview | Designed fallback supports local static HTML and Remote Runtime live preview status/direct LAN URLs |
| LLM chat on Android | ⚠️ Bridge scaffolded | Remix API routes cannot run in WebView; Phase 5.6 adds safe Android API Backend design/client/settings placeholder |
| Mobile UI | ❌ Not started | Desktop layouts break at 360px (533px min-width, 1200px modal) |
| APK build | ✅ Automated | `android:apk:debug` compiles the debug APK via Gradle wrapper |
| Remote Runtime file sync | ✅ MVP complete | Explicit text-file push/pull/single-file sync; IndexedDB remains source of truth |
| Remote Runtime command profiles | ✅ MVP complete | Safe allowlisted npm/pnpm install/dev/build profiles with WebSocket output, stop, and command status panel |
| Remote Runtime live preview | ✅ MVP complete | Tracks `npm run dev` / `pnpm run dev` output, returns JSON preview status, and loads detected LAN preview URLs on Android |
| Android LLM API bridge | ✅ Scaffold complete | Recommends separate authenticated backend; provider keys stay server-side; production chat not connected yet |
| Device tested | ⚠️ Test plan ready | Phase 5.7: `docs/ANDROID_DEVICE_TEST_PLAN.md` created for Samsung Galaxy A56 testing |

---

## Known Limitations

1. **LLM chat not wired on Android** — The app's core feature requires server-side API routes (`api.chat.ts`, `api.llmcall.ts`, etc.) which don't exist in a WebView. Phase 5.6 adds a safe Android API Backend design and client scaffold, but production chat still needs a backend implementation and integration.

2. **Live preview fallback** — Dev server preview is unavailable without WebContainer/Remote Runtime. Remote Runtime now tracks dev-server URL output and the Android Preview tab can load a detected LAN URL; local `index.html` static Blob preview remains available.

3. **Terminal fallback** — The terminal cannot run a local shell process without WebContainer. In Android fallback mode it shows setup guidance; in Remote Runtime mode it shows safe npm/pnpm command-profile buttons, streamed output, stop control, and last-command status. Free-form terminal input is still disabled.

4. **IndexedDB file persistence** — Files created by AI actions are saved to IndexedDB and restored on app restart. In-memory store is always in sync with IndexedDB.

5. **Remote Runtime file sync** — Phase 5.3 adds optional text-file sync to a trusted LAN server. Push sends all local IndexedDB text files; pull imports remote text files only after user action and keeps local files on conflict. Binary files are skipped with warnings.

6. **Remote Runtime command execution** — Phase 5.4 allows only predefined profiles: `npm install`, `npm run dev`, `npm run build`, `pnpm install`, `pnpm run dev`, and `pnpm run build`. Commands require auth, run inside the workspace directory, enforce timeout, stream stdout/stderr/status/exit over WebSocket, and can be stopped.

7. **Remote Runtime live preview** — Phase 5.5 detects common Vite dev-server URLs from safe dev-command stdout/stderr, exposes `GET /workspace/:id/preview` JSON status, and loads direct network URLs in Android. No preview proxy is implemented yet; projects must bind dev servers to `0.0.0.0` for phone access.

8. **Android API Backend required for AI** — Provider keys must stay on a trusted backend. The APK stores only a backend URL/token placeholder and does not bundle provider API keys.

9. **Desktop layout breaks on mobile** — `--chat-min-width: 533px` forces horizontal scroll. Settings modal is 1200px wide. `react-resizable-panels` doesn't support touch resize. `react-dnd` with `HTML5Backend` doesn't work on touchscreens.

10. **Git operations via Remote Runtime** — Client UI is fully wired to the Remote Runtime Git API. Users can initialize a Git repository, check git status, and commit changes on the remote workspace. Pushing to GitHub is supported in dry-run/simulation mode for credential safety.

11. **Screenshot selector broken** — Uses `navigator.mediaDevices.getDisplayMedia()` which doesn't exist in Android WebView.

12. **Speech recognition unreliable** — `webkitSpeechRecognition` may not be available in all Android WebView versions.

13. **Android build workflow** — The Android build workflow is now fully automated. `npm run android:apk:debug` compiles the debug APK containing the fully functional SPA build.

---

## Broken or Unfinished Parts

| Component | State | Fix Required |
|-----------|-------|-------------|
| `build/client/` | ✅ Complete | Vite SPA build generates real React SPA assets correctly |
| LLM chat (`api.chat.ts`) | Bridge scaffolded | Implement authenticated Android API Backend and wire chat to `AndroidApiClient` |
| Model listing (`api.models.ts`) | Bridge scaffolded | Implement backend `/models` contract and wire model selectors safely |
| Preview iframe | ✅ Complete | Designed fallback, local static HTML preview, and Remote Runtime live preview status/direct LAN URL loading implemented |
| Terminal process | ✅ Complete | Designed fallback and settings redirection implemented |
| File system persistence | ✅ Complete | InMemoryFS with IndexedDB backing automatically saves and restores files |
| Remote Runtime file sync | ✅ MVP complete | Text-only push/pull/current-file sync; local IndexedDB wins on conflict |
| Remote Runtime command profiles | ✅ MVP complete | Allowlisted npm/pnpm profiles only; output streams over WebSocket and command metadata is shown in the terminal panel |
| Remote Runtime live preview | ✅ MVP complete | Detects Vite-style URLs from dev command output; JSON preview status and Android preview refresh are implemented |
| Android LLM API bridge | ✅ Scaffold complete | `docs/ANDROID_LLM_API_BRIDGE.md`, `AndroidApiClient`, and Android settings placeholder added; no provider keys in APK |
| Git operations | ✅ MVP complete | Phase 5.7: Remote Git API server scaffolding and UI client integration complete. Push operations are dry-run only. |
| Settings modal | 1200px fixed width | Phase 2: `w-full max-w-[1200px]` |
| Chat layout | Forces 533px min width | Phase 2: responsive CSS override |
| DnD (file tree, chat) | HTML5 backend, no touch | Phase 2: switch to `react-dnd-touch-backend` |
| Screenshot selector | `getDisplayMedia` unavailable | Phase 2: hide on mobile |
| Keyboard shortcuts | No Ctrl/Cmd on mobile | Phase 2: no-op on mobile |
| `package-lock.json` | Untracked | Can remain untracked or added to gitignore |

---

## Exact Next Implementation Steps

### Phase 2: Mobile UI (immediate next)

1. **`app/styles/variables.scss`** — Add media query: `@media (max-width: 768px) { --chat-min-width: 100%; --workbench-width: 100%; --workbench-left: 0; }`

2. **`app/components/chat/BaseChat.tsx`** — Stack chat above workbench on mobile (not `lg:flex-row`). Reduce `mt-[16vh]` to `mt-[8vh]` on mobile. Hide `ScreenshotSelector` when `isCapacitor()`. Feature-detect `SpeechRecognition`.

3. **`app/components/@settings/core/ControlPanel.tsx`** — Change `w-[1200px] h-[90vh]` to `w-full max-w-[1200px] h-full md:h-[90vh]`.

4. **`app/components/workbench/EditorPanel.tsx`** — On mobile: replace `PanelGroup`/`PanelResizeHandle` with tab-based switching (Editor | Files | Terminal).

5. **`app/components/workbench/FileTree.tsx`** — Wrap in collapsible drawer on mobile (slide from left).

6. **`app/components/workbench/terminal/TerminalTabs.tsx`** — Wrap in bottom slide-up drawer on mobile.

7. **`app/components/workbench/Preview.tsx`** — Fullscreen mode on mobile, no device frame.

8. **`app/root.tsx`** — Replace `HTML5Backend` with `TouchBackend` from `react-dnd-touch-backend` (or conditional).

9. **`app/lib/hooks/useShortcuts.ts`** — Early return when `isCapacitor()` or touch-only.

10. **NEW `app/components/mobile/BottomNav.tsx`** — Bottom tab bar: Chat, Files, Preview, Settings.

11. **NEW `app/styles/mobile.scss`** — Mobile-specific CSS overrides.

12. **Commit:** `feat: mobile-first responsive UI`

### Phase 3: Filesystem Adapter

1. Create `app/lib/adapters/in-memory-fs.ts` — implements `mkdir`, `writeFile`, `readFile`, `readdir`, `rm` with localStorage/IndexedDB backing.
2. Update `FilesStore` fallback to use `InMemoryFS`.
3. Update `useGit.ts` to use `InMemoryFS` as `isomorphic-git` FS backend.
4. Update `action-runner.ts` to route file ops through adapter.
5. Update `Search.tsx` to search in-memory contents.
6. **Commit:** `feat: in-memory filesystem adapter for Android`

### Phase 4: Terminal/Preview Adapter

1. Create `app/lib/adapters/terminal-adapter.ts` — `NullTerminalAdapter` with fallback message.
2. Update `TerminalStore` to use adapter instead of direct WC spawn.
3. Update `Terminal.tsx` to show "Terminal not available on mobile".
4. Update `Preview.tsx` to show "Preview not available on mobile".
5. No-op `shell.ts` functions when WC unavailable.
6. **Commit:** `feat: terminal and preview fallback for mobile`

### Phase 5: Remote Runtime Design & Scaffold ✅ COMPLETE

1. **Commit `66d0dc0` — "feat: scaffold remote runtime client"**
2. **Commit `5f8b651` — "feat: scaffold secure remote runtime server"**
3. **Commit `7ba9bc4` — "feat: connect android settings to remote runtime"**
4. Created `docs/REMOTE_RUNTIME.md` detailing the secure API contract and WS events.
5. Implemented `RemoteRuntimeClient.ts` with health check, workspace stubs, and single-file write methods.
6. Connected Settings UI on Android to execute live `/health` status tests and `/workspace` creations.
7. Workspace ID configuration is successfully persisted and connection state indicators render in UI.

### Phase 5.7: Remote Runtime Git Workflow Wiring & Integration ✅ COMPLETE

1. **Commit [HEAD] — "feat: complete remote git workflow wiring"**
2. Created `docs/REMOTE_GIT_WORKFLOW.md` detailing the secure Git API specifications.
3. Implemented safe Git command execution engine using `execFile` (shell-less) in `remote-runtime/src/git.ts`.
4. Exposed endpoints `/workspace/:id/git/status`, `/git/init`, `/git/commit`, `/git/push` with authentication and workspace validation in `remote-runtime/src/server.ts`.
5. Exposed helper methods (`gitStatus`, `gitInit`, `gitCommit`, `gitPush`) in `RemoteRuntimeClient.ts`.
6. Wired action buttons (Git Init, Git Status, Commit, Push Dry-Run) and terminal logs box in client settings UI `GitHubSyncPanel.tsx`.

### Phase 6: APK Build & Polish ✅ COMPLETE

1. **Commit `ad1ffa6` — "ci: add debug apk artifact workflow"**
2. Set up automated build scripts (`scripts/build-apk.mjs` with automatic JVM 21/SDK discovery).
3. Successfully compiled debug APK locally (`npm run android:apk:debug` generating `app-debug.apk`).
4. Implemented manual trigger (`workflow_dispatch`) GitHub Actions workflow at `.github/workflows/android-debug-apk.yml` to compile and upload `app-debug.apk` as a workflow artifact.
5. Documented step-by-step GitHub build/download processes and added troubleshooting sections to `README_ANDROID.md` for permissions, SDK paths, Node memory, and missing artifacts.

---

## Git State

The canonical repository is available and the latest Image Studio foundation has been pushed successfully.

```
[HEAD] feat: complete remote git workflow wiring
ad1ffa6 ci: add debug apk artifact workflow
feat: connect android settings to remote runtime
5f8b651 feat: scaffold secure remote runtime server
e94c805 chore: verify remote runtime scaffold
```

**Remote:** `origin → git@github.com:mertgoevse-wq/VELDRA.git`
- Latest pushed commit: `26b93af` (`fix: harden remote runtime authentication`).
- Local `main` is synchronized with `origin/main`; no force-push or alternate repository is used.
- Local backup branches remain preserved.

---

## Branding Pass ⚠️ IN PROGRESS

The active web, desktop metadata, Android package identity, and primary VELDRA SVG sources are migrated. Native launcher/splash vector sources are now being aligned; density-specific generated PNGs still require a reproducible asset-generation pass and device verification.

**Initial branding milestone:** `8192044` — "feat: establish VELDRA product identity"**

| Item | Status | Details |
|------|--------|---------|
| Project name | ✅ | `VELDRA` |
| Display name | ✅ | `VELDRA` |
| Android package | ✅ | `com.veldra.app` |
| README.md | ✅ | Replaced with Android-port README and branding preview |
| NOTICE.md | ✅ | Attribution and copyright |
| BRANDING.md | ✅ | `BRANDING.md` |
| VELDRA logo SVG | ✅ | `public/veldra-logo.svg` |
| VELDRA app icon SVG | ✅ | `public/veldra-icon.svg` |
| VELDRA social preview | ✅ | `public/veldra-social-preview.png` |
| Android strings.xml | ✅ | App name → `VELDRA` |
| Android build.gradle | ✅ | namespace + applicationId updated |
| MainActivity.java | ✅ | Package/path `com/veldra/app/`, package `com.veldra.app` |
| capacitor.config.ts | ✅ | appId + appName updated |
| package.json | ✅ | name, description, author, contributors |
| Original LICENSE | ✅ | Retained unchanged |
| Original upstream logos | ✅ | Retained only where needed for attribution/compatibility; not claimed as VELDRA assets |
