# VELDRA Orchestrator Core — Architecture

Referenced from `app/lib/orchestrator/types.ts`'s own top-of-file doc
comment ("Rationale and what is deliberately NOT modelled yet"), which
pointed here before this file existed. Written directly from the actual
code (`app/lib/orchestrator/{types,adapters,budget,registries,
entitlement}.ts`), not reconstructed from memory or a prior mandate
summary — see `project/CLAUDE.md`'s §0 for why that distinction matters
in this repository.

## What this core is

`app/lib/orchestrator/` is a small, dependency-free "workflow spine":
`Goal` → `Task` graph → bounded execution → `Evidence`-backed
verification, with hard stop conditions instead of open-ended autonomy.
Its own doc comment states the real constraint driving its shape:

> The core must run unchanged inside Claude Code, inside Freebuff, and
> later inside the Veldra app itself. It therefore depends on no host, no
> LLM and no execution provider: everything it needs from the outside
> arrives through the ports in `./adapters`.

That is a real, load-bearing design constraint, not aspirational
language: `OrchestratorHost.id` (`adapters.ts`) is typed as
`'claude-code' | 'freebuff' | 'veldra-app'`. Whatever gets built on top of
this core has to keep working as a portable library across those three
hosts, not just inside VELDRA's own app. This is why the core has zero
imports of anything host-specific (no LLM SDK, no execution provider, no
UI, no billing) — every one of those crosses through a port
(`AgentRunner`, `ApprovalPort`, `RunStore`, `ModelCatalog`, `PolicyGate`).

## The core types, and why each exists (`types.ts`)

- **`Goal { id, text, openQuestions[] }`** — what the user actually wants,
  before decomposition. `openQuestions` exists because the core's own
  premise (per `project/CLAUDE.md` §13) is that VELDRA should not one-shot
  an unclear request; unresolved questions are a first-class field, not
  something bolted onto a prompt.
- **`Task { id, goalId, title, dependsOn[] }` + `TaskState`** — a real
  dependency graph (`dependsOn`), not a flat todo list, with an explicit
  `awaiting-approval`/`abandoned` state distinct from `failed` — a task a
  human chose not to pursue is a different outcome than one that broke.
- **`Budget`/`BudgetUsage`** — every field in `Budget` is a hard stop
  condition, not a hint. The product requirement behind this is explicit
  in the code: "no unbounded autonomous loops" must be true structurally,
  not just documented. Enforcement lives in `budget.ts` (`checkBudget`),
  not in the type itself — `types.ts` only defines the shape, `budget.ts`
  is what actually halts a run.
- **`RoutingDecision<T>`** — every automatic choice (model, execution
  provider, agent, method) is recorded with what was rejected and why.
  The rationale given in the code is direct: "an automatic choice the
  user cannot inspect is one they cannot trust or debug." Any future
  router (model router, execution router, agent router) should produce
  one of these per decision, not just log to console.
- **`Evidence`** — the anti-hallucination boundary. A task may not be
  reported `verified` on an agent's say-so; it needs a re-inspectable
  artifact (`test-run`/`build`/`lint`/`typecheck`/`diff`/
  `command-output`/`external-check`). `outcome: 'inconclusive'` is a
  distinct value from `'fail'` — an ambiguous result is not a passing one
  by default. This is the type-level enforcement of D-007 ("no fake
  external capability") for the orchestrator's own task-completion claims
  specifically, not just for provider/model/device claims.
- **`VerificationRequirement`** — what a `MethodDefinition` demands before
  a task counts done. The code is explicit that an empty requirement list
  is *allowed* but produces a weaker claim ("nobody objected," not
  "verified") — callers must not treat the two as equivalent.
- **`ApprovalKind`/`ApprovalRequest`/`ApprovalResponse`** — a workflow
  never auto-resolves an approval point itself; that is the entire point
  of the type existing. `'destructive-action'`, `'budget-exceeded'`,
  `'external-side-effect'`, and `'low-confidence'` are the four kinds that
  must stop and wait for a human, mirroring `project/CLAUDE.md` §5's list
  of things worth pausing for in this project generally.
- **`FailureFingerprint`** — a stable signature over *normalized* error
  text plus the failing step, not the raw message (so two failures with
  different timestamps/paths in the message still fingerprint as the
  same failure). This is what lets `budget.ts`'s `findRepeatingFailure`
  notice a loop retrying the identical failure instead of burning the
  iteration budget on it — the single most common "unbounded autonomous
  loop" failure mode this whole core exists to prevent.
- **`WorkflowRun`** — the aggregate a `RunStore` persists. `haltReason` is
  mandatory-in-spirit whenever `state === 'halted'` ("a halt is never
  silent" per the code comment) — a halted run with no reason is itself a
  bug, not a valid state.
- **`PolicyGate`** — the seam that keeps billing out of the core
  entirely. `PolicyGate.check()` returns a denial *reason* string, not a
  boolean, specifically so a UI can explain a restriction instead of
  silently hiding a capability — this is the same "no fake availability"
  principle applied to entitlement gating specifically.

## The host ports (`adapters.ts`)

`AgentInvocation`/`AgentResult`/`AgentRunner` is deliberately narrow: the
core doesn't care whether a host parallelizes, queues, or runs serially —
only that `maxConcurrency` is respected and results come back with
`Evidence`. A host that can't parallelize must still honor the contract by
running serially, not by failing the contract. `OrchestratorHost` marks
only `agents`, `approvals`, and `policy` as mandatory; `runs`
(`RunStore`), `models` (`ModelCatalog`), and `capabilities`
(`CapabilityResolver`) are optional — a host that can't persist runs or
enumerate models is still a *valid* host, it just loses resume and
automatic model routing. This optionality is intentional, not a gap: it's
what lets a minimal host (e.g. an early Freebuff integration) implement
this contract without first building a persistence layer.

## Budget enforcement (`budget.ts`)

`checkBudget()` checks limits in a **fixed order**
(`maxWallClockMs → maxTokens → maxCostMinor → maxIterations`) specifically
so a run that blows several limits simultaneously always reports the same
one — reproducibility over "report everything." `maxConcurrency` is
checked separately, at dispatch, not accumulated like the other four
limits (it isn't a thing that accumulates over a run). `MAX_IDENTICAL_FAILURES
= 3` is the actual threshold behind the "repeated-failure circuit breaker"
described in `project/research/VELDRA-ARCHITECTURE-RESEARCH.md` — the
comment in the code explains the choice directly: "three lets a transient
fault pass twice while still stopping a loop that has clearly stopped
making progress."

## Capability/connector registries (`registries.ts`)

Two orthogonal registry families live here, and they should stay
orthogonal:

1. **Content sources** (`PromptPattern`, `MethodDefinition`, `ModelCapabilities`,
   `CapabilitySource`/`CapabilityEntry`/`CapabilityResolver`) — catalogues
   of *metadata*, never of content. `CapabilityResolver.load()` can
   legitimately return `null` ("policy or licence forbids it") and every
   caller must treat that as a normal answer, not an error to catch.
2. **Connectors** (`ConnectorDefinition`, `ConnectionStatus`,
   `RequiredCredential`, `ConnectorPermission`) — live external service
   integrations (GitHub, Supabase, Vercel, an MCP server, a local
   OpenAI-compatible server, ...). The type-level doc comment is explicit
   about a distinction worth preserving in any future UI: `DiscoveryState`
   is a one-directional trust pipeline (`discovered→verified→cataloged→
   optional→enabled`, never regresses once a source is vetted), while
   `ConnectionStatus` is the connector's freely-changing *live* state — a
   connector can be `DiscoveryState='enabled'` (trusted, the user opted
   in) while `ConnectionStatus='disconnected'` because a credential
   expired. Don't conflate "the user trusts this connector" with "this
   connector is currently reachable" — they're different questions with
   different UI treatments (a disabled toggle vs. an error banner).

`PatternUsage = 'product' | 'research-only'` is licensing-gated, not a
taste call: a pattern without a clear, verified permissive license stays
`'research-only'` forever — its *shape* may inform prompts VELDRA writes
originally, its *text* may never enter the product. This is recorded as
`project/DECISIONS.md` D-009 (added alongside this document — the code's
own comment had cited it as "D-5" since it was written, which is actually
Remote Runtime authentication, an unrelated decision; the mismatch is now
fixed at the source).

`ModelCapabilities` is a **deliberately separate overlay**, not an
extension of `app/lib/modules/llm/types.ts`'s `ModelInfo` — that type is
implemented by 24 provider modules today, and widening it would force
every one of them to supply routing metadata most don't actually have,
which in practice means inventing it. Every optional field's absence
means "unknown," and per D-007 the UI must show unknown as unknown, never
a fabricated default.

## Entitlement (`entitlement.ts`, not duplicated here in full)

`EntitlementTier = FREE | PREMIUM | PRO | DEVELOPER` with real numeric
`TIER_BUDGETS` and an `ABSOLUTE_CEILING` no tier or override may ever
exceed. `DEVELOPER` is explicitly internal/non-production
(`ENVIRONMENTS_ALLOWING_OVERRIDE = ['development', 'test']`, never
`'production'`) — it must never be repurposed as a customer-facing tier;
`PRO` is the real customer-facing top tier, added Loop 21 Slice 4 as a
distinct addition rather than a rename. `EntitlementCapability`/
`TIER_CAPABILITIES` express binary feature access (connectors,
mcp-servers, custom agents/skills/providers, advanced agent swarms,
premium transports) that a `Budget` number can't — this is the
`capabilities: Set<...>` concept `project/research/
VELDRA-ARCHITECTURE-RESEARCH.md` §6 recommended adding, already built.

## Relationship to `studio/` — a real duplication worth knowing about

`studio/orchestration/gauntlet.ts` is a second, complementary state
machine (`GAUNTLET_STATUSES = PLANNED→RESEARCHING→IMPLEMENTING→TESTING→
REVIEWING→VERIFYING→BLOCKED→AWAITING_APPROVAL→COMPLETED→FAILED→CANCELLED`)
that maps closely onto this core's `WorkflowState`/`TaskState` but is not
the same code. It correctly imports and reuses this core's
`MAX_IDENTICAL_FAILURES` constant from `budget.ts` — but it also declares
its **own, differently-shaped** `FailureFingerprint` interface
(`{id, kind, message, count, firstSeenAt, lastSeenAt}`, strings) rather
than reusing `types.ts`'s `FailureFingerprint`
(`{signature, occurrences, firstSeenAt, lastSeenAt}`, numbers-plus-a-hash).
Both types serve the identical purpose. This is a real, small
architectural duplication — flagged honestly here rather than silently
fixed, because `studio/` currently has zero consumers in `app/` (confirmed
via grep; re-check before assuming this is still true), so unifying the
two types is a genuine but low-urgency cleanup, not an active bug. Do not
add a *third* shape for the same concept anywhere else; if this gets
fixed, the direction should be `gauntlet.ts` importing the core's
`FailureFingerprint` type directly, not the reverse.

## What is deliberately NOT modelled here yet

- **No concrete `AgentRunner` implementation.** Every host port in
  `adapters.ts` is a contract; nothing in this repository implements
  `AgentRunner.run()` against a real LLM call today. This is the single
  largest gap between "the orchestrator core exists" and "the
  orchestrator core does anything" — see `project/ROADMAP.md` P1.1.
- **No wiring from the chat UI into a real `WorkflowRun`.** `Goal`/`Task`
  persistence (`orchestratorRunStore.ts`) works and is tested, but nothing
  outside this orchestrator code and its own persistence layer currently
  creates a `WorkflowRun` — confirmed by grep, re-check before assuming
  otherwise. Building a "resume" UI ahead of this would be exactly the
  fake-UI problem D-007 forbids (a deliberate Loop 21 Slice 6 scope
  decision, not an oversight).
- **No context-compaction/summarization step.** `BudgetUsage.tokens`
  tracks consumption but nothing compacts a long-running workflow's
  history yet. `project/research/VELDRA-ARCHITECTURE-RESEARCH.md` §4.4
  sketches a direction (structured-state-first, LLM-summary fallback) but
  none of it is implemented.
- **No model/execution router implementation**, only the
  `RoutingDecision` type it would need to report through. A router that
  doesn't record a `RoutingDecision` per choice isn't meeting this core's
  own contract, even if it technically picks something reasonable.
- **Billing/entitlement enforcement is a `PolicyGate` contract, not a
  concrete implementation wired to real product tiers yet.** `entitlement.ts`
  computes what a tier *should* allow; nothing today calls
  `PolicyGate.check()` from an actual running workflow, because no
  concrete `AgentRunner` exists to run one.
- **No replay/audit event log.** `project/research/
  VELDRA-ARCHITECTURE-RESEARCH.md` §1.2 flags OpenHands' typed-event-log
  design as directly relevant if `WorkflowRun`'s current snapshot-style
  persistence ever needs to become replayable — not built, and not needed
  until a concrete `AgentRunner` makes replay a real question.

## Extending this core

Add a field to an existing type, or a new optional adapter port, before
proposing a parallel structure. The three-host constraint
(`OrchestratorHost.id`) means any new mandatory field on a host port is a
breaking change for hosts that don't yet exist in this repository's code
but are named in the type — treat that seriously even though only
`'veldra-app'` is concretely implemented today.
