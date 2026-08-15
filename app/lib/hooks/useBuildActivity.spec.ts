// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useBuildActivity } from './useBuildActivity';
import { buildActivityStore, clearBuildActivity } from '~/lib/stores/buildActivity';

/**
 * Block 2 (product-integration mandate): useBuildActivity used to emit guessed,
 * conversation-bookkeeping-derived phase labels ("Understanding your request",
 * "Planning project structure") with no real signal backing which cognitive phase the
 * LLM was actually in -- a fake-progress pattern. This covers the fix: exactly one
 * honest, generic "Generating a response" entry per streaming session, never a guessed
 * specific phase.
 */

afterEach(() => {
  cleanup();
  clearBuildActivity();
});

describe('useBuildActivity', () => {
  it('emits exactly one honest "Generating a response" entry when streaming starts, not a guessed phase', () => {
    const { rerender } = renderHook(({ isStreaming }) => useBuildActivity({ isStreaming, chatStarted: true }), {
      initialProps: { isStreaming: false },
    });

    rerender({ isStreaming: true });

    const { events } = buildActivityStore.get();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ phase: 'generating', label: 'Generating a response', status: 'active' });
  });

  it('marks the session complete when streaming ends, without inventing a new phase', () => {
    const { rerender } = renderHook(({ isStreaming }) => useBuildActivity({ isStreaming, chatStarted: true }), {
      initialProps: { isStreaming: false },
    });

    rerender({ isStreaming: true });
    rerender({ isStreaming: false });

    const state = buildActivityStore.get();
    expect(state.currentPhase).toBe('complete');
    expect(state.events[0].status).toBe('done');
  });

  it('clears activity when the chat is reset (chatStarted becomes false)', () => {
    const { rerender } = renderHook(({ chatStarted }) => useBuildActivity({ isStreaming: false, chatStarted }), {
      initialProps: { chatStarted: true },
    });

    buildActivityStore.set({
      events: [{ id: '1', phase: 'generating', label: 'x', startedAt: 0, status: 'done' }],
      currentPhase: 'complete',
      sessionId: 's',
    });

    rerender({ chatStarted: false });

    expect(buildActivityStore.get().events).toHaveLength(0);
  });
});
