# VELDRA Session Checkpoint — 2026-08-17 (current)

Supersedes the 2026-08-15 checkpoint below (kept for context, that mandate is done). This
round's full detail lives in `docs/ai-state/CURRENT_STATE.md`'s top entry (dated
2026-08-17) — this section is a short pointer, not a duplicate.

**What happened**: continuation of the standing autonomous VELDRA mandate. Ten commits,
`7ddffe6` → final HEAD `5245a6b`. Highlights: fixed 6 real Live Preview bugs and 3
Terminal/remote-runtime bugs (all found by a 7-agent parallel discovery audit that cited
file:line evidence before any code was touched); fixed the actual Android app icon/splash
(was a literal lightning-bolt shape mislabeled `veldra_*`, never redrawn) plus several
leftover "bolt-" branded user-visible strings; built a real pixel-morph text-dissolve
animation engine and wired it into the home greeting; switched `crypto.ts` from AES-CBC to
AES-GCM; compared Supabase/Cloudflare/Firebase and wrote (but did not deploy) a real
entitlement backend contract on Supabase; root-caused and fixed the Android build OOM with
real measurements, not guesses; **produced and verified a genuine current-HEAD debug APK**
(`5e82078f...`, see CURRENT_STATE.md for the full record) — the stale `a0489b6` artifact
from an earlier round must not be cited as representing current HEAD anymore.

**State to pick up from**: 576/576 tests, typecheck/lint clean. No `adb`/physical-device
verification and no browser/screenshot visual verification were possible this session
(neither tool was available) — both remain genuinely open, not done. See CURRENT_STATE.md's
"Explicitly, honestly, NOT done this round" for the precise list.

---

# VELDRA Session Checkpoint — 2026-08-15 (product integration mandate, in progress)

Read this section first. This supersedes the "recovery round" checkpoint below it (kept
for context) — the recovery is done (fb2be44) and a large, explicit 17-phase product
integration mandate is now underway, tracked via TaskCreate/TaskUpdate in-session. Update
this section at each phase boundary rather than appending a new top section every time,
since phases build on each other within one continuous mandate.

## Phase 1 — Orchestrator end-to-end (done)
Proved the real orchestrator runtime (built in the recovery round) actually works
end-to-end through every VELDRA-authored layer, not just in isolated unit tests — see
`app/lib/orchestrator/orchestrator-e2e.spec.ts` and `DECISIONS.md`'s "Phase 1" entry for
the full detail, including a real dormant contract bug (`apiKeys`/`providerSettings`
silently dropped on fallback) the deep test surfaced and fixed. Documented the flag in
`.env.example` with a concrete dev/staging recommendation rather than silently changing
any default-enablement behavior. 397/397 tests, typecheck clean.

## Phase 2 — Real event observability in UI (done)
Wired `runWorkflow()`'s real `run.*`/`approval.*` events (emitted whenever the
orchestrator path actually runs, still gated behind `VELDRA_USE_ORCHESTRATOR`) into the
same `recentAgentActivityStore` `SubagentActivityWidget` already reads, instead of being
captured internally and discarded. Did NOT attempt `tool.*`/`file.*`/`verification.*` --
those event types have no real emit call site anywhere in the codebase yet (confirmed by
reading every `emitter.emit`/`emit(...)` call site in `run-workflow.ts`); building UI for
them would be exactly the "fake progress" the mandate explicitly forbids. That gap needs
real instrumentation first (an `onStepFinish` hook in `subagentService.ts`), not attempted
here -- same restraint Block B already documented for the same reason.

Writing a rigorous end-to-end test (asserting exact event *counts*, not just presence, in
`orchestrator-e2e.spec.ts`) caught a real design bug before it shipped: the orchestrator's
own `Task.id` (a UUID) and `SubagentService`'s generated task id (`subagent-<ts>-<rand>`,
what `subagentsStore`/the widget actually key on) are different id spaces. The first
version of this change tagged forwarded events with the wrong one -- they would have been
silently invisible in the real UI, which is worse than not building the feature at all
(looks wired up, never renders). Fixed by buffering events and re-tagging with the real
resolved id once known (from evidence, after `runWorkflow()` returns) — see
`DECISIONS.md`'s "Phase 2" entry for the full detail. 397/397 tests, typecheck clean, lint
clean.

## Phase 3 — Real approval flow end-to-end (done)
`ApprovalRequestWidget.tsx` (mounted in `Messages.client.tsx`, above `SubagentActivityWidget`)
is a real, tested round-trip against the already-real `ApprovalPort` -- subscribes to
`pendingApprovalsStore`, renders kind/question/context with progressive disclosure, calls
`getVeldraHost().approvals.respond()` on click. Honest scope note carried into
`DECISIONS.md`: no live call site can currently trigger a real approval request --
Phase 1's own preflight budget check makes the only requestable kind
(`'budget-exceeded'`) provably unreachable from today's single-task spawn shape. Built
anyway, deliberately, since the gap here is "no caller yet," not "the mechanism is fake."

Side effect worth flagging on its own: fixed a real, pre-existing test-infrastructure gap
while writing this phase's component test -- `vite.config.ts` used `remixVitePlugin()`
even under Vitest, and no test in this codebase had ever successfully imported a real
`.tsx` component before (confirmed by checking every existing jsdom-environment test file
existing beforehand). Fixed by swapping to plain `@vitejs/plugin-react` in test mode,
extending the exact conditional pattern already used one line above for
`remixCloudflareDevProxy()`. Verified the production plugin path is unaffected (code
inspection + a `vite build --mode production` attempt that got past all plugin resolution
before hitting the pre-existing, already-documented Miniflare/tcmalloc OOM this container
is known to hit). This unblocks real component testing for the several UI-heavy phases
still ahead (4-6, 8-12) -- see `QUALITY_GATES.md` for the reference pattern.
397→400 tests, typecheck clean, lint clean.

## Phase 4 — Agent activity experience (SubagentActivityWidget upgrade) (done)
The mandate's own example list for this phase (Planning/Tool/File/Execution/
Verification/Waiting states) has no real data source for any of them -- confirmed by
re-checking (not just recalling) that task decomposition/planning, tool.*/file.*/
verification.* events, and a queued/pending SubagentTask status all still don't exist
anywhere in the codebase. Declined to fabricate any of them, same restraint as Phase 2.
Scoped to what's real: `usePrefersReducedMotion` (new hook, reactive to live OS changes,
guards against `matchMedia` being unavailable) wired into both `SubagentActivityWidget`
and `ApprovalRequestWidget`'s framer-motion transitions; and `SubagentActivityWidget.spec.tsx`,
the first real component test for this widget, which exercises the widget's own
`startSubagentActivityBridge()` against a genuine `subagentsStore` status transition
(not a manually-seeded event) end to end.

Three real test-authoring bugs found and fixed while writing these tests (full detail in
`DECISIONS.md`'s Phase 4 entry, worth reading before writing more component tests): the
`~/lib/hooks` barrel export crashes under Vitest via an unrelated hook's transitive
`import.meta.hot` access (import the specific hook file instead); `matchMedia` mocks need
both the modern and legacy MediaQueryList method pairs (framer-motion's own internal
reduced-motion detection uses the legacy one); and `nanostore.listen()` only fires for
changes made *after* subscribing, so a test must render the bridge-starting widget before
seeding store state, not after.

408 tests (was 400), typecheck clean, lint clean.

## Phase 5 — Unified chat/orchestrator/artifact/workbench experience (done)
Investigated "true interleaving" of tool calls within assistant message text -- the exact
fix `daeabc6` deliberately deferred -- and preserved that deferral with concrete evidence:
`Markdown.tsx`'s artifact rendering depends on the *full* `content` string (VELDRA's own
`<boltArtifact>` tag parser output), which doesn't align with the AI SDK's `parts`
chunking boundaries. Splitting `content` per-part risks breaking artifact rendering, the
single most business-critical path in the app. Confirmed real, not just cautious --
`AssistantMessage.tsx` left unchanged.

Found a real, higher-value "disconnected UI" bug instead: `BuildActivityFeed` (renders on
every AI streaming response) had zero styling on web/desktop -- its CSS classes were
defined only in `android.css`, which only `src/android-main.tsx` imports. Rewrote it with
the same tokenized Tailwind pattern as `SubagentActivityWidget`/`ApprovalRequestWidget`,
which both fixes the missing styling and genuinely unifies the visual language across all
three activity indicators now visible in chat -- concretely what "not several disconnected
UI systems" means. Dropped a 14-hue hardcoded-color rainbow in favor of a tokenized
status-based color, keeping per-phase icons as the (skin-safe) differentiator. Removed the
now-orphaned CSS from `android.css`. Added `BuildActivityFeed.spec.tsx`, the component's
first real test. Full detail in `DECISIONS.md`'s Phase 5 entry.

413 tests (was 408), typecheck clean, lint clean.

## Phase 6 — Composer as real control surface (done)
Audited every composer control against the mandate's own bar ("works, or deliberately
disabled with an explanation — no dead buttons"). Most were already real (send/stop,
provider/model, attachments/drag-drop, MCP tools dialog, web search, discuss/settings
toggles); "skills"/"agents" have no dedicated composer button by design (both are MCP tool
calls the LLM makes, not UI controls) rather than a gap.

Found and fixed two real bugs:
1. "Enhance prompt" showed a success toast unconditionally and immediately on click,
   before the actual async/streamed enhancement had even started -- and the one real
   completion signal (`promptEnhanced`) was tracked in state but never actually read
   anywhere (`// promptEnhanced,` sat commented out in `BaseChat.tsx`). The underlying
   `fetch()` also had no error handling at all. Moved the whole operation into one
   try/catch in `usePromptEnhancer.ts` with real success/error toasts tied to actual
   outcome; removed the blind toast from `ChatBox.tsx`. New `usePromptEnhancer.spec.ts`
   (4 tests, first for this hook).
2. The speech-recognition mic button stayed enabled on browsers without the Web Speech
   API -- `startListening()` already correctly no-oped, but nothing disabled the button
   itself, so it was a literal dead button with zero feedback on unsupported
   browsers/WebViews. Threaded a real `speechRecognitionSupported` prop through and added
   an honest disabled-state tooltip explaining why.

Full detail in `DECISIONS.md`'s Phase 6 entry. 417 tests (was 413), typecheck clean, lint
clean.

## Phase 7 — Unified template/project system (done)
Continued the crashed session's own c998f16 template-unification round rather than
re-auditing the same ground -- that round already confirmed `/git` is legitimately
different domain logic (not a duplicate) and extracted the one real duplication
(`buildFileSeedArtifactMessage()`, fixing a real escaping gap in the process). The
remaining known gap (`/git` navigating to a whole new chat instead of seeding into the
current one) is still explicitly out of scope -- a deliberate, separate, larger change,
not reopened by this round's own narrower scope.

Found instead that `getTemplates()` -- the actual mechanism behind "pick a template, get a
real project" -- had zero test coverage, along with every other template-system file.
Added `selectStarterTemplate.spec.ts` (5 tests) covering `.git`/`.bolt` file exclusion, a
`.bolt/prompt` file's instructions reaching the LLM, and a real, easy-to-get-backwards
distinction in `.bolt/ignore` handling: a read-only file is still *included* in the seeded
artifact content (the LLM needs the real content to import/reference it), just flagged
read-only in the accompanying instructions -- not silently dropped. First real regression
guard for this pipeline. Also recorded a test-authoring lesson in `DECISIONS.md`: an early
version used unnecessary `vi.resetModules()` + dynamic imports per test, which forced a
full module-graph reimport every time and timed one test out; a plain top-level import
(since `vi.mock` is already hoisted and file-scoped) was both correct and ~400x faster.

422 tests (was 417), typecheck clean, lint clean.

## Phase 8 — Workbench truth-of-state pass (done, audit-only)
Audited `workbenchStore` and its neighbors for duplicate/competing state-truth, beyond the
one instance a prior round already fixed (`AndroidShell.tsx`'s `activeTab`/`showWorkbench`
desync). Checked, via direct code reading, not re-derivation: `showWorkbench`/`currentView`
(single atoms, no shadow `useState` anywhere), `selectedFile` (encapsulated in a private
`#editorStore`), `unsavedFiles` (single canonical atom), `Preview.tsx`'s file sourcing
(reads `workbenchStore.files` directly, no independent snapshot), and `runtime-status.ts`
vs `runtime-mode.ts` (a pure read-only query over the latter's real state, not two
competing stores). Found the architecture sound — no new bugs, no code changes this phase.
An honest "audited, confirmed healthy" is the correct outcome when that's what the
evidence shows, same principle as declining to fabricate activity states in Phase 2/4.

Flagged one real, separate gap for a future round rather than attempting it blind:
`workbench.ts` itself has no test coverage at all (confirmed: no `workbench.spec.ts`,
unlike several sibling stores) — its deep infra coupling
(FilesStore/PreviewsStore/EditorStore/WebContainer) needs real testability investigation
before writing tests for it, which this round didn't have scope for. Full detail in
`DECISIONS.md`'s Phase 8 entry.

## Phase 9 — Product-quality UX/design pass (done, audit-only, no browser)
Ran the one static-analysis technique that could meaningfully re-check for more
`BuildActivityFeed`-style "unstyled on one platform" bugs (all 77 `android.css` selectors
cross-referenced against every non-mobile component) -- found no new instances; that
component was the only real one. The rest of Phase 9's own scope (typography, spacing,
hierarchy, empty/error/loading/success states, cross-device navigation feel) is a visual
judgment call static analysis can't honestly make, and this container still has no
headless browser (confirmed again). Not claiming that work happened -- deferred to Phase
16 or whenever a browser is available, per the mandate's own "don't claim visual
verification that didn't happen" instruction. Routed a broader hardcoded-hex-color finding
(~19+ files, concentrated in `app/components/@settings/**`) to Phase 11, where it actually
belongs. No code changes this phase. Full detail in `DECISIONS.md`'s Phase 9 entry.

## Phase 10 — Motion system pass (done)
59 files import framer-motion; only 3 (Phases 3-5's widgets) had any
`prefers-reduced-motion` awareness. Added one `<MotionConfig reducedMotion="user">`
wrapper at each real app root instead of retrofitting ~56 files individually:
`app/root.tsx`'s `App()` (web/desktop) and `src/android-main.tsx` (Android's separate
entry point, which bypasses `app/root.tsx` entirely). Both needed -- confirmed via reading
`android-main.tsx` that it mounts `AndroidShell` directly. Also fixed a pre-existing
`@blitz/lines-around-comment` lint error in `android-main.tsx`, confirmed pre-existing via
`git stash`. Full detail in `DECISIONS.md`'s Phase 10 entry. 422/422 tests still passing
(config-only change, no new tests needed).

## Phase 11 — Design system/skin token audit (in progress, split: fork + main thread)
The `@settings/**` hardcoded-hex sweep (149 occurrences/19 files, flagged by Phase 9)
was handed to a background fork agent as a large, mechanical, well-bounded task. This
session's own thread stayed out of `@settings/**` while the fork works, and instead found
and fixed a *different*, more concrete design-token bug while scoping the work: a dead
UnoCSS class name, `bg-bolt-elements-bg-depth-N` (looks plausible -- matches the CSS
variable's own name -- but the UnoCSS theme only generates classes from the
`background.depth` path, not a `bg.depth` path, so this class resolves to zero CSS,
silently). Fixed the 3 occurrences outside `@settings/**`
(`ColorSchemeDialog.tsx`, `Dialog.tsx`, `RuntimeModeBanner.tsx`); left the 2 occurrences
inside `@settings/**` (`ControlPanel.tsx`, `DataVisualization.tsx`) for the fork to pick up
so there's exactly one writer per file. Full detail in `DECISIONS.md`.

## Phase 12 — Responsive + Android first-class pass (done, this round's scope)
Found and fixed a real anchored-popover viewport-overflow bug:
`WebSearch.client.tsx`'s URL-fetch popover sits in a horizontally-scrollable composer
toolbar row and had a hardcoded `w-[300px]` input with no viewport clamp -- its total
footprint (~380-420px) exceeds an Android-width viewport (~360-412px) regardless of anchor
position. Fixed with the same `w-[min(Npx,calc(100vw-Nrem))]` clamp idiom already
established in `Workbench.client.tsx`. Swept the rest of the codebase's `absolute
left-0`/`right-0` anchored popovers outside `@settings/**` (`PortDropdown.tsx`,
`TabsWithSlider.tsx`, `Preview.tsx`, `Workbench.client.tsx`) -- no other instances found
(all either already viewport-clamped or use `min-w` rather than a fixed `w`, which is
safe). No headless browser available this round either (consistent with every prior
round); this phase's verification is layout-math reasoning against concrete viewport/
element widths, not a visual-verification claim. Full detail in `DECISIONS.md`.

## Phase 13+ — not started yet
See the TaskList in this session for the remaining phases (docs refresh, security review,
testing gate, visual verification if a browser becomes available, and a final APK block
deliberately deferred until the core product blocks are done).

---

# VELDRA Session Checkpoint — 2026-08-15 (core product + runtime foundation, recovery round)

Read this section first; everything below it is prior-session history, kept for context.

## Latest commit / branch
Branch `integration/veldra-bedrock-plus-claude-web` (single active branch, work directly
on it). See git log for the exact commit — this file isn't the place to hardcode a hash
that goes stale the moment another commit lands.

## Session recovery note
The prior session crashed partway through a "core product + runtime foundation" mandate,
after landing 4 commits (real orchestrator runtime, agent-activity event bridge, a chat
tool-invocation visual connector, and a template file-seed-artifact unification) without
writing any docs/ai-state update for them — this file's "product evolution pass" section
below predates all four. Recovered entirely from `git log`/commit messages, not from
docs, per this project's own stated practice of trusting git over stale docs. Continued
the same mandate rather than re-auditing or starting new work; see CLAUDE.md's
"Orchestrator Migration Strategy" Phase 2 and `DECISIONS.md`'s "core product + runtime
foundation, later round" entry for the full detail of both the recovered work and what
was added this round.

## What changed this round (2026-08-15, after the crash)
Wired the one call site that can actually reach the orchestrator from a live request —
`spawnSubagentWithOrchestrator()` (`app/lib/orchestrator/integration.ts`) — through the
real `runWorkflow()` state-machine driver the crashed session had built but nothing yet
invoked, instead of calling `host.agents.run()` directly. Still gated behind
`VELDRA_USE_ORCHESTRATOR` (off by default) — this is still foundation work, not a
migration. Found and fixed a real bug while doing this: FREE tier's `maxCostMinor: 0`
would have made the very first budget check inside `runWorkflow()` request an approval
that nothing can currently answer (no approval UI exists yet), hanging the call forever.
Added a preflight `checkBudget()` call in `integration.ts` that falls back to legacy
immediately when a tier can't afford one iteration, same as an existing policy denial.
Rewrote `integration.spec.ts`'s orchestrator-enabled tests for the new real-runWorkflow
contract (including one asserting the deadlock guard specifically). 395/395 tests,
typecheck clean, lint clean on changed files (pre-existing whole-repo lint drift on
generated/config files is unrelated — see `QUALITY_GATES.md`). No UI work this round —
still nothing for a UI to render correctly yet (no `ApprovalPort.respond()` caller
exists), consistent with the mandate's "don't build UI on stubs, and don't build it
before something can actually answer it" stance carried over from the prior round.

## What changed in the prior (crashed) session, recovered from git log
Real orchestrator runtime replacing the `ApprovalPort`/`PolicyGate`/`RunStore` stubs
(`events.ts`, `run-workflow.ts`, `veldra-approvals.ts`, `veldra-policy.ts`) — the
`WorkflowRun` state machine and typed event model didn't exist before this; agent-activity
event bridge (`subagent-activity-bridge.ts`, mounted in `SubagentActivityWidget`) so real
subagent state flows into the new event model even though nothing calls `runWorkflow()`
for the legacy path; a visual connector between an assistant response and the tool
invocation that produced it (`AssistantMessage.tsx`); a shared
`buildFileSeedArtifactMessage()` used by both Android's template pipeline and desktop's
`/git`-route import, which surfaced and fixed a real unescaped-`<boltArtifact>`-tag
injection gap in the latter. Full detail in `git log` (commits `57f9029`, `b9e7a03`,
`daeabc6`, `c998f16`) and `DECISIONS.md`.

## What changed in the "product evolution pass" (earlier 2026-08-15 round, unchanged)
1. **Deterministic starter-code seeding for Android templates** — "Code Workspace" and
   "Project Overview" now trigger the same `getTemplates()` GitHub-backed file-seeding
   pipeline desktop's auto-select-on-first-message already used, but deterministically
   (no LLM guess) via a new `applyStarterTemplate` prop threaded through
   `Chat.client.tsx` -> `BaseChat.tsx` -> `TemplatePicker`. The other 6 Android
   templates are workspace-layout/mode presets by design (not code scaffolds) and
   correctly do NOT get this.
2. **Fixed a real state-truth bug**: `AndroidShell.tsx`'s `activeTab` and
   `workbenchStore.showWorkbench` could disagree about what's on screen when the
   Workbench opened from an artifact-link click or AI file-streaming rather than a tab
   switch. Added the missing reverse sync.
3. **Unified `UserMessage.tsx`** — was two structurally different layouts depending on
   whether the AI SDK gave it string vs. array content (different alignment, avatar
   presence, image ordering). Also dropped a leftover `@ts-nocheck` from this file's
   upstream bolt.diy-tutorial origin; typechecks clean without it.
4. **Continued the hardcoded-hex-to-design-token cleanup** across `Preview.tsx`,
   `Workbench.client.tsx`, `ToolInvocations.tsx`, `SupabaseConnection.tsx` — while
   explicitly leaving semantic/status colors, Supabase's actual brand green, and
   `Preview.tsx`'s device-mockup colors (rendered in a separate document context)
   untouched. See `DECISIONS.md` "When NOT to tokenize" for the rule.
5. **Investigated, deliberately deferred** (see `DECISIONS.md` for the full reasoning):
   orchestrator approval/policy UI (no backend event stream exists yet — would be
   showing the user data the runtime doesn't back up), and unifying desktop's
   `StarterTemplates`/`/git`-route starter-import path with the pipeline in (1) above.

## What was NOT possible this session
No headless browser was available in this container to visually verify any of the above
(a fresh `npx playwright install chromium` timed out after 90s). Verification was
typecheck + lint + build + direct code/call-site reading only. Flagging this honestly
rather than claiming visual confirmation that didn't happen — see CURRENT_STATE.md block 4.

---

# VELDRA Session Checkpoint — 2026-08-14 (End of Session)

## Latest Commit

```
287587b feat(entitlement): add client-side entitlement store for UI capability checks
```

## APK

```
android/app/build/outputs/apk/debug/app-debug.apk (22 MB)
Contains: SetupGuide, BuildActivityFeed, template layout wiring, 
          auto-preview, skin system, connection banner, all session work
```

## Environment

- Platform: ARM64 proot-Debian (Termux)
- Node: 22.23.2
- Java: OpenJDK 21.0.12
- Android SDK: /opt/android-sdk (android-35, build-tools;34.0.0)
- AAPT2: qemu-x86_64-static wrapper at /opt/aapt2-wrapper/aapt2
- ADB: not available

## Build Commands (working)

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-arm64
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
NODE_OPTIONS='--max-old-space-size=4096' npx vite build --config vite.android.config.ts
./node_modules/.bin/cap sync android
cd android && ./gradlew assembleDebug --no-daemon
```

## Completed This Session

### P1: Template System → Workspace Layout ✅
- `app/lib/stores/template.ts` — activeTemplateStore, applyTemplate(), clearTemplate()
- `app/lib/stores/workspaceLayout.ts` — computed layout from template panels, panelToTab()
- AndroidShell: switches tab when template applied, shows dismissable badge
- BaseChat: calls applyTemplate() on template select
- Templates with editors/terminal/preview route to correct tab

### P1: Skin System Completion ✅
- 226 lines of per-skin tokens added to variables.scss
- Per-skin: typography (font-size, weight, letter-spacing), component geometry (btn, input, card, nav), depth, motion
- All 11 skins have distinctive visual identity
- New root tokens: --veldra-surface-bg-hover, --veldra-border-color, --veldra-accent, --veldra-accent-subtle

### P1: Live Preview Pipeline ✅
- Preview.tsx: auto-starts static blob-URL preview on Android when index.html exists
- AndroidShell: auto-navigates to Preview tab 1.2s after AI writes index.html
- Preview empty state on Android: friendly "No Preview Yet" + "Go to Chat" CTA

### P1: Build Activity Feed ✅
- `app/lib/stores/buildActivity.ts` — activity event store with phases
- `app/components/chat/BuildActivityFeed.tsx` — collapsible activity log with icons, elapsed time
- `app/lib/hooks/useBuildActivity.ts` — emits Planning → Generating on stream start/end
- ActionRunner: emits Writing/Running/Building/Previewing per action type
- Displayed in Messages.client.tsx above streaming indicator

### P1: First-Run Experience ✅
- SetupGuide card on welcome screen when no backend configured
- Guides user to Settings with 3-step instructions (run backend, enter URL, start building)

### P3: Branding ✅
- bolt-diy → veldra in Netlify/Vercel deploy routes
- mobile.scss comment updated

### Architecture ✅
- `app/lib/stores/entitlement.ts` — UI capability checks (client-side only, server enforces)
- Entitlement system: FREE/PREMIUM/PRO/DEVELOPER tiers, capability registry

## Quality Gates

| Gate | Status |
|------|--------|
| TypeScript (tsc --noEmit) | 0 errors |
| ESLint | 0 errors, 2 pre-existing warnings |
| Vite Android build | ✅ built in ~2m |
| Capacitor sync | ✅ |
| Gradle assembleDebug | ✅ BUILD SUCCESSFUL |
| APK exists | ✅ 22 MB |
| SetupGuide in APK | ✅ verified |
| BuildActivityFeed in APK | ✅ verified |

## Bundle Chunks (current)
| Chunk | Size | Notes |
|-------|------|-------|
| vendor-shiki | 9,329KB | Lazy-loaded with workbench |
| app-workbench | 1,578KB | Lazy |
| Chat.client | 1,483KB | Main lazy chunk |
| vendor-codemirror | 764KB | Lazy w/ workbench |
| vendor-markdown | 403KB | |
| vendor-ui (framer+radix) | 379KB | |
| android-index CSS | 378KB | Includes all skin tokens |

## User Flow (now functional end-to-end)

1. Opens VELDRA → inline splash screen (immediate)
2. Welcome screen + SetupGuide (if no backend)
3. Configures backend URL in Settings
4. Connection banner disappears on success
5. Types request → BuildActivityFeed shows "Planning → Generating"
6. AI writes files → "Writing X.tsx" activity events
7. index.html written → auto-navigate to Preview tab after 1.2s
8. Static preview auto-starts in WebView
9. User returns to Chat to iterate

## Remaining Work (prioritized)

### P1 — Still Outstanding
1. Orchestrator Phase 2: wire ApprovalPort to UI confirmation dialogs
2. Remote Runtime connectivity testing from Android
3. Model selector more accessible on Android (currently only in collapsed ChatBox)
4. BuildActivityFeed: more granular events (e.g. "Analyzing requirements" before generating)

### P2 — Architecture
5. Amazon Bedrock provider integration via backend proxy (architecture docs)
6. Local model provider abstraction (design only, no implementation yet)
7. Media/creative pipeline architecture (image gen, audio gen stubs)
8. Server-side entitlement enforcement hooks

### P3 — Polish
9. Remove remaining `@ts-nocheck` from BaseChat.tsx (requires type fixes)
10. Add error recovery UI for failed file writes
11. Skin token application to more specific components (Tag, Badge, Chip)

---

# Android Recovery Session Handoff (claude/veldra-android-recovery-85j8ws)

Read this first, then CURRENT_STATE.md / ANDROID_STATE.md / ROADMAP.md / DECISIONS.md
for detail. This section is a pointer, not a duplicate — keep it short.

This branch's work has since been cherry-picked onto `integration/veldra-bedrock-plus-claude-web`
(commits `79b45b9`, `784d7d2`, and the current HEAD) — the checkpoint above is this integration
branch's own latest state; the notes below are carried forward from the recovery branch for context.

## Where things stood
Three blocks of Android recovery work (see git log for exact commits):
1. Fixed the fallback-banner/workbench-toolbar overlap (the original bug screenshot's
   most visible symptom).
2. Live preview reactivity + multi-file resolution, Android touch/layering audit fixes,
   partial skin-token wiring, this ai-state/ system.
3. **Found and fixed two pre-existing, more severe bugs** via that session's first-ever
   real screenshot verification (headless Chromium against the actual production
   Android build): an app-crashing chunk-splitting bug, and the Workbench panel
   rendering full-screen on top of every tab regardless of state. See CURRENT_STATE.md
   for full detail — this second bug is almost certainly the real explanation for the
   original screenshot's "editor area dominates the screen" complaint.

## What's next (highest value, not yet started)
- Real device / APK build+install — blocked on Android SDK in this environment.
- `AndroidSettingsPanel.tsx`/`GitHubSyncPanel.tsx` hardcoded-color cleanup (skin tokens).
- Service-Worker-backed virtual-FS preview (real live dev-server-less multi-file preview,
  beyond the current blob-URL resolver).
- Template system: verify template selection actually changes workspace composition.

## How to verify without a device
See "How to screenshot-verify" in CURRENT_STATE.md — `vite preview` serves the exact
static output Capacitor ships, and a headless Chromium can screenshot/click it at a
Pixel 7 viewport. Use this before claiming any Android UI change is fixed — several of
this repo's most serious bugs were invisible from source code alone.

**Correction (2026-08-16)**: `/opt/pw-browsers` does not exist in this container and
never did during this session -- that claim went stale at some point and misled every
attempt to reuse it until 2026-08-16 finally worked around it directly. What actually
works in this environment: a cached Chromium binary lives at
`/root/.cache/ms-playwright/chromium-1234/chrome-linux/chrome` (downloaded by an earlier
`npx playwright` invocation that itself timed out on the *npm package* fetch, but left
the browser binary behind), and a cached `playwright-core` npm package exists at
`/root/.npm/_npx/<hash>/node_modules/playwright-core` from that same prior invocation --
`node -e "require('.../playwright-core').chromium.launch(...)"` works directly without
needing `npx playwright` to resolve at all. The binary also needs
`playwright install-deps chromium` run once (installs `libatk-1.0.so.0` and its X11/font/
GTK dependency chain via apt) before it will actually launch -- confirmed working,
2026-08-16, first successful real Android build+screenshot verification this session.

## 2026-08-16 block -- Core Creation Loop, Live Runtime bridge, real visual verification

Continuation of the product-integration mandate from `a24ffd7`. Full detail in
`DECISIONS.md`'s 2026-08-16 entries; summary:
- Fixed a real, exploitable attribute-breakout tag-injection vulnerability in the shared
  template-seeding builder (`3450ea8`).
- Fixed the Android production build, which had been completely broken (permanent splash
  screen) since some point after this doc's own last screenshot-verified block -- 4 real
  crashes chased through mcp-stdio's Node-only import and 3 distinct chunk-splitting
  circular-reference bugs (`e08e61e`, `0daefef`).
- First real headless-Chromium screenshots this session (see correction above) --
  Chat/Settings/Files/Preview all confirmed rendering correctly; screenshots committed to
  `docs/images/android-2026-08-16/` and referenced in README.
- Bridged agent-issued 'build'/'start' actions to Remote Runtime via the existing safe
  command-profile API (`6a02e3d`) -- a real, previously-self-documented Core Creation Loop
  gap (agent could chat but never actually build/run anything on Remote Runtime).
  Deliberately did NOT bridge raw 'shell' actions -- would mean executing unvalidated
  LLM-generated text on a real remote server.
- Redacted secret-shaped substrings from `tool.failed` event error text as defense-in-depth
  (`3f98a0e`) -- follow-up to an earlier security review's low-severity finding.
- Corrected stale README APK/build-status claims (`91a080e`) -- the web bundle build is
  now genuinely verified; the native Gradle/Capacitor APK build is not (no Android SDK in
  this environment).
- 422 -> 459 tests across this block; typecheck/lint clean throughout.
