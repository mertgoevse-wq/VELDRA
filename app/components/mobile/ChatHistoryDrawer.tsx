import { memo, useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { androidActiveChatId } from '~/lib/stores/androidChatSession';

interface ChatHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

function ChatHistoryDrawerBase({ open, onClose }: ChatHistoryDrawerProps) {
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !db) {
      return;
    }

    setLoading(true);

    getAll(db)
      .then((list) =>
        list
          .filter((item) => item.description)
          .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
          .slice(0, 30),
      )
      .then((sorted) => {
        setChats(sorted);
        setLoading(false);
      })
      .catch(() => {
        setChats([]);
        setLoading(false);
      });
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
      <div className="chat-history-drawer" role="dialog" aria-label="Chat history">
        <div className="chat-history-handle" />
        <div className="chat-history-header">
          <h2 className="chat-history-title">Recent Chats</h2>
          <button className="chat-history-close" onClick={onClose} aria-label="Close history">
            <div className="i-ph:x" />
          </button>
        </div>
        <div className="chat-history-list">
          {loading && (
            <div className="chat-history-empty">
              <div className="i-svg-spinners:90-ring-with-bg text-lg" />
            </div>
          )}
          {!loading && chats.length === 0 && (
            <div className="chat-history-empty">
              <div className="i-ph:chat-circle-dots text-2xl text-bolt-elements-textTertiary" />
              <span className="text-sm text-bolt-elements-textSecondary">No saved chats yet</span>
            </div>
          )}
          {!loading &&
            chats.map((chat) => (
              <button key={chat.id} className="chat-history-item" onClick={() => handleSelect(chat.id)}>
                <span className="chat-history-item-title">{chat.description}</span>
                {chat.timestamp && (
                  <span className="chat-history-item-time">
                    {formatDistanceToNow(new Date(chat.timestamp), { addSuffix: true })}
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>
    </>
  );
}

export const ChatHistoryDrawer = memo(ChatHistoryDrawerBase);
