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

## 2026-08-15 additions, continued (core product + runtime foundation, later round)

- **The real orchestrator runtime (events.ts, run-workflow.ts's WorkflowRun state
  machine, veldra-approvals.ts, veldra-policy.ts) landed in this round, but nothing in
  the live app called it yet** — `spawnSubagentWithOrchestrator()`
  (`app/lib/orchestrator/integration.ts`), the one call site actually reachable from a
  real chat request (`mcpService.ts`'s `spawn_subagent` tool), still called
  `host.agents.run()` directly, bypassing `runWorkflow()` entirely. Fixed: it now builds
  a single-task `Goal`/`Task`/`WorkflowRun` and drives it through `runWorkflow()`, so a
  spawn taken this way exercises the real state machine, event emission, budget
  enforcement and persistence, not just the `AgentRunner` call with all of that sitting
  unused beside it. Still gated behind `VELDRA_USE_ORCHESTRATOR` (off by default) — this
  is the mandate's own "foundation, not migration" stance, unchanged.
- **Found a real deadlock while wiring the above in, not yet exercised by anything
  before this round**: `entitlement.ts`'s `TIER_BUDGETS.FREE` sets `maxCostMinor: 0`, and
  `budget.ts`'s `checkBudget()` treats a limit as violated on `used >= allowed` — so for
  a FREE-tier run, the very first budget check (before any task has even dispatched, at
  `usage.costMinor === 0`) trips a violation on `0 >= 0`. `runWorkflow()`'s response to a
  violation is to call `host.approvals.request()`, and `veldra-approvals.ts`'s real
  `ApprovalPort` genuinely suspends until something calls `respond()` — which nothing
  does yet, no approval UI is wired up. Net effect: enabling the orchestrator for a
  FREE-tier user would hang the calling request forever. This was never hit by Block A's
  own test suite because it always used a hand-built `GENEROUS_BUDGET`, never a real tier
  budget, through `runWorkflow()`. Chose not to touch `checkBudget()`/`TIER_BUDGETS`
  themselves — that's shared, already-tested core state-machine code, and it's genuinely
  ambiguous whether the fix belongs there (e.g. `>` instead of `>=`) or is correct as
  policy (FREE tier arguably *should* be blocked from any cost-incurring orchestrator
  run). Fixed at the call site instead: `integration.ts` now runs `checkBudget()` itself
  against zero usage before ever calling `runWorkflow()`, and falls back to legacy
  immediately if a tier can't afford one iteration — same fallback behavior as a policy
  denial, not a new failure mode. Whether `checkBudget`'s zero-allowance semantics need a
  real fix (or a UI that can actually answer an approval) is a good next-round question,
  not resolved here.

## 2026-08-15 additions, continued (product-integration mandate, Phase 1)

- **Proved the orchestrator path end-to-end instead of trusting the sum of its unit
  tests.** Every existing spec touching `spawnSubagentWithOrchestrator()` mocks at least
  one VELDRA-owned layer (the host, the agent runner, or the subagent service).
  `orchestrator-e2e.spec.ts` mocks only the two boundaries this container genuinely
  cannot provide — `ai`'s `generateText` and an active sandbox session — and lets every
  VELDRA-authored layer run for real: `integration.ts` -> `runWorkflow()` ->
  `VeldraAgentRunner` -> `SubagentService` -> `subagentsStore` -> back up through
  `Evidence` -> a `completed` `WorkflowRun`. It passed on the first real attempt after
  fixing one test-authoring mistake (`apiKeys` must be keyed by provider display name,
  e.g. `{ Google: '...' }`, not the env-var token name — `BaseProvider.
  getProviderBaseUrlAndKey()`'s own lookup key), which is itself a useful confirmation
  that the wiring, not just the mocks, is what made it pass.
- **A deep test found a real (if currently dormant) contract bug**, not a test-authoring
  artifact: writing the failure-path test (`generateText` rejects) surfaced that
  `spawnSubagentWithOrchestrator()`'s `apiKeys`/`providerSettings` parameters were
  silently dropped by both the disabled-flag legacy call and the post-failure fallback
  call — only the orchestrator-path's own `getVeldraHost(apiKeys, providerSettings)`
  actually used them. `mcpService.ts`'s tool handler, the only real caller, never passes
  them (relies on `serverEnv`/`process.env` instead), so this has never fired in
  production — but the function's own signature invites a caller to pass credentials
  this way, and a future one doing so would have silently gotten an unauthenticated
  fallback instead of an equivalent one. Fixed by merging `apiKeys`/`providerSettings`
  into the `SpawnSubagentOptions` object passed to `SubagentService` on both paths,
  preferring anything already set directly on `options` (`SpawnSubagentOptions` carries
  both fields itself).
- **Rejected auto-enabling the orchestrator by runtime environment** (e.g. "on by
  default outside production") as this round's "safe rollout" mechanism, even though the
  mandate asked for one. The blast radius is untraceable: `getRuntimeEnvironment()`
  returns `'test'` under Vitest, so that single change would have silently flipped the
  default for every existing spec that calls into this code without explicitly setting
  `VELDRA_USE_ORCHESTRATOR` — an audit scope far larger than what proving end-to-end
  correctness required. Chose the lower-risk, still-genuinely-useful alternative
  instead: `.env.example` now documents the flag with a concrete recommendation (enable
  it in dev/staging deployments, not in your local test run), and the new e2e spec makes
  "is the flag-enabled path still healthy" a question `npm test` answers on every run,
  regardless of any deployment's actual flag setting.

## 2026-08-15 additions, continued (product-integration mandate, Phase 2)

- **Only wired UI observability for events that have a real emit call site.** Audited
  every `emit(...)` call in `run-workflow.ts`: `run.*`, `agent.*`, and `approval.*` all
  fire from real state transitions; `tool.*`/`file.*`/`verification.*` exist in
  `events.ts`'s type union but have no emit call site anywhere in the codebase. Building
  UI for those now would be exactly the fake-progress pattern `events.ts`'s own doc
  comment forbids ("if a UI wants a phase that has no corresponding emit call anywhere,
  that phase does not exist yet"). Left them alone; real instrumentation (an
  `onStepFinish` hook in `subagentService.ts`) is a prerequisite, not attempted here, same
  restraint the agent-activity-bridge round already documented for the identical reason.
- **`run.*`/`approval.*` events were being emitted and thrown away.** `integration.ts`'s
  `onEvent` callback (added when Phase 1 wired `spawnSubagentWithOrchestrator()` through
  `runWorkflow()`) only used incoming events to capture `agent.completed`'s output
  internally — nothing forwarded them anywhere a UI could read. Fixed by exporting
  `recordActivityEvent()` from `subagent-activity-bridge.ts` (renamed from the
  file-private `pushRecent`) so both the bridge and `integration.ts` write into the same
  `recentAgentActivityStore` — one shared store, not two, per the same "no duplicate
  competing stores" principle the mandate names explicitly for a later phase.
- **Found and fixed a real bug via a rigorous test, not a passing-but-shallow one.** The
  orchestrator's own `Task.id` (a `crypto.randomUUID()`, internal to `integration.ts`/
  `run-workflow.ts`) and `SubagentService`'s generated task id (`subagent-<timestamp>-
  <random>`, the id `subagentsStore` and `SubagentActivityWidget` actually key rows on)
  are two unrelated id spaces. The first version of this change tagged forwarded
  `run.*`/`approval.*` events with the orchestrator's `Task.id` — syntactically fine,
  semantically wrong: those events would never match any `SubagentTask` row in the real
  widget, so they'd be silently invisible despite "looking" wired up. An early version of
  the e2e test's assertion (checking only *presence* via `arrayContaining`) didn't catch
  this; only asserting exact *counts* per event type, filtered by the id the production
  code path actually returns, surfaced the mismatch (count was 0, not 1). Fixed by
  buffering `run.*`/`approval.*` events in `integration.ts` and re-tagging them with the
  real `SubagentService` task id once resolved from `Evidence` after `runWorkflow()`
  returns, rather than at emission time (when that id doesn't exist yet — `run.started`
  fires before any subagent has been dispatched). Events with no resolvable subagent id
  (e.g. a policy/budget denial before any dispatch happened) are recorded untagged rather
  than force-attributed to a task — honest "not attributable to a row yet," not a
  fabricated association.
- **Test-writing lesson, not a code lesson**: three separate JSDoc/block comments in this
  round's diff contained the literal substring `run.*/approval.*` as prose shorthand,
  which is also valid JavaScript's block-comment-close token (`*/`) — each one silently
  truncated its comment and turned the rest into a syntax error, caught immediately by
  `tsc`. Avoid `X.*/Y.*` as comment shorthand for "these two event-name families";
  spell out "and" instead.

## 2026-08-15 additions, continued (product-integration mandate, Phase 3)

- **Built the real approval UI, but was honest that nothing can trigger it yet.**
  `ApprovalRequestWidget.tsx` subscribes to `pendingApprovalsStore` and calls
  `getVeldraHost().approvals.respond()` — a genuine round-trip against the real
  `ApprovalPort`, not a mock (proved in `ApprovalRequestWidget.spec.tsx` with a real DOM
  render and click). But `spawnSubagentWithOrchestrator()`'s single-task-per-run shape
  (Phase 1) means its one `checkBudget()` call always runs against zero usage — the exact
  same computation Phase 1's own preflight check already performs before `runWorkflow()`
  is even called. That makes a `'budget-exceeded'` approval request — the only kind
  anything in the codebase currently requests — provably unreachable from today's one live
  call site. Built the UI anyway, deliberately: unlike building UI for an event type with
  no emit call site at all (rejected in Phase 2's DECISIONS.md entry), this UI is backed by
  a real, already-tested port with a real, already-tested pending-request store — the gap
  is "no current caller happens to trigger it," not "the mechanism doesn't exist." That's
  a meaningfully different, and acceptable, kind of incompleteness: the next feature that
  legitimately needs approval (a multi-task workflow, a destructive-action check) gets a
  working UI for free instead of needing its own UI-wiring round.
- **Fixed a real, pre-existing test-infrastructure gap while writing this round's
  component test, not specific to the approval widget.** `vite.config.ts`'s `plugins`
  array used `remixVitePlugin()` unconditionally, including under Vitest — but Vitest has
  no real dev-server/HTML page for Remix's Fast-Refresh "preamble" injection to attach to,
  so importing ANY real `.tsx` component from a test threw `Remix Vite plugin can't detect
  preamble. Something is wrong.` at *import* time, not just when `render()` was called.
  Checked: no test file anywhere in this codebase had ever imported a real component
  file before — every existing `// @vitest-environment jsdom` test (`composer.spec.ts`,
  `backend-config.spec.ts`, `workspaceFileImport.spec.ts`) tests plain functions, never
  JSX. Root cause and fix were both cheap once diagnosed: `remixCloudflareDevProxy()` was
  already conditionally skipped under `config.mode === 'test'` one line above the
  unconditional `remixVitePlugin()` call — extending that exact same, already-proven
  pattern to swap in plain `@vitejs/plugin-react` (already a devDependency, unused until
  now) for test mode fixed it cleanly, with the non-test branch left byte-for-byte
  identical to before. Verified the production branch is unaffected two ways: (1) the
  non-test code path is unchanged, only relocated one level into a ternary guarded by a
  condition already proven correct by the adjacent `remixCloudflareDevProxy()` line: dev
  and build already work today, which only holds if `config.mode` correctly distinguishes
  test from non-test in this exact codebase; (2) a `vite build --mode production` attempt
  progressed past all plugin resolution/config validation (printed the Remix future-flags
  startup banner) before hitting the pre-existing, already-documented Miniflare/tcmalloc
  address-space OOM this container is known to hit on production builds — not a plugin
  error, and not something this change could have caused since it doesn't run in
  non-test mode. This unblocks real component testing for the several upcoming UI-heavy
  phases (4-6, 8-12), not just this one widget — `ApprovalRequestWidget.spec.tsx` is the
  reference pattern (see `QUALITY_GATES.md`).

## 2026-08-15 additions, continued (product-integration mandate, Phase 4)

- **Declined to build Planning/Tool/File/Verification/Waiting activity states** — the
  mandate's own example list for the activity timeline upgrade. None have a real data
  source: `Task` decomposition/planning is explicitly out of scope for `run-workflow.ts`
  (see its own doc comment); `tool.*`/`file.*`/`verification.*` events have no emit call
  site anywhere (Phase 2's finding, unchanged); and `SubagentTask.status` is exactly
  `{running, completed, failed}` — no `'queued'`/`'pending'` state exists in the data
  model at all, so "Waiting" has nothing real to represent either. Building any of these
  now would be exactly the fake-progress pattern this project has repeatedly, explicitly
  rejected (Block B, Phase 2). Scoped Phase 4 to what's real instead: reduced-motion
  support (a mandate requirement with a genuine implementation path) and real component
  test coverage proving the widget's existing real-data rendering actually works.
- **`usePrefersReducedMotion` imports the specific file, not the `~/lib/hooks` barrel.**
  Writing the first component test for `ApprovalRequestWidget` (importing the hook via
  the barrel) crashed with `Cannot read properties of undefined (reading
  'webcontainerContext')`, thrown from `app/lib/webcontainer/index.ts` — pulled in
  transitively through some other hook the barrel re-exports (`useGit`/`useGitHubConnection`/etc.),
  unrelated to anything this round touched. Root cause not fully chased down (would mean
  auditing the whole barrel's transitive import graph for `import.meta.hot`-adjacent
  module-load-time side effects under Vitest — out of scope here); side-stepped by
  importing `usePrefersReducedMotion` directly from its own file in both widgets, which
  has no import graph beyond `react`. The barrel export was still added for any future
  consumer that doesn't hit this path.
- **Widget mocks for `window.matchMedia` need both the modern and legacy MediaQueryList
  method pairs.** `addEventListener`/`removeEventListener` alone crashed any test
  rendering a `motion.*` element with `motionMediaQuery.addListener is not a function` —
  framer-motion's own internal reduced-motion detection (`initPrefersReducedMotion`,
  independent of this round's `usePrefersReducedMotion` hook) still uses the legacy
  `addListener`/`removeListener` pair. Both widget spec files' mocks stub all four.
- **Two real test-authoring bugs, not product bugs, caught while writing
  `SubagentActivityWidget.spec.tsx`** (recorded so the next person reusing this pattern
  doesn't repeat them): (1) the widget's task list starts expanded
  (`useState(true)`) — clicking the outer section-toggle button in a test *collapses* it
  instead of expanding it, intermittently hiding everything the test then tries to query
  depending on animation/timing luck. (2) Several real, distinct pieces of state
  legitimately render the same text in two places at once (a task's status badge and its
  Activity-list entry both say "Completed"; the collapsed-row summary and the expanded
  "Delegated task" paragraph both show `task.task`) — `getByText` correctly throws on
  ambiguity in both cases; the fix is `getAllByText(...).length` assertions, not a
  product change.
- **`nanostore.listen()` only fires on changes made after subscribing, not for
  already-existing state at subscribe time** — relevant to any future test of
  `subagent-activity-bridge.ts`'s bridge: seed a task into `subagentsStore` *before*
  rendering `SubagentActivityWidget` (which starts the bridge on mount) and the bridge
  never sees that task's transition into `'running'`, since it happened before the
  bridge ever subscribed. Render first, then mutate the store, to match how production
  actually orders things (widget mounts once at chat-load time, long before any real
  spawn happens).

## 2026-08-15 additions, continued (product-integration mandate, Phase 5)

- **Investigated "true interleaving" of tool calls within assistant message text
  (`AssistantMessage.tsx`) — the exact fix `daeabc6` deliberately deferred as "the more
  complete fix" — and preserved that deferral, now with concrete evidence rather than just
  caution.** `Markdown.tsx` renders `<boltArtifact>` content by parsing the *full* `content`
  string (VELDRA's own message-parser rewrites `<boltArtifact>` tags into
  `__boltArtifact__`-classed placeholder elements before this component ever sees them);
  splitting `content` into fragments aligned to the AI SDK's `parts` array boundaries risks
  a fragment boundary falling in the middle of an artifact tag the AI SDK has no awareness
  of, since `parts` are chunked by streaming/tool-call structure, not by VELDRA's own tag
  syntax. This is a real, confirmed architectural coupling, not just an abundance of
  caution — attempting the naive version of this fix could break the artifact system,
  the single most business-critical rendering path in the app (it's how every file the AI
  writes actually reaches the user). Correctly de-risking this would need auditing
  `message-parser.ts`'s tag-boundary handling against real `parts` chunking behavior first
  — out of scope for this round. Left `AssistantMessage.tsx` unchanged.
- **`BuildActivityFeed` had zero styling on web/desktop** — a real, high-severity, entirely
  pre-existing bug found while looking for genuine "disconnected UI system" issues (Phase
  5's actual mandate) rather than assuming the tool-interleaving gap was the only one.
  `BuildActivityFeed.tsx` used bespoke CSS class names (`.build-activity-feed`,
  `.activity-row`, etc.) that were defined *only* in `app/styles/android.css` — confirmed
  via search that no other stylesheet anywhere in the codebase defines them, and confirmed
  `android.css` is imported *only* by `src/android-main.tsx`, the Android-only entry point.
  The web/desktop entry (`app/root.tsx` → `index.scss`) never loads it. Since
  `BuildActivityFeed` renders on every single AI streaming response and is shared by both
  entry points, this means it rendered as completely unstyled raw HTML on web/desktop the
  entire time it existed. Rewrote it to use Tailwind/UnoCSS utility classes with
  `bg-bolt-elements-*`/`text-bolt-elements-*` design tokens — the same pattern
  `SubagentActivityWidget`/`ApprovalRequestWidget` already use — which fixes the missing
  styling (utility classes apply everywhere, not gated behind a platform-specific
  stylesheet) and genuinely unifies the visual language across all three activity
  indicators now visible in chat, which is what "not several disconnected UI systems"
  concretely means here. Also dropped `PHASE_COLORS`' 14-hue hardcoded-Tailwind-color
  rainbow (`text-blue-400`, `text-violet-400`, etc. — one per `ActivityPhase`, none
  skin-aware) in favor of a status-based tokenized color (`statusColorClass`: active/done/
  error/skipped), keeping the per-phase *icon* shape as the differentiator instead — icons
  don't have a skin/theming problem the way raw hex-adjacent color utilities do. Removed
  the now-orphaned CSS block from `android.css` rather than leaving dead code with no
  remaining reference. Added `BuildActivityFeed.spec.tsx` (first real test for this
  component) proving the rewrite renders real `buildActivityStore` data correctly.
  413 tests (was 408), typecheck clean, lint clean.

## 2026-08-15 additions, continued (product-integration mandate, Phase 6)

- **Audited every composer control** (`ChatBox.tsx` + its sub-components) for the mandate's
  own bar: "each control must actually work, or be deliberately disabled with an
  explanation — no dead buttons." Verified real and unchanged: prompt textarea (Enter to
  send, Shift+Enter newline, IME-composing guard), send/stop (`SendButton`), provider/model
  (`ModelSelector`), attachments/drag-drop (`FilePreview`, real image-file filtering and
  `FileReader` processing), `McpTools` (real dialog, real `checkServersAvailabilities()`
  with proper try/catch and a real error message, not a stub), `WebSearch` (already
  correctly awaits before its success toast — see below), `ColorSchemeDialog`,
  `SupabaseConnection`, `ExpoQrModal`, Discuss toggle, Model Settings toggle. "Skills" and
  "agents" have no dedicated composer button — skills load via the `load_skill` MCP tool at
  the LLM's own discretion, and subagent spawning is a tool call too (see `mcpService.ts`);
  this is a legitimate design, not a missing composer control, so nothing was added for it.
- **Found and fixed a real fake-success bug: "Enhance prompt" showed `toast.success('Prompt
  enhanced!')` unconditionally and immediately on click**, before the actual (async,
  network-dependent, streamed) enhancement had even started — not after it finished, and
  not conditioned on whether it actually succeeded. Confirmed `enhancePrompt()` is a real
  `fetch()` + streamed-response operation that can genuinely fail (network error, non-ok
  status, a stream read error) — and confirmed the ONLY UI signal of real success/failure,
  `promptEnhanced`, was tracked in state, threaded as a prop all the way to `BaseChat.tsx`,
  and then never read there (`// promptEnhanced,` sat commented out) — so there was
  genuinely no real feedback path anywhere before this. Also found the `fetch()` call
  itself had no error handling at all (only the stream-reading loop was inside a
  try/catch) — a network failure would have been an unhandled promise rejection with the
  fake success toast having already fired. Fixed by moving the entire operation into one
  try/catch in `usePromptEnhancer.ts` itself (the natural owner of this state) with real
  success/error toasts tied to actual outcome, and removing the blind toast from
  `ChatBox.tsx`'s click handler entirely. `promptEnhanced` is now only ever set `true` on
  genuine success (previously set unconditionally in a `finally` block, which was itself
  wrong regardless of the toast issue — a second, smaller instance of the same root
  problem). New `usePromptEnhancer.spec.ts` (4 tests) covers the streamed-success path,
  a rejected fetch, a non-ok response, and the in-flight `enhancingPrompt` state — the
  first real test for this hook.
- **Found and fixed a real, if narrower, dead-button case: the speech-recognition mic
  button stayed enabled on browsers/WebViews without the Web Speech API.**
  `BaseChat.tsx`'s `startListening()` already correctly no-ops when `recognition` is
  `null` (the feature-detected `SpeechRecognition`/`webkitSpeechRecognition` instance) —
  but the button's own `disabled` prop only ever reflected `isStreaming`, never whether the
  API exists at all. On an unsupported browser (older Firefox, some Android WebViews),
  clicking the mic did precisely nothing, with zero feedback of any kind — the literal
  "dead button" case the mandate names. Threaded a new `speechRecognitionSupported`
  boolean prop from `BaseChat.tsx` (`!!recognition`) through `ChatBox.tsx` to
  `SpeechRecognitionButton`, which now disables itself and shows an honest native `title`
  tooltip ("Speech recognition is not supported in this browser") instead of silently
  doing nothing.
- 417 tests (was 413), typecheck clean, lint clean (0 errors, the same 2 pre-existing
  warnings baseline).

## 2026-08-15 additions, continued (product-integration mandate, Phase 7)

- **Continued the c998f16 template-unification round rather than re-auditing the same
  ground.** That round already read `GitUrlImport.client.tsx` in full and confirmed the
  `/git` route is legitimately different domain logic from `getTemplates()` (arbitrary
  user URL + real `git clone` + a brand-new chat, vs. a curated catalog seeded into the
  current chat) — not re-litigated here. It also already extracted the one thing that
  really was duplicated (`buildFileSeedArtifactMessage()`) and fixed a real escaping gap
  that comparison surfaced. What was left unaddressed, and stayed that way here too: `/git`
  navigating to a whole new chat instead of seeding into the current one — explicitly
  flagged as "a deliberate, separate, larger change," which this round's own scope (adding
  missing test coverage for the core pipeline, not a `/git`-route behavior change) didn't
  warrant reopening.
- **`getTemplates()` — the actual mechanism behind "pick a template, get a real project" —
  had no test coverage at all before this.** Neither did `templates.ts`, `StarterTemplates.tsx`,
  or `TemplatePicker.tsx`. Added `selectStarterTemplate.spec.ts` (5 tests, mocking only
  `fetch` and `STARTER_TEMPLATES`) covering what was genuinely untested: `.git`/`.bolt`
  file exclusion from the seeded artifact, a `.bolt/prompt` file's instructions actually
  reaching `userMessage`, a `.bolt/ignore` file's matched paths being listed as read-only
  in `userMessage` while still being *included* in the seeded artifact content (a real,
  easy-to-get-backwards distinction — read-only isn't the same as absent, the LLM still
  needs the file's real content to import/reference it), and the not-found case. First
  real regression guard for this pipeline. 422 tests (was 417), typecheck clean, lint
  clean.
- **Test-authoring note**: an early version of the new spec used `vi.resetModules()` +
  a fresh dynamic `import('./selectStarterTemplate')` per test (reaching for it to make a
  per-test `vi.mock('./constants', ...)` override "feel" isolated) — `vi.mock` calls are
  already hoisted and file-scoped in Vitest, so this bought nothing but forced a full
  module-graph reimport (including `LLMManager`'s real provider-registration side effect)
  on every single test, timing one of them out at the default 5s. A plain top-level
  `import` was not only correct but ~400x faster once removed (5769ms → 13ms for the
  whole suite).

## 2026-08-15 additions, continued (product-integration mandate, Phase 8)

- **Audited `workbenchStore` (`app/lib/stores/workbench.ts`) and its neighbors for
  duplicate/competing state-truth, beyond the one instance already fixed
  (`AndroidShell.tsx`'s `activeTab`/`showWorkbench` desync, an earlier round). Found the
  architecture sound — no new bugs — via direct code reading, not a re-derivation of the
  earlier finding:**
  - `showWorkbench`/`currentView`: single `WritableAtom`s directly on `workbenchStore`,
    nothing else in the codebase (`grep`-confirmed: no component keeps a local
    `useState`-based shadow of workbench visibility) maintains a parallel copy.
  - `selectedFile`: delegated through a getter to a private `#editorStore` — genuinely
    encapsulated, not duplicated anywhere else.
  - `unsavedFiles`: a single canonical `Set<string>` atom on `workbenchStore`; every
    mutation site reads-then-writes the same atom, no shadow copy found.
  - `Preview.tsx` reads its file data directly from `workbenchStore.files` (via
    `useStore`/`.get()`), not an independent snapshot — `buildStaticPreview()` itself is a
    pure function taking a `FileMap` parameter, so it can't drift from whatever the caller
    passes in.
  - `runtime-status.ts` vs `runtime-mode.ts`: not two competing stores — `runtime-mode.ts`
    owns the actual state (`runtimeModeStore`); `runtime-status.ts` is a pure, read-only
    query function that reports registry-backed provider availability *for* the current
    mode, never mutates it and holds no state of its own.
  - `settingsStore`/`runtime-mode.ts` were flagged as "not exhaustively audited" by the
    round that fixed the `AndroidShell` bug — checked this round too, same conclusion: no
    duplicate-truth issue found in either.
  - No code changes resulted from this pass — an honest "audited, confirmed healthy"
    outcome is the correct deliverable when that's what the evidence shows, not a
    manufactured finding to have something to fix. `workbench.ts` itself still has no test
    coverage (confirmed: no `workbench.spec.ts` exists, unlike several of its sibling
    stores) — flagged as a real, separate gap, not attempted here given the store's deep
    infra coupling (FilesStore/PreviewsStore/EditorStore/WebContainer) would need real
    investigation into testability before writing tests blind, which this round's time
    didn't warrant opening.

## 2026-08-15 additions, continued (product-integration mandate, Phase 9)

- **Ran the one static-analysis technique that could meaningfully check for more
  "unstyled on one platform" bugs (the `BuildActivityFeed` bug class from Phase 5) without
  a browser: extracted all 77 top-level selectors from `android.css` and cross-referenced
  every one against every component outside `app/components/mobile/`.** Result: no new
  instances — every non-`.android-*`-prefixed class (`.chat-history-*`, `.setup-guide-*`,
  `.mobile-bottom-nav`) is used exclusively by components that only ever render inside
  `AndroidShell` (where `android.css` genuinely is loaded), which is correct, not a bug.
  `BuildActivityFeed` was the only real instance of this bug class.
- **The rest of Phase 9's own scope (typography, spacing, hierarchy, card/button/input
  consistency, empty/error/loading/success states, navigation feel across
  mobile/desktop/tablet) is not something static analysis can honestly assess** — these
  are visual/interaction judgments, and this container still has no headless browser
  available (confirmed again this round, same as every prior round's finding). Per the
  mandate's own instruction ("wenn Browser technisch nicht verfügbar: nicht behaupten,
  dass visuell getestet wurde"), not claiming any of that work happened. Deferred to
  Phase 16 (or whenever a browser becomes available), not attempted blind here.
- **A broader hardcoded-hex-color surface was found while checking for the CSS-class bug
  (~19+ files, concentrated in `app/components/@settings/**` plus `ChatBox.tsx`) — routed
  to Phase 11 (design-system/skin-token audit) instead of triaged here**, since each
  instance needs the same "brand color vs. real gap" judgment call the existing "When NOT
  to tokenize" rule requires, and the mandate already reserves exactly this as its own
  later phase. `app/components/@settings/` is the densest cluster and the concrete
  starting point for that phase. No code changes this phase.

## 2026-08-15 additions, continued (product-integration mandate, Phase 10)

- **Global reduced-motion support, not per-component.** 59 files import
  `framer-motion`; before this phase only 3 (`SubagentActivityWidget`,
  `BuildActivityFeed`, `ApprovalRequestWidget` -- all built/fixed in Phases 3-5) had any
  `prefers-reduced-motion` awareness. Rather than retrofit the other ~56 files one by one,
  added a single `<MotionConfig reducedMotion="user">` wrapper at BOTH real app roots:
  `app/root.tsx`'s `App()` (wraps `<Layout><Outlet /></Layout>`, web/desktop) and
  `src/android-main.tsx` (wraps `<MemoryRouter><AndroidShell /></MemoryRouter>`, Android's
  separate entry point). Both were necessary -- Android bypasses `app/root.tsx` entirely
  (mounts `AndroidShell` directly, confirmed by reading `android-main.tsx`), so a wrapper
  in only one root would have left the other platform's ~56 files unmanaged. `MotionConfig
  reducedMotion="user"` (framer-motion v11, confirmed in `package.json`) makes every
  nested `motion.*` component respect the OS-level `prefers-reduced-motion` setting
  automatically, without touching the 3 already-tested widgets' own explicit checks
  (harmless redundancy, not a conflict).
- **Found and fixed a pre-existing lint error while in `android-main.tsx`**: a missing
  blank line before a block comment (`@blitz/lines-around-comment`), confirmed pre-existing
  via `git stash` (present on the unmodified file, not introduced by this phase's edit,
  just unmasked because the file was touched and the stale `.eslintcache` no longer
  covered it). Fixed inline since it was a one-line, zero-risk, same-file change.
- Config-only change (declarative wrapper, no new logic) -- no new tests written; full
  422-test suite re-run to confirm no regression.

## 2026-08-15 additions, continued (product-integration mandate, Phase 11 kickoff + Phase 12)

- **Phase 11 (design-system/skin-token audit)**: the `app/components/@settings/**`
  hardcoded-hex-color sweep flagged by Phase 9 (149 occurrences across 19 files) was
  delegated to a background fork agent, since it's a large, mechanical,
  well-bounded classification task (tokenize vs. leave-as-brand-color vs.
  leave-as-semantic-status) well suited to parallel delegation -- see the fork's own
  commit/report for what it changed. This session's own (non-fork) thread avoided
  touching any file under `app/components/@settings/**` while that fork was in flight, to
  prevent two writers touching the same files.
- **Found a second, more concrete class of design-token bug while scoping Phase 11 (not
  the same as the brand-color/hex-literal anti-pattern Phase 9 flagged): a genuinely dead
  UnoCSS class name.** `uno.config.ts`'s theme only defines the color path
  `colors.bolt.elements.background.depth.{1,2,3,4}` (-> generates classes like
  `bg-bolt-elements-background-depth-2`, resolving to CSS var `--bolt-elements-bg-depth-2`
  from `variables.scss`). There is no sibling `colors.bolt.elements.bg.depth.*` path, so
  any class literally spelled `bg-bolt-elements-bg-depth-N` (a name that looks plausible --
  it matches the *CSS variable's* own name, `--bolt-elements-bg-depth-N` -- but not the
  UnoCSS theme's class-generating path) resolves to nothing: UnoCSS silently emits zero
  CSS for it, so the element gets no background color at all, no error, no visual sign
  other than "this element just isn't styled." Found via `grep -rln
  "bolt-elements-bg-depth-"`: 5 files use it. Two (`ControlPanel.tsx`,
  `DataVisualization.tsx`) are inside `@settings/**` and were left for the Phase 11 fork to
  handle (same file-ownership reasoning as above). Fixed the other three directly this
  round: `app/components/ui/ColorSchemeDialog.tsx` (9 occurrences),
  `app/components/ui/Dialog.tsx` (4 occurrences), `app/components/mobile/RuntimeModeBanner.tsx`
  (1 occurrence) -- all via a scoped `sed` replacing the `bg-`/`text-`/`border-`/
  `scrollbar-thumb-` + `bolt-elements-bg-depth-` prefix combinations with
  `...bolt-elements-background-depth-`, deliberately NOT touching the one legitimate
  `var(--bolt-elements-bg-depth-3)` raw-CSS-var usage in `ColorSchemeDialog.tsx` (that one
  is correct as-is; the bug is specifically in class-name usage, not the CSS var itself).
- **Phase 12 (responsive/Android): found and fixed a real anchored-popover overflow bug.**
  `app/components/chat/WebSearch.client.tsx`'s URL-fetch popover is `absolute left-0`
  anchored off a small icon button that lives inside `ChatBox.tsx`'s composer toolbar row
  (`custom-scrollbar flex ... overflow-x-auto` -- confirmed horizontally-scrollable, so the
  anchor button can end up anywhere along that row on a narrow screen, not just near the
  left edge). The popover's `<input>` had a hardcoded `w-[300px]` with no viewport clamp;
  combined with the "Fetch" button, gaps, and padding, the popover's total footprint
  (~380-420px) exceeds an Android-width viewport (~360-412px, matching the Galaxy A56
  `mobile.scss` is written for) outright, independent of anchor position -- a real,
  reproducible-by-reasoning horizontal-overflow bug. Fixed using the exact viewport-clamp
  idiom already established elsewhere in this codebase (`Workbench.client.tsx`'s
  `w-[min(20rem,calc(100vw-1.5rem))]` pattern): outer popover container is now
  `w-[min(360px,calc(100vw-1.5rem))]`, the input is `min-w-0 flex-1` (fills available space
  instead of forcing 300px), and the button got `shrink-0` so it can't be squeezed below
  its content width. **Honest limitation, not silently overclaimed**: this bounds the
  popover to never exceed the viewport width (fixes the page-level horizontal-overflow
  failure mode, the most damaging one), but does not add anchor-aware collision detection
  -- if the icon is scrolled far enough right in the toolbar, the popover can still render
  partially past the right edge. That would need a Floating-UI-style positioning library,
  which no other popover in this codebase uses either (same architecture limitation is
  shared by every other icon-anchored popover in this toolbar); not attempted as a
  drive-by scope expansion.
- No headless browser was available this round either (same finding as every prior round
  -- see Phase 9's entry); all Phase 12 work this round is static-analysis-plus-reasoning
  about concrete, checkable layout math (viewport widths vs. element widths), not a
  visual-verification claim.
- Full 422-test suite, typecheck, and scoped lint re-run after these changes (see
  `QUALITY_GATES.md` / `current-session.md` for the exact run confirmation).

## 2026-08-15 additions, continued (product-integration mandate, Phase 13)

- **README.md had a real overclaim, not just staleness**: "11 distinct visual languages...
  each affects radius, shadow, blur, border, and motion" (two places) plus a matching
  Roadmap checkbox. Checked against `app/lib/stores/skin.ts`'s own `SKINS` array and its
  header comment: of the 11 total entries, `'veldra'` is an explicit no-op default (no CSS
  override at all -- the comment says so directly) and `'obsidian'` is a dark-palette-only
  variant (confirmed in `variables.scss`: its override block is
  `[data-theme='dark'][data-skin='obsidian']`, palette values only, no radius/shadow/blur
  override, unlike the other 9 which each have their own `--veldra-radius-*` block). So
  only 9 of the 11 are genuinely "structurally distinct visual languages" in the sense the
  README claimed for all of them. Fixed both README callouts and the Roadmap checkbox to
  say "11 selectable skins: 9 structurally distinct ... plus the default look and a
  dark-palette variant" -- precise rather than rounding up, per this mandate's own "no
  marketing claims code doesn't back up" instruction, and consistent with this same
  README's own stated principle one section above it ("Honest status, not aspirational").
- **`project/STATUS.md`, which the README pointed readers to for verification detail, is
  itself stale**: dated 2026-08-12, header cites branch `claude/veldra-integration-freebuff`
  and commit `90522f3` -- a branch that predates the current single active branch
  (`integration/veldra-bedrock-plus-claude-web`) entirely, per this file's own repeated
  "single active branch" framing and CLAUDE.md's explicit note that `docs/ai-state/*` (not
  `project/*`) is the current living-doc set. Rather than rewrite 598 lines of what is a
  legitimate historical record of real past work, repointed the README's reference to
  `docs/ai-state/CURRENT_STATE.md` (the doc this session and its predecessors have actually
  kept current) and left `project/STATUS.md` as-is with a note in the README explaining
  it's historical, not current.
- Docs-only change -- no test/typecheck/lint implications (README.md and DECISIONS.md
  aren't code). Deliberately did not attempt a line-by-line rewrite of every living doc in
  this one slice -- `CURRENT_STATE.md`/`ROADMAP.md`/`QUALITY_GATES.md`/`current-session.md`
  have all been kept current incrementally, per-phase, throughout this mandate already (see
  each phase's own entry above); this slice targeted the one doc (README.md, the
  externally-facing one) that had drifted, plus the one stale cross-reference it made.

## 2026-08-15 additions, continued (product-integration mandate, Phase 11: design-token audit)

- **Scope**: `app/components/@settings/**`, following up on Phase 9's fork finding. A grep
  for `#[0-9a-fA-F]{3,8}` found 149 hardcoded hex-color occurrences across 19 files. 75
  were tokenized to `bg-bolt-elements-*`/`border-bolt-elements-*` design tokens; 74 were
  deliberately left as-is (see breakdown below). Files touched: `core/ControlPanel.tsx`,
  `shared/components/SkinPicker.tsx`, `tabs/data/DataVisualization.tsx`,
  `tabs/event-logs/EventLogsTab.tsx`, `tabs/github/components/GitHubConnection.tsx`,
  `tabs/mcp/McpTab.tsx`, `tabs/netlify/NetlifyTab.tsx`,
  `tabs/netlify/components/NetlifyConnection.tsx`, `tabs/notifications/NotificationsTab.tsx`,
  `tabs/runtime/RuntimeModeTab.tsx`, `tabs/settings/SettingsTab.tsx`,
  `tabs/supabase/SupabaseTab.tsx`, `tabs/vercel/VercelTab.tsx`,
  `tabs/vercel/components/VercelConnection.tsx`.
- **Established token mapping** (matched against already-tokenized sibling files like
  `app/components/chat/SupabaseConnection.tsx`): a recurring "card/panel shell" pattern
  (`bg-[#FAFAFA] dark:bg-[#0A0A0A]` + `border border-[#E5E5E5] dark:border-[#1A1A1A]`, and
  a `bg-white`/depth-1 variant) appeared dozens of times identically across these files --
  mapped to `bg-bolt-elements-background-depth-2` (or `-depth-1` for the white variant) +
  `border-bolt-elements-borderColor`. An input-field pattern
  (`bg-[#F8F8F8] dark:bg-[#1A1A1A]` + `border-[#E5E5E5] dark:border-[#333333]`) matched
  `SupabaseConnection.tsx`'s existing input styling exactly -- same mapping. A
  hover-surface pattern (`hover:bg-gray-50 dark:hover:bg-[#1A1A1A]`) had its dark hex half
  replaced with `dark:hover:bg-bolt-elements-background-depth-3`, matching the existing
  depth-2-resting/depth-3-hover convention already used in `SupabaseConnection.tsx`.
- **Deliberately NOT tokenized (74 remaining), by category**:
  - *Third-party brand colors*: GitLab orange (`#FC6D26`/`#E24329`), Netlify teal
    (`#00AD9F`), Supabase green (`#3ECF8E`) -- consistent with the existing "When NOT to
    tokenize" precedent from an earlier round.
  - *Semantic/status colors*: log-level and notification-category color maps (error=red,
    warning=amber, info=blue, debug=gray, etc.) in `EventLogsTab.tsx`/`NotificationsTab.tsx`
    -- meant to stay recognizable regardless of skin, same reasoning as the existing
    amber/green badge precedent.
  - *A separate document context CSS variables can't reach*: `EventLogsTab.tsx`'s ~30
    `doc.setFillColor()`/`setTextColor()`/`setDrawColor()` calls feeding jsPDF's PDF
    export -- jsPDF has no relationship to the DOM/CSS custom-property system at all,
    structurally identical to the existing `Preview.tsx` device-frame-mockup exemption.
  - *A legitimate SSR-only fallback*: `DataVisualization.tsx`'s `getThemeColor()` already
    resolves real `--bolt-elements-*` CSS variables via `getComputedStyle` at runtime; its
    `#FFFFFF`/`#000000` fallback only fires when `document` is undefined (SSR), where
    `getComputedStyle` cannot run by definition. Already correctly designed, not a bug.
  - *A wholesale parallel non-token styling system, found but out of THIS pass's scope*:
    `core/AvatarDropdown.tsx` (14 occurrences) and `shared/components/TabTile.tsx` (4) use
    Tailwind's `dark:` variant with named grays (`dark:bg-gray-800`, `dark:text-gray-300`,
    etc.) throughout, not just at the isolated hex literals the grep matched -- the same
    pattern appears at smaller scale in `EventLogsTab.tsx`/`NotificationsTab.tsx` (both
    already partially fixed above) and `ControlPanel.tsx`. Converting only the isolated hex
    literals in these two files in isolation would leave them still fundamentally
    non-skin-aware (e.g. `AvatarDropdown.tsx`'s `bg-white dark:bg-[#141414]` sits directly
    beside untouched `border-gray-200/50 dark:border-gray-800/50`), a half-measure with a
    real visual-mismatch risk (a token-driven dark value next to fixed-gray siblings for
    the same visual role). Left fully as-is rather than a partial fix; flagging as a
    genuine follow-up for a dedicated pass (convert `dark:`-gray Tailwind classes to
    `bolt-elements` tokens, not just literal hex values).
  - *Ambiguous, left unguessed*: a "Connect" CTA button (`bg-[#303030] text-white` +
    `hover:bg-[#5E41D0]`) repeats identically across 8 files (`ConnectionForm.tsx`,
    `GitHubAuthDialog.tsx`, `GitHubConnection.tsx`, `NetlifyTab.tsx`,
    `NetlifyConnection.tsx`, `SupabaseTab.tsx`, `VercelTab.tsx`, `VercelConnection.tsx`).
    Neither `--bolt-elements-button-primary-background` (a translucent low-opacity accent
    tint) nor `--bolt-elements-cta-background` (light gray / translucent white) visually
    matches this solid dark button with a saturated purple hover -- forcing either token
    would likely change its appearance materially. Left as-is per this session's "don't
    force a bad guess" rule; worth a deliberate design decision (is this meant to become
    the token-driven primary button, or is it an intentional distinct CTA color?) rather
    than a silent token swap.
- **Dead-class-name bug found and fixed while doing this work** (2 occurrences, both
  inside this pass's scope): `bg-bolt-elements-bg-depth-N`/`scrollbar-thumb-bolt-elements-bg-depth-N`
  silently resolve to zero CSS -- the UnoCSS theme in `uno.config.ts` only generates
  utility classes from the `background.depth.N` path (`bg-bolt-elements-background-depth-N`),
  not `bg.depth` (`bg-depth` matches the underlying `--bolt-elements-bg-depth-N` CSS
  variable's own name, not the generated utility class name -- an easy naming-convention
  trap). Fixed in `DataVisualization.tsx:324` (a pre-existing bug, not introduced this
  round) and `ControlPanel.tsx`'s scrollbar-thumb utility (introduced earlier in this same
  round while fixing the scrollbar hex colors, caught before commit). A parallel session
  working the same branch concurrently found and fixed 3 more occurrences of the identical
  bug outside `@settings/**`.
- Typecheck clean, scoped lint clean (0 errors after one prettier auto-fix for
  line-wrap-length changes from the shorter token names), full suite still 422/422 passing
  -- see `QUALITY_GATES.md`.

## 2026-08-15: shared-index race incident, resolved

A Phase 11 fork agent and the main session both ran `git add`/`git commit` against the
same working tree/index concurrently (no worktree isolation). Result: one commit (`1547499`)
landed with a misleading message ("docs: fix skin-count...") but actually containing the
fork's 13 `@settings/**` token fixes instead -- the fork's own `git reset`+`add` cycle
unstaged the main session's pending README.md change at the exact moment the main session
ran `git commit`. The fork was then resumed to reconcile, hit an API session limit mid
git-recovery, and in the process reverted README.md's working-tree edits (no history
was rewritten -- `git reflog` confirms a clean linear commit sequence, nothing force-pushed
or reset). Recovered by re-applying the 3 README edits from source and committing them
separately and correctly (`4de1155`). **Going forward: only the main session runs
`git add`/`commit`/`push` on this branch; subagents analyze/implement but never touch the
index** -- per the user's explicit instruction in the productization-block mandate.
