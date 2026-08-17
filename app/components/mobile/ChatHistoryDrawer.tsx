import { memo, useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { androidActiveChatId } from '~/lib/stores/androidChatSession';

interface ChatHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

/**
 * Guards against date-fns throwing on an unparseable/corrupted timestamp (it documents
 *  "'date' must not be Invalid Date" as a hard @throws, not a null-return).
 */
function formatChatTimestamp(timestamp?: string): string | null {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDistanceToNow(date, { addSuffix: true });
}

function ChatHistoryDrawerBase({ open, onClose }: ChatHistoryDrawerProps) {
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    if (!db) {
      /*
       * Persistence disabled (VITE_DISABLE_PERSISTENCE) or IndexedDB failed to open -- without
       * this branch `loading` never leaves its initial `true`, so the drawer spins forever.
       */
      setChats([]);
      setLoadState('unavailable');

      return undefined;
    }

    let cancelled = false;
    setLoadState('loading');

    getAll(db)
      .then((list) =>
        list
          .filter((item) => item.description)
          .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
          .slice(0, 30),
      )
      .then((sorted) => {
        if (cancelled) {
          return;
        }

        setChats(sorted);
        setLoadState('ready');
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setChats([]);
        setLoadState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSelect = useCallback(
    (id: string) => {
      androidActiveChatId.set(id);
      onClose();
    },
    [onClose],
  );

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="chat-history-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="chat-history-drawer"
        role="dialog"
        aria-label="Chat history"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="chat-history-handle" />
        <div className="chat-history-header">
          <h2 className="chat-history-title">Recent Chats</h2>
          <button className="chat-history-close" onClick={onClose} aria-label="Close history">
            <div className="i-ph:x" />
          </button>
        </div>
        <div className="chat-history-list">
          {loadState === 'loading' && (
            <div className="chat-history-empty">
              <div className="i-svg-spinners:90-ring-with-bg text-lg" />
            </div>
          )}
          {loadState === 'unavailable' && (
            <div className="chat-history-empty">
              <div className="i-ph:warning-circle text-2xl text-bolt-elements-textTertiary" />
              <span className="text-sm text-bolt-elements-textSecondary">Chat history isn't available</span>
            </div>
          )}
          {loadState === 'error' && (
            <div className="chat-history-empty">
              <div className="i-ph:warning-circle text-2xl text-bolt-elements-textTertiary" />
              <span className="text-sm text-bolt-elements-textSecondary">Couldn't load chat history</span>
            </div>
          )}
          {loadState === 'ready' && chats.length === 0 && (
            <div className="chat-history-empty">
              <div className="i-ph:chat-circle-dots text-2xl text-bolt-elements-textTertiary" />
              <span className="text-sm text-bolt-elements-textSecondary">No saved chats yet</span>
            </div>
          )}
          {loadState === 'ready' &&
            chats.map((chat) => {
              const relativeTime = formatChatTimestamp(chat.timestamp);
              return (
                <button key={chat.id} className="chat-history-item" onClick={() => handleSelect(chat.id)}>
                  <span className="chat-history-item-title">{chat.description}</span>
                  {relativeTime && <span className="chat-history-item-time">{relativeTime}</span>}
                </button>
              );
            })}
        </div>
      </div>
    </>
  );
}

export const ChatHistoryDrawer = memo(ChatHistoryDrawerBase);
