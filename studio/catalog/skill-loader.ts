import type { SkillManifest, RoutingPolicy } from '@studio/catalog/types';
import type { ContentAdapter, LoadedContent } from '@studio/catalog/content-adapter';
import { resolveSkills } from '@studio/orchestration/skill-resolver';

export interface ProgressiveSkillLoad {
  discovered: string[];
  selected: string[];
  loaded: LoadedContent[];
  failures: Array<{ id: string; code: string; message: string }>;
}

export async function loadProgressiveSkills(
  skills: SkillManifest[],
  selectedIds: string[],
  policy: RoutingPolicy,
  adapter: ContentAdapter,
): Promise<ProgressiveSkillLoad> {
  const resolution = resolveSkills(skills, selectedIds, policy);
  const loaded: LoadedContent[] = [];
  const failures: ProgressiveSkillLoad['failures'] = [];

  for (const skill of resolution.orderedSkills) {
    const result = await adapter.load({ id: skill.id, expectedRevision: skill.source.revision });

    if (result.ok) {
      loaded.push(result.value);
    } else {
      failures.push(result.error);
    }
  }

  return {
    discovered: skills.map((skill) => skill.id).sort(),
    selected: resolution.orderedSkills.map((skill) => skill.id),
    loaded,
    failures: [
      ...resolution.excluded.map((item) => ({ id: item.id, code: 'RESOLUTION_BLOCKED', message: item.reason })),
      ...failures,
    ],
  };
}
