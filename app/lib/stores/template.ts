import { atom } from 'nanostores';
import type { VeldraTemplate } from '~/lib/templates';

export const activeTemplateStore = atom<VeldraTemplate | null>(null);

export function applyTemplate(template: VeldraTemplate): void {
  activeTemplateStore.set(template);
}

export function clearTemplate(): void {
  activeTemplateStore.set(null);
}
