# VELDRA Architecture Research

**Loop 20, 2026-08-11.** Research-only pass per the "CONTINUE AUTONOMOUSLY" mandate's Loop 20 instructions ("Noch keine riesigen Feature-Implementierungen"). No product code was changed in this loop. Sources: 3 parallel web-research agents (full raw reports kept for reference, condensed here) plus direct inspection of this repository's existing code — every recommendation below is checked against what VELDRA already has before proposing anything new, per "Prüfe zuerst die vorhandene Architektur. Keine parallele zweite Architektur."

Companion documents: `VELDRA-REPOSITORY-CANDIDATES.md` (concrete OSS repos), `VELDRA-DESIGN-SYSTEM.md` (UI/UX/typography/motion), `VELDRA-PRODUCT-ROADMAP.md` (P0-P3 prioritization, synthesizes all four documents).

---

## 0. What VELDRA already has (read before proposing anything)

This section exists because the single biggest risk in this loop was recommending a "new" architecture that already exists. It doesn't, mostly — VELDRA has a real, well-designed foundation that the sections below extend, not replace.

### 0.1 Orchestrator core — `app/lib/orchestrator/`

A provider-agnostic, ports-and-adapters TypeScript core with **zero host/LLM/execution-provider dependencies** (everything crosses through `adapters.ts`):

- **`types.ts`**: `Goal { id, text, openQuestions[] }` — this already models the mandate's IDEA→QUESTIONS step directly. `Task { id, goalId, title, dependsOn[] }` with `TaskState = pending | running | awaiting-approval | verified | failed | abandoned` — a real dependency graph, not a flat list. `Budget { maxWallClockMs, maxTokens, maxCostMinor, maxIterations, maxConcurrency }` + `BudgetUsage` — bounded execution is a first-class type, not a convention (D-004: "Unlimited is never represented by an unbounded numeric value").
- **`registries.ts`**: `ModelDescription`/`ModelCapabilities` (with `Modality = text|code|image|audio|video`, `ModelStatus = current|preview|deprecated|retired`, `ReasoningCapability`, `ThinkingCapability`). `DiscoveryState = discovered → verified → cataloged → optional → enabled` and `CapabilityKind = agent | skill | prompt-pattern | method` with `CapabilitySource`/`CapabilityEntry`/`CapabilityResolver` — **this is already the capability registry the mandate's section 2 asks for**, just not wired to a UI or a real installer flow yet.
- **`adapters.ts`**: `AgentInvocation`, `AgentResult`, `AgentRunner`, `ApprovalPort`, `RunStore`, `ModelCatalog`, `OrchestratorHost` — the seams for a real agent runtime to plug into. No concrete `AgentRunner` exists yet (contracts only, honestly — this is real, not aspirational-fake).
- **`entitlement.ts`**: `EntitlementTier = FREE | PREMIUM | DEVELOPER` with real numeric `TIER_BUDGETS` (FREE: 2 min wall-clock / 50K tokens / $0 / 5 iterations / concurrency 1; PREMIUM & DEVELOPER: 30 min / 2M tokens / $50 / 50 iterations / concurrency 4) and an `ABSOLUTE_CEILING` no tier or override may ever exceed (60 min / 20M tokens / $1,000 / 500 iterations / 20 identical failures). A `DeveloperOverride` mechanism exists for `development`/`test` environments only, never `production`.
- **Referenced but missing**: `types.ts`'s own comments point to `project/ARCHITECTURE-ORCHESTRATOR.md` for "rationale and what is deliberately NOT modelled yet" — that file does not exist in this repository. Documentation gap, flagged for follow-up (see roadmap P0).

### 0.2 Capability engine — `studio/`

A second, complementary body of code (not a duplicate — different concern) implementing the actual *content* the orchestrator core operates on:

- **`studio/catalog/`**: `capability-index.ts`, `skill-loader.ts`, `content-adapter.ts`, `validation.ts`, `veldra-roles.ts`. Agent role manifests already carry **provenance and license tracking baked into their type**, via `provenance()`/`permissiveLicense()` helpers (`source: { sourceId, repository, revision, path, importedAs }`, `license: 'MIT' | ...`). This is exactly the "track where a skill/capability came from and what its license is" mechanism that a real installable-skills marketplace needs — it already exists at the data-model level.
- **`studio/orchestration/`**: `gauntlet.ts` defines `GAUNTLET_STATUSES = PLANNED, RESEARCHING, IMPLEMENTING, TESTING, REVIEWING, VERIFYING, BLOCKED, AWAITING_APPROVAL, COMPLETED, FAILED, CANCELLED` — a near-exact match for the mandate's `IDEA → QUESTIONS → REQUIREMENTS → PLAN → AGENTS → SKILLS → TOOLS → CODE → ASSETS → TEST → REPAIR → PREVIEW → DEPLOY` flow, already implemented as a real state machine, not a diagram. `ReviewGateName = ARCHITECTURE | SECURITY | LICENSE | TESTS | VERIFICATION | DOCUMENTATION` with `ReviewGateStatus = pending|passed|failed|blocked` — gated progression is already modeled. `FailureFingerprint { id, kind, message, count, firstSeenAt, lastSeenAt }` plus `MAX_IDENTICAL_FAILURES` imported from the orchestrator core's `budget.ts` — repeated-failure circuit-breaking (the same pattern every external coding-agent tool researched below also implements, independently) is already wired between the two subsystems.

### 0.3 Execution / sandbox layer — `app/lib/execution/`

`SandboxProvider`/`SandboxCapabilities`/`SandboxSession`/`SandboxCreateOptions` — a clean, provider-agnostic sandbox contract (matches D-002 "Provider-neutral boundaries"). `webcontainer.ts` is a real, race-hardened production adapter. This is the layer that already embodies the "no hard-lock on E2B" principle for code execution — the equivalent layer for *model* providers is `app/lib/modules/llm/providers/` (23 providers, see §3).

### 0.4 Persistence — `app/lib/persistence/`

Real, working IndexedDB-backed chat history (`db.ts`): message history, snapshots, forking, duplication. **Gap**: does not yet persist `Goal`/`Task`/`Budget` orchestrator state — see §7.

### 0.5 Legal / code-origin position — verified, not guessed

Per the mandate's section 22 ("noch NICHT blind löschen, noch NICHT blind umschreiben, erst einen Bericht erstellen"), a real, reproducible check was run this loop rather than relying on memory or assumption:

**Method**: shallow-cloned `stackblitz-labs/bolt.diy` at its current HEAD (commit `2e254ac1`, dated Feb 2026) and diffed file paths and content against this repository's `app/` tree.

**Result** (483 files in VELDRA's `app/`, 390 in upstream's):
- **306 files byte-identical** to upstream (verified via `diff -q`, not sampled).
- **84 files modified** from upstream (same path, different content) — exactly what 19 loops of Bolt→VELDRA renaming, Android adaptation, and branding work would produce.
- **93 files new** — VELDRA-only paths that don't exist in upstream at all, concentrated in `app/lib/orchestrator/` (13), `app/lib/modules/` (14), `app/lib/stores/` (10), `app/components/mobile/` (8), `app/lib/execution/` (7), `app/lib/adapters/` (6), `app/lib/.server/` (4), `app/lib/dev/` (3), `app/lib/android-api/` (3), plus per-file Android routes (`app/routes/api.android.*.ts` ×4, `android._index.tsx`, `api.update-manifest.ts`, `api.image.ts`).
- **0 files removed** — every upstream `app/`-relative file path still exists somewhere in VELDRA.
- Top-level directories that exist **only** in VELDRA, not in upstream at all (confirmed via upstream's own `ls -d */` = `app, assets, docs, electron, functions, icons, public, scripts, types`): **`studio/`, `android/`, `project/`**.

**Dependency license audit** (real, via `pnpm licenses list --prod`, ~1,500-entry production dependency tree, grepped for `gpl|agpl|sspl|bsl|unknown|copyleft`):
- `jszip`: dual `(MIT OR GPL-3.0-or-later)` — used under MIT terms, no issue.
- `atomically`, `stubborn-fs`: reported "Unknown" by the license checker (missing `license` field in their own `package.json`), but **both ship a real `license` file on disk reading "The MIT License (MIT)"** — verified by reading the actual file text, not guessed. A metadata gap in two upstream packages, not an actual licensing problem.
- Every other entry in the ~1,500-package tree: MIT / Apache-2.0 / BSD / 0BSD / Unlicense / MPL-2.0 / CC0 / AFL — all permissive. **Zero GPL/AGPL/SSPL/BSL copyleft risk found in the current dependency tree.**

**Existing attribution** (already correct, not touched this loop): `NOTICE.md` (Android-port copyright + bolt.diy/StackBlitz attribution + MIT retained), `LICENSE` (root, original MIT), `BRANDING.md` (asset-origin documentation, current through Loop 19).

**Gap identified**: no upstream fork-point commit hash was recorded anywhere in the repository before this loop, which made any future "what changed since the fork" claim unverifiable without re-guessing which upstream ref to diff against.

**Conclusion**: no evidence of undisclosed or unattributed third-party code. The 84 "modified" files are consistent with disclosed, attributed adaptation work, not a hidden derivation. **Recommendation is explicitly not a cleanup** (nothing found to clean up) — it is to record the verified fork-point ref (`stackblitz-labs/bolt.diy @ 2e254ac1`) plus this file-count breakdown in `NOTICE.md` or `BRANDING.md`, so the claim is reproducible evidence rather than a categorical assertion. See roadmap P0.

---

## 1. AI coding agent architectures — cross-tool research

Full per-tool detail (Claude Code, Codex CLI, Cline, Roo Code, Aider, OpenHands, Continue, OpenCode, Replit Agent, Base44, Emergent.sh, Freebuff, plus MCP) is preserved in the research agent's raw output; condensed findings and direct VELDRA implications below. Every tool's dimension that couldn't be verified from a real source is marked as such in the raw report — that discipline is preserved here.

### 1.1 Cross-cutting patterns (recurring in 3+ tools — the strongest signal)

1. **Plan/read-only mode as a first-class, cheaply-toggled state.** Claude Code (Plan Mode), Cline (Plan/Act), Roo Code (Ask/Architect), OpenCode (`plan` agent) all converge on a small-N mode set where one mode is explicitly non-mutating. **VELDRA implication**: the `gauntlet`'s `PLANNED`/`RESEARCHING` states already map onto this — but note none of the surveyed tools requires a *persisted structured plan artifact* the way VELDRA's `Goal`/`Task` model implies; most treat "plan mode" as disposable conversational scratch space. VELDRA's stricter model (a real, savable plan) is a genuine differentiator, not something to water down to match the field.
2. **Checkpointing is near-universal but never a git replacement.** Claude Code (file-snapshot + `/rewind`, last 100 kept), Cline (a separate shadow git repo under app storage, real commits per tool-use, 3 restore modes), Replit (snapshot engine, also a billing unit — don't conflate the two meanings), Aider (real git commits per edit, `/undo`). Every tool explicitly separates "session undo" from "real version control." **VELDRA implication**: any checkpoint system VELDRA builds should keep that same explicit separation, and Cline's shadow-git-repo pattern (captures even untracked files, never touches the user's real `.git`) is the most directly reusable design among the four.
3. **Context compaction converges on: LLM summary + verbatim-preserve-recent-N + discard old reasoning/rejected paths** (Claude Code, Codex, OpenCode; Roo Code's claim is unverified). Two genuinely differentiated moves worth studying: **Codex's structured-state-first path** — if session memory (task state, file-edit history, decisions) can substitute for a full summary, it skips the LLM call entirely, and most of its auto-compactions take this path; and **OpenCode's split** between a terse (2-sentence) user-facing summary and a fuller internal continuation summary. Both are directly actionable for VELDRA's `BudgetUsage` accounting, since compaction itself costs tokens.
4. **Sub-agent/multi-agent execution converges on isolated-context-window delegation with a merge-back-summary contract, not shared memory.** Claude Code's Task tool, Cline's SDK session layer, Freebuff's 9 named sub-agents, Emergent.sh's role-agents, Replit's under-documented "sub-agent orchestration" — spawn scoped worker → worker returns only a distilled result → parent context stays clean. **VELDRA implication**: this validates the `CapabilityKind='agent'` + `DiscoveryState` design as directionally correct — though notably, none of the surveyed tools has anything as formal as VELDRA's five-stage discovery state; most just have "installed" vs. "not installed." That extra staging is a real asset for a future skill/agent marketplace, not over-engineering.
5. **Permission models are 3-4 discrete tiers, never a single on/off switch.** Claude Code (ask/auto-accept/plan/bypass), Codex (suggest/auto-edit/full-auto), Replit (4 autonomy levels), Roo (per-mode tool/file allowlists). **VELDRA implication**: `EntitlementTier` (FREE/PREMIUM/DEVELOPER) is a monetization axis, not a runtime-trust axis — these should compose as two separate dimensions, not be conflated. See §6.
6. **File editing strategy correlates with model capability and is chosen per-model, not fixed.** Diff/patch-based (Codex's `apply_patch`, Aider's editblock/unified-diff) vs. full-file rewrite (weaker-model fallback) — Aider explicitly, Codex implicitly, select the format based on what the active model can reliably produce.
7. **Sandboxed/isolated shell execution is standard wherever autonomy is high** (Codex's seatbelt/iptables, OpenHands' Docker-mandatory runtime, Replit's isolated compute fabric). VELDRA's own D-1 decision (remote sandbox, not WebContainer, because Android WebView lacks `SharedArrayBuffer`) is squarely inside this pattern, not an outlier forced by a platform limitation — the field independently converged on the same answer for autonomy reasons alone.

### 1.2 What's genuinely novel and worth flagging

- **Codex's encrypted, opaque, server-side compaction blob** (`POST /v1/responses/compact`, AES-encrypted, anti-tampering) treats compacted state as a *security boundary*, not just a token-saving trick — no other tool does this. Implication for VELDRA: a future compaction/summarization step that feeds back into a bounded-execution loop is itself a potential prompt-injection surface, worth threat-modeling once built, not an afterthought.
- **OpenHands' event-stream architecture** (`User → Agent → LLM → Action → Runtime → Observation → Agent`, every state change a typed event) is the only surveyed design with peer-reviewed academic grounding (ICLR 2025) and is architecturally heavier than VELDRA likely needs today — but the "typed event log is the state" idea is directly relevant if the `gauntlet`'s status machine and review gates ever need replayable, auditable execution traces.
- **Freebuff's ad-funded, no-account, no-BYOK-required model** is a monetization novelty (see §6), not an architecture one.

### 1.3 MCP (Model Context Protocol) — current state

Spec `2025-06-18` (confirmed "Stable" from the primary spec doc) is the safe version to target; a `2025-11-25` reference surfaced in one secondary source only — **re-verify directly against modelcontextprotocol.io before hard-coding a version number anywhere**. Roles: Hosts / Clients / Servers, JSON-RPC 2.0, capability negotiation at init. Server primitives: Tools, Resources, Prompts. Client primitives: Sampling, Roots, Elicitation (added 2025-06-18). **Security note directly relevant to VELDRA's capability registry**: the spec explicitly states it "cannot enforce these principles at the protocol level" — user-consent gating before any tool invocation is pushed onto the *client/host* to implement, and tool descriptions/annotations from untrusted servers must be treated as untrusted text. This validates VELDRA's `DiscoveryState = discovered → verified → cataloged → optional → enabled` staging as necessary infrastructure, not caution for its own sake — MCP's own spec assumes exactly that kind of trust-escalation pipeline is somebody else's job.

Transport: **stdio** for same-machine single-client (no ports/auth/CORS, prefer whenever applicable); **Streamable HTTP** (spec 2025-03-26+) is the current standard for remote/multi-client servers; legacy **HTTP+SSE** is officially deprecated and being actively cut by several platforms during 2026 — any new VELDRA MCP client work should target Streamable HTTP only.

---

## 2. Recommended Agent/Skill/Tool/Connector/Provider architecture

This is a vertical extension of §0, not a new design. No new top-level system is proposed.

| Concept (mandate's terms) | Existing VELDRA type/mechanism | What's missing |
|---|---|---|
| Agent | `CapabilityKind='agent'` entries in `registries.ts`; `AgentManifest` role definitions in `studio/catalog/veldra-roles.ts` (with provenance+license) | A real `AgentRunner` implementation (currently a contract only); a UI to browse/install |
| Skill | `CapabilityKind='skill'`; `studio/catalog/skill-loader.ts` | Same as above — the SKILL.md convention researched in §1 (Anthropic's open spec, Apache-2.0) is a directly reusable format if VELDRA wants file-based skill definitions rather than only TS-typed ones |
| Subagent | `AgentInvocation`/`AgentResult` in `adapters.ts`, `Budget.maxConcurrency` | Concrete spawn/merge implementation |
| Tool | Not yet a distinct `CapabilityKind` — implicitly covered by `method` | Add `'tool'` as an explicit fourth (well, fifth) `CapabilityKind` value if tool-calling needs registry-level discovery independent of skills |
| Connector | Not modeled yet | New concept — see §5 (transport/connection abstraction). A `Connector` should be a thin wrapper describing *how* to reach a Provider/MCP server (transport, auth method), separate from the Provider/MCP server definition itself |
| Plugin | Not modeled yet | Lower priority than the above; `unplugin`'s pattern (see repository candidates doc) is a reasonable reference if a build-tool-agnostic plugin layer is ever needed across VELDRA's two Vite configs |
| MCP Server | Not modeled as a registry concept yet (only `mcpService.ts` exists as a service) | Model an MCP server as a `CapabilitySource` with its own `DiscoveryState`, reusing the exact staged-trust mechanism already designed for agents/skills — MCP servers are exactly the kind of "found something, haven't verified it yet" entity that state machine was built for |
| Provider | `app/lib/modules/llm/providers/` (23 providers), `SandboxProvider` (execution) | Already mature; see §3 for what's missing (a couple of newer LLM providers, "known vs. discoverable" UX) |
| Model | `ModelDescription`/`ModelCapabilities` in `registries.ts` | Already well-modeled; not wired to a live UI model-picker with capability-aware filtering yet |

**The one structural gap worth calling out explicitly**: `CapabilityKind` currently has four values (`agent | skill | prompt-pattern | method`) and none of them is `'connector'` or `'mcp-server'`. Extending that union (not replacing it) is the recommended vertical move — it reuses `DiscoveryState`, `CapabilitySource`, and `CapabilityResolver` as-is for two new concept types the mandate explicitly wants users to be able to "install"/"connect."

---

## 3. Providers — landscape gaps (light touch; 23 providers already implemented, not re-researched)

New/notable providers not yet in VELDRA's `app/lib/modules/llm/providers/` registry, found this loop (full pricing/detail in the raw research report — treat as directional, sourced from third-party aggregators, not vendor pricing pages):

- **MiniMax** — OpenAI-compatible; notable for a flat-fee "Token/Coding Plan" tier bundling text/speech/image/music/video under one key, distinct from its pay-as-you-go API.
- **Qwen (Alibaba, direct)** — OpenAI-, Anthropic-, and DashScope-native compatible; standalone OAuth free tier was discontinued 2026-04-15, API-key auth only now. Base URL `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`.
- **Novita AI, DeepInfra, SambaNova** — all OpenAI-compatible aggregators/inference clouds, differentiated mainly on price or hardware (SambaNova's custom RDU chips).
- **Nebius, Reka** — appeared in listings only, **not independently verified** — do not add without direct vendor documentation.

**"Known vs. discoverable" pattern, confirmed across real tools**: LibreChat's "Custom Endpoints" (with a `fetch: true` config flag enabling live `/v1/models` discovery), LiteLLM's separate `CustomLLM` base class distinct from its curated registry, and an open VS Code Copilot feature request (#319968) asking for the same on custom/OpenRouter endpoints — confirming this is still an active, unsolved-everywhere gap, not something VELDRA is behind on. **Recommendation**: VELDRA's existing "openai-like" provider type is already the right mechanism for the "discoverable" side; the missing piece is a dedicated onboarding flow that (a) tries live `/v1/models` discovery against whatever base URL the user enters, (b) falls back to manual model-ID entry when the endpoint doesn't support that route, rather than treating "openai-like" as just one more entry in a flat provider list.

---

## 4. Context Engine — architecture direction

### 4.1 What's real vs. what needs building

| Technique | Real OSS implementation | License | Directly usable from VELDRA's TS/Node stack? |
|---|---|---|---|
| Repo-map / dependency-graph context selection | Aider's tree-sitter + PageRank technique (aider.chat/2023/10/22/repomap.html); standalone reimplementation **RepoMapper** ships an MCP server mode | Aider: Apache-2.0; RepoMapper: MIT | Both Python — not embeddable in-process, but RepoMapper's MCP-server mode is callable as a subprocess/service without embedding Python |
| AST parsing | `tree-sitter` + `tree-sitter-typescript` (native Node bindings); `ts-morph` (wraps the TS Compiler API) | MIT (both) | **Yes, directly** — real npm packages, no subprocess needed |
| Embedding-based codebase RAG | Continue.dev's local-embeddings + LanceDB/SQLite design (⚠️ **Continue itself is now archived/read-only as of this research** — study the architecture, don't depend on the repo) | Apache-2.0 | Reference only |
| Repository packaging for AI context | **Repomix** — packs a repo into a single AI-friendly file with token counts and Secretlint secret-scanning; also an MCP server | MIT | **Yes, directly** — real, active, npm-installable |
| Small-model routing in front of a large model | **RouteLLM** (LMSYS) — real working proxy/framework, published results up to 85% cost reduction retaining 95% GPT-4-Turbo-level MT-Bench quality | Apache-2.0 | Python service, callable over HTTP, not in-process |
| Task decomposition reference | **Open SWE** (LangChain, LangGraph-based, TS) vs. SWE-agent's Agent-Computer-Interface pattern | Open SWE: MIT-family (verify exact file) | Open SWE is the closest stack match |

### 4.2 Prompt caching — verified directly from official docs (not third-party summaries)

| Provider | TTL | Cache-hit discount | Minimum tokens | Invalidation |
|---|---|---|---|---|
| Anthropic | 5 min default (free refresh on reuse) or 1h explicit | Read ≈0.1× base price; write ≈1.25× (5m) / 2× (1h) | 1024-4096 tokens depending on model | Hierarchical `tools → system → messages`; any change invalidates that level + everything after |
| OpenAI | 5-10 min idle (pre-GPT-5.6), 30 min guaranteed min (GPT-5.6+) | Up to 90% discount on cached tokens | Automatic ≥1024 tokens, 128-token increments | Exact-prefix match; content after the breakpoint can change freely |
| Google Gemini | Default 60 min, adjustable via explicit `ttl`/`expire_time` | Billed by TTL duration × cached tokens (not a simple %) | Not stated | Explicit cache object (create/update/delete), not automatic |

Direct implication: VELDRA's provider abstraction (`app/lib/modules/llm/providers/`) could expose a normalized `promptCaching` capability per provider (breakpoint count, min tokens, TTL options) inside `ModelCapabilities` — the type already has room for capability flags like this, this is an additive field, not a redesign.

### 4.3 What VELDRA should NOT try to adopt as a dependency

- Anthropic's own auto-compact algorithm is not open-sourced — any compaction VELDRA builds is an original design informed by the researched *behavior*, not an adopted library.
- No real, actively-maintained, open-source, directly-reusable "diff-based incremental context" library was found in either research pass — this is an architectural pattern to design in-house (following Aider's "only send what changed" principle), not something to shop for.

### 4.4 Recommended shape (naming only, not a spec)

A **VELDRA Context Engine**, layered on the existing orchestrator core rather than beside it:
1. **Repository map** — `tree-sitter`/`ts-morph`-based (in-process, MIT, no subprocess) producing a compact symbol graph, following Aider's ranking approach but implemented natively in TS rather than shelling out to a Python tool.
2. **File relevance scoring** — a ranking function over that graph plus recent-edit recency, feeding into what gets included per `Task`, not full-repo inclusion by default.
3. **Context cache** — normalized prompt-caching capability declarations per provider (§4.2), so the orchestrator can place stable content (system prompt, repo map) before volatile content (current task) to maximize cache-hit rate.
4. **Task/session/project memory** — persisted `Goal`/`Task`/decision state (§7), not just chat messages.
5. **Compressed history** — a compaction step modeled on the Codex/OpenCode pattern (structured-state-first, LLM-summary fallback, user-facing-vs-internal-summary split), consuming its own entry in `BudgetUsage` since compaction has a real token cost.

None of this is implemented yet. This is the direction the roadmap's P1 items point toward.

---

## 5. Connection methods / transport

Confirmed real, current patterns (full detail in raw research):

- **OAuth device-code flow (RFC 8628)**: right only when a browser genuinely can't open locally; PKCE authorization-code flow is now the safer general default (Vercel adopted device-flow for its CLI in Sept 2025, AWS moved away from it in the same period). GitHub Copilot CLI uses device-flow for interactive auth but **bypasses it entirely for BYOK** — directly relevant precedent since VELDRA is BYOK-centric for nearly all 23 providers.
- **Local OpenAI-compatible servers, now-standardized ports**: Ollama `127.0.0.1:11434/v1`, LM Studio `127.0.0.1:1234/v1` (⚠️ **no API-key enforcement at all** by default — security relies entirely on loopback binding), llama.cpp server `127.0.0.1:8080/v1`. On Android, reaching a laptop's local server means the phone must target the LAN IP, not `localhost` — a real onboarding friction point VELDRA's existing Ollama/LMStudio provider modules already have to deal with.
- **MCP transport**: stdio for local, Streamable HTTP for remote (see §1.3).
- **QR-code-initiated pairing**: real, low-risk pattern with concrete Android precedent (ShareRTC: SDP offer→QR→scan→answer→QR→scan→P2P channel). For VELDRA's likely actual use case — pairing a laptop's local model server with the phone app — a QR code encoding just `http://192.168.x.x:port` + an optional key is sufficient and needs **no WebRTC at all**; full WebRTC signaling-via-QR is only needed for direct device-to-device *data* transfer (e.g. moving a whole project between devices), which is a materially bigger feature.

**Premium-gating implication** (mandate §10): the mandate wants premium tiers to unlock "additional transport methods." Given the above, a defensible free/premium split is: FREE = manual endpoint entry (base URL + key, works for any provider/local server today); PREMIUM = QR-pairing convenience flow + any future WebRTC/Bluetooth device-to-device transfer. This doesn't block any *provider* behind a paywall — it gates *convenience*, not capability, which avoids the "premium features that feel like artificial limitations" trap.

---

## 6. Premium / Entitlement architecture — extending what exists

`app/lib/orchestrator/entitlement.ts` already implements `EntitlementTier = FREE | PREMIUM | DEVELOPER` with real budget ceilings (§0.1). The mandate wants a customer-facing **FREE / PREMIUM / PRO** three-tier split. These are not the same axis:

- **`DEVELOPER`** in the existing code is explicitly an *internal, non-production* tier (`ENVIRONMENTS_ALLOWING_OVERRIDE = ['development', 'test']` — never `'production'`) for simulating budget-exhaustion scenarios during testing. It is not a customer-facing tier and must not be repurposed as one.
- A customer-facing **`PRO`** tier is a genuinely new addition to `EntitlementTier`, sitting between `PREMIUM` and the internal `DEVELOPER` ceiling — not a rename of `DEVELOPER`.

Recommended shape (extends the existing `TIER_BUDGETS` table, does not redesign it):

| Tier | Maps to mandate's | Budget direction |
|---|---|---|
| `FREE` | "grundlegender Chat, begrenzte Modelle, grundlegende Projekte, grundlegende Agenten" | Already has real numbers (2 min / 50K tokens / $0 / 5 iter / concurrency 1) — these already read as genuinely restrictive-but-usable, not crippled |
| `PREMIUM` | "mehr Modelle, mehr Agenten, lokale Modelle, erweiterte Tools, mehr Speicher, zusätzliche Connectors" | Existing PREMIUM budget (30 min / 2M tokens / $50 / 50 iter / concurrency 4) is a reasonable starting point; local-model access and extra connectors are **capability flags**, not budget numbers — need a new `capabilities: Set<...>` alongside `Budget` |
| `PRO` (new) | "maximale Konfiguration, advanced agents, subagents, local inference, advanced routing, premium transports, extensive model support" | New tier; likely needs a budget between PREMIUM and `ABSOLUTE_CEILING`, plus every capability flag PREMIUM has, plus a few PRO-exclusive ones (advanced routing, premium transports per §5) |
| `DEVELOPER` (existing, unchanged) | not customer-facing | Stays exactly as-is — internal override tier for `development`/`test` only |

This is additive: `TIER_BUDGETS` gets a new `PRO` entry, `EntitlementTier` gets a new value, and a parallel `capabilities` concept (not yet in the type) is needed to represent binary feature access (local models, extra connectors, premium transports) that a budget number can't express. Nothing about the existing FREE/PREMIUM/DEVELOPER numbers or the `ABSOLUTE_CEILING` mechanism needs to change.

**Monetization note** (mandate §19): Freebuff's ad-funded, no-account model (researched in §1) is a real, live example of an alternative to paywalling — worth a one-line flag for VELDRA's own thinking given the project's `@webcontainer/api` 500-session/month ceiling already tracked as a cost concern. Not a recommendation to copy it, just evidence that "free tier funded by non-intrusive ads, no forced account" is a validated model in this exact product category as of 2026, not a hypothetical.

---

## 7. Session / project persistence

`app/lib/persistence/db.ts` already provides real IndexedDB-backed chat history (§0.4). The gap is that the orchestrator core's `Goal`/`Task`/`Budget`/decisions state has no persistence layer at all today — it only exists in memory during a run.

**Recommended direction** (reuses existing infrastructure, doesn't replace it): extend `db.ts`'s IndexedDB schema with a new object store for `Goal`+`Task` graphs (including `openQuestions`, decisions, and open-task state), keyed by chat/project ID the same way messages already are. This directly satisfies the mandate's "Project Goal + Requirements + Plan + Progress + Decisions + Files + Tests + Open Tasks must be persistent" requirement without inventing a second persistence mechanism alongside the one that already works.

**Reference pattern worth studying (not adopting as a dependency)**: OpenHands' event-sourcing design — an immutable event log for replay/recovery, with secrets kept server-side and never mirrored to localStorage. VELDRA has no backend yet (per CLAUDE.md: "nur IndexedDB/localStorage im Browser, kein Backend"), so this pattern isn't adoptable today, but the "secrets never touch localStorage" half of it is relevant now: audit which of VELDRA's 23 provider API keys currently live in localStorage/cookies (this was not re-audited in this research-only loop — flagged as a P0 follow-up check, not confirmed either way).

---

## 8. Local Intelligence Engine — model runtime research

Full comparison table with every verified/unverified platform claim is in the raw research report (agent 2). Summary of what's actually confirmed today:

### 8.1 Runtime formats, verified platform support

| Format/Runtime | Verified support | License | Best fit |
|---|---|---|---|
| **GGUF + llama.cpp** | Android (official JNI example) + iOS (official SwiftUI sample via XCFramework) + desktop | MIT | Most widely deployed, best-documented cross-platform local-LLM runtime |
| **ExecuTorch** (PyTorch edge) | Official: iOS, Android, Linux, bare-metal MCUs; Meta's own production rollout across Meta's apps; real device benchmarks (iPhone 15 Pro, Galaxy S24+, OnePlus 12) with Llama 3.2 1B/3B | BSD | **Best-verified path for running actual Llama-family small models on both Android and iOS today** — the strongest cross-platform evidence of any option researched |
| **LiteRT / LiteRT-LM** (Google, successor to TFLite/MediaPipe LLM Inference API) | LiteRT: Android/iOS/Web/IoT/desktop. LiteRT-LM (the LLM-specific orchestration layer, production backend for Gemini Nano in Chrome/Pixel Watch): **Android/Linux/macOS/Windows only in what was found — iOS not confirmed for this layer specifically**, don't conflate with base LiteRT's iOS support | Apache-2.0 | Google's current recommended Android path; MediaPipe LLM Inference API is in maintenance-only mode since June 2026, migrate to LiteRT-LM |
| **MLC-LLM / WebLLM** | Native Android + iOS SDKs documented; WebLLM is the browser/WASM+WebGPU variant, directly relevant to VELDRA's **web** target | Apache-2.0 | Real mobile SDKs but requires a per-model TVM compile step (more setup than llama.cpp) |
| **ONNX Runtime (+ Mobile/Web)** | Android (NNAPI), iOS (CoreML), Web (WASM/WebGPU) — official Phi-3/Phi-4-mini mobile examples exist | MIT | Broadest single-runtime platform span if the model is exported to ONNX |
| **Apple MLX** | README states "primarily Apple silicon and macOS" — **iOS support not independently confirmed** from the primary README, only inferred from a Swift package's existence | MIT | Mac-first dev tooling; verify iOS story against Apple's own docs before relying on it |
| **Core ML** | iOS/macOS native, well-established | Proprietary (Apple) | iOS-only path when targeting iOS specifically |
| **OpenVINO** | No prebuilt Android package — buildable from source only (NDK/CMake) | Apache-2.0 | Weak Android story vs. alternatives above — **not recommended** given VELDRA's Android-first priority |
| **SafeTensors** | Not a runtime — a serialization format only (important distinction, gets confused with GGUF/ONNX) | Apache-2.0/MIT | Source weight format to convert *from*, not something run directly |

### 8.2 Small models verified for on-device routing/classification (not code generation)

| Model | Size | Verified Android path | Note |
|---|---|---|---|
| **Gemma 3 270M** | 270M (~125MB INT4) | LiteRT / LiteRT-LM / gemma.cpp | Purpose-built by Google for exactly this use case — explicitly pitched for task-specific on-device fine-tuning |
| **Gemma 3 1B** | 1B | Same path | Larger, better general capability |
| **Llama 3.2 1B/3B (quantized)** | 1B/3B | ExecuTorch, real device benchmarks on iOS **and** Android | Best cross-platform-verified general-purpose small model |
| **Phi-3/4-mini** | 3.8B | ONNX Runtime GenAI, benchmarked (Galaxy S21: ~6.2 tok/s, ~2.7GB peak memory) | Heavier than the above for a "cheap router" role — real but noticeably larger footprint |
| **Gemini Nano** | undisclosed | ML Kit GenAI APIs / AICore (Pixel + Snapdragon/Dimensity devices with AICore) | Most production-grade path, but Google-managed — not a model VELDRA fine-tunes, only accessed via high-level task APIs |

### 8.3 Recommended shape (naming only)

A **VELDRA Local Intelligence Engine** as an *optional*, capability-gated layer (fits directly into the `SandboxCapabilities`-style "declare what you can do, never assume" pattern already used for execution providers): Gemma 3 270M/1B via ExecuTorch or LiteRT as the default candidate for intent classification/routing/prompt-optimization duty (smallest verified footprint, purpose-built for exactly this), with Llama 3.2 1B/3B via ExecuTorch as the cross-platform (Android+iOS) fallback once iOS is in scope. **Not recommended for this role**: Phi-3/4-mini (too heavy for a pre-processing/routing task specifically, better suited if VELDRA ever wants a genuinely capable *offline* assistant rather than a lightweight router) and MLX (iOS story unconfirmed) and OpenVINO (weak Android story).

**Explicitly not claimed**: none of this is implemented. This entire section is "here is what's technically possible and verified," per the mandate's "Aber keine Unterstützung behaupten, bevor sie technisch überprüft wurde."

---

## 9. Audio/music intelligence — brief (long-term direction, per mandate's own instruction not to over-invest here)

| Capability | Tool | License | Commercial-use status |
|---|---|---|---|
| Stem separation | Demucs (Meta) | MIT | ⚠️ Archived Jan 2025, no longer maintained — use `nomadkaraoke/python-audio-separator` (MIT, active) as the maintained successor wrapping the same model family |
| Chord/key/BPM | Essentia / essentia.js | **AGPL-3.0** | **Do not use as a linked dependency** — copyleft risk for a closed commercial app |
| Chord/key/BPM | madmom | BSD code, but **pretrained models are CC BY-NC-SA (non-commercial)** | Code alone is fine; shipped models are not usable commercially — easy-to-miss trap |
| Chord/key/BPM | librosa | ISC (permissive) | Clean, no landmine |
| Audio-text embeddings | CLAP (LAION-CLAP-Music) | CC0 | Clean |
| Music embeddings | MERT | **CC-BY-NC** | Not usable commercially without separate licensing |
| Media processing | FFmpeg | Dual LGPL/GPL depending on build flags | LGPL-only build (no `--enable-gpl`/`--enable-nonfree`) permits commercial closed-source use if dynamically linked — **this is a build-configuration decision that must be explicitly controlled**, not a fixed property of "using FFmpeg" |

This is a long-term direction, not near-term work — see roadmap P3.

---

## 10. Design/UX research pointer

Full findings (ChatGPT/Claude mobile, Claude Code terminal+VS Code UI, Replit/Base44/Emergent.sh, Material 3 Expressive, iOS 26 Liquid Glass, "AI is working" loading-state patterns, typography, motion) are written up in `VELDRA-DESIGN-SYSTEM.md`, not duplicated here.

---

## 11. Hosting / deployment, app platforms — brief

Not independently re-researched this loop (VELDRA already deploys to Cloudflare Pages/Workers per CLAUDE.md's stated stack) — the mandate's list (Vercel, Netlify, GitHub Pages, Supabase, Firebase) are all real, standard free-tier-available options for separately deploying individual future VELDRA services (e.g. a context-engine microservice, an MCP server) without committing the whole app to a second platform. Platform portability (§21 of the mandate: Android/Web/Windows/Linux/macOS/iOS) is already a stated architecture principle (CLAUDE.md's "Kein Hard-Lock auf einzelne Provider" extended to execution/runtime) — nothing in this research contradicts that; the runtime-format findings in §8 are explicitly the piece that determines how portable an *on-device inference* feature specifically would be, and ExecuTorch is the strongest verified cross-platform (Android+iOS) candidate found.

---

## Sources

Full source lists (every URL fetched, ~120 across the three research passes) are preserved in the raw agent reports referenced at the top of this document. Selected primary sources directly cited above: `code.claude.com/docs/en/sub-agents`, `code.claude.com/docs/en/permissions`, `code.claude.com/docs/en/skills`, `docs.openhands.dev/usage/architecture/runtime`, `modelcontextprotocol.io/specification/2025-06-18`, `aider.chat/2023/10/22/repomap.html`, `platform.claude.com/docs/en/build-with-claude/prompt-caching`, `developers.openai.com/api/docs/guides/prompt-caching`, `ai.google.dev/gemini-api/docs/caching`, `github.com/ggml-org/llama.cpp/blob/master/docs/android.md`, `github.com/pytorch/executorch`, `ai.google.dev/edge/litert/overview`, `github.com/google-ai-edge/LiteRT-LM`, `onnxruntime.ai/docs/get-started/with-mobile.html`, `github.com/ml-explore/mlx`, `docs.openvino.ai`, `developers.googleblog.com/en/introducing-gemma-3-270m`, `docs.ollama.com/api/openai-compatibility`, `lmstudio.ai/docs/developer/core/server`.
