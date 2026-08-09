# TODO: Next Steps for Android Port

**Last updated:** 2026-07-05
**Current phase:** Phase 0, 1, 3, 4, 5.3, 5.4, 5.5, 5.6, 5.7b (Git scaffold & integration), 6 (debug compile & GitHub Actions workflow) complete; Phase 2 (mobile UI) and Android API Backend implementation next.

---

## Phase 1: WebView Wrapper ✅ DONE

- [x] Install Capacitor (core, cli, android — v7 for Node 20 compat)
- [x] Create `capacitor.config.ts` (appId: `com.veldra.app`, webDir: `build/client`)
- [x] Run `cap add android` — native project scaffolded
- [x] Add npm scripts: `android:sync`, `android:open`, `android:build`, `android:run`, `android:copy`, `android:clean`, `android:init`
- [x] Create platform adapter layer (`app/lib/adapters/`)
- [x] Guard WebContainer boot in `app/lib/webcontainer/index.ts`
- [x] Add fallback mode to `TerminalStore` in `app/lib/stores/terminal.ts`
- [x] Add fallback mode to `FilesStore` in `app/lib/stores/files.ts`
- [x] Create `README_ANDROID.md`
- [x] Verify `cap copy android` works

---

## Phase 2: Mobile UI ⬅️ NEXT

**Goal:** Make the existing UI usable on a 360px wide touchscreen.

### 2a. Responsive CSS Variables
- [ ] Override `--chat-min-width` to `100%` on screens < 768px
- [ ] Override `--workbench-width` to `100%` on mobile
- [ ] Override `--header-height` to `56px` on mobile
- [ ] Add `--mobile-bottom-nav-height: 56px` for bottom navigation
- **Files:** `app/styles/variables.scss`, NEW `app/styles/mobile.scss`

### 2b. Chat Layout
- [ ] `BaseChat.tsx`: switch from `lg:flex-row` to stacked on mobile (chat on top, workbench below or as overlay)
- [ ] `BaseChat.tsx`: reduce `mt-[16vh]` to `mt-[8vh]` on mobile
- [ ] `BaseChat.tsx`: hide `ScreenshotSelector` when `isCapacitor()` or no `getDisplayMedia`
- [ ] `BaseChat.tsx`: feature-detect `SpeechRecognition` and hide button if unavailable
- **Files:** `app/components/chat/BaseChat.tsx`, `app/components/chat/BaseChat.module.scss`

### 2c. Settings Modal
- [ ] `ControlPanel.tsx`: change `w-[1200px] h-[90vh]` to `w-full max-w-[1200px] h-full md:h-[90vh]`
- [ ] Make tab list horizontal scrollable on mobile (instead of vertical sidebar)
- **Files:** `app/components/@settings/core/ControlPanel.tsx`

### 2d. Workbench Layout
- [ ] `Workbench.client.tsx`: on mobile, use full-width stacked layout instead of fixed positioning
- [ ] `EditorPanel.tsx`: replace `react-resizable-panels` with tab-based switching on mobile (Editor | Files | Terminal tabs)
- [ ] `FileTree.tsx`: make collapsible drawer (slide in from left)
- [ ] `TerminalTabs.tsx`: make slide-up drawer from bottom
- [ ] `Preview.tsx`: fullscreen mode on mobile (no device frame)
- **Files:** `app/components/workbench/Workbench.client.tsx`, `app/components/workbench/EditorPanel.tsx`, `app/components/workbench/FileTree.tsx`, `app/components/workbench/terminal/TerminalTabs.tsx`, `app/components/workbench/Preview.tsx`

### 2e. Drag & Drop
- [ ] `root.tsx`: switch from `HTML5Backend` to `TouchBackend` from `react-dnd-touch-backend`
- [ ] Or: conditionally use `HTML5Backend` on desktop, `TouchBackend` on mobile
- [ ] Install: `npm install react-dnd-touch-backend --legacy-peer-deps`
- **Files:** `app/root.tsx`, `package.json`

### 2f. Bottom Navigation
- [ ] Create `app/components/mobile/BottomNav.tsx` with tabs: Chat, Files, Preview, Settings
- [ ] Show only on mobile (`isCapacitor()` or `max-width: 768px`)
- [ ] Wire to view switching (chat ↔ workbench ↔ settings)
- **Files:** NEW `app/components/mobile/BottomNav.tsx`, `app/components/workbench/Workbench.client.tsx`

### 2g. Keyboard Shortcuts
- [ ] `useShortcuts.ts`: skip all shortcuts when `isCapacitor()` or touch-only
- [ ] Don't remove the hook — just make it a no-op on mobile
- **Files:** `app/lib/hooks/useShortcuts.ts`

### 2h. Commit Checkpoint
- [ ] Run typecheck: `npx tsc --noEmit`
- [ ] Run build: `npm run build`
- [ ] Run `npm run android:sync` and test on device
- [ ] Commit: `feat: mobile-first responsive UI`

---

## Phase 3: Filesystem Adapter ✅ DONE

**Goal:** Make file operations work without WebContainer using an in-memory filesystem.

- [x] Create `app/lib/adapters/in-memory-fs.ts`:
  - [x] Implement `mkdir`, `writeFile`, `readFile`, `readdir`, `rm`, `rename`, `exists`
  - [x] Match WebContainer FS API signatures
  - [x] Store data in nanostores map (already partially done in FilesStore fallback)
- [x] Update `FilesStore` fallback to use `InMemoryFS` instead of just updating the map
- [x] Update `useGit.ts` to use `InMemoryFS` as the `isomorphic-git` FS backend
- [x] Update `action-runner.ts` to use adapter FS for file write actions
- [x] Update `Search.tsx` to search in-memory file contents
- [x] Add file export/import via `file-saver` + `jszip` (already available)
- [x] **Commit:** `feat: in-memory filesystem adapter for Android`

---

## Phase 4: Terminal & Preview Adapter ✅ DONE

**Goal:** Graceful fallback for terminal and preview features.

### Terminal
- [x] Create `app/lib/adapters/terminal-adapter.ts`:
  - [x] Define `TerminalAdapter` interface (write, read, resize, kill)
  - [x] `NullTerminalAdapter` — shows "Terminal not available on mobile" message
  - [x] Future: `CapacitorTerminalAdapter` using Termux or SSH plugin
- [x] Update `TerminalStore` to use adapter instead of direct WebContainer spawn
- [x] Update `TerminalTabs.tsx` to show fallback message when no terminal
- [x] Update `shell.ts` to no-op when WebContainer unavailable
- [x] **Commit:** `feat: terminal fallback adapter`

### Preview
- [x] Update `PreviewsStore` to detect no-WebContainer and show empty state
- [x] Update `Preview.tsx` to show "Preview not available on mobile" when no previews
- [x] Future: static HTML preview from in-memory files (open in new WebView)
- [x] **Commit:** `feat: preview fallback for mobile`

---

## Phase 5a: Remote Runtime Design & Scaffold ✅ DONE

**Goal:** Scaffold a safe, authenticated Remote Runtime interface for terminal execution and preview tunneling on mobile.

- [x] Create `docs/REMOTE_RUNTIME.md` defining API contract & WebSocket streams
- [x] Implement `RemoteRuntimeClient.ts` with health-check, workspace stubs, and preview URL methods
- [x] Integrate Auth Token, Workspace ID, and URL fields in Runtime Settings UI
- [x] Add connection testing trigger checking GET /health
- [x] **Commit:** `feat: scaffold remote runtime client`

---

## Phase 5.3: Remote Runtime File Sync MVP ✅ DONE

**Goal:** Sync local Android IndexedDB text files to/from an optional Remote Runtime without enabling shell command execution.

- [x] Create `app/lib/remote-runtime/RemoteWorkspaceSync.ts`
  - [x] `pushLocalWorkspaceToRemote()`
  - [x] `pullRemoteWorkspaceToLocal()`
  - [x] `syncSingleFileToRemote()`
  - [x] `getSyncStatus()`
  - [x] `resetSyncStatus()`
- [x] Keep IndexedDB local Android storage as the source of truth
- [x] Push all local text files to Remote Runtime
- [x] Pull remote text files only after user action
- [x] Keep local files by default on conflict and record conflicts in sync status
- [x] Skip binary files with clear warnings
- [x] Strengthen `RemoteRuntimeClient.ts` list/read/write/sync typings and errors
- [x] Harden remote-runtime file API for nested directories, path traversal, JSON errors, and text-safe payloads
- [x] Add sync controls/status to Android Settings and Runtime Mode UI
- [x] Update docs with LAN setup guidance: `REMOTE_RUNTIME_HOST=0.0.0.0`, `REMOTE_RUNTIME_PORT=8787`, and `http://192.168.x.x:8787`
- [x] **Commit:** `feat: add remote runtime file sync`

---

## Phase 5.4: Safe Remote Command Execution MVP ✅ DONE

**Goal:** Allow Android to run safe predefined project commands through Remote Runtime without free-form shell input.

- [x] Implement command profile mapping in `remote-runtime/src/commands.ts`
- [x] Allow only these command profiles:
  - [x] `npm install`
  - [x] `npm run dev`
  - [x] `npm run build`
  - [x] `pnpm install`
  - [x] `pnpm run dev`
  - [x] `pnpm run build`
- [x] Implement `POST /workspace/:id/commands` with `commandProfile` only
- [x] Implement `GET /workspace/:id/commands/:commandId`
- [x] Implement `POST /workspace/:id/commands/:commandId/stop`
- [x] Require auth token and valid workspace for command routes and WebSocket events
- [x] Execute only inside the workspace directory with fixed allowlisted arguments
- [x] Enforce `REMOTE_RUNTIME_COMMAND_TIMEOUT_MS` default timeout
- [x] Stream stdout/stderr/status/exit over WebSocket
- [x] Log command start/end/error
- [x] Update `RemoteRuntimeClient` command methods
- [x] Update Android terminal fallback UI with remote command buttons, streamed output, and stop control
- [x] Add Android terminal command history/status panel with last profile, command ID, status, output timestamp, and exit code
- [x] Keep free-form terminal input disabled
- [x] **Commit:** `feat: add safe remote command execution`
- [x] **Verification commit:** `chore: verify and finish safe remote command UI`

---

## Phase 5.5: Remote Runtime Live Preview ✅ DONE

**Goal:** Show a real live preview URL on Android when Remote Runtime runs a dev server.

- [x] Track active dev-server command output per workspace
- [x] Detect common Vite URLs from stdout/stderr:
  - [x] `http://localhost:5173/`
  - [x] `http://192.168.x.x:5173/`
  - [x] `http://0.0.0.0:5173/`
- [x] Store preview status: `none`, `starting`, `running`, `failed`
- [x] Store preview metadata: port, local URL, network URL, last detected timestamp, command ID
- [x] Implement JSON `GET /workspace/:id/preview`
- [x] Add safe HTML fallback route `GET /workspace/:id/preview-page`
- [x] Update `RemoteRuntimeClient.getPreviewUrl()` to call the real JSON endpoint
- [x] Update Android Preview fallback with Refresh Preview and Open External Preview controls
- [x] Load detected direct LAN preview URLs in the Android preview iframe
- [x] Document that Remote Runtime and Vite must bind to `0.0.0.0` for phone access
- [x] Do not add an unsafe preview proxy yet
- [x] **Commit:** `feat: add remote runtime live preview status`

---

## Phase 5.6: Android LLM API Bridge Design & Scaffold ✅ DONE

**Goal:** Design and scaffold safe Android LLM chat/code generation without exposing provider keys in the APK.

- [x] Audit `api.chat.ts`, `api.llmcall.ts`, `api.models.ts`, `api.enhancer.ts`
- [x] Audit provider key handling through cookies, provider settings, Cloudflare env, `process.env`, and `LLMManager`
- [x] Document architecture options:
  - [x] Remote Runtime as API proxy
  - [x] Separate Cloudflare/Vercel API backend
  - [x] User-supplied local provider endpoints only
- [x] Recommend separate authenticated API backend as MVP
- [x] Create `docs/ANDROID_LLM_API_BRIDGE.md`
- [x] Add `app/lib/android-api/AndroidApiClient.ts`
- [x] Define client methods:
  - [x] `listModels()`
  - [x] `sendChatMessage()`
  - [x] `streamChatResponse()`
  - [x] `enhancePrompt()`
  - [x] `validateProviderConfig()`
- [x] Add Android settings placeholder:
  - [x] Android API Backend URL
  - [x] Backend Auth Token
  - [x] Test API Backend
  - [x] Provider keys stay on backend warning
- [x] Do not connect production chat yet
- [x] **Commit:** `feat: scaffold android llm api bridge`

---

## Phase 5.7: Android API Backend Implementation

**Goal:** Make LLM chat work without a Remix server.

### Recommended Approach
- [ ] Build/deploy a separate authenticated Android API Backend that reuses server-side LLM logic
- [ ] Store provider API keys only on the backend, never in Android client JS or APK assets
- [ ] Implement `GET /health`
- [ ] Implement `GET /models`
- [ ] Implement `POST /chat`
- [ ] Implement `POST /chat/stream`
- [ ] Implement `POST /enhance`
- [ ] Implement `POST /provider-config/validate`
- [ ] Add request size limits, rate limits, streaming timeout, and secret-safe logging
- [ ] Wire `Chat.client.tsx` to `AndroidApiClient` only when Android API Backend is configured
- [ ] Wire model selectors to `AndroidApiClient.listModels()` only in Android/API-backend mode
- [ ] Preserve existing desktop/WebContainer/Remix behavior
- [ ] Test LLM streaming end-to-end on device
- [ ] **Commit:** `feat: connect android chat to api backend`

---

## Phase 5.7b: Remote Runtime Git Workflow Scaffold & Client Integration ✅ DONE

**Goal:** Scaffold a safe Git workflow through Remote Runtime and wire it to the client UI.

- [x] Create design document `docs/REMOTE_GIT_WORKFLOW.md`
- [x] Implement safe shell-less git command executor in `remote-runtime/src/git.ts` using `execFile`
- [x] Integrate git endpoints `/workspace/:id/git/status`, `/git/init`, `/git/commit`, `/git/push` in `remote-runtime/src/server.ts`
- [x] Expose Git methods in `RemoteRuntimeClient.ts`
- [x] Wire Git operations and outputs console in `GitHubSyncPanel.tsx` UI
- [x] Run typescript and compile builds
- [x] **Commit:** `feat: complete remote git workflow wiring`

---

## Phase 6: APK Build & Polish ⚠️ PARTIAL

**Goal:** Produce a distributable APK and automate build pipelines.

- [x] Set up automated build scripts (`scripts/build-apk.mjs` with automatic JVM 21/SDK discovery)
- [x] Successfully compile debug APK (`npm run android:apk:debug` generating `app-debug.apk`)
- [x] Create GitHub Actions workflow for debug APK artifact (`.github/workflows/android-debug-apk.yml`) triggered manually via `workflow_dispatch`
- [x] Create comprehensive device test plan and smoke-test checklist (`docs/ANDROID_DEVICE_TEST_PLAN.md`)
- [ ] Create `android/app/src/main/res/xml/network_security_config.xml` for dev cleartext
- [ ] Configure `android/app/build.gradle`:
  - Set `minSdkVersion` to 24 (Android 7.0 — covers Galaxy A56)
  - Set `targetSdkVersion` to 35 (Android 15)
  - Add signing config for release builds
- [ ] Update `AndroidManifest.xml`:
  - Add `android:usesCleartextTraffic="true"` for dev
  - Add `android:configChanges` for orientation handling
  - Consider `android:screenOrientation` lock or responsive handling
- [x] Add reproducible VELDRA VectorDrawable sources for launcher and splash resources
- [ ] Generate density-specific PNG/ICO/ICNS assets with an available reproducible toolchain
- [x] Set correct app name in `strings.xml` (`VELDRA`)
- [ ] Build release APK: `npm run android:build`
- [ ] Test on Samsung Galaxy A56
- [ ] **Commit:** `feat: production APK build configuration`

---

## Quick Reference: Build Commands

```bash
# Install
npm install --legacy-peer-deps

# Development (web)
npm run dev

# Development (Android, live reload)
# 1. Start dev server: npm run dev
# 2. Set server.url in capacitor.config.ts to your IP:5173
# 3. npm run android:copy && npm run android:open

# Build APK
npm run android:build

# Sync web build to Android
npm run android:sync

# Open in Android Studio
npm run android:open

# Run on connected device
npm run android:run
```

---

## Dependency Notes

| Package | Keep on Android? | Reason |
|---------|-----------------|--------|
| `@webcontainer/api` | Yes (guarded) | Import types, but never boot |
| `@xterm/*` | Yes | Terminal UI renders; no process attached |
| `react-resizable-panels` | Yes (conditional) | Use tabs on mobile instead |
| `react-dnd` + `HTML5Backend` | Replace with TouchBackend | HTML5 DnD doesn't work on touch |
| `electron` (devDep) | Yes (unused) | Only loaded in Electron build |
| `isomorphic-git` | Yes | Needs InMemoryFS adapter (Phase 3) |
| `file-saver` | Yes | Works in WebView |
| `jszip` | Yes | Pure JS, works everywhere |
| `framer-motion` | Yes | Works in WebView |
| `chart.js` / `react-chartjs-2` | Yes | Works in WebView |
| `react-hotkeys-hook` | Keep but no-op | No Ctrl/Cmd on mobile keyboards |
