# VELDRA — Roadmap (living doc)

## P0 (must work for Android to be usable)
- [x] Fix fallback banner / workbench toolbar overlap.
- [x] Fix app-crashing production bundling bug (React undefined in vendor-ai chunk).
- [x] Fix Workbench panel always rendering full-screen regardless of active tab
      (the actual root cause of the original bug screenshot's dominant editor area).
- [x] Back button / drawer state, undersized touch targets, hover-only controls,
      z-index below bottom-nav on 3 modals — audited and fixed.
- [x] Live preview: multi-file relative-reference resolution + reactive regeneration
      for the static/blob-URL path (still no real dev-server preview on Android —
      that needs either Remote Runtime configured by the user, or a future
      Service-Worker-backed virtual-FS interceptor, see DECISIONS.md/CURRENT_STATE.md).
- [ ] Real device / APK verification — blocked on Android SDK availability in this
      environment; code is ready for it.

## P1 (polish / product quality)
- [x] Home/chat welcome screen — verified via screenshot: already has a coherent
      "Guided Build" flow, greeting, provider/model selectors, composer. Not a
      raw scaffold; further polish (button consistency, ambient motion) is a
      nice-to-have, not a P0 blocker.
- [ ] Skin tokens: `.android-card`/`.android-mode-badge`/button radii wired to
      `--veldra-radius-*` this session; `AndroidSettingsPanel`/`GitHubSyncPanel`'s
      raw hex colors still bypass the token system (sized as a separate block).
- [ ] Template system changes real workspace composition on Android.
- [ ] Activity/agent status stream reflects real tool state (not synthetic).
- [ ] Composer toolbar icon-button visual consistency (one button styled
      differently from its siblings).

## P2 (future architecture, don't block P0/P1)
- Local models (GGUF/safetensors/LoRA), media generation extension points.
- Orchestrator migration (`VELDRA_USE_ORCHESTRATOR` flag) to default-on,
  once evidence of no regressions vs. legacy SubagentService path.
- Entitlement enforcement moved fully server-side (client flags are UI-only
  today; do not treat them as security boundaries).

## Explicitly out of scope unless requested
- Rewriting the app from scratch.
- Replacing the dual orchestration architecture before Phase 2/3 criteria
  (see CLAUDE.md "Orchestrator Migration Strategy") are met.
- Visually copying Google AI Studio / Bolt / Lovable rather than adapting
  patterns into VELDRA's own identity.
