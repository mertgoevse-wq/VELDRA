import type { TabType, TabVisibilityConfig } from '~/components/@settings/core/types';

export interface MobileTabGroup {
  label: string;
  description: string;
  tabs: TabVisibilityConfig[];
}

export const MOBILE_TAB_GROUPS: Array<{ label: string; description: string; tabs: TabType[] }> = [
  { label: 'Account', description: 'Profile and personal preferences', tabs: ['profile', 'settings'] },
  {
    label: 'AI setup',
    description: 'Providers, models, and runtime access',
    tabs: ['cloud-providers', 'local-providers', 'runtime'],
  },
  {
    label: 'Workspace',
    description: 'Data, updates, and diagnostics',
    tabs: ['data', 'features', 'notifications', 'event-logs'],
  },
  {
    label: 'Connections',
    description: 'Services and tool integrations',
    tabs: ['github', 'gitlab', 'supabase', 'vercel', 'netlify', 'mcp'],
  },
  { label: 'Creation', description: 'Visual assets and generation tools', tabs: ['image-studio'] },
];

export const MOBILE_TAB_DESCRIPTIONS: Partial<Record<TabType, string>> = {
  profile: 'Name and profile details',
  settings: 'Theme, language, and skin',
  notifications: 'Alerts and updates',
  features: 'Discover what is new',
  data: 'Storage and local data',
  'cloud-providers': 'Cloud models and API keys',
  'local-providers': 'Ollama, LM Studio, and local models',
  runtime: 'WebContainer, Android, or remote',
  github: 'Repositories and sync',
  gitlab: 'Projects and repositories',
  supabase: 'Database connection',
  vercel: 'Projects and deployments',
  netlify: 'Sites and deployments',
  mcp: 'Model Context Protocol servers',
  'image-studio': 'Project image assets',
};

const MOBILE_CORE_TABS: TabVisibilityConfig[] = [
  { id: 'profile', visible: true, window: 'user', order: -2 },
  { id: 'settings', visible: true, window: 'user', order: -1 },
];

/**
 * Build the compact mobile navigation from the same visible tab list used by desktop.
 * Profile and Settings remain reachable from the account area even though they are not
 * part of the legacy persisted default tab list.
 */
export function buildMobileTabGroups(visibleTabs: TabVisibilityConfig[]): MobileTabGroup[] {
  const tabsById = new Map<TabType, TabVisibilityConfig>(MOBILE_CORE_TABS.map((tab) => [tab.id, tab]));

  visibleTabs.forEach((tab) => tabsById.set(tab.id, tab));

  const groupedTabs = new Set(MOBILE_TAB_GROUPS.flatMap((group) => group.tabs));
  const groups = MOBILE_TAB_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs
      .map((tabId) => tabsById.get(tabId))
      .filter((tab): tab is TabVisibilityConfig => Boolean(tab))
      .sort((a, b) => a.order - b.order),
  })).filter((group) => group.tabs.length > 0);
  const otherTabs = visibleTabs.filter((tab) => !groupedTabs.has(tab.id));

  return otherTabs.length > 0
    ? [
        ...groups,
        {
          label: 'Other',
          description: 'Additional settings available in this workspace',
          tabs: otherTabs,
        },
      ]
    : groups;
}
