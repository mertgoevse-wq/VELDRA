# VELDRA Android Porting Audit Report

**Date:** 2026-07-04
**Target:** Samsung Galaxy A56 (Android 15, 1080×2340, 6.7")
**Approach:** Capacitor WebView shell → progressive native adapter replacement

---

## 1. Executive Summary

VELDRA is a Remix/Vite workbench derived from the upstream bolt.diy project and uses the **WebContainer API** to run a full Node.js environment inside the browser. This is the single hardest blocker for Android — WebContainer requires `SharedArrayBuffer` and cross-origin isolation (`COOP`/`COEP` headers), neither of which Android WebView supports.

The good news: the **chat, AI provider, code generation, code editor, and settings** layers are standard React and work in any browser. Only the **runtime layer** (terminal, preview, live file execution) needs adapter work.

**Verdict:** A VELDRA WebView shell can ship immediately with chat-only mode. Full feature parity requires 5 phases of adapter work.

---

## 2. Dependency Audit

### 2.1 WebContainer API (`@webcontainer/api`)

| File | Usage | Android Impact |
|------|-------|----------------|
| `app/lib/webcontainer/index.ts` | Bootstraps WebContainer instance, mounts filesystem | **BLOCKING** — no SharedArrayBuffer in WebView |
| `app/lib/stores/files.ts` | All file CRUD via `webcontainer.fs.*` | **BLOCKING** — file ops won't persist |
| `app/lib/stores/terminal.ts` | Spawns `jsh` shell process | **BLOCKING** — no shell available |
| `app/lib/stores/previews.ts` | Watches file changes, manages preview URLs | **BLOCKING** — no preview runtime |
| `app/lib/stores/workbench.ts` | Imports webcontainer promise, passes to all stores | **BLOCKING** — construction fails |
| `app/lib/runtime/action-runner.ts` | Executes shell/file actions from AI output | **BLOCKING** — can't run actions |
| `app/lib/hooks/useGit.ts` | Uses `isomorphic-git` with WebContainer FS | **BLOCKING** — no FS backend |
| `app/utils/shell.ts` | `newShellProcess()`, `newBoltShellProcess()` | **BLOCKING** — no shell process |
| `app/components/workbench/Search.tsx` | Text search via WebContainer FS | **BLOCKING** — no FS |
| `app/routes/webcontainer.connect.$id.tsx` | Connect to external WebContainer | N/A — skip route |
| `app/routes/webcontainer.preview.$id.tsx` | Preview iframe proxy | N/A — skip route |
| `app/lib/webcontainer/auth.client.ts` | WebContainer auth re-export | N/A — unused on Android |

**SharedArrayBuffer / Cross-Origin Isolation:**
- `app/lib/adapters/platform.ts` — already detects this (added in Phase 0)
- `app/components/workbench/Preview.tsx` — iframe requires `cross-origin-isolated` permission
- `app/lib/webcontainer/index.ts` — already guards against missing SharedArrayBuffer (Phase 0)

### 2.2 Terminal (xterm)

| File | Usage | Android Impact |
|------|-------|----------------|
| `app/components/workbench/terminal/Terminal.tsx` | XTerm.js terminal renderer | Works in WebView, but no process to attach |
| `app/components/workbench/terminal/TerminalManager.tsx` | Paste handler, health check | Depends on terminal process |
| `app/components/workbench/terminal/TerminalTabs.tsx` | Terminal tab UI | UI works, content empty |
| `app/utils/shell.ts` | Spawns jsh, pipes I/O | **BLOCKING** — no WebContainer |
| `app/lib/stores/terminal.ts` | TerminalStore class | Already has fallback guard (Phase 0) |

**xterm packages:** `@xterm/xterm@^5.5.0`, `@xterm/addon-fit@^0.10.0`, `@xterm/addon-web-links@^0.11.0` — these render fine in WebView but are useless without a shell backend.

### 2.3 Filesystem APIs

| File | Usage | Android Impact |
|------|-------|----------------|
| `app/lib/stores/files.ts` | `webcontainer.fs.writeFile/readFile/mkdir/rm/readdir` | **BLOCKING** — 22 call sites across 3 files |
| `app/lib/hooks/useGit.ts` | `isomorphic-git` with WebContainer FS proxy | **BLOCKING** |
| `app/lib/runtime/action-runner.ts` | File write actions from AI | **BLOCKING** |
| `app/components/workbench/Search.tsx` | Full-text search in WebContainer FS | **BLOCKING** |
| `file-saver` (dependency) | `saveAs()` for downloads | Works — WebView supports Blob downloads |
| `FileReader` (7 files) | Reading uploaded files | Works — standard Web API |
| `jszip` (dependency) | ZIP export/import | Works — pure JS |

**Note:** The FilesStore already has fallback mode (Phase 0) — file ops update the in-memory nanostores map without persisting to WebContainer.

### 2.4 Electron

| File | Usage | Android Impact |
|------|-------|----------------|
| `electron/main/` | Electron main process | Not loaded on Android — no impact |
| `electron/preload/` | Preload scripts | Not loaded on Android — no impact |
| `vite-electron.config.ts` | Separate Vite config for Electron | Not used by Android build |
| `package.json` electron scripts | Build scripts | Don't run for Android |
| `electron-builder.yml` | Packaging config | Not used for Android |
| `app/entry.server.tsx` | Electron import hack for `react-dom/server` | Not loaded in WebView |

**Verdict:** Electron code is completely isolated. No changes needed. The Android build uses the standard Remix Vite config.

### 2.5 Desktop-Only Keyboard Shortcuts

| File | Usage | Android Impact |
|------|-------|----------------|
| `app/lib/hooks/useShortcuts.ts` | Global `keydown` listener with Ctrl/Cmd combos | **NO KEYBOARD** — Android soft keyboard has no Ctrl/Cmd |
| `app/components/chat/ChatBox.tsx` | `onKeyDown` for Enter-to-send | Works with soft keyboard Enter |
| `app/components/chat/ModelSelector.tsx` | Arrow key navigation in dropdowns | Touch users use taps instead |
| `app/components/workbench/FileTree.tsx` | `onKeyDown` for file tree navigation | Touch users use taps |
| `app/components/editor/codemirror/CodeMirrorEditor.tsx` | `keydown` handler for editor | CodeMirror has mobile support but limited |
| `app/components/chat/ToolInvocations.tsx` | `keydown` for tool invocation expand/collapse | Not critical — tap to expand |
| `app/components/sidebar/HistoryItem.tsx` | `onKeyDown` for rename | Not critical |
| `app/lib/persistence/ChatDescription.client.tsx` | `onKeyDown` for chat rename | Not critical |

**Verdict:** Keyboard shortcuts are a desktop power-user feature. On mobile, they simply don't fire (no Ctrl/Cmd key). No crash risk — just missing functionality. Can be replaced with tap/long-press gestures in Phase 2.

### 2.6 Fixed Desktop Layouts

| File | Issue | Impact |
|------|-------|--------|
| `app/styles/variables.scss` | `--chat-min-width: 533px` | **TOO WIDE** — forces horizontal scroll on 360px viewport |
| `app/styles/variables.scss` | `--workbench-width: min(calc(100% - var(--chat-min-width)), 2536px)` | Breaks when chat-min-width > screen width |
| `app/components/@settings/core/ControlPanel.tsx` | `w-[1200px] h-[90vh]` | **WAY TOO WIDE** — fixed 1200px modal |
| `app/components/workbench/EditorPanel.tsx` | `react-resizable-panels` horizontal + vertical | **NO TOUCH RESIZE** — panel handles not touch-friendly |
| `app/components/workbench/Workbench.client.tsx` | `fixed top-[calc(...)]` positioning | Complex desktop layout assumptions |
| `app/components/chat/BaseChat.tsx` | `lg:flex-row`, `lg:min-w-[var(--chat-min-width)]` | Breaks below `lg` breakpoint (1024px) |
| `app/components/chat/BaseChat.tsx` | `mt-[16vh]` for intro text | Excessive top margin on mobile |
| `app/root.tsx` | `DndProvider` with `HTML5Backend` | **NO TOUCH** — HTML5 drag-drop doesn't work on touch devices |
| `app/components/ui/ColorSchemeDialog.tsx` | `min-w-[480px]` | **TOO WIDE** — exceeds 360px viewport |
| `app/components/ui/Dropdown.tsx` | `min-w-[220px]` | May be OK, but verify on small screens |
| `app/components/workbench/FileBreadcrumb.tsx` | `min-w-[300px]` | Borderline — 300px on 360px screen |

### 2.7 Unsupported Android WebView APIs

| API | Used In | Android Status |
|-----|---------|----------------|
| `SharedArrayBuffer` | WebContainer | **NOT AVAILABLE** in WebView |
| `crossOriginIsolated` | WebContainer | **NOT AVAILABLE** — WebView can't set COOP/COEP |
| `navigator.mediaDevices.getDisplayMedia()` | `ScreenshotSelector.tsx` | **NOT AVAILABLE** in WebView |
| `window.open()` | 15+ files | Works — Capacitor opens system browser |
| `navigator.clipboard.writeText()` | 8+ files | Works in WebView (Android 7+) |
| `navigator.clipboard.readText()` | `TerminalManager.tsx` | May need user gesture; works with Capacitor |
| `localStorage` | 20+ files | Works — WebView supports it |
| `BroadcastChannel` | `previews.ts`, `webcontainer.preview.$id.tsx` | Works in WebView |
| `SpeechRecognition` / `webkitSpeechRecognition` | `BaseChat.tsx`, `SpeechRecognition.tsx` | **UNRELIABLE** — not in all WebView versions |
| `ServiceWorker` | Not directly used | N/A |
| `Web Workers` | Not directly used | N/A |
| `navigator.onLine` | `app/lib/api/connection.ts` | Works |
| `navigator.storage.estimate()` | `app/lib/api/debug.ts` | Works |

### 2.8 Server-Side API Routes (Remix Loaders/Actions)

The app has **33 API routes** that run server-side. In a Capacitor WebView, there is no server. These break:

| Route | Purpose | Critical? |
|-------|---------|-----------|
| `api.chat.ts` | **LLM streaming** — the core chat endpoint | **YES** — app is useless without it |
| `api.llmcall.ts` | Direct LLM calls | **YES** |
| `api.models.ts` / `api.models.$provider.ts` | List available models | **YES** |
| `api.enhancer.ts` | Prompt enhancement | Medium |
| `api.check-env-key.ts` | Check API keys | Medium |
| `api.configured-providers.ts` | List configured providers | Medium |
| `api.export-api-keys.ts` | Export API keys | Low |
| `api.git-proxy.$.ts` | Git CORS proxy | Medium (for git operations) |
| `api.github-*.ts` (4 routes) | GitHub integration | Low |
| `api.gitlab-*.ts` (2 routes) | GitLab integration | Low |
| `api.netlify-*.ts` (2 routes) | Netlify deploy | Low |
| `api.vercel-*.ts` (2 routes) | Vercel deploy | Low |
| `api.supabase*.ts` (4 routes) | Supabase integration | Low |
| `api.web-search.ts` | Web search for AI | Medium |
| `api.health.ts` | Health check | Low |
| `api.system.*.ts` (3 routes) | System diagnostics | Low |
| `api.update.ts` | Update check | Low |
| `api.mcp-*.ts` (2 routes) | MCP server management | Low |
| `api.bug-report.ts` | Bug reporting | Low |

**Critical path:** `api.chat.ts` must work for the app to function at all. Options:
1. **Proxy to a remote server** — deploy the Remix app and point API calls to it
2. **Convert to client-side calls** — call LLM APIs directly from the WebView (CORS may block)
3. **Capacitor HTTP plugin** — bypass CORS with native HTTP

---

## 3. Architecture: Current vs Target

### Current (Desktop)
```
Browser (Chrome with COOP/COEP)
  └── Remix App
       ├── Server (Cloudflare Pages / Wrangler)
       │    └── 33 API routes
       └── Client
            ├── WebContainer (Node.js in browser)
            │    ├── Filesystem
            │    ├── Terminal (jsh)
            │    └── Preview server
            ├── xterm.js terminal UI
            ├── CodeMirror editor
            └── React DnD (HTML5 drag-drop)
```

### Target (Android)
```
Android WebView (Capacitor)
  └── Remix App (client-only)
       ├── No server — API routes replaced with:
       │    ├── Capacitor HTTP plugin (bypass CORS)
       │    └── Or remote proxy to deployed Remix app
       ├── WebContainer → FALLBACK (in-memory file map)
       │    ├── Filesystem → InMemoryFS adapter
       │    ├── Terminal → Disabled (show message)
       │    └── Preview → Disabled (show message)
       ├── xterm.js → Hidden or read-only display
       ├── CodeMirror editor → Works (with touch tweaks)
       └── React DnD → Touch backend or removed
```

---

## 4. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| No LLM streaming without server | **CRITICAL** | Phase 5: Capacitor HTTP or remote proxy |
| WebContainer completely unavailable | **HIGH** | Already mitigated with fallback adapters (Phase 0) |
| Fixed desktop layouts break on mobile | **HIGH** | Phase 2: CSS responsive overrides |
| React DnD doesn't work on touch | **MEDIUM** | Phase 2: Switch to `react-dnd-touch-backend` or remove |
| `ScreenshotSelector` uses `getDisplayMedia` | **LOW** | Hide feature on mobile |
| SpeechRecognition unreliable | **LOW** | Feature-detect and hide if unavailable |
| 33 API routes need server or replacement | **HIGH** | Phase 5: Remote proxy or native HTTP |
| `--chat-min-width: 533px` forces scroll | **HIGH** | Phase 2: Override to `100%` on mobile |
| ControlPanel 1200px modal | **MEDIUM** | Phase 2: Responsive `w-full max-w-[1200px]` |
| `isomorphic-git` needs FS backend | **MEDIUM** | Phase 3: InMemoryFS adapter |

---

## 5. Files That Must Change (Complete List)

### Phase 1: WebView Wrapper (DONE)
- ✅ `capacitor.config.ts` — created
- ✅ `android/` — Capacitor Android project
- ✅ `package.json` — Android scripts added
- ✅ `app/lib/adapters/platform.ts` — platform detection
- ✅ `app/lib/adapters/types.ts` — adapter interfaces
- ✅ `app/lib/adapters/android-adapter.ts` — fallback adapter
- ✅ `app/lib/adapters/webcontainer-adapter.ts` — WC wrapper
- ✅ `app/lib/adapters/index.ts` — factory
- ✅ `app/lib/webcontainer/index.ts` — guarded boot
- ✅ `app/lib/stores/terminal.ts` — fallback mode
- ✅ `app/lib/stores/files.ts` — fallback mode
- ✅ `README_ANDROID.md` — setup guide

### Phase 2: Mobile UI
- `app/styles/variables.scss` — responsive CSS vars
- `app/components/chat/BaseChat.tsx` — mobile layout
- `app/components/chat/BaseChat.module.scss` — mobile CSS
- `app/components/@settings/core/ControlPanel.tsx` — responsive modal
- `app/components/workbench/Workbench.client.tsx` — mobile layout
- `app/components/workbench/EditorPanel.tsx` — mobile panels (tabs instead of split)
- `app/components/workbench/FileTree.tsx` — collapsible drawer
- `app/components/workbench/terminal/TerminalTabs.tsx` — drawer mode
- `app/components/workbench/Preview.tsx` — fullscreen mode
- `app/root.tsx` — DnD touch backend
- `app/components/chat/BaseChat.tsx` — hide ScreenshotSelector on mobile
- `app/components/chat/SpeechRecognition.tsx` — feature-detect
- `app/lib/hooks/useShortcuts.ts` — disable on mobile
- NEW: `app/components/mobile/BottomNav.tsx` — bottom navigation bar
- NEW: `app/components/mobile/MobileDrawer.tsx` — slide-up drawer
- NEW: `app/styles/mobile.scss` — mobile-specific overrides

### Phase 3: Filesystem Adapter
- `app/lib/stores/files.ts` — complete InMemoryFS integration
- `app/lib/hooks/useGit.ts` — InMemoryFS for isomorphic-git
- `app/lib/runtime/action-runner.ts` — use adapter FS
- `app/components/workbench/Search.tsx` — search in-memory files
- NEW: `app/lib/adapters/in-memory-fs.ts` — InMemoryFS implementation

### Phase 4: Terminal/Preview Adapter
- `app/lib/stores/terminal.ts` — mock terminal or Capacitor plugin
- `app/lib/stores/previews.ts` — disable or static preview
- `app/components/workbench/terminal/Terminal.tsx` — show fallback message
- `app/components/workbench/Preview.tsx` — show fallback or static HTML preview
- `app/utils/shell.ts` — no-op shell
- NEW: `app/lib/adapters/terminal-adapter.ts` — terminal interface

### Phase 5: AI Provider Integration
- `app/routes/api.chat.ts` — convert to client-side or proxy
- `app/routes/api.llmcall.ts` — convert to client-side or proxy
- `app/routes/api.models.ts` — convert to client-side
- `app/routes/api.models.$provider.ts` — convert to client-side
- `app/routes/api.enhancer.ts` — convert to client-side or proxy
- `app/routes/api.check-env-key.ts` — convert to client-side
- `app/routes/api.configured-providers.ts` — convert to client-side
- `app/routes/api.web-search.ts` — convert to client-side or proxy
- NEW: `app/lib/adapters/api-client.ts` — Capacitor HTTP or fetch wrapper
- NEW: `app/lib/adapters/llm-stream.ts` — client-side LLM streaming

### Phase 6: APK Build
- `capacitor.config.ts` — production config (no debug flags)
- `android/app/build.gradle` — signing config
- `android/app/src/main/AndroidManifest.xml` — final permissions
- `android/app/src/main/res/values/strings.xml` — app name
- NEW: `android/app/src/main/res/xml/network_security_config.xml` — cleartext for dev
- `.env.local` or build-time env injection for API keys

---

## 8. Runtime Adapter Layer (Phase 1 — Completed)

**Date added:** 2026-07-04
**Commit:** feat: add runtime adapter layer

### 8.1 What Was Created

A new `src/mobile/adapters/runtime/` directory with a high-level
`RuntimeAdapter` interface that abstracts all WebContainer-dependent
operations:

```
src/mobile/adapters/runtime/
├── RuntimeAdapter.ts               # Interface + types + UnsupportedFeatureError
├── WebContainerRuntimeAdapter.ts   # Desktop: wraps @webcontainer/api
├── AndroidFallbackRuntimeAdapter.ts # Android: in-memory FS, stub terminal
└── index.ts                        # Factory (getRuntimeAdapter) + re-exports
```

### 8.2 Interface Design

The `RuntimeAdapter` interface defines methods for:

| Method Group | Methods | WebContainer | Android |
|-------------|---------|:---:|:---:|
| Lifecycle | `boot()`, `isReady()`, `shutdown()` | ✅ | ✅ (no-op) |
| File system | `readFile`, `writeFile`, `mkdir`, `readdir`, `rm`, `rename`, `watch` | ✅ | ✅ (in-memory) |
| Terminal | `spawnShell()`, `executeCommand()` | ✅ | ❌ stub |
| Dependencies | `installDependencies()` | ✅ | ❌ |
| Dev server | `startDevServer()` | ✅ | ❌ |
| Preview | `onServerReady`, `onPortEvent`, `getPreviewUrl`, `getPreviews` | ✅ | ❌ |
| Inspector | `onPreviewMessage`, `setPreviewScript` | ✅ | ❌ (no-op) |
| Capabilities | `getCapabilities()` | all true | fileSystem only |

### 8.3 Capability Flags

`getCapabilities()` returns a `RuntimeCapabilities` object with explicit
boolean flags for each feature. UI components can check these before
showing/hiding features:

```typescript
interface RuntimeCapabilities {
  fileSystem: boolean;
  terminal: boolean;
  commandExecution: boolean;
  packageInstall: boolean;
  devServer: boolean;
  preview: boolean;
  gitClone: boolean;
  persistentFileSystem: boolean;
}
```

### 8.4 Relationship to Existing Adapters

The existing `app/lib/adapters/` layer (PlatformAdapter interface,
platform detection, webcontainer-adapter, android-adapter) is **not
removed or changed**. The new `RuntimeAdapter` is a higher-level
abstraction that builds on the same platform detection utilities
(`isWebContainerSupported()`, `isCapacitor()`, etc.).

### 8.5 WebContainer API Import Audit (Exact Files)

All 14 files that import `@webcontainer/api`:

| # | File | Import | Status |
|---|------|--------|--------|
| 1 | `app/lib/webcontainer/index.ts` | `WebContainer` (class) | Phase 2 — will use adapter.boot() |
| 2 | `app/lib/stores/files.ts` | `WebContainer` (type) | Phase 3 — will accept RuntimeAdapter |
| 3 | `app/lib/stores/terminal.ts` | `WebContainer, WebContainerProcess` (type) | Phase 4 |
| 4 | `app/lib/stores/previews.ts` | `WebContainer` (type) | Phase 5 |
| 5 | `app/lib/stores/workbench.ts` | (imports webcontainer promise) | Phase 3 |
| 6 | `app/lib/runtime/action-runner.ts` | `WebContainer` (type) | Phase 4 |
| 7 | `app/lib/hooks/useGit.ts` | `WebContainer` (type) | Phase 5 |
| 8 | `app/utils/shell.ts` | `WebContainer, WebContainerProcess` (type) | Phase 4 |
| 9 | `app/components/workbench/Search.tsx` | `WebContainer` (type) | Phase 5 |
| 10 | `app/lib/webcontainer/auth.client.ts` | re-export of `auth` | N/A (unused on Android) |
| 11 | `app/lib/adapters/webcontainer-adapter.ts` | `WebContainer` (class) | Existing adapter (kept) |
| 12 | `app/routes/webcontainer.connect.$id.tsx` | dynamic CDN import | N/A (skip route) |
| 13 | `app/routes/webcontainer.preview.$id.tsx` | (indirect) | N/A (skip route) |
| 14 | `app/lib/runtime/enhanced-message-parser.ts` | (indirect reference) | Phase 4 |

### 8.6 UnsupportedFeatureError

The adapter defines a standard error class for unsupported features:

```typescript
class UnsupportedFeatureError extends Error {
  readonly capability: keyof RuntimeCapabilities;
  // e.g. new UnsupportedFeatureError('devServer', 'android')
}
```

This lets UI components show targeted "this feature is not available on
your device" messages instead of generic errors.

### 8.7 Future: RemoteRuntimeAdapter

The `AndroidFallbackRuntimeAdapter` is designed to be replaceable by a
`RemoteRuntimeAdapter` that connects to a server-side sandbox over
WebSocket. The interface is identical — only the implementation changes.
This is the path to full feature parity on Android without WebContainer.
