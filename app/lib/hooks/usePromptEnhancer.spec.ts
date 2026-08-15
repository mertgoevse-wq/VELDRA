// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePromptEnhancer } from './usePromptEnhancer';

/**
 * Phase 6 of the product-integration mandate: "Enhance prompt" showed
 * toast.success('Prompt enhanced!') unconditionally and immediately on click, before the
 * (async, network-dependent) enhancement had even started -- a real fake-success bug, not
 * a nitpick. This hook now owns real success/error feedback, tied to what actually
 * happened, not to when the button was clicked.
 */

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('~/lib/adapters/platform', () => ({
  isCapacitor: () => false,
}));

function streamResponse(chunks: string[], ok = true, status = 200) {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    body: {
      getReader: () => ({
        read: async () => {
          if (index >= chunks.length) {
            return { done: true, value: undefined };
          }

          const value = encoder.encode(chunks[index]);
          index += 1;

          return { done: false, value };
        },
      }),
    },
  };
}

describe('usePromptEnhancer', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('streams the enhanced prompt, sets promptEnhanced, and shows a real success toast only once it actually finished', async () => {
    vi.mocked(fetch).mockResolvedValue(streamResponse(['Build ', 'a landing page.']) as any);

    const { result } = renderHook(() => usePromptEnhancer());
    const setInputCalls: string[] = [];
    const setInput = (value: string) => setInputCalls.push(value);

    await act(async () => {
      await result.current.enhancePrompt('build a page', setInput, 'gemini-1.5-pro', { name: 'Google' } as any);
    });

    expect(toastSuccess).toHaveBeenCalledWith('Prompt enhanced!');
    expect(toastError).not.toHaveBeenCalled();
    expect(result.current.promptEnhanced).toBe(true);
    expect(result.current.enhancingPrompt).toBe(false);
    expect(setInputCalls.some((value) => value === 'Build a landing page.')).toBe(true);
  });

  it('shows a real error toast and restores the original input when the fetch itself rejects, instead of an unhandled rejection with a fake success toast', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => usePromptEnhancer());
    let lastInput: string | undefined;
    const setInput = (value: string) => {
      lastInput = value;
    };

    await act(async () => {
      await result.current.enhancePrompt('original prompt', setInput, 'gemini-1.5-pro', { name: 'Google' } as any);
    });

    expect(toastError).toHaveBeenCalledWith('Could not enhance the prompt. Please try again.');
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(result.current.promptEnhanced).toBe(false);
    expect(result.current.enhancingPrompt).toBe(false);
    expect(lastInput).toBe('original prompt');
  });

  it('shows a real error toast when the server responds with a non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValue(streamResponse([], false, 500) as any);

    const { result } = renderHook(() => usePromptEnhancer());

    await act(async () => {
      await result.current.enhancePrompt('a prompt', vi.fn(), 'gemini-1.5-pro', { name: 'Google' } as any);
    });

    expect(toastError).toHaveBeenCalledWith('Could not enhance the prompt. Please try again.');
    expect(result.current.promptEnhanced).toBe(false);
  });

  it('sets enhancingPrompt to true while the request is in flight', async () => {
    let resolveFetch!: (value: unknown) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)) as any);

    const { result } = renderHook(() => usePromptEnhancer());

    act(() => {
      result.current.enhancePrompt('a prompt', vi.fn(), 'gemini-1.5-pro', { name: 'Google' } as any);
    });

    await waitFor(() => expect(result.current.enhancingPrompt).toBe(true));

    await act(async () => {
      resolveFetch(streamResponse(['done']));
    });

    await waitFor(() => expect(result.current.enhancingPrompt).toBe(false));
  });
});
