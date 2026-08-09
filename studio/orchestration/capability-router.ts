import type {
  AgentManifest,
  CapabilityRequest,
  RoutingPolicy,
  RoutingReason,
  RoutingResult,
  SkillManifest,
} from '@studio/catalog/types';
import { resolveSkills as resolveSkillDependencies, RISK_RANK } from '@studio/orchestration/skill-resolver';

const KEYWORD_CAPABILITIES: Record<string, string[]> = {
  android: ['android', 'kotlin', 'compose', 'mobile'],
  kotlin: ['android', 'kotlin', 'mobile'],
  mobile: ['android', 'mobile'],
  react: ['react', 'web', 'typescript'],
  typescript: ['typescript', 'web'],
  testing: ['testing', 'test', 'qa', 'quality'],
  security: ['security', 'audit', 'auth'],
  mcp: ['mcp'],
  git: ['git', 'github', 'gitlab', 'worktree'],
  performance: ['performance', 'profiling', 'optimization'],
  architecture: ['architecture', 'architect', 'api-design'],
};

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.toLowerCase().trim()).filter(Boolean))];
}

function inferCapabilities(request: CapabilityRequest): string[] {
  const text = [
    request.task,
    request.domain,
    request.language,
    ...(request.frameworks ?? []),
    ...(request.task_types ?? []),
    ...(request.required_tools ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const capabilities = [...(request.capabilities ?? [])];

  for (const [keyword, inferred] of Object.entries(KEYWORD_CAPABILITIES)) {
    if (text.includes(keyword)) {
      capabilities.push(...inferred);
    }
  }

  return unique(capabilities);
}

function matchesAgent(
  agent: AgentManifest,
  request: CapabilityRequest,
  inferred: string[],
): { score: number; reasons: string[] } {
  const searchable = unique([
    ...agent.capabilities,
    ...agent.domains,
    ...agent.languages,
    ...agent.frameworks,
    ...agent.task_types,
  ]);
  const matches = inferred.filter((capability) => searchable.includes(capability));
  const reasons = matches.map((match) => `matches capability '${match}'`);

  if (request.domain && agent.domains.includes(request.domain.toLowerCase())) {
    reasons.push(`matches domain '${request.domain}'`);
  }

  if (request.language && agent.languages.includes(request.language.toLowerCase())) {
    reasons.push(`matches language '${request.language}'`);
  }

  if (request.required_tools?.length && request.required_tools.every((tool) => agent.required_tools.includes(tool))) {
    reasons.push('supports all required tools');
  }

  return { score: matches.length + reasons.length * 0.25, reasons };
}

function policyReason(id: string, selected: boolean, message: string): RoutingReason {
  return { id, kind: 'policy', selected, message };
}

export function routeCapabilities(
  request: CapabilityRequest,
  agents: AgentManifest[],
  skills: SkillManifest[],
  policy: RoutingPolicy,
): RoutingResult {
  const inferred = inferCapabilities(request);
  const reasons: RoutingReason[] = [];
  const requestedRisk = request.risk ?? policy.maxRisk;
  const effectiveMaxRisk = RISK_RANK[requestedRisk] < RISK_RANK[policy.maxRisk] ? requestedRisk : policy.maxRisk;
  const requiredToolsAllowed = (request.required_tools ?? []).every((tool) => policy.allowedTools.includes(tool));
  const candidates = agents
    .map((agent) => ({ agent, match: matchesAgent(agent, request, inferred) }))
    .sort((left, right) => right.match.score - left.match.score || left.agent.id.localeCompare(right.agent.id));

  const selected: AgentManifest[] = [];
  const blocked: string[] = [];
  const approvalRequired: string[] = [];
  const excluded: string[] = [];

  for (const { agent, match } of candidates) {
    if (!agent.enabled && !policy.allowDisabled) {
      excluded.push(agent.id);
      reasons.push(policyReason(agent.id, false, 'capability disabled'));
      continue;
    }

    if (match.score === 0) {
      excluded.push(agent.id);
      reasons.push({
        id: agent.id,
        kind: 'agent',
        score: match.score,
        selected: false,
        message: 'no capability match',
      });
      continue;
    }

    if (RISK_RANK[agent.risk_level] > RISK_RANK[effectiveMaxRisk]) {
      blocked.push(agent.id);
      reasons.push(
        policyReason(agent.id, false, `risk ${agent.risk_level} exceeds effective policy ${effectiveMaxRisk}`),
      );
      continue;
    }

    const requestedToolsSupported = (request.required_tools ?? []).every((tool) => agent.required_tools.includes(tool));
    const toolsAllowed =
      requiredToolsAllowed &&
      requestedToolsSupported &&
      agent.required_tools.every((tool) => policy.allowedTools.includes(tool));

    if (!toolsAllowed) {
      blocked.push(agent.id);
      reasons.push(policyReason(agent.id, false, 'required tool is not allowed by policy'));
      continue;
    }

    if (agent.approval_required && !request.approvalGranted) {
      approvalRequired.push(agent.id);
      reasons.push(policyReason(agent.id, false, 'human approval required'));
      continue;
    }

    if (
      request.context_tokens !== undefined &&
      agent.context_requirements.estimatedTokens !== undefined &&
      request.context_tokens < agent.context_requirements.estimatedTokens
    ) {
      excluded.push(agent.id);
      reasons.push(policyReason(agent.id, false, 'context budget is too small'));
      continue;
    }

    if (selected.length < policy.maxAgents) {
      selected.push(agent);
      reasons.push({
        id: agent.id,
        kind: 'agent',
        score: match.score,
        selected: true,
        message: match.reasons.join('; '),
      });
    } else {
      excluded.push(agent.id);
      reasons.push(policyReason(agent.id, false, 'agent limit reached'));
    }
  }

  const skillCandidates = skills
    .filter((skill) => policy.allowDisabled || skill.enabled)
    .filter((skill) => RISK_RANK[skill.risk_level] <= RISK_RANK[effectiveMaxRisk])
    .filter((skill) =>
      inferred.some((capability) => skill.capabilities.includes(capability) || skill.domains.includes(capability)),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const skillResolution = resolveSkillDependencies(
    skills,
    skillCandidates.map((skill) => skill.id),
    { ...policy, maxRisk: effectiveMaxRisk },
  );

  for (const skill of skillResolution.orderedSkills) {
    reasons.push({
      id: skill.id,
      kind: 'skill',
      selected: true,
      message: 'matched inferred capability and dependencies resolved',
    });
  }

  for (const excludedSkill of skillResolution.excluded) {
    reasons.push({ id: excludedSkill.id, kind: 'dependency', selected: false, message: excludedSkill.reason });
  }

  const rejectedAgents = reasons

    .filter((reason) => reason.kind === 'agent' && !reason.selected)
    .map((reason) => ({ id: reason.id, reason: reason.message }));
  const estimatedContextCost = selected.reduce(
    (total, agent) => total + (agent.context_requirements.estimatedTokens ?? 0),
    0,
  );

  return {
    selected_agents: selected.map((agent) => agent.id),
    selected_skills: skillResolution.orderedSkills.map((skill) => skill.id),
    executable_agents: selected
      .filter((agent) => !agent.approval_required || request.approvalGranted)
      .map((agent) => agent.id),
    blocked_agents: [...blocked, ...approvalRequired],
    rejected_agents: rejectedAgents,
    required_tools: request.required_tools ?? [],
    estimated_context_cost: estimatedContextCost,
    reasons,
    inferred_capabilities: inferred,
    policy: {
      passed: blocked.length === 0 && approvalRequired.length === 0,
      approval_required: approvalRequired,
      excluded: [...excluded, ...skillResolution.excluded.map((item) => item.id)],
    },
  };
}
