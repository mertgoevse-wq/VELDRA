/**
 * VELDRA Template System
 *
 * Templates are pre-configured workspace layouts that set up specific views
 * and tools for different development workflows. They affect:
 * - Which panels are visible
 * - Initial state/content suggestions
 * - Quick action buttons
 * - Model recommendations
 *
 * Templates are purely client-side UI compositions — they don't create
 * server resources or require API calls to activate.
 */

export interface VeldraTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  defaultModel?: string;
  suggestedPrompt?: string;
  panels: TemplatePanelConfig[];

  /**
   * Name of an entry in STARTER_TEMPLATES (app/utils/constants.ts) to seed as real project
   * files the moment this template is selected -- via the same getTemplates()/boltArtifact
   * pipeline the desktop auto-select-on-first-message flow uses, but deterministic (no LLM
   * guess) since picking this template is already an explicit choice. Only set this on
   * templates that represent "give me a project to build in" -- the AI-workflow-mode templates
   * (ai-chat, agent-workspace, model-lab, prompt-studio, monitoring) are layout/mode presets,
   * not project scaffolds, and must NOT get one.
   */
  starterTemplateName?: string;
}

export type TemplateCategory = 'ai' | 'development' | 'operations' | 'analysis';

export interface TemplatePanelConfig {
  type: 'chat' | 'editor' | 'terminal' | 'preview' | 'agents' | 'settings' | 'monitoring';
  visible: boolean;
  position?: 'main' | 'sidebar' | 'bottom';
}

export const VELDRA_TEMPLATES: VeldraTemplate[] = [
  {
    id: 'ai-chat',
    name: 'AI Chat',
    description: 'Focused conversation with an AI model',
    icon: 'i-ph:chat-circle-text',
    category: 'ai',
    panels: [{ type: 'chat', visible: true, position: 'main' }],
  },
  {
    id: 'code-workspace',
    name: 'Code Workspace',
    description: 'Full development environment with editor and terminal',
    icon: 'i-ph:code',
    category: 'development',
    starterTemplateName: 'Vite React',
    panels: [
      { type: 'chat', visible: true, position: 'sidebar' },
      { type: 'editor', visible: true, position: 'main' },
      { type: 'terminal', visible: true, position: 'bottom' },
    ],
  },
  {
    id: 'agent-workspace',
    name: 'Agent Workspace',
    description: 'Multi-agent orchestration with activity monitoring',
    icon: 'i-ph:users-three',
    category: 'ai',
    suggestedPrompt: 'Orchestrate multiple agents to...',
    panels: [
      { type: 'chat', visible: true, position: 'main' },
      { type: 'agents', visible: true, position: 'sidebar' },
    ],
  },
  {
    id: 'model-lab',
    name: 'Model Laboratory',
    description: 'Compare responses across models and providers',
    icon: 'i-ph:flask',
    category: 'ai',
    panels: [{ type: 'chat', visible: true, position: 'main' }],
  },
  {
    id: 'prompt-studio',
    name: 'Prompt Studio',
    description: 'Iterate and refine prompts with version history',
    icon: 'i-ph:pencil-line',
    category: 'ai',
    suggestedPrompt: 'Help me craft a prompt for...',
    panels: [
      { type: 'chat', visible: true, position: 'main' },
      { type: 'editor', visible: true, position: 'sidebar' },
    ],
  },
  {
    id: 'project-overview',
    name: 'Project Overview',
    description: 'Dashboard view of project state and recent activity',
    icon: 'i-ph:squares-four',
    category: 'development',
    starterTemplateName: 'Vite React',
    panels: [
      { type: 'chat', visible: true, position: 'main' },
      { type: 'editor', visible: true, position: 'sidebar' },
    ],
  },
  {
    id: 'terminal-focus',
    name: 'Terminal',
    description: 'Command-line focused with inline AI assistance',
    icon: 'i-ph:terminal-window',
    category: 'development',
    panels: [
      { type: 'terminal', visible: true, position: 'main' },
      { type: 'chat', visible: true, position: 'sidebar' },
    ],
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    description: 'System metrics, logs, and health status',
    icon: 'i-ph:chart-line-up',
    category: 'operations',
    panels: [
      { type: 'monitoring', visible: true, position: 'main' },
      { type: 'terminal', visible: true, position: 'bottom' },
    ],
  },
];

export function getTemplateById(id: string): VeldraTemplate | undefined {
  return VELDRA_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: TemplateCategory): VeldraTemplate[] {
  return VELDRA_TEMPLATES.filter((t) => t.category === category);
}
