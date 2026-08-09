# Mobile Adapters

This directory contains adapter abstractions that let VELDRA run on
both desktop browsers (full WebContainer) and Android (Capacitor WebView,
no WebContainer).

## Structure

```
src/mobile/adapters/
└── runtime/
    ├── RuntimeAdapter.ts              # Interface + types + UnsupportedFeatureError
    ├── WebContainerRuntimeAdapter.ts  # Desktop: wraps @webcontainer/api
    ├── AndroidFallbackRuntimeAdapter.ts # Android: in-memory FS, stub terminal
    └── index.ts                       # Factory (getRuntimeAdapter) + re-exports
```

## Existing Adapters (app/lib/adapters/)

The original adapter layer lives at `app/lib/adapters/` and provides:

- `platform.ts` — platform detection (isCapacitor, isWebContainerSupported, etc.)
- `types.ts` — PlatformAdapter interface (lower-level)
- `webcontainer-adapter.ts` — PlatformAdapter impl for WebContainer
- `android-adapter.ts` — PlatformAdapter impl for Android

The `src/mobile/adapters/runtime/` layer is a **higher-level** abstraction
that builds on top of the existing platform detection. It adds explicit
methods for the operations VELDRA's stores need:

- `installDependencies()` — npm/pnpm/yarn install
- `startDevServer()` — long-running dev server process
- `getPreviewUrl(port)` — direct preview URL lookup
- `getCapabilities()` — feature flags for UI gating

The existing `PlatformAdapter` is not removed or changed — both layers
coexist. New code should use `RuntimeAdapter`; existing stores continue
to work unchanged.

## Usage

```typescript
import { getRuntimeAdapter } from '~/mobile/adapters/runtime';

const adapter = getRuntimeAdapter();

// Check what's available
const caps = adapter.getCapabilities();
if (!caps.devServer) {
  showToast('Live preview is not available on this device');
}

// Boot the runtime
await adapter.boot();

// Read/write files (works on both platforms — in-memory on Android)
await adapter.writeFile('src/App.tsx', code);
const { content } = await adapter.readFile('src/App.tsx');

// Run commands (only on WebContainer — returns error on Android)
const result = await adapter.executeCommand('npm run build');
if (result.exitCode !== 0) {
  console.error(result.output);
}
```

## Capability Matrix

| Feature              | WebContainer | Android Fallback |
|---------------------|:------------:|:----------------:|
| File system          | ✅ real      | ✅ in-memory     |
| Terminal             | ✅           | ❌ stub          |
| Command execution    | ✅           | ❌               |
| Package install      | ✅           | ❌               |
| Dev server           | ✅           | ❌               |
| Live preview         | ✅           | ❌               |
| Git clone            | ✅           | ❌               |
| Persistent FS        | ✅           | ❌               |
| Chat / AI            | ✅           | ✅               |
| Code generation      | ✅           | ✅               |
| File editing         | ✅           | ✅               |

## Migration Path

The existing stores (`files.ts`, `terminal.ts`, `previews.ts`, `action-runner.ts`)
currently import `@webcontainer/api` directly. The migration plan is:

1. **Phase 1 (done)**: Create RuntimeAdapter abstraction — this commit.
2. **Phase 2**: Refactor `webcontainer/index.ts` to use `getRuntimeAdapter()`.
3. **Phase 3**: Update `files.ts` to accept a `RuntimeAdapter` instead of a
   `Promise<WebContainer>`.
4. **Phase 4**: Update `terminal.ts` and `action-runner.ts` similarly.
5. **Phase 5**: Update `previews.ts` to use adapter preview callbacks.
6. **Phase 6**: Remove direct `@webcontainer/api` imports from stores.

Each phase is non-breaking — the old code path continues to work via
the `webcontainer` promise in `app/lib/webcontainer/index.ts`.

## Future: RemoteRuntimeAdapter

The `AndroidFallbackRuntimeAdapter` returns "unsupported" for runtime
features (terminal, dev server, package install). A future
`RemoteRuntimeAdapter` could connect to a server-side sandbox over
WebSocket, providing these features on Android without WebContainer.

The `RuntimeAdapter` interface is designed to support this — a
`RemoteRuntimeAdapter` would implement the same methods but delegate
to a remote server instead of a local WebContainer.
