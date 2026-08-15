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
}

export function useBuildActivity({ isStreaming, chatStarted }: UseBuildActivityOptions) {
  const prevStreamingRef = useRef(false);
  const generatingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;

    /*
     * Streaming started. Only one honest, generic entry here -- "the LLM is now
     * generating a response" is the one real fact we have at this point. Earlier
     * versions guessed a specific cognitive phase ("Understanding your request",
     * "Planning project structure") purely from conversation bookkeeping (first
     * message vs. new message), with no real signal backing which phase the LLM
     * was actually in -- exactly the fake-progress pattern this store's own doc
     * comment says to avoid. Real, more specific phases (writing/running/building/
     * previewing) still come from action-runner.ts as real actions actually happen.
     */
    if (!wasStreaming && isStreaming) {
      startBuildSession(`session-${Date.now()}`);

      const id = addActivity('generating', 'Generating a response');
      generatingIdRef.current = id;
    }

    // Streaming ended
    if (wasStreaming && !isStreaming) {
      completeBuildSession();
      generatingIdRef.current = null;
    }

    prevStreamingRef.current = isStreaming;
  }, [isStreaming, chatStarted]);

  // Clear activity on new chat
  useEffect(() => {
    if (!chatStarted) {
      clearBuildActivity();
    }
  }, [chatStarted]);
}
