import { computed } from 'nanostores';
import { activeTemplateStore } from './template';

export type PanelId = 'chat' | 'editor' | 'terminal' | 'preview' | 'agents' | 'settings' | 'monitoring';

export interface WorkspaceLayout {
  primaryPanel: PanelId;
  sidebarPanel: PanelId | null;
  bottomPanel: PanelId | null;
  showSidebar: boolean;
  showBottom: boolean;
}

const DEFAULT_LAYOUT: WorkspaceLayout = {
  primaryPanel: 'chat',
  sidebarPanel: null,
  bottomPanel: null,
  showSidebar: false,
  showBottom: false,
};

export const workspaceLayoutStore = computed(activeTemplateStore, (template): WorkspaceLayout => {
  if (!template) {
    return DEFAULT_LAYOUT;
  }

  const layout: WorkspaceLayout = { ...DEFAULT_LAYOUT };

  for (const panel of template.panels) {
    if (!panel.visible) {
      continue;
    }

    if (panel.position === 'main') {
      layout.primaryPanel = panel.type;
    } else if (panel.position === 'sidebar') {
      layout.sidebarPanel = panel.type;
      layout.showSidebar = true;
    } else if (panel.position === 'bottom') {
      layout.bottomPanel = panel.type;
      layout.showBottom = true;
    }
  }

  return layout;
});

/** Map a PanelId to the corresponding MobileTab */
export function panelToTab(panel: PanelId): 'chat' | 'files' | 'preview' | 'settings' {
  switch (panel) {
    case 'editor':
    case 'terminal':
    case 'agents':
    case 'monitoring':
      return 'files';
    case 'preview':
      return 'preview';
    case 'settings':
      return 'settings';
    default:
      return 'chat';
  }
}
