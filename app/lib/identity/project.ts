/**
 * Project Identity
 *
 * Block 1 of the identity/sync mandate: a real, distinct concept for "which project's
 * files are these" -- kept structurally separate from chat identity even though, today,
 * they resolve to the same value. This is deliberate: conflating "project" and "chat" in
 * the TYPE system (rather than just in behavior) is exactly what the mandate warned
 * against, because a future feature (a project spanning multiple chats, or a chat that
 * references multiple projects) would then require touching every call site instead of
 * one function.
 *
 * Current reality, stated honestly: VELDRA has no broader "project" grouping construct
 * than a chat. `getCurrentProjectId()` derives from `getCurrentChatId()` (the URL's
 * `/chat/:id` segment, or `'default'`) because that is the closest real 1:1 mapping that
 * exists -- not because a project genuinely equals a chat conceptually. When a real
 * project-grouping feature is built, only this function's body needs to change.
 */

import { getCurrentChatId } from '~/utils/fileLocks';

export interface ProjectIdentity {
  id: string;
}

/** The current project's stable ID. See file header for what this derives from today. */
export function getCurrentProjectId(): string {
  return getCurrentChatId();
}

export function getCurrentProject(): ProjectIdentity {
  return { id: getCurrentProjectId() };
}
