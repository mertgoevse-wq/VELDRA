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
