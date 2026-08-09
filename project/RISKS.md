# VELDRA Risks

| Risk | Severity | Mitigation / next action |
|---|---:|---|
| Remote Runtime deployment with missing token | Critical | Fail closed with `503`; require a long random `REMOTE_RUNTIME_TOKEN` |
| Remote Runtime browser origin misconfiguration | High | Exact production allowlist via `REMOTE_RUNTIME_ALLOWED_ORIGINS`; native no-Origin requests remain supported |
| Legacy WebSocket query token may appear in infrastructure URL logs | High | Client prefers subprotocol auth for valid tokens; remove query compatibility only in a versioned migration |
| Remote Runtime package dependencies are not installed in this environment | Medium | Root security tests run; install/compile package dependencies in CI or a controlled environment before release |
| Production Miniflare/tcmalloc address-space OOM | High | Re-run build on a memory/address-space-capable environment; do not misclassify as app failure |
| Android JDK/SDK/Gradle unavailable locally | High | Use CI or Android Studio/device environment for APK and device validation |
| Global ESLint backlog remains | Medium | Repair small rule-based slices without broad rule suppression or unrelated reformatting |
| No verified image provider or local image runtime | Medium | Keep Image Studio unavailable; do not fabricate assets/results |
| Static/provider metadata can become stale | Medium | Use provenance, freshness, validation, and rollback before dynamic catalog promotion |
