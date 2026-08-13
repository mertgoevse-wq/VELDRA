# VELDRA Ecosystem Capability Inventory
**Date**: 2026-08-13  
**Purpose**: Catalog available capabilities from ecosystem repos for VELDRA integration

## Classification System

- **A**: Directly useful, should be adapted into VELDRA
- **B**: Useful as external development reference
- **C**: Redundant with existing VELDRA functionality
- **D**: Irrelevant to VELDRA's goals
- **E**: Unsafe/unnecessary dependency

## Ecosystem Repositories

### 1. everything-claude-code (ECC)
**Location**: `/root/repos/everything-claude-code`  
**Type**: Full reference implementation  
**Purpose**: Battle-tested patterns for Claude Code development

#### Skills Available (40+)

| Skill | Category | Classification | Notes |
|-------|----------|----------------|-------|
| **security-review** | Quality | **A** | Adapt for VELDRA security review workflow |
| **tdd-workflow** | Testing | **A** | Integrate into VELDRA dev workflow |
| **verification-loop** | Quality | **A** | Evidence-based verification pattern |
| **unified-memory** | Context | **A** | Context management across agents |
| **strategic-compact** | Planning | **B** | Reference for planning workflows |
| **agent-introspection-debugging** | Debug | **A** | Debug multi-agent orchestration |
| **api-design** | Development | **B** | Reference for API patterns |
| **backend-patterns** | Development | **B** | Reference for backend design |
| **frontend-patterns** | Development | **B** | Reference for frontend design |
| **coding-standards** | Quality | **C** | We have ECC rules already |
| **deep-research** | Research | **A** | Enhance veldra-researcher |
| **documentation-lookup** | Docs | **B** | Reference for doc search |
| **e2e-testing** | Testing | **A** | E2E test patterns |
| **eval-harness** | Testing | **B** | Agent evaluation framework |
| **everything-claude-code** | Meta | **B** | ECC self-documentation |
| **exa-search** | Research | **A** | Web search integration |
| **mcp-server-patterns** | MCP | **A** | MCP server development |
| **nextjs-turbopack** | Build | **D** | VELDRA uses Vite |
| **bun-runtime** | Build | **D** | VELDRA uses Node/npm |
| **plan-canvas** | Planning | **B** | Visual planning reference |

**Priority Integrations**:
1. **security-review** → Adapt for VELDRA security workflow
2. **tdd-workflow** → Integrate TDD patterns
3. **verification-loop** → Evidence collection
4. **unified-memory** → Context management
5. **agent-introspection-debugging** → Orchestrator debugging
6. **deep-research** → Enhance veldra-researcher
7. **e2e-testing** → Test critical flows
8. **mcp-server-patterns** → MCP development guide

#### Commands Available

| Command | Purpose | Classification | Notes |
|---------|---------|----------------|-------|
| **feature-development** | End-to-end feature workflow | **A** | Adapt for VELDRA |
| **database-migration** | DB migration workflow | **B** | Reference when needed |
| **add-language-rules** | Language-specific rules | **B** | Reference pattern |

#### Rules/Guardrails

| Rule | Purpose | Classification | Notes |
|------|---------|----------------|-------|
| **everything-claude-code-guardrails** | Safety constraints | **A** | Review and adapt |
| **node.md** | Node.js best practices | **B** | Reference for Node runtime |

### 2. awesome-claude-code-subagents
**Location**: `/root/repos/awesome-claude-code-subagents`  
**Type**: Agent pattern catalog  
**Purpose**: Specialized agent templates

#### Categories (10 total, 100+ agents)

##### 01-core-development (12 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **frontend-developer** | **A** | VELDRA needs frontend specialist |
| **backend-developer** | **B** | Reference for backend patterns |
| **fullstack-developer** | **C** | Too broad, we prefer specialized |
| **mobile-developer** | **A** | Android/Capacitor specialist needed |
| **electron-pro** | **B** | Future desktop support |
| **ui-designer** | **A** | Complement ui-ux-pro-max skill |
| **api-designer** | **B** | API design reference |
| **graphql-architect** | **D** | VELDRA doesn't use GraphQL |
| **microservices-architect** | **D** | Not applicable to VELDRA |
| **websocket-engineer** | **B** | Reference for real-time features |
| **design-bridge** | **B** | Design-to-code workflow |

**Priority**: frontend-developer, mobile-developer, ui-designer

##### 02-language-specialists (30+ agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **typescript-pro** | **A** | VELDRA is TypeScript-heavy |
| **javascript-pro** | **C** | Covered by TypeScript |
| **react-specialist** | **A** | VELDRA uses React |
| **python-pro** | **D** | No Python in VELDRA |
| **golang-pro** | **D** | No Go in VELDRA |
| **rust-expert** | **D** | No Rust in VELDRA |

**Priority**: typescript-pro, react-specialist

##### 03-infrastructure (10 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **devops-engineer** | **B** | Reference for CI/CD |
| **docker-specialist** | **D** | Not applicable |
| **kubernetes-expert** | **D** | Not applicable |
| **cloud-architect** | **B** | Reference for remote runtime |

**Priority**: None critical

##### 04-quality-security (15 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **code-reviewer** | **C** | Already have veldra-code-reviewer |
| **security-auditor** | **C** | Already have veldra-security |
| **performance-optimizer** | **A** | Bundle size, runtime perf |
| **accessibility-expert** | **A** | Mobile, WCAG compliance |
| **test-engineer** | **A** | TDD, test coverage |
| **qa-specialist** | **B** | Reference for QA workflow |

**Priority**: performance-optimizer, accessibility-expert, test-engineer

##### 05-data-ai (12 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **ml-engineer** | **D** | Not applicable |
| **data-scientist** | **D** | Not applicable |
| **llm-specialist** | **B** | Reference for LLM integration |
| **prompt-engineer** | **B** | Reference for agent prompts |

**Priority**: None critical (llm-specialist as reference)

##### 06-developer-experience (8 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **documentation-writer** | **A** | ADRs, API docs, README |
| **onboarding-specialist** | **B** | Reference for VELDRA onboarding |
| **migration-expert** | **B** | Reference for migrations |
| **build-tooling-expert** | **A** | Vite, bundling, optimization |

**Priority**: documentation-writer, build-tooling-expert

##### 07-specialized-domains (10 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **game-developer** | **D** | Not applicable |
| **blockchain-developer** | **D** | Not applicable |
| **embedded-systems-engineer** | **D** | Not applicable |
| **pwa-specialist** | **A** | VELDRA could be PWA |

**Priority**: pwa-specialist

##### 08-business-product (8 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **product-manager** | **B** | Reference for product decisions |
| **ux-researcher** | **A** | User experience analysis |
| **technical-writer** | **B** | Reference for docs |
| **requirements-analyst** | **B** | Reference for specs |

**Priority**: ux-researcher

##### 09-meta-orchestration (6 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **agent-coordinator** | **A** | Multi-agent workflows |
| **workflow-architect** | **A** | Orchestration patterns |
| **context-manager** | **C** | Already have veldra-context-manager |
| **budget-optimizer** | **A** | Token budget tracking |

**Priority**: agent-coordinator, workflow-architect, budget-optimizer

##### 10-research-analysis (10 agents)

| Agent | Classification | Notes |
|-------|----------------|-------|
| **research-analyst** | **C** | Already have veldra-researcher |
| **competitive-analyst** | **D** | Not applicable |
| **technical-interviewer** | **D** | Not applicable |
| **patent-researcher** | **D** | Not applicable |

**Priority**: None critical

### 3. awesome-claude-code
**Location**: `/root/repos/awesome-claude-code`  
**Type**: Resource catalog (skills, tools, guides)  
**Purpose**: Comprehensive ecosystem index

**Status**: Large CSV catalog (71KB), needs detailed analysis

**Quick Scan Results**:
- 100+ resources cataloged
- Skills, commands, hooks, MCP servers
- Community contributions
- Integration patterns

**Action**: Parse `THE_RESOURCES_TABLE_NEW.csv` for VELDRA-relevant entries

### 4. mcp-servers
**Location**: `/root/repos/mcp-servers`  
**Type**: MCP server catalog  
**Purpose**: Tool/capability discovery

**Integration Strategy**:
1. Parse catalog for VELDRA-relevant servers
2. Prioritize: filesystem, git, memory, browser
3. Document integration patterns
4. Add to VELDRA MCP registry

### 5. mcp-specification
**Location**: `/root/repos/mcp-specification`  
**Type**: Protocol specification  
**Purpose**: Reference for MCP development

**Classification**: **B** (reference)

**Use Cases**:
- MCP server development
- Tool registration patterns
- Capability negotiation
- Error handling

## Priority Integration Matrix

### Immediate (P0) — Fill Critical Gaps

| Capability | Source | Target | Effort | Impact |
|------------|--------|--------|--------|--------|
| **Frontend Specialist** | awesome-subagents/01 | .claude/agents/ | Medium | High |
| **TypeScript Specialist** | awesome-subagents/02 | .claude/agents/ | Medium | High |
| **Performance Optimizer** | awesome-subagents/04 | .claude/agents/ | Medium | High |
| **Test Engineer** | awesome-subagents/04 | .claude/agents/ | Medium | High |
| **Security Review Skill** | ECC/.agents/skills/ | .claude/skills/ | Medium | High |
| **TDD Workflow Skill** | ECC/.agents/skills/ | .claude/skills/ | Medium | High |

### Short-term (P1) — Enhance Capabilities

| Capability | Source | Target | Effort | Impact |
|------------|--------|--------|--------|--------|
| **Accessibility Expert** | awesome-subagents/04 | .claude/agents/ | Medium | Medium |
| **Documentation Writer** | awesome-subagents/06 | .claude/agents/ | Low | Medium |
| **Build Tooling Expert** | awesome-subagents/06 | .claude/agents/ | Medium | Medium |
| **Agent Coordinator** | awesome-subagents/09 | .claude/agents/ | High | High |
| **Workflow Architect** | awesome-subagents/09 | .claude/agents/ | High | High |
| **E2E Testing Skill** | ECC/.agents/skills/ | .claude/skills/ | Medium | Medium |
| **MCP Server Patterns** | ECC/.agents/skills/ | .claude/skills/ | Low | High |

### Long-term (P2) — Polish & Optimization

| Capability | Source | Target | Effort | Impact |
|------------|--------|--------|--------|--------|
| **PWA Specialist** | awesome-subagents/07 | .claude/agents/ | Medium | Low |
| **UX Researcher** | awesome-subagents/08 | .claude/agents/ | Low | Low |
| **Budget Optimizer** | awesome-subagents/09 | .claude/agents/ | Medium | Medium |
| **Deep Research Skill** | ECC/.agents/skills/ | .claude/skills/ | Medium | Medium |
| **Verification Loop** | ECC/.agents/skills/ | .claude/skills/ | High | Medium |

## Integration Principles

### 1. Adapt, Don't Copy

❌ **DON'T**:
- Copy entire agent files verbatim
- Include non-VELDRA specific instructions
- Create duplicate capabilities
- Blindly install every MCP server

✅ **DO**:
- Study the pattern/methodology
- Extract core algorithms
- Customize for VELDRA architecture
- Preserve provider neutrality
- Maintain mobile-first design
- Add source attribution

### 2. Progressive Disclosure

Load detailed instructions only when relevant:
- Skill triggered by task type
- Agent invoked by complexity
- Command called explicitly
- MCP server needed for tool

### 3. VELDRA-Native Implementation

Every integration must:
- Support multi-platform (Web, Electron, Android)
- Respect provider neutrality
- Use Nanostores for state
- Follow immutability principles
- Include comprehensive tests
- Document clearly

### 4. Source Attribution

Always include:
```markdown
<!-- Source: {repo-name}/{path} -->
<!-- Adapted for VELDRA by {date} -->
<!-- Changes: {list of customizations} -->
```

## Ecosystem Development Workflow

### Discovery Phase

1. **Identify need** (e.g., "VELDRA needs performance optimization")
2. **Search ecosystem** (ECC skills, awesome-subagents)
3. **Evaluate candidates** (A/B/C/D/E classification)
4. **Select best match**

### Adaptation Phase

1. **Read source** (understand pattern)
2. **Extract core** (algorithm, workflow, checklist)
3. **Customize** (VELDRA-specific context)
4. **Test** (verify it works)
5. **Document** (attribution + usage)

### Integration Phase

1. **Place in correct location** (.claude/agents/ or .claude/skills/)
2. **Update discovery** (frontmatter, triggers)
3. **Wire to VELDRA** (orchestrator, UI, services)
4. **Verify end-to-end** (actual usage test)
5. **Commit** (with clear attribution)

## MCP Integration Strategy

### Phase 1: Core Servers (P0)

Evaluate and integrate:
- **filesystem** — File operations (read, write, search)
- **git** — Repository operations (status, diff, commit)
- **memory** — Context persistence across sessions

### Phase 2: Development Servers (P1)

Evaluate and integrate:
- **browser** — Headless browser automation (testing, screenshots)
- **github** — Issue/PR management
- **search** — Code search across repositories

### Phase 3: Specialized Servers (P2)

Evaluate and integrate:
- **database** — Query/migration tools (if needed)
- **aws** — Cloud resource management (remote runtime)
- **documentation** — Doc search/indexing

## Ecosystem Maintenance

### Update Cadence

- **Weekly**: Check for new ECC skills/patterns
- **Monthly**: Review awesome-claude-code catalog
- **Quarterly**: Audit all integrations for staleness

### Quality Gates

Before integrating any ecosystem capability:
- [ ] Classification assigned (A/B/C/D/E)
- [ ] Source attribution clear
- [ ] VELDRA-specific customization done
- [ ] Tests written (if applicable)
- [ ] Documentation updated
- [ ] No duplication with existing capabilities
- [ ] Mobile compatibility verified
- [ ] Provider neutrality preserved

## Next Actions

### Immediate

1. **Create Priority Agents** (P0)
   - veldra-frontend (from frontend-developer)
   - veldra-typescript (from typescript-pro)
   - veldra-performance (from performance-optimizer)
   - veldra-test-engineer (from test-engineer)

2. **Create Priority Skills** (P0)
   - security-review (from ECC)
   - tdd-workflow (from ECC)

3. **Audit Current Agents**
   - Check for gaps vs ecosystem
   - Identify obsolete patterns
   - Update based on ECC best practices

### Short-term

1. **Parse awesome-claude-code CSV**
   - Extract VELDRA-relevant entries
   - Classify each capability
   - Create integration roadmap

2. **MCP Server Evaluation**
   - Test core servers (filesystem, git, memory)
   - Document integration patterns
   - Add to VELDRA MCP registry

3. **Command Development**
   - Adapt feature-development command
   - Create VELDRA-specific workflows
   - Add verification steps

### Long-term

1. **Continuous Integration**
   - Monitor ecosystem for updates
   - Adapt new useful patterns
   - Remove obsolete integrations

2. **Community Contribution**
   - Share VELDRA patterns back
   - Contribute improvements to ecosystem
   - Document lessons learned

## Success Metrics

**Ecosystem Utilization**:
- % of ecosystem capabilities evaluated: **Target 80%**
- % of P0 integrations complete: **Target 100%**
- Agent portfolio coverage: **Target 12 agents**
- Skill catalog size: **Target 10 skills**
- MCP servers integrated: **Target 5**

**Quality Metrics**:
- All integrations have source attribution: **Target 100%**
- All integrations tested: **Target 100%**
- No duplicate capabilities: **Target 0**
- Mobile compatibility: **Target 100%**

**Development Impact**:
- Reduced time to implement features: **Target -30%**
- Improved code quality scores: **Target +20%**
- Increased test coverage: **Target 80%+**
- Better security posture: **Target 0 P0 vulns**

---

**Last Updated**: 2026-08-13  
**Next Review**: When new critical capability identified or weekly ecosystem scan
