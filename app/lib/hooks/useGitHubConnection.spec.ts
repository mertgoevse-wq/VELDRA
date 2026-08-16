// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import Cookies from 'js-cookie';
import { useGitHubConnection } from './useGitHubConnection';
import { gitHubApiService } from '~/lib/services/githubApiService';
import { githubConnectionAtom, githubConnectionStore, isGitHubConnecting } from '~/lib/stores/githubConnection';

/**
 * Block 5 of the identity/sync mandate: proves useGitHubConnection is now a genuine thin
 * wrapper over the ONE shared githubConnectionStore -- connecting through the hook is
 * visible to any other consumer reading the shared atom directly (e.g.
 * GitHubSyncPanel.tsx's `githubConnectionStore.get().token`), which was exactly the real
 * bug (two independent atoms) this round fixed. Only the real external boundary
 * (gitHubApiService's network calls) is mocked.
 */
describe('useGitHubConnection', () => {
  beforeEach(() => {
    githubConnectionAtom.set({ user: null, token: '', tokenType: 'classic' });
    isGitHubConnecting.set(false);
    localStorage.clear();
    Cookies.remove('githubUsername');
    Cookies.remove('githubToken');
    Cookies.remove('git:github.com');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connecting through the hook updates the SAME shared store other consumers (e.g. GitHubSyncPanel) read directly', async () => {
    vi.spyOn(gitHubApiService, 'fetchUser').mockResolvedValue({
      user: { login: 'octocat' } as any,
      rateLimit: {},
    });
    vi.spyOn(gitHubApiService, 'fetchStats').mockResolvedValue({} as any);

    const { result } = renderHook(() => useGitHubConnection());

    await act(async () => {
      await result.current.connect('real-token-value', 'classic');
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connection?.token).toBe('real-token-value');

    /*
     * The real proof: a completely separate reader of the shared store (not the hook's
     * own state) sees the same connection -- this is what GitHubSyncPanel.tsx does.
     */
    expect(githubConnectionStore.get().token).toBe('real-token-value');
    expect(githubConnectionStore.get().user?.login).toBe('octocat');
  });

  it('a real connect failure surfaces an honest error and leaves the shared store disconnected', async () => {
    vi.spyOn(gitHubApiService, 'fetchUser').mockRejectedValue(new Error('Bad credentials'));

    const { result } = renderHook(() => useGitHubConnection());

    await act(async () => {
      await expect(result.current.connect('bad-token', 'classic')).rejects.toThrow('Bad credentials');
    });

    expect(result.current.error).toBe('Bad credentials');
    expect(result.current.isConnected).toBe(false);
    expect(githubConnectionStore.get().user).toBeNull();
  });

  it('disconnect clears the shared store, not just the hook-local view', async () => {
    vi.spyOn(gitHubApiService, 'fetchUser').mockResolvedValue({ user: { login: 'octocat' } as any, rateLimit: {} });
    vi.spyOn(gitHubApiService, 'fetchStats').mockResolvedValue({} as any);

    const { result } = renderHook(() => useGitHubConnection());
    await act(async () => {
      await result.current.connect('real-token-value', 'classic');
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(githubConnectionStore.get().token).toBe('');
    expect(localStorage.getItem('github_connection')).toBeNull();
  });

  it('reports isServerSide honestly based on whether a real client-held token exists', async () => {
    const { result } = renderHook(() => useGitHubConnection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isServerSide).toBe(true);

    vi.spyOn(gitHubApiService, 'fetchUser').mockResolvedValue({ user: { login: 'octocat' } as any, rateLimit: {} });
    vi.spyOn(gitHubApiService, 'fetchStats').mockResolvedValue({} as any);
    await act(async () => {
      await result.current.connect('real-token-value', 'classic');
    });

    expect(result.current.isServerSide).toBe(false);
  });
});
