import { atom } from 'nanostores';

/**
 * Substitutes for Remix's URL-path-based chat identity (`/chat/:id`) on Android.
 *
 * The Android SPA has no server-side routing -- AndroidShell mounts inside a bare
 * MemoryRouter with no <Routes>, and the @remix-run/react shim's useLoaderData()/
 * useNavigate()/useParams() are no-ops there (src/shims/remix-react.tsx), so a saved chat
 * could never be reopened: useChatHistory() always read an empty loader id, and history
 * links pointed at real browser URLs the WebView can't resolve.
 *
 * This store is read/written only when isCapacitor() is true (see useChatHistory.ts,
 * HistoryItem.tsx, Menu.client.tsx, Chat.client.tsx). Desktop/web chat identity is
 * untouched and continues to use the real Remix loader/useParams.
 *
 * Deliberately NOT updated by the "first message in a fresh chat gets a persistent id"
 * flow (useChatHistory.ts's storeMessageHistory -> navigateChat) -- only an explicit user
 * action (tapping a history item, starting a new chat, duplicating/importing a chat) changes
 * this value. That keeps Chat.client.tsx's remount key (keyed on this store) stable across a
 * chat's natural lifecycle, so sending a chat's first message never interrupts an in-flight
 * stream by unmounting the chat mid-response.
 */
export const androidActiveChatId = atom<string | undefined>(undefined);

export function startNewAndroidChat() {
  androidActiveChatId.set(undefined);
}
