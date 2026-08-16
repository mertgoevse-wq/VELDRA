# VELDRA — Roadmap (living doc)

## P0 (must work for Android to be usable)
- [x] Fix fallback banner / workbench toolbar overlap.
- [x] Fix app-crashing production bundling bug (React undefined in vendor-ai chunk).
      **Re-broken and re-fixed 2026-08-16**: this specific bug stayed fixed, but the
      build broke again for 4 different, related chunk-splitting circular-reference
      reasons that went undetected for a while (no real build+screenshot check had been
      run since P0 was last verified) — see DECISIONS.md's 2026-08-16 entry. Lesson: a
      manual `manualChunks` split is only as safe as its last real screenshot
      verification, not a one-time fix.
- [x] Fix Workbench panel always rendering full-screen regardless of active tab
      (the actual root cause of the original bug screenshot's dominant editor area).
- [x] Back button / drawer state, undersized touch targets, hover-only controls,
      z-index below bottom-nav on 3 modals — audited and fixed.
- [x] Live preview: multi-file relative-reference resolution + reactive regeneration
      for the static/blob-URL path. Real dev-server preview on Android now works when
      a Remote Runtime is configured (2026-08-16): the agent can actually start it
      (`#runStartActionRemote()`), files sync automatically first, and Preview checks
      for it without a manual refresh. No dev-server preview exists yet with NO Remote
      Runtime configured — that would need a future Service-Worker-backed virtual-FS
      interceptor, see DECISIONS.md/CURRENT_STATE.md.
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
      scaffolds — see DECISIONS.md.
- [x] Desktop's `StarterTemplates`/`/git`-route path unified with the shared
      seeding pipeline (2026-08-16) — desktop now seeds into the current chat
      via `applyStarterTemplate`, same as Android, instead of navigating away.
      `/git?url=...` (arbitrary GitHub URL import) deliberately left separate.
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
- [x] `UserMessage.tsx`'s two content-shape branches unified into one
      consistent layout (2026-08-15) — see DECISIONS.md/current-session.md.
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

- [x] Agent-issued 'build'/'start' actions bridged to Remote Runtime (2026-08-16)
      — previously only the user's manual Terminal panel could talk to a
      configured Remote Runtime server; the agent itself had no execution path
      at all on that mode. Now routes through the same safe command-profile
      API (`npm run build`/`npm run dev`), not raw shell, syncs current files
      first, and triggers a real Preview refresh once a dev server starts. See
      DECISIONS.md. Still open: raw agent-issued 'shell' actions remain
      unavailable on Remote Runtime by design (would mean executing
      unvalidated LLM text on a real remote server).
- [x] Language capability matrix (2026-08-16, `app/lib/languages/capabilities.ts`)
      — a tested, truthful map of editor/template/dependency/runtime/build/
      preview support per language. Real editor syntax highlighting added for
      Go/Rust/Java/Kotlin/C/Shell (`@codemirror/legacy-modes`). Honest finding:
      WebContainer and Remote Runtime are both Node.js-only, so full support
      (run/build/preview) stays JS/TS/HTML/CSS-only — not a gap to hide, a real
      architecture constraint until a genuinely different runtime is built.
- [x] Real end-to-end creation-loop proof (2026-08-16,
      `app/lib/runtime/creation-loop-e2e.spec.ts`) — files → real sync → Remote
      Runtime start → real Preview URL → render → second edit → re-sync →
      refresh, through genuine wiring (real `ActionRunner`/`FilesStore`, real
      `pushLocalWorkspaceToRemote`, a real `fake-indexeddb`-backed persistence
      round-trip), with only the HTTP server and WebContainer boundaries mocked.
      Plus honest build-failure representation end-to-end. `Preview.tsx` also
      got its first-ever test coverage (7 tests) proving it never invents
      success. See DECISIONS.md/CURRENT_STATE.md block 7.
- [x] Terminal/Preview shared runtime state (2026-08-16) — a user manually
      running `npm run dev` from `RemoteCommandPanel` (Terminal's Remote
      Runtime fallback UI), or a running command exiting/crashing, now
      triggers the same real Preview refresh signal the agent's own start
      path already did. Previously Preview only found out about agent-started
      servers, not user-started ones, and never learned a server had crashed.
- [x] Multi-file consistency audit (2026-08-16) — found and fixed a critical
      data-loss bug: unsaved editor edits in one file were silently reverted
      whenever ANY other file changed anywhere (agent write, sync, etc.),
      while the UI kept claiming the file was still "modified". Also closed
      a real gap where locally-deleted files never propagated to Remote
      Runtime (server had no delete endpoint at all) and could be silently
      resurrected by a pull. See DECISIONS.md/CURRENT_STATE.md block 8 for
      full detail, including what was investigated and deliberately deferred
      (file rename doesn't exist as a feature; cross-ActionRunner write
      ordering is a real but low-exposure gap, not fixed without a concrete
      repro).
- [x] Multi-device/project sync foundation (2026-08-16) — `StorageProvider`
      interface (`app/lib/storage/types.ts`) with two real adapters
      (`RemoteRuntimeProvider`, `LocalStorageProvider`), both wrapping
      already-proven logic rather than reimplementing file I/O. New device
      identity (`app/lib/identity/device.ts`) — nothing used one before.
      Full LOCAL/REMOTE/SYNC/PROJECT/AUTHENTICATION/STORAGE-PROVIDER
      breakdown and an honest threat model (no encryption at rest anywhere
      today, despite a real unused `crypto.ts`; GitHub/provider tokens in
      plaintext localStorage+cookies; no real per-project file isolation —
      Android fallback storage is one single global workspace) written up
      in `docs/architecture/STORAGE_AND_SYNC.md`. Deliberately NOT built:
      any GitHub/Drive/iCloud provider (no OAuth/conflict-UI to back one
      yet), encryption at rest, real multi-project UI.
- [x] Real project identity + per-project Android storage isolation
      (2026-08-16, later) — `app/lib/identity/project.ts` (kept structurally
      distinct from chat identity even though it derives from it today, per
      explicit instruction not to conflate them at the type level).
      `androidFallbackStorage.ts` went from one global IndexedDB workspace
      shared by every chat to real per-project keys, with a deterministic
      one-time migration (first project after upgrade inherits legacy data;
      every other project starts genuinely empty; legacy record never
      deleted). Found and fixed a real unbounded IndexedDB connection leak
      in `openDb()` while building the migration tests. See
      `docs/architecture/STORAGE_AND_SYNC.md`/`CURRENT_STATE.md` block 11.
- [x] StorageProvider hardening (2026-08-16, later) — `exists()`/`getMetadata()`/
      `rename()` added to the contract, with a new `capabilities.rename` flag.
      `LocalStorageProvider` genuinely supports rename (real, atomic);
      `RemoteRuntimeProvider` honestly rejects it (no server-side primitive
      to build one from). Found and fixed a real gap in the same pass:
      `LocalStorageProvider` was still ignoring its own `project` argument
      after the per-project isolation migration landed — now genuinely
      threads it through. See `CURRENT_STATE.md` block 12.

## P2 (future architecture, don't block P0/P1)
- Local models (GGUF/safetensors/LoRA), media generation extension points.
- Orchestrator migration (`VELDRA_USE_ORCHESTRATOR` flag) to default-on,
  once evidence of no regressions vs. legacy SubagentService path.
- Entitlement enforcement moved fully server-side (client flags are UI-only
  today; do not treat them as security boundaries).
- Encryption at rest for credentials/project files (real WebCrypto helper
  already exists at `app/lib/crypto.ts`, unused by anything today).
- Unify `app/lib/stores/github.ts` (desktop, server-OAuth-proxied — token
  never touches the client) and `app/lib/stores/githubConnection.ts`
  (Android, client-side PAT entry) — confirmed real duplicate state
  (2026-08-16 dead-code sweep): both read/write the SAME `github_connection`
  localStorage key but keep separate in-memory atoms, so a live session
  where both were somehow active wouldn't see each other's connect/disconnect
  reactively (only synced on next page load / `initializeConnection()`).
  Not fixed this round — they represent two genuinely different auth models
  (server-proxied OAuth vs. client-supplied PAT), and unifying them is a
  product decision (should Android get OAuth too? should desktop support
  PAT entry?) not a mechanical bug fix. Flagging for a deliberate, scoped
  follow-up rather than merging blind.

## Explicitly out of scope unless requested
- Rewriting the app from scratch.
- Replacing the dual orchestration architecture before Phase 2/3 criteria
  (see CLAUDE.md "Orchestrator Migration Strategy") are met.
- Visually copying Google AI Studio / Bolt / Lovable rather than adapting
  patterns into VELDRA's own identity.
