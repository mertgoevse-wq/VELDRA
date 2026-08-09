# VELDRA Source Consolidation — 2026-08-09

## Canonical working repository

All active work is performed in `mertgoevse-wq/VELDRA`.

- Remote: `git@github.com:mertgoevse-wq/VELDRA.git`
- Branch: `main`
- Source archive: `mertgoevse-wq/bolt-android`
- Original baseline: `mertgoevse-wq/bolt-diy-android`
- Safety branch created before migration: `backup/pre-source-consolidation-20260809`

`bolt-android` and `bolt-diy-android` remain historical/reference repositories. Their working trees are not active VELDRA workspaces.

## Compared refs

| Source | Ref | Finding |
|---|---|---|
| `bolt-diy-android` | `main` `fc1cfb6`, `gh-pages` `dbbde06` | Android-port baseline and upstream-derived application history |
| `bolt-android` | `main` `d4c6bbb` | Early repository baseline; no later architecture slices |
| `bolt-android` | `claude-work` `a303a1b` | Earlier Claude execution/Android work |
| `bolt-android` | `integration/claude-freebuff` `da35d27` | Most complete committed architecture source: execution contracts, orchestrator, studio foundation, policy/catalog contracts, provider slices, and documentation |
| `bolt-android` | backup refs/tags | Preserved historical checkpoints; not used as migration input |

The local `bolt-android` working tree was dirty and contained conflicts. It was deliberately **not** used as a migration source. Only the committed `origin/integration/claude-freebuff` tree was considered.

## Migration matrix

| Source area / commits | VELDRA action | Conflict | Reason |
|---|---|---:|---|
| `a303a1b`, `9ddf416`: execution contract, registry, WebContainer adapter/specs | Selectively copied into `app/lib/execution/` | No existing path | Additive provider-neutral execution foundation; existing VELDRA stores remain unchanged for now |
| `af9fec7`: orchestrator contracts, registries, budget/failure fingerprint tests | Selectively copied into `app/lib/orchestrator/` | No existing path | Bounded, provider-neutral ports and policies are compatible with VELDRA and do not execute agents by themselves |
| `b33bca5`: entitlement/developer policy and runtime adapter/specs | Selectively copied into `app/lib/orchestrator/` and `app/lib/dev/` | No existing path | Preserves FREE/PREMIUM/DEVELOPER policy boundaries and absolute ceilings without introducing billing or bypasses |
| `da35d27`: catalog update contract, model router, capability overlay | Copied contract files; static model catalog intentionally excluded | No path conflict after exclusion | Update validation/rollback/freshness and capability-based routing are safe contracts; source model IDs were not independently verified |
| `401e7cf`: Gauntlet/budget conflict resolution and tests | Selectively copied through `studio/orchestration/` | No existing path | Preserves bounded loop and failure-fingerprint semantics |
| `7347dd4`: Bedrock provider changes/tests | Not copied in this slice | Existing `app/lib/modules/llm/providers/amazon-bedrock.ts` differs | Avoid overwriting VELDRA's provider and avoid importing unverified model assumptions; requires a separate AWS-verification slice |
| Source NIM provider/test | Copied to `app/lib/modules/llm/providers/nvidia-nim.*`; exported from VELDRA registry | No existing provider path | OpenAI-compatible discovery is dynamic; returned `ModelInfo` uses conservative `maxTokenAllowed: 8000` because `/v1/models` does not guarantee context metadata |
| Source `studio/` capability catalog, provenance, progressive loading, routing, prompts, Gauntlet | Copied to `studio/` with `@studio/*` TypeScript alias | No existing path | VELDRA-controlled foundation consolidated from the committed source ref; external content is metadata-only and license-aware |
| Source `app/lib/webcontainer/capabilities.*` | Copied | No existing path | Adds a testable capability probe without replacing VELDRA's existing platform adapter |
| Source `app/lib/api/base-url.ts` | Copied | No existing path | Provides a relative-by-default API URL boundary for future Android backend wiring; not yet applied to all routes |
| Source Capacitor helper | Excluded | Would require absent `@capacitor/app` dependency | Avoid adding an unvalidated package/version change to the VELDRA Android build |
| Source `package.json`, lockfile, Android, Capacitor configs | Excluded | High | VELDRA uses a different Capacitor/runtime/build state; blind replacement could destroy working functionality |
| Source `.claude/`, `CLAUDE.md`, session/status docs | Excluded from code migration | Product/workflow identity conflict | Source instructions and dirty-worktree assumptions are preserved as historical reference, not silently installed as active policy |
| Source static model catalog | Excluded | Unverified model IDs/capabilities | No model IDs are invented or promoted without official verification |
| VELDRA Image Studio and branding/assets | Preserved untouched | Existing VELDRA work | Existing `/api/image`, image contracts, assets, Android identity, and product branding remain authoritative |

## Current result

The migrated code is a **foundation slice**, not a completed runtime integration:

- Orchestrator contracts define ports for agent invocation, approvals, policy, persistence, capabilities, and model metadata.
- Budget enforcement, repeated-failure detection, entitlement policy, developer override validation, and limit simulation are bounded and tested in source fixtures.
- Execution contracts and a WebContainer adapter are available, but VELDRA's existing stores/action runner still use their established adapters.
- `studio/` is provider/runtime-independent. Node filesystem discovery is isolated under `studio/adapters/`; it is not imported by the browser-facing `studio/index.ts`.
- The NIM adapter performs no request without a configured key and uses bounded model discovery timeout inherited from `BaseProvider`.
- No credentials, live-cost requests, fake image outputs, or unverified static model catalog entries were added.

## Validation constraints

The repository has no `node_modules` in the current environment. Therefore targeted Vitest tests, TypeScript checking, lint, and build must be run in a dependency-complete environment before the next release/milestone. Static checks performed during this slice include `git diff --check`, secret-pattern scans, import/dependency audits, and preservation checks for VELDRA Image Studio/Android/branding paths.

## Next consolidation gates

1. Install dependencies in a controlled environment and run migrated targeted tests, full tests, typecheck, lint, and build.
2. Resolve any Node/browser boundary findings from the real typecheck/build rather than adding broad polyfills.
3. Add an explicit integration adapter only after the execution contract is reconciled with `runtimeModeStore`, `ActionRunner`, remote runtime, and Android fallback.
4. Verify Bedrock model IDs and merge only the provider changes that match VELDRA's current provider contract.
5. Update the canonical session handoff with the migration commit and test results.
