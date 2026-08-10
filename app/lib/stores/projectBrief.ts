/**
 * Project Brief — the optional structured context a user can attach to their very first chat
 * message when starting a new project ("Guided Build"). "Quick Start" (typing a description and
 * hitting send, exactly as before) remains the default and is completely unaffected: every field
 * here is optional, and an empty brief produces an empty preamble, so nothing about the existing
 * chat-send path changes unless the user actually fills something in.
 *
 * This intentionally does NOT introduce a second chat/agent pipeline. The brief is folded into the
 * plain text of the first outgoing message (see composeMessageWithProjectBrief), so it flows
 * through the exact same parser -> ActionRunner -> FilesStore path every other message already
 * uses.
 */

import { atom } from 'nanostores';

export type ProjectPlatform = 'web' | 'android' | 'both';

export interface ProjectBrief {
  platform?: ProjectPlatform;
  visualStyle?: string;
  integrations?: string;
  offlineRequired?: boolean;
}

const EMPTY_BRIEF: ProjectBrief = {};

export const projectBriefStore = atom<ProjectBrief>(EMPTY_BRIEF);

export function setProjectBriefField<K extends keyof ProjectBrief>(field: K, value: ProjectBrief[K]): void {
  projectBriefStore.set({ ...projectBriefStore.get(), [field]: value });
}

export function resetProjectBrief(): void {
  projectBriefStore.set(EMPTY_BRIEF);
}

export function hasProjectBriefDetails(brief: ProjectBrief): boolean {
  return Boolean(brief.platform || brief.visualStyle?.trim() || brief.integrations?.trim() || brief.offlineRequired);
}

const PLATFORM_LABEL: Record<ProjectPlatform, string> = {
  web: 'Web app',
  android: 'Android app',
  both: 'Web and Android app',
};

/**
 * Turns a structured brief into a short, readable preamble prepended to the user's own
 * description. Plain natural-language text, not a machine-parsed tag -- the model reads it the
 * same way it reads the rest of the message, no server-side parsing changes required.
 */
export function composeMessageWithProjectBrief(userMessage: string, brief: ProjectBrief): string {
  if (!hasProjectBriefDetails(brief)) {
    return userMessage;
  }

  const details: string[] = [];

  if (brief.platform) {
    details.push(`Platform: ${PLATFORM_LABEL[brief.platform]}`);
  }

  if (brief.visualStyle?.trim()) {
    details.push(`Visual style: ${brief.visualStyle.trim()}`);
  }

  if (brief.integrations?.trim()) {
    details.push(`Required integrations: ${brief.integrations.trim()}`);
  }

  if (brief.offlineRequired) {
    details.push('Must work fully offline (no required network calls).');
  }

  return `Project details:\n${details.map((line) => `- ${line}`).join('\n')}\n\n${userMessage}`;
}
