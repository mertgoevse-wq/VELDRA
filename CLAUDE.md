# CLAUDE.md

Durable working guidance for Claude Code (or any AI agent) in the
`mertgoevse-wq/VELDRA` repository. Everything below is derived from this
repo's actual code, its `project/` documentation, and the product owner's
stated goals — not reconstructed from any third-party system prompt. Treat
this file as the default operating basis for VELDRA work, not a rigid
cage: if the existing architecture or a verified fact points at a better
approach than something written here, take that approach and record the
deviation (in a commit message, `STATUS.md`, or this file) rather than
following the letter of this document past the point it stops making
sense.

## 0. Read this first, every session

Before changing anything, read in this order: `project/STATUS.md`,
`project/SESSION-HANDOFF.md`, `project/ROADMAP.md`, `project/DECISIONS.md`,
`project/RISKS.md`, then verify the real git state yourself (`git status`,
`git log`, `origin/main` / the active PR). These docs have tracked the
real repo state accurately across 22+ documented loops — trust them, but
verify against actual code before building on a claim, especially an
architectural one.

---

## 1. VELDRA product mission

VELDRA is an independent AI development/creation studio: a chat-driven
"vibecoding" environment that takes an idea from description through a
working, previewable, deployable project. The intended full surface —
some shipped, most still contract-only or not started (see `ROADMAP.md`'s
capability matrix, and the honest gap lists in every `STATUS.md` loop
entry) — is: chatbot conversation, guided project generation, live
preview/diff/workbench, a bounded agent/task orchestration core, an
installable skill/tool/connector/MCP-server ecosystem, a wide LLM provider
catalog (BYOK-first), persistent project + user memory, and eventually
local/alternative model runtimes and transports. It is not "a chatbot with
a code box" and not a thin wrapper around one provider.

## 2. Identity & brand

VELDRA is its own brand, not a renamed bolt.diy. No Bolt/StackBlitz/"Bolt"
product terminology, logos, lightning-bolt marks, or Bolt branding should
be user-visible. Two categories are explicitly exempt and must stay:
required MIT attribution (`LICENSE`, `NOTICE.md`, copyright headers on
genuinely StackBlitz-authored files like `StickToBottom.tsx`) and internal
protocol/technical identifiers that are never rendered to a user
(`boltAction`/`boltArtifact` — the XML-ish tags the system prompt
instructs the model to emit, parsed by `message-parser.ts`; the
`bolt-elements-*` CSS design-token prefix used throughout `variables.scss`
and hundreds of components; the `boltHistory` IndexedDB database name).
Renaming these is a large, high-risk mechanical refactor touching the
parser and every themed component, for zero user-visible benefit — do not
do it as a "cleanup," and do not do partial, naive find-and-replace on any
of them (a prior loop's mistake, corrected in Loop 19: swapping the word
"Bolt" for "VELDRA" in a *generated* string, producing an unnatural
sentence, is not the same as writing an original one).

## 3. Source of truth

`mertgoevse-wq/VELDRA` is the only active repository. `bolt.diy` and
`bolt-android` are historical starting points, inspectable read-only for
provenance/diffing, never edited (D-001). Before any session, confirm
`pwd`/`git remote -v` actually point at this repo — a copy-pasted command
or an assumption from a prior session is not a substitute for checking.

## 4. Architecture first

VELDRA already has more real architecture than a first read of the
mandate documents suggests. Before proposing or building a new subsystem,
check whether one of these already covers it — extend it, do not build a
parallel one:

| Concern | Where it already lives | What's real vs. contract-only |
|---|---|---|
| Goal/Task/Budget orchestration | `app/lib/orchestrator/{types,adapters,budget,registries}.ts` | Types + budget math + `Goal`/`Task` IndexedDB persistence (`orchestratorRunStore.ts`) are real; no concrete `AgentRunner` exists yet — contract only |
| Entitlement tiers | `app/lib/orchestrator/entitlement.ts` | `FREE/PREMIUM/PRO/DEVELOPER` with real numeric `TIER_BUDGETS`, an `ABSOLUTE_CEILING` nothing may exceed, and `EntitlementCapability`/`TIER_CAPABILITIES` flags — real and tested |
| Capability/connector/MCP registry | `app/lib/orchestrator/registries.ts` | `CapabilityKind = agent \| skill \| prompt-pattern \| method \| connector \| mcp-server`, `DiscoveryState = discovered→verified→cataloged→optional→enabled` — real types, not wired to any UI or installer flow |
| Capability *content* + gated engineering loop | `studio/` (`catalog/`, `orchestration/gauntlet.ts`, `capability-router.ts`, `engineering-loop.ts`) | Real state machine (`PLANNED→RESEARCHING→IMPLEMENTING→TESTING→REVIEWING→VERIFYING→...`) with license/provenance baked into role manifests — **confirmed zero consumers in `app/` as of this writing** (grep before assuming otherwise; it changes) |
| Execution/sandbox | `app/lib/execution/` (`SandboxProvider`/`SandboxCapabilities`) | `webcontainer.ts` is a real production adapter; Android fallback and Remote Runtime are not yet routed through it — `ActionRunner` still uses its own direct WebContainer/Shell path |
| Chat/message persistence | `app/lib/persistence/db.ts` | Real, working IndexedDB chat history, snapshots, forking |
| Theming | `app/styles/variables.scss` (~80 `--bolt-elements-*` tokens) + `app/lib/stores/theme.ts` (light/dark) + `app/lib/stores/skin.ts` (`data-skin` overlay) | Real, proven mechanism; only two skins actually designed (`veldra` default, `obsidian`) — see §9 |
| LLM providers | `app/lib/modules/llm/providers/` (24 provider modules as of this writing) | Real, BYOK, provider-neutral (D-002) |
| Android | `android/` (Capacitor native project) + `vite.android.config.ts` + `AndroidShell.tsx` + `app/lib/stores/runtime-mode.ts` | Real shared-bundle approach; native `android/` edits are the higher-risk, less-traveled path — see §11 |

Never build a second Goal/Task system, a second entitlement axis, a second
theming mechanism, or a second persistence layer next to one of these.

## 5. Autonomous engineering

Work in logically complete, independently-validated slices. Use
subagents in parallel for genuinely independent research or execution —
not for synthesis or product decisions (never delegate "based on the
findings, decide/implement X"; do that yourself after the findings come
back). Use whatever skills/tools already fit the task. Do not stop to ask
about ordinary implementation choices (which existing helper to reuse,
which file a fix belongs in, naming that follows an existing convention).
Do stop and ask — or flag clearly and wait — for: real product-direction
decisions (a new named skin's palette, a UX direction the product owner
hasn't specified), anything that touches security boundaries (auth,
secrets, CORS, entitlement ceilings), and anything hard to reverse (native
`android/` project files, force-push, deleting user-authored content,
changing which git branch work lands on).

## 6. Research before implementation

For anything complex or new: first check what VELDRA already has (§4).
Then, if an external building block is genuinely needed, research real
candidate repositories, verify their actual license (read the LICENSE
file, don't trust a listicle), read enough of the code/architecture to
know what you'd actually be depending on, and adopt only what's
license-compatible and architecturally additive. Never copy a third
party's proprietary implementation, and never present a researched-but-
unimplemented idea as if it were built. `project/research/` holds prior
loops' real, sourced research (architecture patterns, design system,
repository candidates, product roadmap) — read it before re-researching
the same ground, and add to it rather than duplicating it.

## 7. Best-practice workflow (methodology, not a library)

A prior loop reviewed the `claude-code-best-practice` repository and
recorded the conclusion as D-008: apply its *development methodology*
while building VELDRA — small, independently-verifiable slices; clear
per-slice goals; targeted context gathering instead of re-reading
everything; tests after every change; real browser/mobile verification,
not just a green build; a git checkpoint per slice; documentation that
tracks what actually happened, not what was planned — without importing
its `.claude/agents/`, `.claude/skills/`, or any other agent/skill library
into this repository. VELDRA does not maintain a `.claude/` agent/skill
tree today, and none should be added speculatively; add one only when a
concrete phase actually needs it, and record that decision when it happens.

## 8. UI/UX

VELDRA should not look or feel like bolt.diy with a new name — that was an
explicit, real product-owner rejection of a prior direction (Loop 22).
Mobile-first: the primary QA widths are 320–430px, not desktop-down.
Soft, modern, high-quality visual language over the sharp/utilitarian
bolt.diy look. No clipped/truncated text, no overflowing button rows, no
unnecessarily hard corners. Desktop and mobile may use genuinely different
layout strategies where that serves the product (e.g. the hero
illustration is desktop-only today because its embedded labels are
illegible at mobile widths) — that's a deliberate choice, not a compromise
to paper over.

## 9. Design system / skins

Today, real and shipping: the `veldra` skin (default, zero override) and
`obsidian` (deep near-black surfaces), both selectable via Settings →
Skin, both verified end-to-end via `getComputedStyle`. The token mechanism
(`[data-theme]` for light/dark, `[data-skin]` as an independent overlay,
same pre-hydration-script pattern, no FOUC) is proven and extensible.
**Not yet designed**: any of glassmorphism, neomorphism, claymorphism,
skeuomorphism, minimalism, maximalism, brutalism, liquid-glass, spatial-UI,
or the other named mood skins from past mandates (Anthracite, Midnight,
Aurora, Ocean, Ember, Forest, Rose, Lavender, Arctic, a Claude-inspired
mood). Each is a real palette/radius/shadow/typography/motion decision,
not a color swap — fabricating a batch of them without visual QA or
product-owner sign-off is exactly the "AI slop" this project avoids
(confirmed repeatedly across Loop 19–22's own honest gap lists). Build
real design-token *categories* first (radius/shadow/border-width/density/
motion-duration scales already exist as of Slice 7; font tokens as of
Slice 10 — extend these, don't invent parallel ones), then implement named
skins one at a time with actual visual verification, starting with the
one that has an objective target rather than a subjective mood (High
Contrast — a WCAG-ratio requirement, not a taste call).

## 10. Brand assets

The seven real, approved source images are `public/assets/brand/`:
`veldra-app-icon.jpg`, `veldra-brand-background.jpg`, `veldra-favicon.jpg`,
`veldra-github-banner.jpg`, `veldra-hero-art.jpg`, `veldra-logo-master.jpg`,
`veldra-social-preview.jpg`. These are the primary visual reference —
never invent a new logo/mark/illustration when one of these already fits
the use case (a real, disclosed mistake this session: hand-drawing a new
"V" mark in an invented palette without checking these files, later
reverted). Analyze the actual pixels before deriving anything (sample real
colors, don't guess hex values from memory of "what a screenshot looked
like"). Derive optimized web/Android formats (resized PNGs, WebP, cropped
social-preview) from the originals without modifying the source JPGs
themselves. If a vectorization tool genuinely isn't available in the
environment, a raster derivative (documented as such) is honest; claiming
a hand-traced vector is "the real logo" when it was invented is not.

## 11. Mobile experience

The Android app should feel like a genuinely native, high-quality AI app,
not a desktop web page in a phone-sized frame. It ships via the shared web
bundle (`vite.android.config.ts` → `AndroidShell.tsx`, mounted in a bare
`MemoryRouter`, not Remix routing — `app/routes/_index.tsx` is dead code
for the shipped app) plus Capacitor native plumbing (`android/`,
`cap sync`). Prefer reaching Android behavior through that shared bundle.
Native `android/` project file edits carry real risk (the Android
SDK/Gradle toolchain is not persisted in this ephemeral environment and
must be reinstalled ad hoc per session; breakage there is expensive to
detect blind) — if one is genuinely needed, say so explicitly and validate
with a real Gradle build rather than assuming it's blocked or safe. See
§23 in `CLAUDE.md`'s Android caution note below for a correction to a
citation that has propagated across several loops without ever being true.

## 12. Home screen

The current "Where ideas begin" headline (`app/components/chat/BaseChat.tsx`)
is a placeholder, not a finished decision. The eventual greeting should be
dynamic and personal — time-of-day-aware, using the user's name once one
exists, occasionally varied — without becoming a random string generator
that reads as unpolished. Any implementation should be able to say exactly
which inputs it's varying on (time, name, a small fixed rotation) rather
than "sometimes shows something different."

## 13. VELDRA vibecoding — the central interaction loop

Idea → clarifying questions → goal definition → plan → implementation →
tests → preview → iteration → completion. This already has a real,
partial home in the codebase: `Goal.openQuestions[]` and `Task` in
`app/lib/orchestrator/types.ts` directly model the questions/plan steps;
`studio/orchestration/gauntlet.ts`'s status machine
(`PLANNED→RESEARCHING→IMPLEMENTING→TESTING→REVIEWING→VERIFYING→...`) maps
onto the rest — neither is wired into the actual chat UI yet (confirmed:
nothing outside this orchestration code creates a real `WorkflowRun`
today). VELDRA should not one-shot code generation for a genuinely unclear
request; it should ask a targeted clarifying question first, the same way
real coding-agent tools converge on (per `project/research/
VELDRA-ARCHITECTURE-RESEARCH.md` §1.1). A long session's original goal
must stay retrievable — that's precisely what `Goal`/`orchestratorRunStore.ts`
persistence exists for; wire new work through that instead of inventing
session-local goal tracking.

## 14. Memory & persistence

Chat/message history is real and persistent today (IndexedDB via
`app/lib/persistence/db.ts`). `Goal`/`Task` orchestrator-run state also
persists (`orchestratorRunStore.ts`, schema v3, added Loop 21 Slice 5) but
nothing in the app creates a real run yet, so there's nothing to resume in
practice — building a "resume" *screen* ahead of that data source would be
exactly the fake-UI problem D-007 forbids (a real, deliberate scope
decision from Loop 21 Slice 6, not an oversight). Longer-term project
goals and user preferences should eventually be stored separately from
short-lived chat context, not blended into it — no such split exists yet.
Memory must stay inspectable and deletable by the user whenever it's
built; do not add a memory feature with no visible way to clear it.

## 15. Agents / skills / tools

`CapabilityKind = agent | skill | prompt-pattern | method | connector |
mcp-server` and `DiscoveryState = discovered → verified → cataloged →
optional → enabled` (`registries.ts`) already model exactly this
discover→vet→install pipeline. `studio/catalog/veldra-roles.ts` already
tracks provenance and license per capability
(`source: {sourceId, repository, revision, path, importedAs}`,
`license`). What's missing is a real runner behind any of it and a UI to
browse/install — do not build a second registry to fill that gap; wire a
real implementation into the one that exists. Never present a capability
as "installed"/"available" in a UI before real execution backs it — an
inert catalog entry with no runner is a fake-availability bug, not a
harmless placeholder.

## 16. Providers

24 LLM provider modules exist today (`app/lib/modules/llm/providers/`),
BYOK-first, provider-neutral per D-002 — no UI behavior should be
hardcoded to a specific provider's identity. Connection/API-key
configuration must produce real, specific error states (missing key,
invalid key, unreachable endpoint), not a generic failure. Never commit a
real secret to code, tests, or `.env*` files that aren't already the
repo's tracked templates (`.env.example`, `.env.production` are templates
and require review before any change, not places to paste a live key).

## 17. Connectors

Later scope: GitHub, Supabase, Vercel, MCP servers, and similar
development-service connectors. `app/lib/orchestrator/registries.ts`
already has a `connector` `CapabilityKind` and `ConnectorDefinition`
concept (capabilities, required credentials, permissions, connection
status, setup instructions) added in Loop 21 Slice 3 — extend that, do not
model connectors as a bespoke per-integration UI each time. Connector UI
should always show a short description, live connection status, and a
plain-language reason when a connection attempt fails.

## 18. Local / alternative runtimes

Architecture direction only today (`project/research/
VELDRA-ARCHITECTURE-RESEARCH.md` §8): GGUF+llama.cpp and Meta's ExecuTorch
are the best cross-platform-verified paths for on-device inference;
Ollama/LM Studio providers already exist and work from a desktop browser,
but their default `127.0.0.1` base URLs cannot resolve to a desktop
machine from inside the Android WebView — a real, already-documented gap
(fixed partially in an earlier loop with a warning banner, not with actual
LAN-IP auto-discovery). Do not claim local-model support "works on
Android" without confirming the LAN-IP path specifically. Alternative
transports (Bluetooth, Wi-Fi Direct, WebRTC device-to-device) are real but
materially bigger features than they sound — implement only once a
concrete use case and a security review justify the complexity, per D-006's
"CORS is defense in depth, not authentication" spirit extended to any new
transport.

## 19. Progress / motion

Communicate real work state honestly — status terms like
THINKING/PLANNING/BUILDING/TESTING/REPAIRING/VERIFYING/DONE/ERROR (mirroring
`studio/orchestration/gauntlet.ts`'s own status machine) are fine; never
claim the model is literally "thinking" as a measured fact if it isn't.
Prefer a distinct, VELDRA-specific progress visualization over the
industry-generic shimmer-text pattern once one is actually designed and
approved — shimmer is a recognized, generic "AI aesthetic" as of
2025–2026 (`project/research/VELDRA-DESIGN-SYSTEM.md` §2.2), not a
differentiator. All motion must respect `prefers-reduced-motion` at the
token level (`--veldra-motion-duration-*`, added Slice 7) — never a
scattered per-component `if` check.

## 20. Performance

Mobile resources are limited. Lazy-load and compress large images (the
hero art and brand-background webp/jpg pairs already follow this
pattern — match it for new assets). Don't add a dependency for something
a few lines of existing code already does. Don't run a full production
build after every one-line change — use `pnpm dev` + targeted checks while
iterating, and reserve the full gauntlet (§22) for the point a slice is
actually ready to validate and commit. Run tests and lint targeted at what
changed when the codebase and tooling support it; run the full suite
before committing.

## 21. Commercial / license safety

VELDRA intends to be commercially usable. Before adopting any external
repository or asset: read its actual LICENSE file (not a summary or a
listicle), watch specifically for AGPL/GPL/SSPL/copyleft and for
"permissive code, restrictive bundled model/asset" traps (e.g. madmom's
BSD code with CC-BY-NC-SA models) — `project/research/
VELDRA-REPOSITORY-CANDIDATES.md` already documents several real examples
of both trap types, worth checking before re-researching from scratch.
Document provenance for anything adopted (source, revision, license) —
`studio/catalog/veldra-roles.ts`'s `provenance()`/`permissiveLicense()`
pattern is the existing convention for this. Never claim third-party code
is original VELDRA work, and never quietly drop a required attribution
notice. When a license is ambiguous or restrictive, default to
implementing the underlying idea from scratch rather than depending on the
problematic package — `project/LEGAL-AND-PROVENANCE.md` already documents
this project's own upstream fork-point (`stackblitz-labs/bolt.diy @
2e254ac1`) as the model for how this kind of record should look.

## 22. Quality gate

A slice is not done because it compiles. Before calling anything finished,
run what's relevant to the change:

```
pnpm install         # first time / after a dependency change
pnpm test            # vitest — must pass 100%
pnpm typecheck        # tsc — must be clean
pnpm lint             # eslint — must be clean
pnpm build             # remix vite:build — must succeed
```

For anything visibly rendered, a successful build is not evidence it
looks or works right — actually run `pnpm dev` and check it with a real
browser (a global Playwright + pre-installed Chromium are available at
`/opt/pw-browsers/chromium-*/chrome-linux/chrome`, separate from this
project's own dependencies; check real `getComputedStyle` values or
screenshots, not just "the page loaded"). UnoCSS resolves same-specificity
utility-class conflicts by source order in the *generated* stylesheet —
when two classes fight for the same property, diff the actual built CSS
before guessing which one "should" win (a real regression this session
found and fixed this exact way: a `purple`→`accent` class rename flipped
which of two same-specificity rules won, silently breaking a button's
color despite the class name being "correct").

For changes touching anything rendered on Android specifically, also run:
```
pnpm android:webbuild
pnpm android:sync
```
A full native Gradle/APK build additionally needs the Android SDK, not
persisted in this ephemeral environment (CI's
`.github/workflows/android-debug-apk.yml` handles this automatically;
reinstall ad hoc if a real local APK build is genuinely needed).

Never report "done"/"working"/"verified" for something only compiled or
only reasoned about — this is D-007, the single most important convention
in this codebase. "Contract-only" and "unavailable by design" are
legitimate, honestly-labeled states; a fabricated "it works" is not.

## 23. Git safety

Before changing anything: `git status`, `git branch`, `git log`, `git
remote -v` — confirm which repo, which branch, and what's already staged
or committed, rather than assuming. After a completed, validated slice:
commit with a clear message, push, and update `project/STATUS.md`/
`project/SESSION-HANDOFF.md` to reflect what actually happened (including
honest gaps). Never force-push, never overwrite another branch's work,
never skip hooks. This repository's established historical convention
(22+ loops) is small validated commits pushed straight to `origin/main`
with `HEAD == origin/main` verified after every push — no long-lived
feature branches, no PR queue. **Some hosting/harness setups override
this per-session** (e.g. a Claude Code on the web session bound to a
specific feature branch with an explicit "never push to a different
branch" instruction) — when that's the case, follow the harness's
explicit instruction for that session and open a PR instead, rather than
silently pushing to `main` against it. Note the discrepancy in
`SESSION-HANDOFF.md` rather than picking one convention and hoping it's
right.

**Android caution note, correcting a repeated but unfounded claim**:
several loop entries in `STATUS.md`/`SESSION-HANDOFF.md` state that
`android/` is "off-limits to Claude per this repo's own CLAUDE.md." No
`CLAUDE.md` existed anywhere in this repository's git history before this
file — that citation was never verifiable and should not be repeated as
fact. Treat it as those sessions' own informal caution (a reasonable one
on its own merits — see §11), not a confirmed product-owner mandate.

## 24. Token efficiency

Don't re-read a document already covered earlier in the same session
without a reason. Prefer targeted `Grep`/`Glob` over re-reading whole
files when only a specific symbol or section is needed. Group related
checks (test+typecheck+lint) rather than re-running the full suite after
every single-line edit. Delegate genuinely independent, broad research to
parallel subagents rather than doing sequential wide exploration yourself
— but never delegate synthesis or the decision itself.

## 25. Failure handling

When something fails, identify which of these it actually is before
"fixing" anything: a real product-code bug, a test that's wrong rather
than the code, a CI/infrastructure problem, or an external
service/network issue. A concrete example from this session: every
GitHub Actions check on this repo (semantic-pr, security, quality,
preview, CI/CD — confirmed across ~317 historical workflow runs, only one
of which ever succeeded) fails within seconds with `runner_id: 0` — no
runner ever picks up the job, on plain pushes to `main` as much as on any
PR. That is a standing repository-level infrastructure problem, not
something a code diff can fix — state it once, keep independent product
work moving, and re-check rather than repeatedly re-diagnosing the same
already-identified cause. Don't spend cycles re-litigating an
already-documented infrastructure failure; do document a *new* one the
first time it's found (see `project/RISKS.md`).

## 26. Definition of done

VELDRA is only really done, feature by feature, when a real user can
actually use it — not when a UI control exists pointing at a capability
that has no execution behind it. A settings toggle for a provider that
can't be reached, a "resume project" screen with no data source, an
"installed skill" with no runner — all of these are exactly the kind of
appearance-of-completeness this project's own D-007 forbids. Prefer an
honestly-labeled "not yet available" state over a control that looks
finished but does nothing real.

---

## Documentation structure (`project/`)

- `STATUS.md` — narrative, loop-by-loop record of what was actually built,
  what was found broken and fixed along the way, and what's explicitly not
  done yet. The primary "what's the real state of the product" reference.
- `SESSION-HANDOFF.md` — the same history from a "picking this up cold"
  angle: current commit, last successful push, immediate next steps.
- `ROADMAP.md` — current priorities and a capability matrix (implemented /
  contract-only / unavailable-by-design).
- `DECISIONS.md` — durable architectural decisions (D-001..D-008).
- `RISKS.md` — known risks and their mitigations.
- `LEGAL-AND-PROVENANCE.md` — bolt.diy/StackBlitz provenance and licensing
  audit; keep MIT attribution intact.
- `research/` — architecture/design-system/repository/roadmap research
  produced by past loops (`VELDRA-ARCHITECTURE-RESEARCH.md`,
  `VELDRA-DESIGN-SYSTEM.md`, `VELDRA-PRODUCT-ROADMAP.md`,
  `VELDRA-REPOSITORY-CANDIDATES.md`).

Keep these docs in sync with reality after every meaningful slice — that
discipline is what has made this repo's history legible across many
independent sessions.

## Consistency check against `project/*.md` (run when this file changes)

This file was cross-checked against `STATUS.md`, `SESSION-HANDOFF.md`,
`ROADMAP.md`, `DECISIONS.md`, and `RISKS.md` at the time it was written.
Known discrepancies, documented rather than silently resolved one way:

- **Git workflow** (§23): the established repo-wide convention is
  direct-to-`main` pushes; this specific session's harness instead requires
  a designated feature branch + PR. Both are recorded as true, scoped to
  when each applies.
- **The two phantom citations**: "off-limits per this repo's own
  CLAUDE.md" (no such file existed before this one — §23) and Loop 22
  Slice 1's "decision D-2" about `.claude/agents/` (no such entry existed
  in `DECISIONS.md` — now recorded for real as D-008). Both are corrected
  here rather than repeated as verified fact.
- **CI infrastructure** (§25): a real, verified, previously-undocumented
  repo-level GitHub Actions failure (no runner ever picks up a job) was
  found this session and has been added to `project/RISKS.md`.
