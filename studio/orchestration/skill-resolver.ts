import type { RiskLevel, RoutingPolicy, SkillManifest, SkillResolution } from '@studio/catalog/types';

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function resolveSkills(skills: SkillManifest[], selectedIds: string[], policy: RoutingPolicy): SkillResolution {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const ordered: SkillManifest[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): boolean => {
    if (visited.has(id)) {
      return ordered.some((skill) => skill.id === id);
    }

    if (visiting.has(id)) {
      excluded.push({ id, reason: 'dependency cycle detected' });
      return false;
    }

    const skill = byId.get(id);

    if (!skill) {
      excluded.push({ id, reason: 'dependency or selected skill not found' });
      return false;
    }

    if (!skill.enabled && !policy.allowDisabled) {
      excluded.push({ id, reason: 'skill disabled' });
      return false;
    }

    if (RISK_RANK[skill.risk_level] > RISK_RANK[policy.maxRisk]) {
      excluded.push({ id, reason: `risk ${skill.risk_level} exceeds policy ${policy.maxRisk}` });
      return false;
    }

    visiting.add(id);

    let dependenciesResolved = true;

    for (const dependency of skill.dependencies) {
      if (!visit(dependency)) {
        dependenciesResolved = false;
      }
    }
    visiting.delete(id);
    visited.add(id);

    if (!dependenciesResolved) {
      excluded.push({ id, reason: 'required dependency was not resolved' });
      return false;
    }

    if (ordered.some((item) => item.id === skill.id)) {
      return true;
    }

    if (ordered.length >= policy.maxSkills) {
      excluded.push({ id, reason: 'skill limit reached' });
      return false;
    }

    ordered.push(skill);

    return true;
  };

  for (const id of selectedIds) {
    visit(id);
  }

  const selected = new Set(ordered.map((skill) => skill.id));
  const conflicted = new Set<string>();

  for (const skill of ordered) {
    for (const conflict of skill.conflicts) {
      if (selected.has(conflict)) {
        conflicted.add(skill.id);
        excluded.push({ id: skill.id, reason: `conflicts with ${conflict}` });
      }
    }
  }

  let filtered = ordered.filter((skill) => !conflicted.has(skill.id));
  const removed = new Set(ordered.filter((skill) => conflicted.has(skill.id)).map((skill) => skill.id));

  for (const skill of filtered) {
    const missingDependency = skill.dependencies.find((dependency) => removed.has(dependency));

    if (missingDependency) {
      removed.add(skill.id);
      excluded.push({ id: skill.id, reason: `required dependency conflicted: ${missingDependency}` });
    }
  }
  filtered = filtered.filter((skill) => !removed.has(skill.id));

  return { orderedSkills: filtered, excluded };
}

export { RISK_RANK };
