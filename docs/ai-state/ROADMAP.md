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
- [x] Skin tokens: `.android-card`/`.android-mode-badge`/button radii (prior
      session), `AndroidSettingsPanel`/`GitHubSyncPanel` (2026-08-15), and a
      further sweep across `Preview.tsx`/`Workbench.client.tsx`/
      `ToolInvocations.tsx`/`SupabaseConnection.tsx` (2026-08-15) all now use
      `bg-bolt-elements-background-depth-*`/`border-bolt-elements-borderColor`.
      Deliberately NOT touched: semantic status colors and third-party brand
      colors (Supabase green) — see DECISIONS.md "When NOT to tokenize".
- [x] Template system changes real workspace composition on Android (2026-08-15)
      — "Code Workspace"/"Project Overview" now deterministically seed real
      starter files via `applyStarterTemplate`, not just a layout switch. The
      other 6 templates are workspace-mode presets by design, not project
      scaffolds — see DECISIONS.md. Still open: unifying with desktop's
      `StarterTemplates`/`/git`-route path (separate, larger change).
- [x] SubagentActivityWidget mounted (prior session) and confirmed genuinely
      wired to real subagentService.ts task state, not synthetic (2026-08-15
      orchestrator audit). Real per-tool-call granularity (tool selected/
      executing, file read, verification, retry) does NOT exist in the
      current data model (`SubagentTask` only has running/completed/failed +
      createdAt) — would need new instrumentation in subagentService.ts
      itself, not just UI wiring. Deliberately not faked.
- [ ] Composer toolbar icon-button visual consistency ("Discuss"/"Model
      Settings" carry a persistent background pill even when off; every
      sibling icon button is hover-only). Investigated 2026-08-15, twice now
      (once via direct read, once via independent fork read reaching the same
      conclusion) — most likely an intentional toggle-vs-momentary-action
      distinction, and it's visually a no-op in the default theme since
      `--bolt-elements-item-backgroundDefault` resolves to fully transparent
      there. Not changed without visual confirmation across the other skins.
- [ ] `UserMessage.tsx`'s two content-shape branches unified into one
      consistent layout (2026-08-15) — done, see DECISIONS.md/current-session.md.
- [x] Real-time state-truth bug fixed: Android's bottom-nav `activeTab` could
      disagree with `workbenchStore.showWorkbench` when the panel opened from
      an artifact-link click or AI file-streaming rather than a tab switch
      (2026-08-15, `AndroidShell.tsx`). Audit found no other duplicate-truth
      issues in chatStore/subagentsStore/skinStore. `settingsStore` and
      `runtime-mode.ts` were flagged as not exhaustively audited at the time —
      checked in the product-integration mandate's Phase 8 (2026-08-15, later):
      `runtime-status.ts` is a pure read-only query over `runtime-mode.ts`'s
      real state, not a second competing store; no duplicate-truth issue found
      in either. `workbenchStore`'s own `showWorkbench`/`currentView`/
      `selectedFile`/`unsavedFiles`/`Preview.tsx` file-sourcing were also
      checked this round — all single-source-of-truth. See
      `docs/ai-state/DECISIONS.md`'s Phase 8 entry for the full trail.

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
