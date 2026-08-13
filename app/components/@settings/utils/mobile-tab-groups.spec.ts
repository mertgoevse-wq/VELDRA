import { describe, expect, it } from 'vitest';
import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { buildMobileTabGroups } from './mobile-tab-groups';

function tab(id: TabVisibilityConfig['id'], order: number, visible = true): TabVisibilityConfig {
  return { id, order, visible, window: 'user' };
}

describe('buildMobileTabGroups', () => {
  it('keeps account settings reachable and groups visible tabs by mobile task', () => {
    const groups = buildMobileTabGroups([
      tab('cloud-providers', 2),
      tab('features', 0),
      tab('runtime', 4),
      tab('github', 5),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['Account', 'AI setup', 'Workspace', 'Connections']);
    expect(groups[0].tabs.map(({ id }) => id)).toEqual(['profile', 'settings']);
    expect(groups[1].tabs.map(({ id }) => id)).toEqual(['cloud-providers', 'runtime']);
    expect(groups[2].tabs.map(({ id }) => id)).toEqual(['features']);
    expect(groups[3].tabs.map(({ id }) => id)).toEqual(['github']);
  });

  it('omits empty groups when a section has no visible tabs', () => {
    const groups = buildMobileTabGroups([tab('data', 1)]);

    expect(groups.map((group) => group.label)).toEqual(['Account', 'Workspace']);
    expect(groups[1].tabs.map(({ id }) => id)).toEqual(['data']);
    expect(groups.some((group) => group.label === 'AI setup')).toBe(false);
    expect(groups.some((group) => group.label === 'Connections')).toBe(false);
  });

  it('sorts tabs by their persisted order within each group', () => {
    const groups = buildMobileTabGroups([tab('runtime', 3), tab('cloud-providers', 1), tab('local-providers', 2)]);

    expect(groups.find((group) => group.label === 'AI setup')?.tabs.map(({ id }) => id)).toEqual([
      'cloud-providers',
      'local-providers',
      'runtime',
    ]);
  });
});
