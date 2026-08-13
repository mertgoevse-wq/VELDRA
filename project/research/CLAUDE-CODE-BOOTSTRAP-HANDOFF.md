# CLAUDE CODE BOOTSTRAP HANDOFF

**Created:** 2026-08-12
**Session:** Reconnaissance and architecture analysis (no implementation performed)
**Working directory:** `/data/data/com.termux/files/home/VELDRA`
**Platform:** Debian ARM64 under Termux/proot-distro (Linux 6.17.0-PRoot-Distro aarch64)
**Claude Code runtime:** Amazon Bedrock (CLAUDE_CODE_USE_BEDROCK=1, AWS_REGION=us-east-2)
**Model used:** Opus 4.6

---

## CURRENT GIT STATE

```
Branch: main
HEAD:   bb495ea feat(ui): normalize skins and expose subagent activity
Tag:    veldra-before-freebuff-integration (at HEAD)

Local main is 5 COMMITS AHEAD of origin/main:
  bb495ea feat(ui): normalize skins and expose subagent activity
  32d6320 feat(runtime): redesign remote runtime configuration and settings UX
  9f70e88 feat(ui): fix accessibility gaps and implement subagent visualization widget
  5f7d455 docs(readme): redesign README as a professional product landing page
  76a7574 feat(design): implement true VELDRA skin system and document specs

origin/main: db0cfcf fix(brand): use the real approved brand photos, not an invented mark (Loop 22 Slice 1)

Remote: origin -> https://github.com/mertgoevse-wq/VELDRA.git

Untracked:
  .claude/           (only settings.local.json inside)
  .veldra-ecosystem/ (if present, from a prior attempt)
  public/assets/images/ (3 brand images)

Working tree: CLEAN (no modified tracked files)
```

**DO NOT:**
- `git reset --hard`
- `git push --force`
- discard the 5 unpushed commits
- delete any branches
- cherry-pick or merge branches without explicit product-owner approval

---

## ALL BRANCHES

All feature branches diverge from the same commit: `db0cfcf` (current origin/main).

| Branch | Commits vs main | Key Content | Status |
|--------|----------------|-------------|--------|
| `main` (local, 5 ahead) | +5 | SubagentService, SkillService, remote-runtime adapter, SubagentActivityWidget, skin normalization | Unpushed |
| `origin/claude/veldra-project-takeover-pitd9o` | +4 | **CLAUDE.md** (512 lines), **ARCHITECTURE-ORCHESTRATOR.md**, purple→accent sweep | Documentation; no code conflicts |
| `origin/claude/veldra-autonomous-build-gbctv8` | +24 | 9-skin architecture, WelcomeHero, BreathingBackground, greeting.ts, SkinPicker, CLAUDE.md adopted | Deliberately REMOVED subagent/skill services |
| `origin/freebuff/veldra-mobile-development` | +25 | Model picker bottom sheets, composer skin border, mobile-tab-groups | Mobile UX additions |
| `origin/claude/veldra-integration-freebuff` | +40 | Superset: SplashScreen, header z-index fix, **model-selector tap fix**, upload consolidation | Most complete; has critical fixes |
| `backup/main-before-freebuff-integration` | =main | Identical to local main HEAD | Safety bookmark |
| `origin/gh-pages` | orphan | MkDocs static site | Documentation only |

**Critical branch finding:** The autonomous-build branch deliberately REMOVED `subagentService.ts`, `skillService.ts`, and `remote-runtime.ts` that local main's 5 unpushed commits ADD. This represents an unresolved architectural disagreement. DO NOT resolve this without explicit decision.

---

## ENVIRONMENT

| Component | Version/Info |
|-----------|-------------|
| Node.js | 24.19.0 |
| pnpm | 9.14.4 |
| Architecture | aarch64 (ARM64) |
| Git | /usr/bin/git |
| Framework | Remix 2.15 + Vite 5.4 |
| UI | React 18 + UnoCSS + Radix UI |
| State | nanostores + IndexedDB |
| LLM SDK | AI SDK 4.3 (22+ provider adapters) |
| MCP | @modelcontextprotocol/sdk 1.15 |
| Android | Capacitor 7.6 + Gradle |
| Desktop | Electron 33 + electron-builder |
| Deploy | Cloudflare Workers/Pages (Wrangler) |
| Tests | Vitest (38 spec files, ~307 tests) |
| Lint | ESLint + Prettier + Husky pre-commit (typecheck + lint) |

---

## VELDRA ARCHITECTURE SUMMARY

### Real and Working (wired end-to-end)
- Chat/LLM via Remix server actions
- WebContainer code execution (desktop browsers)
- Android fallback runtime (IndexedDB filesystem, no shell)
- Remote Runtime client (authenticated WebSocket, file sync, allowlisted commands)
- MCP service (stdio/SSE/streamable-HTTP transports)
- IndexedDB persistence (chat history, snapshots, orchestrator runs)
- Multi-provider LLM registry (22+ providers)
- Execution provider registry with capability routing
- UnoCSS theming with VELDRA accent colors
- Pre-commit hooks (typecheck + lint)

### Contract-Only (types/tests exist, no runtime wiring)
- `studio/` orchestration (gauntlet, engineering loop, capability router) — **ZERO consumers in app/**
- `app/lib/orchestrator/` workflow engine (Goal/Task/Budget/Evidence) — **no runtime driver**
- Entitlement tiers (FREE/PREMIUM/PRO/DEVELOPER) — no billing integration
- Connector definitions — no live connection manager
- Catalog discovery and signed updates — no fetch/verify flow
- Agent swarm execution — no dispatcher

### Two Parallel Orchestration Systems (UNRESOLVED)

| | `studio/` | `app/lib/orchestrator/` |
|---|-----------|------------------------|
| Budget | Gauntlet budgets | `checkBudget()` |
| Failure detection | `recordFailure()` + fingerprinting | `findRepeatingFailure()` |
| State machine | 10-state gauntlet | WorkflowRun (data bag) |
| Agent dispatch | Capability router + skill resolver | AgentRunner port (no impl) |
| Review gates | 6 named gates | Evidence + VerificationRequirement |
| Tests | gauntlet.spec.ts, engine.spec.ts | budget.spec.ts, entitlement.spec.ts, registries.spec.ts |

**Recommendation (NOT YET IMPLEMENTED):** Use `app/lib/orchestrator/` types as portable contracts; use `studio/` logic as implementation. But DO NOT reconcile without deliberate architectural review.

### CRITICAL ARCHITECTURAL PRINCIPLE

```
Claude Code .claude/agents/ and .claude/skills/ = DEVELOPMENT/ENGINEERING layer
  (helps BUILD VELDRA, runs inside Claude Code sessions)

VELDRA's studio/ + app/lib/orchestrator/ = PRODUCT/RUNTIME layer
  (runs inside the VELDRA app for end-users)

These are SEPARATE concerns. Do NOT replace one with the other.
```

---

## CURRENT CLAUDE CODE CONFIGURATION

```
.claude/settings.local.json:
  {"permissions":{"allow":["Bash(git *)"]}}

/root/.claude/settings.json:
  {"effortLevel":"high","theme":"dark"}

.claude/agents/    → DOES NOT EXIST (to be created)
.claude/skills/    → DOES NOT EXIST (to be created)
.mcp*              → NO MCP CONFIG FILES EXIST
```

---

## EXTERNAL RESOURCES TO INSTALL/INTEGRATE

### Category A: Claude Code Skills/Agents (install into .claude/)

| Resource | URL | License | Action |
|----------|-----|---------|--------|
| **ECC** (Everything Claude Code) | https://github.com/affaan-m/ECC | MIT | Evaluate skills/instincts/memory patterns; selectively adapt useful ones into `.claude/skills/` and `.claude/agents/` |
| **awesome-claude-code-subagents** | https://github.com/VoltAgent/awesome-claude-code-subagents | MIT | Evaluate 100+ subagent definitions; adapt useful ones into `.claude/agents/` |
| **awesome-claude-code** | https://github.com/hesreallyhim/awesome-claude-code | — | Discovery index; use to find additional skills/tools |
| **awesome-claude-skills** | https://github.com/travisvn/awesome-claude-skills | — | NOTE: previously attempted as `mingrath/awesome-claude-skills` which returned "Repository not found". The correct source appears to be `travisvn/awesome-claude-skills`. VERIFY this URL before use. If invalid, search GitHub for "awesome claude skills" to find the current canonical collection. |

**IMPORTANT:** Do not blindly clone entire repositories into VELDRA. Instead:
1. Clone/fetch the repository to a temporary location
2. Inspect its structure, license, and contents
3. Identify individual skills/agents that are relevant to VELDRA development
4. Adapt (not copy) the useful ones into VELDRA's `.claude/` structure
5. Ensure no license conflicts (GPL/AGPL = SKIP)

### Category B: MCP Servers (configure for development use)

| Resource | URL | License | Action |
|----------|-----|---------|--------|
| **MCP Servers** (official) | https://github.com/modelcontextprotocol/servers | Apache-2.0/MIT | Evaluate filesystem, git, and fetch servers for development use |
| **MCP TypeScript SDK** | https://github.com/modelcontextprotocol/typescript-sdk | MIT/Apache-2.0 | Already present as `@modelcontextprotocol/sdk@^1.15.0` in VELDRA's package.json — VERIFY version currency, do not duplicate |
| **Context7** | https://github.com/upstash/context7 | MIT | MCP server for current library documentation; evaluate as development tool |
| **Repomix** | https://github.com/yamadashy/repomix | MIT | Repo-packaging + MCP server; evaluate for codebase context generation |

### Category C: Development Tools (install globally or as devDependencies)

| Resource | URL | License | Action |
|----------|-----|---------|--------|
| **promptfoo** | https://github.com/promptfoo/promptfoo | MIT | Prompt/agent regression testing; evaluate for VELDRA's system prompt quality assurance |

### Category D: Reference Only (do NOT install, learn patterns from)

| Resource | URL | Value |
|----------|-----|-------|
| anthropics/anthropic-cookbook | https://github.com/anthropics/anthropic-cookbook | Tool-use and streaming patterns |
| Windy3f3f3f3f/how-claude-code-works | https://github.com/Windy3f3f3f3f/how-claude-code-works | Agent loop internals |
| ratel-ai/ratel | https://github.com/ratel-ai/ratel | Token optimization (BM25/progressive disclosure) |
| LangGraph.js | https://github.com/langchain-ai/langgraphjs | Graph state machine patterns |

---

## PROPOSED .claude/ STRUCTURE

```
.claude/
  settings.local.json        ← EXISTS (permissions only)
  agents/
    architect.md             ← Validates changes against VELDRA architecture
    researcher.md            ← Parallel external research with web access
    reviewer.md              ← Code review against VELDRA conventions
    tester.md                ← Writes and runs tests
    mobile-qa.md             ← Audits UI at mobile viewports
  skills/
    verify-build/            ← Run typecheck + lint + test + build
      SKILL.md
    android-cycle/           ← Run android:sync + Gradle build
      SKILL.md
    branch-archaeology/      ← Analyze branch diffs and recommend actions
      SKILL.md
    architecture-check/      ← Verify change doesn't duplicate existing subsystems
      SKILL.md
    token-report/            ← Estimate context usage and suggest optimization
      SKILL.md
```

Each agent should:
- Have a clear, narrow responsibility
- Reference VELDRA's specific architecture (not generic)
- Include allowed/denied tool lists
- Follow the Fable-5 principle: "Brief like a smart colleague who just walked into the room"

---

## ENGINEERING PRINCIPLES (from Fable-5 / Best Practice Research)

These should inform the CLAUDE.md and agent definitions:

1. **Evidence before assertion** — A task isn't done because an agent says so; it needs inspectable artifacts
2. **Autonomous for reversible** — Proceed without asking for reversible actions; stop for destructive or scope-change decisions
3. **Pipeline-first orchestration** — Default to streaming pipelines; only synchronize when cross-item context is genuinely needed
4. **Adversarial verification** — For code review, spawn independent skeptics that try to REFUTE findings
5. **Budget-gated loops** — Loop until "dry" (consecutive empty rounds) not fixed iteration counts
6. **Resumable context** — Design for context compression; don't wrap up early
7. **Minimal narration** — Don't narrate plans; execute them. Check last paragraph: if it's a plan, do it instead
8. **Match surrounding code** — Write code that reads like its neighbors
9. **No completion without evidence** — Never mark done if tests fail, implementation is partial, or errors are unresolved

---

## WHAT HAS NOT BEEN CHANGED THIS SESSION

- No files created in `.claude/agents/` or `.claude/skills/`
- No CLAUDE.md created on main (exists only on takeover branch)
- No branches merged or cherry-picked
- No external repositories cloned or installed
- No MCP servers configured
- No dependencies added to package.json
- No code modified
- The 5 unpushed local commits remain as-is
- All branch divergence remains unresolved

---

## NEXT-SESSION EXECUTION PLAN

The next Claude Code session MUST:

### Phase 1: Orientation (5 min)
1. Read this file: `project/research/CLAUDE-CODE-BOOTSTRAP-HANDOFF.md`
2. Verify git state: `git status`, `git log --oneline -6`, `git remote -v`
3. Confirm environment: `node --version`, `pnpm --version`
4. Read `project/STATUS.md` and `project/SESSION-HANDOFF.md` for additional context

### Phase 2: CLAUDE.md Adoption (10 min)
1. Read the CLAUDE.md from the takeover branch: `git show origin/claude/veldra-project-takeover-pitd9o:CLAUDE.md`
2. Evaluate whether it should be adopted as-is or modified
3. Create/write CLAUDE.md on main (the product owner has previously approved this in principle)
4. Also adopt ARCHITECTURE-ORCHESTRATOR.md: `git show origin/claude/veldra-project-takeover-pitd9o:project/ARCHITECTURE-ORCHESTRATOR.md`

### Phase 3: External Resource Evaluation (20 min, use subagents)
1. **VERIFY** all repository URLs still exist and are accessible
2. Clone ECC to a temporary location, inspect structure, identify useful skills
3. Clone VoltAgent/awesome-claude-code-subagents, inspect agent definitions
4. Find and verify the correct awesome-claude-skills repository (try `travisvn/awesome-claude-skills`)
5. Check awesome-claude-code for additional discoveries
6. For each candidate skill/agent: check license, check relevance, check quality

### Phase 4: .claude/ Structure Creation (15 min)
1. Create `.claude/agents/` with the 5 proposed agents (architect, researcher, reviewer, tester, mobile-qa)
2. Create `.claude/skills/` with the 5 proposed skills (verify-build, android-cycle, branch-archaeology, architecture-check, token-report)
3. Incorporate useful patterns from ECC and VoltAgent subagents into these definitions
4. Ensure agents reference VELDRA's actual architecture, not generic instructions

### Phase 5: MCP Configuration (10 min)
1. Evaluate Context7 and Repomix as MCP development servers
2. If useful, configure them in the appropriate MCP config location
3. Verify `@modelcontextprotocol/sdk` version in package.json is current
4. Do NOT install MCP servers that require cloud credentials without explicit authorization

### Phase 6: promptfoo Evaluation (10 min)
1. Evaluate promptfoo for testing VELDRA's system prompts
2. If useful, add as a devDependency or global tool
3. Consider a basic prompt regression test for VELDRA's 4 chat system prompts

### Phase 7: Verification (5 min)
1. Run `pnpm typecheck` — must pass
2. Run `pnpm lint` — must pass
3. Run `pnpm test` — must pass (~307 tests)
4. Verify no secrets or credentials are committed
5. Update `project/STATUS.md` with what was accomplished

### DO NOT in the next session:
- Replace VELDRA's internal orchestration (studio/, app/lib/orchestrator/)
- Merge branches without product-owner approval
- Push to origin without explicit request
- Install large frameworks (AutoGen, LangGraph, CrewAI) as runtime dependencies
- Add MCP servers that make external network calls without authorization
- Modify the working Bedrock configuration
- Create parallel architectures to what VELDRA already has

---

## COMMAND TO START NEXT SESSION

From the VELDRA repository directory, start Claude Code and instruct it to read this handoff:

```bash
cd /data/data/com.termux/files/home/VELDRA
claude
```

Then in Claude Code:

```
Read project/research/CLAUDE-CODE-BOOTSTRAP-HANDOFF.md and execute the next-session plan described there. This is a continuation of VELDRA multi-agent engineering environment setup. Start with Phase 1 orientation, then proceed through all phases. Use subagents where appropriate for parallel work.
```

---

## FILE LOCATIONS FOR CONTEXT

| File | Purpose |
|------|---------|
| `project/research/CLAUDE-CODE-BOOTSTRAP-HANDOFF.md` | THIS FILE — start here |
| `project/STATUS.md` | Full development history (very long, read selectively) |
| `project/SESSION-HANDOFF.md` | Condensed handoff from prior loops |
| `project/DECISIONS.md` | Architectural decisions D-001 through D-007 |
| `project/ROADMAP.md` | Current priorities |
| `project/RISKS.md` | Known risks |
| `project/research/VELDRA-REPOSITORY-CANDIDATES.md` | Loop 20's external repo research |
| `project/research/VELDRA-ARCHITECTURE-RESEARCH.md` | Architecture patterns research |
| `studio/catalog/veldra-roles.ts` | 8 defined agent manifests |
| `studio/orchestration/gauntlet.ts` | Gauntlet state machine |
| `app/lib/orchestrator/types.ts` | Portable orchestration contracts |
| `app/lib/services/mcpService.ts` | Working MCP implementation |
| `app/lib/services/subagentService.ts` | Working subagent spawner (local main only) |
| `app/lib/services/skillService.ts` | Minimal skill loader (local main only) |
