import type { Message } from 'ai';
import { Fragment } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import type { ProviderInfo } from '~/types/model';
import { BuildActivityFeed } from './BuildActivityFeed';
import { SubagentActivityWidget } from './SubagentActivityWidget';
import { ApprovalRequestWidget } from './ApprovalRequestWidget';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  append?: (message: Message) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  addToolResult: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [] } = props;
    const location = useLocation();

    const handleRewind = (messageId: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', messageId);
      window.location.search = searchParams.toString();
    };

    const handleFork = async (messageId: string) => {
      try {
        if (!db || !chatId.get()) {
          toast.error('Chat persistence is not available');
          return;
        }

        const urlId = await forkChat(db, chatId.get()!, messageId);
        window.location.href = `/chat/${urlId}`;
      } catch (error) {
        toast.error('Failed to fork chat: ' + (error as Error).message);
      }
    };

    return (
      <div id={id} className={props.className} ref={ref}>
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, content, id: messageId, annotations, parts } = message;
              const isUserMessage = role === 'user';
              const isFirst = index === 0;
              const isHidden = annotations?.includes('hidden');

              if (isHidden) {
                return <Fragment key={index} />;
              }

              return (
                <div
                  key={index}
                  className={classNames('flex gap-4 py-3 w-full rounded-lg', {
                    'mt-4': !isFirst,
                  })}
                >
                  <div className="grid grid-col-1 w-full">
                    {isUserMessage ? (
                      <UserMessage content={content} parts={parts} />
                    ) : (
                      <AssistantMessage
                        content={content}
                        annotations={message.annotations}
                        messageId={messageId}
                        onRewind={handleRewind}
                        onFork={handleFork}
                        append={props.append}
                        chatMode={props.chatMode}
                        setChatMode={props.setChatMode}
                        model={props.model}
                        provider={props.provider}
                        parts={parts}
                        addToolResult={props.addToolResult}
                      />
                    )}
                  </div>
                </div>
              );
            })
          : null}

        {/*
         * Independent of isStreaming, same reasoning as SubagentActivityWidget below: a
         * pending approval blocks a background workflow whether or not the visible reply
         * is still streaming, and rendered first since it's the more urgent of the two --
         * something is actually waiting on the user, not just running in the background.
         */}
        <ApprovalRequestWidget />

        {/*
         * Independent of isStreaming: subagents are background tasks that can still be
         * running (or have just finished) after the message stream that spawned them has
         * already ended. Gating this on isStreaming would hide in-progress/completed
         * background work the moment the visible reply stops streaming.
         */}
        <SubagentActivityWidget />
        {isStreaming && (
          <>
            <BuildActivityFeed />
            <div className="flex items-center gap-2 mt-2 px-2 py-1.5 w-max rounded-sm border border-accent-500/20 bg-accent-500/10 text-accent-500 animate-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" />
              <div className="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0 opacity-75" />
              <div className="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0 opacity-50" />
              <span className="text-xs uppercase tracking-widest font-mono ml-1">Computing</span>
            </div>
          </>
        )}
      </div>
    );
  },
);
