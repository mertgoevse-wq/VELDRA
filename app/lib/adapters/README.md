# Mobile Adapters

Adapter layer for making VELDRA work on Android (Capacitor WebView) and other non-desktop environments. VELDRA is derived from the upstream bolt.diy project; technical compatibility boundaries remain documented separately.

## Structure

```
app/lib/adapters/
├── types.ts                  # PlatformAdapter interface + PlatformInfo type
├── platform.ts               # Platform detection (Android, Capacitor, Electron, touch, SharedArrayBuffer)
├── android-adapter.ts        # Fallback adapter for Android (no WebContainer)
├── webcontainer-adapter.ts   # Real adapter wrapping @webcontainer/api
├── index.ts                  # Factory: picks the right adapter at runtime
├── in-memory-fs.ts           # [PLANNED] In-memory filesystem for Phase 3
├── terminal-adapter.ts       # [PLANNED] Terminal interface for Phase 4
├── api-client.ts             # [PLANNED] API route replacement for Phase 5
└── llm-stream.ts             # [PLANNED] Client-side LLM streaming for Phase 5
```

## PlatformAdapter Interface

```typescript
interface PlatformAdapter {
  platform: PlatformInfo;
  filesystem: FilesystemAdapter;
  terminal: TerminalAdapter;
  preview: PreviewAdapter;
}
```

Each sub-interface (`FilesystemAdapter`, `TerminalAdapter`, `PreviewAdapter`) defines the
operations the app needs. The `WebContainerAdapter` delegates to the real WebContainer API.
The `AndroidAdapter` provides in-memory or no-op fallbacks.

## How Detection Works

`platform.ts` checks:
1. **Capacitor** — `typeof window.Capacitor !== 'undefined' && Capacitor.getPlatform() === 'android'`
2. **Android WebView** — User-Agent contains `Android` and `wv`
3. **Touch device** — `'ontouchstart' in window || navigator.maxTouchPoints > 0`
4. **SharedArrayBuffer** — `typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated`
5. **WebContainer supported** — not SSR, has SharedArrayBuffer, not Capacitor, not Android

The factory in `index.ts` calls `getPlatformInfo()` once and returns either
`WebContainerAdapter` (desktop) or `AndroidAdapter` (mobile/fallback).

## Current Status (Phase 0)

- ✅ Platform detection working
- ✅ Adapter interfaces defined
- ✅ AndroidAdapter provides fallback for all operations
- ✅ WebContainer boot guarded — fails gracefully instead of crashing
- ✅ TerminalStore has fallback mode (no shell process)
- ✅ FilesStore has fallback mode (in-memory map updates, no WebContainer FS)
- ❌ InMemoryFS not yet implemented (Phase 3)
- ❌ Terminal adapter not yet implemented (Phase 4)
- ❌ API client not yet implemented (Phase 5)

## Usage in Components

```typescript
import { getPlatformInfo, isWebContainerSupported, isCapacitor } from '~/lib/adapters/platform';

if (!isWebContainerSupported()) {
  // Show fallback UI instead of terminal/preview
}
```

The stores (`files.ts`, `terminal.ts`, `workbench.ts`) already check `isWebContainerSupported()`
internally and switch to fallback mode. Components should use `isCapacitor()` or
`getPlatformInfo().isAndroid` to conditionally render mobile-specific UI.
