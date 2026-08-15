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

## Phase 2+ — not started yet
See the TaskList in this session for the full 17-phase breakdown (event observability,
approval flow UI, agent activity timeline, unified chat/workbench experience, composer
audit, template unification, workbench state-truth audit, UX/motion/design-system passes,
Android pass, docs refresh, security review, and a final APK block deliberately deferred
until the core product blocks are done).

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
static output Capacitor ships, and a headless Chromium (Playwright, pre-installed in
this environment at `/opt/pw-browsers`) can screenshot/click it at a Pixel 7 viewport.
Use this before claiming any Android UI change is fixed — two of that session's bugs
were invisible from source code alone.
