# VELDRA — Roadmap (living doc)

## P0 (must work for Android to be usable)
- [x] Fix fallback banner / workbench toolbar overlap (this session).
- [ ] Full layering/touch audit of remaining mobile components (drawers,
      dialogs, settings panel) — in progress.
- [ ] Live preview actually renders something on Android fallback mode.

## P1 (polish / product quality)
- [ ] Skin tokens actually drive Android surfaces, not just light/dark theme.
- [ ] Template system changes real workspace composition on Android.
- [ ] Activity/agent status stream reflects real tool state (not synthetic).

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
