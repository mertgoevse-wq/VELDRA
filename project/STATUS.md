# VELDRA Status

**Updated:** 2026-08-10
**Branch:** `main`
**Current commit:** `24872f6` — "feat: wire real Android LLM chat through a Bearer-authenticated bridge"
**Remote:** `origin/main` (`git@github.com:mertgoevse-wq/VELDRA.git`)

## Validation baseline (2026-08-10, this session/environment)

| Check | Result |
|---|---|
| Git status/fetch | Clean; `main` synchronized with `origin/main` |
| `pnpm install` | Was blocked by a GitHub 403 fetching `@electron/node-gyp`'s tarball; fixed with the same `pnpm.overrides` entry already proven in the bolt-android source (`npm:@electron/node-gyp@10.2.0-electron.2`) |
| `pnpm test` | Passed: 27 files / 218 tests (was 205; +13 from the Android LLM chat bridge auth/config specs) |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed: 0 errors (142 auto-fixable formatting/style findings resolved via `lint:fix`, re-verified with tests/typecheck) |
| `pnpm build` | **Passed** in this environment (15 GB RAM) — the previously documented Miniflare/tcmalloc 1 GiB OOM does not reproduce here; environment-dependent, not a code defect |
| Android debug APK | **Built successfully** — `android/app/build/outputs/apk/debug/app-debug.apk` (8.4 MB, `com.veldra.app`, label "VELDRA"), delivered directly to the product owner for device install. Android SDK (platform 35, build-tools 35.0.0, platform-tools) installed ad hoc at `/opt/android-sdk` in this ephemeral container — **not persisted**; a future session/CI run needs the SDK available again (the repo's `.github/workflows/android-debug-apk.yml` already handles this for CI). Java 21 and Gradle were already present in this environment. |
| Secret scan | No private-key or obvious literal-token findings; `.env.example` and `.env.production` remain tracked templates/configuration files and require review before release |

## Android LLM chat bridge (2026-08-10)

Implemented per `docs/ANDROID_LLM_API_BRIDGE.md` Option B: the Android app (no server process of its own) sends chat/model requests to a Bearer-token-authenticated bridge on the same backend deployment that already serves `/api/chat` for the web app.

- `app/routes/api.android.{health,models,chat}.ts` — new routes, gated by `checkAndroidApiAuth()` (`app/lib/.server/android-auth.ts`, constant-time comparison against `ANDROID_API_BACKEND_TOKEN`, fails closed with 500 if unconfigured).
- `chatAction()` moved from the `api.chat.ts` route file into `app/lib/.server/llm/chat-action.ts` so both `api.chat.ts` (cookie-authenticated) and `api.android.chat.ts` (Bearer-authenticated) can import the identical streaming/MCP/context-selection logic — no duplicated chat logic, no per-platform provider special-casing.
- `api.android.chat.ts` strips the `Cookie` header before delegating, so `apiKeys`/`providerSettings` resolve to `{}` and `BaseProvider`'s existing `serverEnv`/`process.env` fallback chain supplies provider credentials from this backend's own environment — provider API keys never reach the Android app or its local storage.
- `app/lib/android-api/backend-config.ts` reads the Android app's locally-stored backend URL/token (`AndroidSettingsPanel.tsx` already wrote these keys); `Chat.client.tsx` now points `useChat()` at the Android backend when `isCapacitor()` and a backend is configured, and blocks sending with a toast otherwise instead of calling a route that can't exist in-app.
- **Tested**: auth gate (9 cases) and backend-config parsing (4 cases) — 218/218 total tests, clean typecheck/lint/build.
- **NOT YET VERIFIED**: real end-to-end streaming against a live provider from a physical device — no provider credentials exist in this environment. This is the next highest-value step (see Known blockers).

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
