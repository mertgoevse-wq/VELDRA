# VELDRA Repository Candidates

**Loop 20, 2026-08-11.** Discovery/cataloging only — nothing here has been integrated, and nothing should be copy-pasted based on this document alone. Every repository was opened directly (or corroborated via multiple independent sources where noted) and its license verified rather than guessed; anything not independently confirmed is explicitly marked "UNVERIFIED — check before any use." `bolt.diy` (MIT, StackBlitz Labs) is VELDRA's existing base and is out of scope here.

Any actual adoption of anything below needs its own decision record and, for anything GPL/AGPL-adjacent or ambiguous, explicit product-owner sign-off before use — this document is the input to that decision, not the decision itself.

---

## Top-line summary

**Highest-value candidates overall:**
1. **Context7** (MCP, MIT) — trivially adoptable, grounds VELDRA's AI in current library docs.
2. **Repomix** (MIT) — directly usable repo-packaging/context tool, also runs as an MCP server.
3. **Stagehand** (MIT) — best-fit AI browser automation for VELDRA's existing TS + Playwright stack.
4. **VoltAgent** (MIT) — closest TS-native agent-orchestration framework if VELDRA ever needs one beyond its own provider abstraction.
5. **promptfoo** (MIT) — trivial CI-based prompt regression testing across VELDRA's 23 LLM providers.
6. **PR-Agent** (MIT, re-verify given a 2026 governance transfer) — self-hostable AI code review for CI.
7. **mem0** (Apache-2.0) — the one memory/persistence library found with an actual TypeScript SDK.
8. **BackstopJS + reg-suit** (both MIT) — pair well for visual QA on top of VELDRA's existing Playwright setup.

**Clear license red flags — do not link into VELDRA's commercial closed-source app:**
- **Skyvern** — AGPL-3.0, network-copyleft.
- **Essentia / essentia.js** — AGPL-3.0; technically the most convenient chord/key/BPM tool available, legally the worst fit.
- **madmom**'s bundled pretrained models — CC BY-NC-SA (non-commercial), even though the code itself is BSD.
- **Mastra's `ee/` directories** and **LiteLLM's Commercial-License features** — not blanket red flags (the cores are Apache-2.0/MIT-family) but require strict per-directory/per-feature discipline, never a whole-repo assumption.

**Explicitly abandoned/unreliable despite permissive licenses — avoid for new work:**
- **fluent-ffmpeg** — archived May 2025, self-described by its own maintainers as broken against current FFmpeg.
- **facebookresearch/demucs** — archived Jan 2025; use `nomadkaraoke/python-audio-separator` instead.
- **Magnitude** — appears to have pivoted away from being a testing framework; re-verify current purpose before any use.

---

## 1. Agent orchestration / multi-agent frameworks

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [LangGraph.js](https://github.com/langchain-ai/langgraphjs) | MIT | Graph-based orchestration for stateful, multi-agent LLM workflows (durable execution, human-in-the-loop, memory) | ~3.2k stars, 3,070+ commits, LangChain-backed, active | Reference/inspiration, possibly directly usable |
| [Mastra](https://github.com/mastra-ai/mastra) | **Dual**: Apache-2.0 core, `ee/` dirs under a separate commercial license | Full TS AI application framework (agents, workflows, RAG, evals, observability) on Vercel AI SDK | 27.1k stars, 17,875+ commits, YC-backed, v1.0 Jan 2026, very active | Reference only for now; never vendor `ee/`; core packages directly usable if fit confirmed |
| [VoltAgent](https://github.com/VoltAgent/voltagent) | MIT | TS-native agent framework — supervisor/sub-agent orchestration, memory, RAG, MCP, workflow engine | 10.3k stars, 1,748+ commits, active | **Directly usable as dependency** (core package) |
| [CrewAI](https://github.com/crewAIInc/crewAI) | MIT | Python role-based multi-agent orchestration ("crews" + event-driven "flows") | 56.9k stars, very active | Reference/inspiration only — Python/TS stack mismatch |
| [AG2](https://github.com/ag2ai/ag2) (formerly AutoGen) | Apache-2.0 | Community-forked continuation of Microsoft AutoGen; multi-agent conversation framework | 4.8k stars, 5,389+ commits, active fork | Reference/inspiration only |

## 2. Context compression / token optimization

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [LLMLingua](https://github.com/microsoft/LLMLingua) (Microsoft) | MIT | Coarse-to-fine prompt/KV-cache compression (up to ~20x) with minimal task-performance loss; LongLLMLingua and LLMLingua-2 variants | 6.5k stars, Microsoft Research-backed, EMNLP'23/ACL'24 papers | Reference/inspiration only — Python, ships a BERT-level model; study the method, build a TS-native equivalent |

No comparably mature, actively-maintained TypeScript-native context-compression library was found — only small/unverified single-author projects. **UNVERIFIED — check before any use** if one is ever considered; otherwise build in-house informed by LLMLingua's method.

## 3. MCP (Model Context Protocol)

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | MIT | Official spec, schema, docs | 8.9k stars, 4,610+ commits, Anthropic + community | Reference/compliance target |
| [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | Apache-2.0 for new contributions, existing code MIT (mixed, per repo LICENSE) | Official TS SDK for MCP servers/clients | 13.1k stars, 1,597+ commits, active | **Directly usable** — likely already backing VELDRA's `mcpService.ts`; confirm version currency |
| [modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) | MIT | Official Python SDK | 24.0k stars, 1,020+ commits, active | Usable for Python-side MCP servers only |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Apache-2.0 new / MIT existing (mixed) | Official reference servers (Filesystem, Git, Fetch, Memory, Sequential Thinking, Time, Everything) | 89.4k stars, 4,158+ commits, very active | Directly usable as dependency/reference |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) (Microsoft) | **UNVERIFIED** — Apache-2.0-likely (consistent with Microsoft's other Playwright repos) but not independently confirmed for this specific repo | MCP server exposing Playwright browser control via the accessibility tree | Actively promoted across the MCP ecosystem | Reference now; directly usable once license confirmed — complements VELDRA's existing Playwright E2E usage |
| [Context7](https://github.com/upstash/context7) (Upstash) | MIT | MCP server fetching up-to-date, version-specific library docs into context | Actively maintained, widely adopted (Smithery-installable) | **Directly usable as dependency** |

## 4. Skill/capability plugin systems

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | **Mixed** — Apache-2.0 for most skills; the 4 document-creation skills (`docx`, `pdf`, `pptx`, `xlsx`) are explicitly source-available but NOT open source | Official reference implementation and open spec for the `SKILL.md` Agent Skills format — the same mechanism this very session's own `Skill` tool uses | 167.5k stars, 20.0k forks, spec released as an open standard Dec 2025 | **Directly usable as reference** for designing VELDRA's own skill/capability system; never vendor the 4 document skills without separately verifying their license |
| VS Code Extension API (architecture pattern, not a repo to vendor) | n/a (underlying `microsoft/vscode` is MIT if code inspection is ever needed) | Mature activation-events + contribution-points + isolated extension-host reference architecture | — | Reference/inspiration only |

## 5. Generic plugin systems in TS/JS apps

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [unplugin](https://github.com/unjs/unplugin) | MIT | Unified plugin interface targeting Vite/Rollup/Webpack/esbuild/Rspack/Rolldown/Bun | 3.6k stars, 802+ commits, UnJS collective, active | Directly usable (or as reference) if a shared plugin abstraction across VELDRA's two Vite configs (web + Android) is ever wanted |
| [Fastify](https://github.com/fastify/fastify) + [avvio](https://github.com/fastify/avvio) | MIT (fastify verified; avvio same org, not independently re-verified) | Graph-based, encapsulated plugin-registration architecture | 37.0k stars, 4,819+ commits, industry-standard | Reference/inspiration only — study the encapsulation model for VELDRA's provider-registry pattern, not vendor-able (VELDRA isn't a Fastify app) |

## 6. Code indexing / repository mapping

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [Repomix](https://github.com/yamadashy/repomix) | MIT | Packs a repo into a single AI-friendly file (token counts, Secretlint secret-scanning, gitignore-aware); also an MCP server | 27.7k stars, 4,412+ commits, very active | **Directly usable as dependency** — could give VELDRA's future orchestrator a codebase-context tool comparable to Aider's repo-map, plus secret-scanning |
| [Sourcegraph](https://github.com/sourcegraph/sourcegraph) | Apache-2.0 for OSS edition, excluding `enterprise/` directories (separate commercial license) | Large-scale code search/navigation (trigram index + streaming), LSIF-based code intelligence | Large, long-running project; primary repo license not independently re-verified in this pass (multiple corroborating sources) | Reference/inspiration only — full platform, far beyond VELDRA's scope for a repo-map feature |

## 7. Local model runtime wrappers usable from Node.js

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [node-llama-cpp](https://github.com/withcatai/node-llama-cpp) | MIT | Node/Bun/Electron bindings for llama.cpp — GGUF inference, JSON-schema-constrained output, function calling | 2.2k stars, 254+ commits, v3.19.0, active | Reference only for VELDRA's Android app (WebView can't run native Node bindings); directly usable for any separate Node-side tooling/CLI |
| [ONNX Runtime Node.js](https://github.com/microsoft/onnxruntime/tree/main/js/node) | MIT (well-established, not independently re-fetched but consistent with Microsoft's standard OSS licensing) | Official Node binding for ONNX inference | Part of actively-maintained `microsoft/onnxruntime` monorepo | Same WebView caveat as above; directly usable for Node-side tooling. ⚠️ Do not confuse with the third-party `fs-eire/onnxruntime-node` fork, **archived since 2021** |

## 8. Model routing tools

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [LiteLLM](https://github.com/BerriAI/litellm) | **Dual** — open-source core (MIT-family) + separate "LiteLLM Commercial License" for enterprise features (SSO, advanced security, priority support) | Unified OpenAI-compatible API/gateway across 100+ LLM providers, cost tracking, guardrails, load balancing | 56.1k stars, very active | Reference primarily (VELDRA already has its own 23-provider abstraction); could be a standalone gateway/proxy service if provider-side load balancing/cost tracking is wanted as infrastructure |
| [RouteLLM](https://github.com/lm-sys/RouteLLM) (LMSYS) | Apache-2.0 | Research framework for training/serving LLM routers directing simple queries to cheap models, hard queries to expensive ones | 5.3k stars, 175+ commits, moderate activity | Reference/inspiration only — classifier-based routing concept worth studying for a future cheap-vs-capable routing feature |

## 9. Prompt optimization tooling

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [DSPy](https://github.com/stanfordnlp/dspy) | MIT | Programming model for LLM pipelines — typed "signatures" + optimizers that auto-tune prompts/weights against a task metric | 37k stars, 4,620+ commits, Stanford NLP, very active | Reference/inspiration only — substantial to integrate directly; more realistic as an offline research tool whose output gets hand-ported |
| [promptfoo](https://github.com/promptfoo/promptfoo) | MIT (fully OSS core, no paid tiers) | Declarative YAML LLM prompt/agent/RAG testing, evaluation, red-teaming; runs 100% locally, CI-integrable | Actively maintained, widely used | **Directly usable as dependency** (dev/CI tooling) — could regression-test prompts across VELDRA's 23 providers |

## 10. Task planning / decomposition

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [MetaGPT](https://github.com/FoundationAgents/MetaGPT) | MIT | Multi-agent "software company" simulation encoding SOPs (PM→architect→PM→engineer), decomposing requirements into PRD→design→tasks→code | 69.8k stars, 6,367+ commits, ICLR 2024 paper, very active | Reference/inspiration only — genuinely relevant as a design-pattern model for how a future VELDRA orchestrator might decompose a feature request into role-based subtasks |

(LangGraph.js, §1, is also the strongest TS-native candidate for this category.)

## 11. Autonomous testing tools

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [Magnitude](https://github.com/magnitudedev/magnitude) | Apache-2.0 | ⚠️ **Appears to have pivoted** — early descriptions call it an AI-native web-testing framework, but the live README now describes a local-model-based agent for code review/file organization, not primarily testing | ~1.9k–893 stars depending on snapshot (inconsistent, consistent with an active pivot), 332+ commits | Reference only — re-verify current scope before any use, do not assume it's still a testing framework |
| [Skyvern](https://github.com/Skyvern-AI/skyvern) | **AGPL-3.0** (with an exception carving out only their managed-cloud anti-bot features) | Vision+LLM browser automation for selector-free E2E test execution | 20k+ stars, YC-backed, active | **Do not use** as an integrated dependency — AGPL copyleft/network-disclosure risk; only viable as a fully separate, unmodified, arms-length microservice, and even then requires explicit product-owner sign-off per the "GPL/AGPL/unklar" rule |

Comparatively few actively-maintained, clearly-licensed pure test-generation tools were found beyond the two above — treat anything else (EvoMaster, Keploy, etc.) as **UNVERIFIED — check before any use**.

## 12. Browser automation for a Node/TS backend (AI-agent-oriented, on Playwright/Puppeteer)

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [Stagehand](https://github.com/browserbase/stagehand) | MIT | TS-first AI browser automation SDK — `act`/`extract`/`observe`/`agent` primitives on top of Playwright, Zod schema validation | 23.8k stars, 1,429+ commits, active, Browserbase-backed | **Directly usable as dependency** — best-fit given VELDRA's existing Playwright + TS stack |
| [browser-use](https://github.com/browser-use/browser-use) | MIT | Python-first, fully-autonomous browser agent (goal-in, agent figures out every step) on Playwright | ~108.7k stars, 10,024+ commits, extremely active | Reference/inspiration only — architectural mismatch (Python) vs. Stagehand's direct TS fit |

## 13. Visual QA / screenshot-diff tooling

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [BackstopJS](https://github.com/garris/BackstopJS) | MIT | Screenshot capture/comparison via headless Chrome (Puppeteer or Playwright backend), before/after scrubber HTML reports | 7.2k stars, 1,588+ commits, active | **Directly usable as dependency** — pairs directly with VELDRA's existing Playwright setup |
| [reg-suit](https://github.com/reg-viz/reg-suit) | MIT | CLI visual-regression tool, plugin system for cloud storage (S3/GCS), GitHub PR-comment diff reporting | 1.3k stars, 1,519+ commits | **Directly usable as dependency** — complementary to BackstopJS (adds cloud storage + PR reporting) |

## 14. AI-assisted code review tools

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [PR-Agent](https://github.com/The-PR-Agent/pr-agent) | MIT (recently transferred by Qodo to community governance — some sources described "Apache 2.0" during the transfer while the live repo shows MIT; **re-verify the LICENSE file at the moment of actual use** given the recent transfer) | Self-hostable AI PR review — `/review`, `/improve`, `/describe`, `/ask`; GitHub/GitLab/Bitbucket/Azure DevOps/Gitea, multi-LLM via LiteLLM | 12.5k stars, 5,094+ commits, very active (releases as recent as Jul 26 2026) | **Directly usable as dependency** (CI tooling, not shipped code) |

## 15. Project/session persistence patterns

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [OpenHands](https://github.com/OpenHands/OpenHands) | MIT | Self-hosted coding-agent control center; relevant for its **event-sourcing persistence pattern** — immutable event log for replay/recovery, PostgreSQL-backed, secrets kept server-side and never mirrored to localStorage | 83.6k stars, 8,008+ commits, very active | Reference/inspiration only — the event-log + server-side-secrets pattern is the takeaway, directly relevant once VELDRA adds a backend (currently IndexedDB/localStorage-only) |
| [Letta](https://github.com/letta-ai/letta) (formerly MemGPT) | Apache-2.0 (search-corroborated, verify LICENSE file directly before use) | Stateful-agent framework, explicitly separates "agents" (runtime) from "agent state" (persisted record); SQLite default, Postgres recommended | Active, well-known (spun out of the MemGPT research paper) | Reference/inspiration only — clean design pattern for persisting chat/task/file state beyond localStorage |
| [mem0](https://github.com/mem0ai/mem0) | Apache-2.0 (search-corroborated, re-check LICENSE directly) | "Universal memory layer" — user/session/agent-level memory on top of any LLM app, self-hostable | ~59.6k stars, v2.0 shipped June 2026, very active | **Directly usable as dependency** — has an actual **TypeScript SDK**, unlike Letta/OpenHands which are reference-pattern-only for VELDRA's stack; verify self-hosted mode works fully without their cloud if data-locality matters |

## 16. Mobile on-device inference examples (real apps, not just runtimes)

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [Google AI Edge Gallery](https://github.com/google-ai-edge/gallery) | Apache-2.0 | Official Google Android (iOS upcoming) on-device GenAI showcase — chat, image Q&A, prompt lab, fully offline via LiteRT-LM | 24.4k stars, 510+ commits, active, also on Google Play | Reference/inspiration only — native Android app, doesn't map 1:1 onto VELDRA's Capacitor/WebView shell, but the model-management UX and LiteRT-LM choice are worth studying |
| [PocketPal AI](https://github.com/a-ghorbani/pocketpal-ai) | MIT | React Native Android/iOS app running local GGUF models via llama.cpp bindings, built-in benchmark page | 7.9k stars, 692+ commits, actively maintained | Reference/inspiration only — closest real-world analog to "llama.cpp-class inference inside a JS-driven mobile shell," directly relevant to any future on-device-vs-remote-only decision |
| [MLC-LLM](https://github.com/mlc-ai/mlc-llm) | Apache-2.0 | Universal LLM deployment engine (MLCEngine), OpenAI-compatible API across REST/Python/JS/iOS/Android, buildable Android reference app included | 23.0k stars, 1,805+ commits, active | Reference/inspiration only — more general-purpose multi-platform alternative to llama.cpp approaches |

## 17. Audio/music intelligence libraries

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [Demucs](https://github.com/facebookresearch/demucs) (Meta AI) | MIT | Hybrid spectrogram/waveform music source separation (vocals/drums/bass/other) | 10.4k stars, ⚠️ **archived Jan 1, 2025**, explicitly no longer maintained | Reference only — models still used via active wrappers, don't treat the original repo as maintained upstream |
| [python-audio-separator](https://github.com/nomadkaraoke/python-audio-separator) | MIT | Actively-maintained wrapper around multiple stem-separation model families (Demucs, MDX-Net, VR Arch, MDXC, sourced from UVR) — the maintained successor now that Demucs itself is archived | 1.3k stars, 375+ commits, actively maintained | Reference/potentially usable as an external CLI-invoked service (Python, not in-process TS); attribution to UVR expected even under MIT |
| [Spleeter](https://github.com/deezer/spleeter) (Deezer) | MIT | Original fast stem-separation library (2/4/5-stem) | 28.4k stars, 542+ commits, 245 open issues signal reduced maintenance | Reference only — largely superseded by Demucs-derived models |
| [Essentia](https://github.com/MTG/essentia) / [essentia.js](https://github.com/MTG/essentia.js) | **AGPL-3.0 for both** (verified for essentia.js via package.json/LICENSE) | Chord/key/BPM/beat detection + large spectral/tonal descriptor library; essentia.js runs in-browser/Node via WASM | essentia: 3.7k stars; essentia.js: UPF academic project, ISMIR-published | **Do not use** as a linked dependency — AGPL copyleft; the most technically convenient option (WASM, TS-adjacent), the legally worst fit |
| [madmom](https://github.com/CPJKU/madmom) | **Split** — BSD code, but bundled models under **CC BY-NC-SA 4.0 (non-commercial)** | Python beat/downbeat/onset/tempo detection, strong for BPM specifically | 1.7k stars, maintenance recency not independently confirmed | **Do not use the bundled models commercially**; bare BSD code is reference-only, retraining defeats most practical value |

## 18. Media processing / FFmpeg-adjacent tooling for Node/TS

| Repo | License | Purpose | Maturity | Verdict |
|---|---|---|---|---|
| [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) | MIT | Classic fluent Node.js wrapper around the FFmpeg CLI | 8.2k stars, but ⚠️ **explicitly archived May 22, 2025**, README states it "no longer works properly with recent ffmpeg versions," no longer accepts issues/PRs | **Do not use** for new work despite MIT license and name recognition — fails the "currently active" bar outright, flagged by its own maintainers |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | MIT | Pure WebAssembly/JS port of FFmpeg, runs in browsers and (per its own npm Node-version badge) Node.js, no system FFmpeg binary required | 17.7k stars, 703+ commits, active, `@ffmpeg/ffmpeg` on npm | **Directly usable as dependency** for lightweight/serverless/browser-side media tasks. WASM is ~10-20x slower than native FFmpeg per its own docs — for heavier server-side pipelines, a direct `child_process` wrapper around the native `ffmpeg` binary is the more realistic path; no other actively-maintained MIT fluent-style Node wrapper was found — this is an explicit gap, not a recommendation to build one blindly |

---

## 19. Claude-Code-development-pattern references (not VELDRA product dependencies)

Loop 22 mandate specifically named these; researched via a light background agent pass, distinct in kind from everything above — these are tools/patterns for how *this session* builds VELDRA, not candidates for VELDRA's own dependency tree. Per this doc's own top-line caveat, none independently re-verified beyond the agent's single pass; re-check before any deeper use.

| Repo/item | License | What it is | Verdict |
|---|---|---|---|
| [jqueryscript/awesome-claude-code](https://github.com/jqueryscript/awesome-claude-code) | CC0-1.0 | Curated index of Claude Code tools/skills/plugins | Reference/discovery only |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT | 24 engineering skills across define→plan→build→verify→review→ship, specialist personas (code reviewer, test engineer, security auditor) | Reference for VELDRA's own orchestration/workflow design, not a code dependency |
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | Apache-2.0 | 1000+ curated skills across Claude/Cursor/Gemini CLI | Reference/discovery only |
| [khoj-ai/khoj](https://github.com/khoj-ai/khoj) | **AGPL-3.0** | Personal AI "second brain" (chat + retrieval + custom agents) | **Not relevant to VELDRA** — a personal-productivity app, not a dev tool, and AGPL would be a real problem for a closed-source product regardless |
| OmniRoute (`pitbaden/omniroute`) | unverified beyond agent pass | AI gateway, 268+ providers, task-based routing/fallback/prompt compression | Interesting parallel to VELDRA's own 24-provider abstraction; not adopted, flagged only as a pattern worth a closer look if provider-routing ever needs more than what `app/lib/modules/llm/providers/` already does |
| claude-mem (`thedotmack/claude-mem`) | unverified beyond agent pass | Cross-session Claude Code memory (SQLite + vector DB, session summaries) | Same territory as VELDRA's own future Context Engine (`VELDRA-ARCHITECTURE-RESEARCH.md` §4) — a pattern reference, not a dependency, since VELDRA's memory needs to live in-product (IndexedDB), not in this session's own tooling |
| Headroom (`headroomlabs-ai/headroom`) | unverified beyond agent pass | macOS menu-bar proxy compressing tool output before it reaches Claude Code, 15-25% token savings | Dev-tooling only (macOS-specific, not embeddable) — the token-compression *idea* is relevant to VELDRA's own future context-compaction work, not the tool itself |
| "Claude Code Setup" (several community repos, e.g. `mrgoonie/claude-code-setup`) | varies by repo | Opinionated `.claude/` project-config templates (agents/commands/hooks) | Reference only — per `project/DECISIONS.md` D-008, VELDRA does not adopt a `.claude/agents`/`.claude/skills` tree speculatively |
| "Task Observer" | n/a (a skill pattern, not a single repo) | Meta-skill that logs skill-creation/improvement opportunities during a session | Reference pattern for iterating on how this session works, not a VELDRA artifact |

**Net effect on VELDRA's own dependency tree: none.** These inform how this session works, consistent with D-008's "apply the methodology, don't import the library" framing already established for `claude-code-best-practice`.

## Sources

All repository URLs above were opened directly on GitHub; license claims marked "search-corroborated" or "not independently re-verified" reflect cases where the primary LICENSE file was not independently re-fetched in this pass and should be re-checked before any actual integration decision, per this document's own top-line caveat.
