# VELDRA — Decisions Log

- **Android overlays**: only modals/drawers/sheets/toasts may use
  `position: fixed`, anchored to the viewport. Everything else (banners,
  toolbars, tab content) must participate in normal flex flow inside
  `.android-shell` / `.android-main`, or be `position: absolute` anchored
  to `.android-main` (which is `position: relative`). Rationale: a fixed
  element is positioned relative to the *viewport*, not its parent's
  padding box — it silently escapes safe-area padding and any sibling
  that takes up variable vertical space (banners, in particular).
- **z-index**: use the scale in `app/styles/z-index.scss`
  (`z-prompt`, `z-workbench`, `z-toast`, `z-max`, ...). Do not invent new
  ad-hoc `z-50`/`z-100` values on Android-only components — that was the
  root cause of the fallback-banner-over-workbench bug.
- **npm install**: use `--legacy-peer-deps` in this environment
  (pre-existing `wrangler`/`@remix-run/dev` conflict, unrelated to Android
  work — do not attempt to resolve by downgrading `wrangler` without an
  explicit user request).

## 2026-08-15 additions

- **"Template" is two different concepts, and that's correct, not a bug**:
  `VeldraTemplate` (`app/lib/templates.ts`, Android's `TemplatePicker`) is a
  workspace-layout/mode preset (which panels are visible) — `ai-chat`,
  `agent-workspace`, `model-lab`, `prompt-studio`, `monitoring` are legitimately
  not code-scaffolding concepts and must NOT get a `starterTemplateName`.
  `Template`/`STARTER_TEMPLATES` (`app/types/template.ts`, desktop's
  `StarterTemplates`) is real GitHub-repo starter code, seeded via
  `getTemplates()`'s `boltArtifact`/`boltAction` file-injection pipeline
  (`app/utils/selectStarterTemplate.ts`). Only templates that represent "give
  me a project to build in" (`code-workspace`, `project-overview`) should carry
  `starterTemplateName`, which triggers that same pipeline deterministically
  (no LLM guess) via `Chat.client.tsx`'s `applyStarterTemplate`.
- **Known remaining gap, not yet unified**: desktop actually has a *third*
  path to the same curated starter repos — `StarterTemplates` navigates to
  `/git?url=https://github.com/{repo}.git` (`app/routes/git.tsx` →
  `GitUrlImport.client.tsx`), a full page navigation away from the current
  chat, completely independent of `getTemplates()`. Left untouched this round
  (already works, and merging it is a larger, separate change than the
  Android starter-seeding gap this round closed) — worth unifying in a future
  round so picking a desktop starter template doesn't leave the current chat.
- **Orchestrator UI: do not build on stubs.** Audited `app/lib/orchestrator/*`
  in full: `ApprovalPort`/`PolicyGate` are stub implementations that
  auto-approve/allow everything (`veldra-host.ts`'s `_createApprovalStub`/
  `_createPolicyStub`), `RunStore`/`ModelCatalog`/`CapabilityResolver` are
  `undefined`, and there is no real-time event stream a UI could subscribe to
  — `ApprovalPort.request()` is a single request/response call, not a
  subscribable stream. Building an approval/policy UI now would show the user
  information the runtime doesn't actually back up. Build the backend plumbing
  (a `WorkflowRun` state machine + emitter, real port/gate/store
  implementations) first; the UI comes after there's real data.
- **When NOT to tokenize a hardcoded color**: not every raw hex value is a
  design-system bug. Two legitimate exceptions found and left alone this
  round: (1) semantic/status colors meant to stay recognizable regardless of
  skin (e.g. `AndroidSettingsPanel`'s runtime-mode amber/green badge,
  `SupabaseAlert.tsx`'s warning-amber box) — these should look the same in
  every skin, the same way "error" should stay red-ish everywhere; (2) a
  third-party service's actual brand color (`SupabaseConnection.tsx`'s
  `#3ECF8E` Supabase green) — that's supposed to look like Supabase, not the
  active skin. Only tokenize generic surface/border colors (near-black/
  off-white/gray values with no semantic or brand meaning) that were clearly
  meant to track the skin/theme system but got left on a literal hex value.
  Also exempt: colors inside content that renders in a separate document
  context VELDRA's CSS custom properties don't reach — e.g. `Preview.tsx`'s
  device-frame-mockup popout window, built as a raw HTML/CSS template string.
- **Run the test suite, don't cite an old count.** CLAUDE.md said "23 tests
  passing" for the orchestrator; actual count is 99, and `npm test` hadn't
  apparently been run fresh in a while — 9 tests across
  `veldra-agent-runner.spec.ts` and `runtime-status.spec.ts` were failing,
  undiscovered, for reasons unrelated to each other and to anything in this
  session (a `vi.mock` factory returning a fresh object per call instead of a
  shared instance; a real premature-throw bug in `_waitForCompletion`'s
  polling loop; one stale test asserting pre-remote-runtime-registry
  behavior; one real gap where `COMMAND_EXECUTION_REQUIREMENTS = {}` let a
  provider without `interactiveShell` report as available). All fixed;
  357/357 pass now. Added `npm test` to `QUALITY_GATES.md`'s documented gate
  list — it wasn't there before, which is plausibly why this went unnoticed.
