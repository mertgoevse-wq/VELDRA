/**
 * useBuildActivity
 *
 * Tracks AI build activity phases based on streaming state and action events.
 * Emits structured activity events to buildActivityStore for display in BuildActivityFeed.
 */

import { useEffect, useRef } from 'react';
import { addActivity, clearBuildActivity, completeBuildSession, startBuildSession } from '~/lib/stores/buildActivity';

interface UseBuildActivityOptions {
  isStreaming: boolean;
  chatStarted: boolean;
  messageCount: number;
}

export function useBuildActivity({ isStreaming, chatStarted, messageCount }: UseBuildActivityOptions) {
  const prevStreamingRef = useRef(false);
  const prevMessageCountRef = useRef(messageCount);
  const generatingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    const isFirstMessage = messageCount === 0;
    const isNewMessage = messageCount > prevMessageCountRef.current;

    // Streaming started
    if (!wasStreaming && isStreaming) {
      startBuildSession(`session-${Date.now()}`);

      if (!chatStarted && isFirstMessage) {
        addActivity('planning', 'Understanding your request');

        const id = addActivity('generating', 'Planning project structure');
        generatingIdRef.current = id;
      } else if (isNewMessage) {
        const id = addActivity('generating', 'Generating response');
        generatingIdRef.current = id;
      } else {
        const id = addActivity('generating', 'Generating code');
        generatingIdRef.current = id;
      }
    }

    // Streaming ended
    if (wasStreaming && !isStreaming) {
      completeBuildSession();
      generatingIdRef.current = null;
    }

    prevStreamingRef.current = isStreaming;
    prevMessageCountRef.current = messageCount;
  }, [isStreaming, chatStarted, messageCount]);

  // Clear activity on new chat
  useEffect(() => {
    if (!chatStarted) {
      clearBuildActivity();
    }
  }, [chatStarted]);
}
