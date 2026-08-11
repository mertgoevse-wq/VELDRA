# CLAUDE.md

Guidance for Claude Code (or any AI agent) working in this repository.

## What this repo is

VELDRA is an independent AI development/creation environment. It began as a
fork of `stackblitz-labs/bolt.diy` (MIT-licensed) but is being deliberately
developed into its own product — its own architecture, branding, UI/UX, and
feature set. **bolt.diy and bolt-android are historical starting points
only, not the active project.** Never make changes to those repositories;
all work happens in `mertgoevse-wq/VELDRA`.

Read `project/STATUS.md` and `project/SESSION-HANDOFF.md` first, in that
order, before starting any work — they are the authoritative, continuously
updated record of what has actually been built, loop by loop, including
honest gaps and deliberately deferred items. Also read `project/ROADMAP.md`,
`project/DECISIONS.md`, and `project/RISKS.md`. Then verify the actual git
state (`git status`, `git log`, `origin/main`) yourself rather than trusting
the docs blindly — but in practice they have tracked the real repo state
accurately across 22+ documented loops.

## Core working principle: no fake success

This is the single most important convention in this codebase (see
`project/DECISIONS.md` D-007). Never present a feature, provider, build, or
test result as working/verified unless it actually was. If something can't
be verified in the current environment (no device, no credentials, no
network), say so explicitly in the commit/doc rather than silently assuming
success. "Contract-only" / "unavailable by design" are legitimate, honest
states — a fabricated one is not.

## Validation gauntlet (run before every commit)

```
pnpm install         # first time / after a dependency change
pnpm test            # vitest — must pass 100%
pnpm typecheck        # tsc — must be clean
pnpm lint             # eslint — must be clean
pnpm build             # remix vite:build — must succeed
```

For anything visibly rendered, don't stop at a successful build — actually
start `pnpm dev` and check it with a real browser (Playwright is available
in this environment; see below). A successful build is not evidence a
feature or a UI change looks or works right.

For changes that touch anything rendered on Android specifically, also run
the Android web-build/sync cycle where feasible:
```
pnpm android:webbuild
pnpm android:sync
```
A full native Gradle/APK build additionally needs the Android SDK, which is
not persisted in this ephemeral environment and must be reinstalled ad hoc
per session if a real APK build is needed (CI's
`.github/workflows/android-debug-apk.yml` handles this automatically).

## Playwright / visual verification

A global Playwright + pre-installed Chromium are available
(`/opt/pw-browsers/chromium-*/chrome-linux/chrome`), separate from this
project's own dependencies. When verifying a UI change, launch
`pnpm dev`, drive it with a real headless browser, and check actual
`getComputedStyle` values or screenshots — not just "the build succeeded."
UnoCSS resolves same-specificity utility-class conflicts by source order in
the *generated* stylesheet, not by intuition about which class "should"
win — when in doubt, diff the actual built CSS, don't guess.

## Git workflow

The established convention across this project's history is: commit small,
well-scoped, fully-validated slices and push straight to `origin/main`,
verifying `HEAD == origin/main` after every push — no long-lived feature
branches, no PR queue. `project/STATUS.md`/`SESSION-HANDOFF.md` assume this
model. Some hosting/harness setups (e.g. Claude Code on the web sessions)
may instead require developing on a designated feature branch and opening
a PR — when that's the case, follow the harness's explicit instructions for
that session and note the discrepancy rather than silently deviating from
either.

## Documentation structure (`project/`)

- `STATUS.md` — narrative, loop-by-loop record of what was actually built,
  what was found broken and fixed along the way, and what's explicitly not
  done yet. This is the primary "what's the real state of the product"
  reference — read it before assuming anything is or isn't implemented.
- `SESSION-HANDOFF.md` — the same history from a "picking this up cold"
  angle: current commit, last successful push, immediate next steps.
- `ROADMAP.md` — current priorities and a capability matrix (implemented /
  contract-only / unavailable-by-design).
- `DECISIONS.md` — durable architectural decisions (D-001..D-007).
- `RISKS.md` — known risks and their mitigations.
- `LEGAL-AND-PROVENANCE.md` — bolt.diy/StackBlitz provenance and licensing
  audit; keep MIT attribution intact.
- `research/` — architecture/design-system research produced by past loops.

Keep these docs in sync with reality after every meaningful slice — that's
what has made this repo's history legible across many independent sessions.

## Android caution note (correcting a repeated but unfounded claim)

Several past `STATUS.md`/`SESSION-HANDOFF.md` entries state that `android/`
is "off-limits to Claude per this repo's own CLAUDE.md." No `CLAUDE.md` ever
existed in this repository's git history before this file — that citation
was never verifiable and should not be repeated as if it were. Treat it as
those sessions' own informal caution, not a confirmed product-owner mandate.

That said, the underlying caution is reasonable on its own merits: the
Android SDK/Gradle toolchain is not persisted in this ephemeral environment,
native build breakage is expensive to detect and fix blind, and most loops
so far have reached Android behavior through the shared web bundle
(`vite.android.config.ts`, `AndroidShell.tsx`, Capacitor sync) rather than
editing native `android/` project files directly. Prefer that path; if a
native-side change under `android/` is genuinely needed, say so explicitly
and validate it with a real Gradle build rather than assuming it's blocked
or that it's safe.

## Provider-neutral, no invented capability

Per `project/DECISIONS.md` D-002/D-007: don't hardcode UI behavior to a
specific provider, don't invent model/provider metadata, and don't fake an
"available" state for image generation, local models, or device support
that hasn't been verified. Extend the existing capability/entitlement
contracts (`app/lib/orchestrator/`) rather than building a second, parallel
system for the same concern.
