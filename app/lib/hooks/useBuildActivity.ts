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
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    const prevCount = prevMessageCountRef.current;

    // Streaming started
    if (!wasStreaming && isStreaming) {
      const sessionId = `session-${Date.now()}`;
      sessionIdRef.current = sessionId;
      startBuildSession(sessionId);

      if (!chatStarted && messageCount === 0) {
        addActivity('planning', 'Understanding your request');
      } else if (messageCount > prevCount) {
        addActivity('generating', 'Generating response');
      } else {
        addActivity('generating', 'Generating code');
      }
    }

    // Streaming ended (completed)
    if (wasStreaming && !isStreaming) {
      completeBuildSession();
    }

    prevStreamingRef.current = isStreaming;
    prevMessageCountRef.current = messageCount;
  }, [isStreaming, chatStarted, messageCount]);

  // Reset activity when starting a new conversation
  useEffect(() => {
    if (!chatStarted) {
      clearBuildActivity();
    }
  }, [chatStarted]);
}
