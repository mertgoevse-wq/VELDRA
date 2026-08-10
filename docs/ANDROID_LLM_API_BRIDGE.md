# Android LLM API Bridge Design

## Problem

The Android build is a client-side WebView SPA. It cannot execute Remix loaders/actions locally, so existing routes such as `api.chat.ts`, `api.llmcall.ts`, `api.models.ts`, and `api.enhancer.ts` are unavailable inside the APK.

The original web app expects those routes to run server-side. They use server-only modules under `app/lib/.server/llm`, read provider configuration from cookies and server environment bindings, and stream responses through the AI SDK. Putting provider API keys into the bundled Android app would expose secrets to every installed APK, so Android must call a trusted backend instead.

## Audit Summary

| Route / Area | Current Behavior | Android Constraint |
|--------------|------------------|--------------------|
| `app/routes/api.chat.ts` | Server action streams AI SDK data-stream chunks, progress annotations, context selection, summaries, MCP tool annotations, and continuation handling | Requires server-only LLM helpers and provider secrets; cannot run in WebView |
| `app/routes/api.llmcall.ts` | Server action supports streaming text or JSON `generateText()` responses, validates provider/model, and checks token limits | Requires model instances created with server env/cookie keys |
| `app/routes/api.models.ts` | Server loader returns provider metadata and static/dynamic model lists | Dynamic models may require backend-held provider credentials |
| `app/routes/api.enhancer.ts` | Server action streams enhanced prompt text using provider/model selection | Requires server-side provider invocation |
| Provider key handling | `getApiKeysFromCookie()`, `getProviderSettingsFromCookie()`, `LLMManager`, and `BaseProvider` combine cookie keys, provider settings, Cloudflare env, `process.env`, and manager env | Android must not store provider API keys in client JS or APK resources |
| Streaming | Chat uses `createDataStream()` and `text/event-stream`; enhancer and streaming `llmcall` stream text | Android bridge must preserve streaming over HTTPS with abort/retry support |

## Architecture Options

### Option A: Remote Runtime Also Acts As API Proxy

This is convenient for LAN development because the Android app already knows the Remote Runtime URL/token. It is not the recommended MVP for LLM chat because Remote Runtime currently owns workspace files, command execution, and preview state. Adding provider secrets there broadens the trust boundary and mixes code execution with LLM credential custody.

Use only as a future local-development adapter if the server explicitly separates command/workspace auth from LLM API auth and stores secrets outside the synced workspace.

### Option B: Separate Cloudflare/Vercel API Backend

This is the recommended MVP. Deploy a dedicated backend that reuses the existing server-side LLM route behavior and stores provider keys in backend environment variables or backend-managed encrypted user settings. Android sends chat/model/enhancer requests to that backend with an app/backend token. Provider secrets never enter the Android bundle or client-side JavaScript.

Benefits:
- Keeps provider API keys server-side.
- Preserves existing streaming semantics.
- Works from any network, not only the same LAN.
- Keeps Remote Runtime focused on files, commands, and preview.
- Can be deployed with standard HTTPS, logs, rate limits, and token rotation.

### Option C: User-Supplied Local Provider Endpoints Only

This is safe for local providers such as Ollama, LM Studio, or an OpenAI-compatible endpoint that does not require embedding cloud secrets in the APK. It does not solve the default cloud-provider flow and can be difficult on Android networks because phone `localhost` is not the laptop.

Use as an optional advanced path, not the MVP.

## Recommended MVP

Implement Option B: a separate authenticated Android API Backend.

The backend should expose a small Android-focused API surface that maps to the existing server-side behavior:

- `GET /health`
- `GET /models`
- `POST /chat`
- `POST /chat/stream`
- `POST /enhance`
- `POST /provider-config/validate`

**Implementation note (2026-08-10):** the paths above are the original design draft. What actually
shipped deploys these as additional Remix routes on the *same* deployment that already serves
`/api/chat`/`/api/models`/`/api/enhancer` -- not a physically separate service -- because that
maximizes reuse (`chatAction()`/`enhancerAction()`/`getModelsData()` are now shared named exports
under `app/lib/.server/`, imported by both the cookie-authenticated web routes and the
Bearer-token Android routes). Remix's flat-file routing then names them under `/api/android/*`:

| Draft path | Implemented path | Status |
|---|---|---|
| `GET /health` | `GET /api/android/health` | Implemented (`app/routes/api.android.health.ts`) |
| `GET /models` | `GET /api/android/models?provider=` | Implemented (`app/routes/api.android.models.ts`) |
| `POST /chat/stream` | `POST /api/android/chat` | Implemented (`app/routes/api.android.chat.ts`); this is what `Chat.client.tsx`'s `useChat()` calls directly on Android, not `AndroidApiClient` |
| `POST /enhance` | `POST /api/android/enhance` | Implemented (`app/routes/api.android.enhance.ts`); used by `usePromptEnhancer.ts` on Android |
| `POST /chat` (non-streaming) | -- | Not implemented -- `chatAction()` always streams; a non-streaming variant has no concrete use case yet |
| `POST /provider-config/validate` | -- | Not implemented -- no UI currently needs it |

`app/lib/android-api/AndroidApiClient.ts`'s method paths match this table; its `sendChatMessage`/
`streamChatResponse`/`enhancePrompt`/`validateProviderConfig` methods are documented in-code as
not backed by a real route where that's still true. `getAndroidApiBackendConfig()` in
`app/lib/android-api/backend-config.ts` is the single source of truth for the stored backend
URL/token (shared by `AndroidSettingsPanel.tsx`, `Chat.client.tsx`, `BaseChat.tsx`, and
`usePromptEnhancer.ts`) -- add new bridge endpoints there, not as ad hoc `localStorage` reads.

The Android app should store only:

- Backend URL
- Backend auth token
- Non-secret user preferences

Provider API keys must be configured only on the backend.

## Security Requirements

1. Provider API keys must never be included in Android source, build artifacts, Capacitor assets, localStorage, IndexedDB, cookies, or client-side JavaScript.
2. Every backend endpoint must require an Android API backend token or a stronger user session.
3. The backend must enforce CORS allowlists for expected Android origins where applicable, but CORS must not be treated as authentication.
4. The backend must validate provider/model names against allowlisted or configured providers.
5. The backend must apply rate limits, request size limits, and streaming timeouts.
6. Logs must not include provider API keys, prompts marked sensitive, or full `.env` values.
7. User workspace files sent for context must be limited by size and type before reaching provider APIs.
8. The Android app must show a clear not-configured state instead of attempting local Remix API calls.

## API Contract Draft

All endpoints use HTTPS in production.

All protected endpoints include:

```http
Authorization: Bearer <android-api-backend-token>
Content-Type: application/json
```

### `GET /health`

Returns backend reachability without exposing provider secrets.

```json
{
  "ok": true,
  "service": "veldra-android-api",
  "version": "1.0.0"
}
```

### `GET /models?provider=openai`

Returns model/provider metadata compatible with Android model selection.

```json
{
  "modelList": [
    {
      "name": "gpt-4.1",
      "provider": "OpenAI",
      "maxTokenAllowed": 128000
    }
  ],
  "providers": [
    {
      "name": "OpenAI",
      "configured": true
    }
  ],
  "defaultProvider": {
    "name": "OpenAI",
    "configured": true
  }
}
```

### `POST /chat`

Non-streaming chat endpoint for smoke tests and simple completions.

```json
{
  "messages": [
    { "role": "user", "content": "Create a Vite app" }
  ],
  "files": {},
  "chatMode": "build",
  "contextOptimization": true,
  "maxLLMSteps": 5,
  "model": "gpt-4.1",
  "provider": "OpenAI"
}
```

### `POST /chat/stream`

Streaming chat endpoint for production chat/code generation. The MVP should preserve the AI SDK data stream format used by `api.chat.ts` so existing client parsing can later be adapted with minimal changes.

Response:

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache
```

### `POST /enhance`

Enhances a prompt using backend-held provider configuration.

```json
{
  "message": "make me a todo app",
  "model": "gpt-4.1",
  "provider": "OpenAI"
}
```

Response:

```json
{
  "ok": true,
  "enhancedPrompt": "Create a responsive todo application..."
}
```

### `POST /provider-config/validate`

Checks whether a provider is configured on the backend without returning secrets.

```json
{
  "provider": "OpenAI"
}
```

Response:

```json
{
  "ok": true,
  "configured": true,
  "provider": "OpenAI"
}
```

## Token/Auth Model

For the scaffold, Android stores a backend URL and backend auth token. This token authenticates the Android app/user to the bridge only. It is not a provider API key.

Production should replace or strengthen this with one of:

- Short-lived session tokens issued after user login.
- Device-scoped tokens with revocation.
- Backend-generated workspace/chat tokens scoped to specific operations.

The backend token should be rotatable and should never grant direct access to provider secret values.

## Streaming Design

The bridge should keep the existing server-side streaming format wherever possible:

- `api.chat.ts` currently returns `text/event-stream` after transforming AI SDK data-stream chunks.
- Progress annotations, usage annotations, MCP tool annotations, and continuation behavior should remain server-side.
- Android should consume `ReadableStream` chunks through a client abstraction and feed them into the existing chat parser only in a later integration phase.
- The Android client must support cancellation with `AbortController` when production chat integration is added.

## Provider-Key Handling

Provider credentials belong in the backend:

- Cloudflare/Vercel environment variables for single-user deployments.
- Backend-managed encrypted per-user settings for multi-user deployments.
- Local provider base URLs only when explicitly configured by the user.

The Android app may store the backend token, but it must not store OpenAI, Anthropic, Google, OpenRouter, or similar provider API keys.

## Android UX

Android Settings now includes a placeholder for:

- Android API Backend URL
- Backend Auth Token
- Test API Backend
- Warning that provider keys stay on the backend

Until the backend is configured and production chat is wired to the bridge, Android should keep showing a clear not-configured state for LLM chat instead of silently calling local Remix routes.

## Scaffold Added In Phase 5.6

`app/lib/android-api/AndroidApiClient.ts` defines a browser-safe client abstraction with:

- `listModels()`
- `sendChatMessage()`
- `streamChatResponse()`
- `enhancePrompt()`
- `validateProviderConfig()`
- `health()`

The scaffold is intentionally not connected to production chat yet.
