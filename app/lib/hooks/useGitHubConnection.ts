import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import type { GitHubConnection } from '~/types/GitHub';
import { useGitHubAPI } from './useGitHubAPI';
import { githubConnectionAtom, githubConnectionStore, isGitHubConnecting } from '~/lib/stores/githubConnection';

/**
 * Block 5 of the identity/sync mandate: this hook used to read/write its OWN separate
 * atom (app/lib/stores/github.ts) with its own inline fetch-to-api.github.com logic,
 * duplicating what app/lib/stores/githubConnection.ts's `githubConnectionStore` already
 * did (and does more robustly, via the shared `gitHubApiService`). Confirmed by a full
 * call-site survey before this rewrite: `github.ts`'s own `initializeGitHubConnection`/
 * `fetchGitHubStatsViaAPI` (its actual "server-OAuth" functions) had ZERO callers
 * anywhere -- the real, live desktop behavior was always this hook's own inline
 * client-PAT fetch, nearly identical to `githubConnectionStore.connect()`, just writing
 * to a different atom than Android's `GitHubSyncPanel.tsx` reads. That's the real bug a
 * prior round's dead-code sweep found: connecting via desktop Settings and Android's
 * sync panel could disagree on connection state within the same live session. Fixed by
 * making this hook a thin wrapper over the ONE shared store instead of a second
 * implementation -- `github.ts` is now fully dead (this was its only caller) and removed.
 *
 * Public interface (`ConnectionState`/`UseGitHubConnectionReturn`) is unchanged so this
 * hook's only consumer, GitHubTab.tsx, needed zero changes.
 */

export interface ConnectionState {
  isConnected: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  connection: GitHubConnection | null;
  error: string | null;
  isServerSide: boolean; // Indicates if this is a server-side connection
}

export interface UseGitHubConnectionReturn extends ConnectionState {
  connect: (token: string, tokenType: 'classic' | 'fine-grained') => Promise<void>;
  disconnect: () => void;
  refreshConnection: () => Promise<void>;
  testConnection: () => Promise<boolean>;
}

export function useGitHubConnection(): UseGitHubConnectionReturn {
  const connection = useStore(githubConnectionAtom);
  const connecting = useStore(isGitHubConnecting);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create API instance - will update when connection changes
  useGitHubAPI();

  /*
   * The shared store already restores a saved connection (with user data) from
   * localStorage at module load -- this only needs to cover the one case that leaves
   * incomplete: a token present with no user/stats yet (e.g. connect() started, then the
   * app reloaded before stats finished fetching).
   */
  useEffect(() => {
    if (connection.user || !connection.token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    githubConnectionStore
      .fetchStats()
      .catch((refreshError) => {
        console.error('Error loading saved connection:', refreshError);
        setError('Failed to load saved connection');
      })
      .finally(() => setIsLoading(false));

    /*
     * Only ever needs to run once on mount -- re-running on every `connection` change
     * would re-fetch stats every time connect()/disconnect() update the shared atom.
     */
  }, []);

  const connect = useCallback(async (token: string, tokenType: 'classic' | 'fine-grained') => {
    if (!token.trim()) {
      setError('Token is required');
      return;
    }

    setError(null);

    try {
      await githubConnectionStore.connect(token, tokenType);

      const connected = githubConnectionAtom.get();
      toast.success(`Connected to GitHub as ${connected.user?.login}`);
    } catch (connectError) {
      const errorMessage = connectError instanceof Error ? connectError.message : 'Failed to connect to GitHub';
      setError(errorMessage);
      toast.error(`Failed to connect: ${errorMessage}`);
      throw connectError;
    }
  }, []);

  const disconnect = useCallback(() => {
    githubConnectionStore.disconnect();
    setError(null);
    toast.success('Disconnected from GitHub');
  }, []);

  const refreshConnection = useCallback(async () => {
    if (!connection.token) {
      throw new Error('No connection to refresh');
    }

    setIsLoading(true);
    setError(null);

    try {
      await githubConnectionStore.fetchStats();
    } catch (refreshError) {
      console.error('Error refreshing connection:', refreshError);
      setError('Failed to refresh connection');
      throw refreshError;
    } finally {
      setIsLoading(false);
    }
  }, [connection.token]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!connection) {
      return false;
    }

    try {
      // For server-side connections (no client-held token), test via our own API proxy.
      if (!connection.token) {
        const response = await fetch('/api/github-user');
        return response.ok;
      }

      // For client-side connections, test directly against the real token.
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${connection.token}`,
          'User-Agent': 'VELDRA',
        },
      });

      return response.ok;
    } catch (testError) {
      console.error('Connection test failed:', testError);
      return false;
    }
  }, [connection]);

  return {
    isConnected: !!connection.user,
    isLoading,
    isConnecting: connecting,
    connection,
    error,
    isServerSide: !connection.token,
    connect,
    disconnect,
    refreshConnection,
    testConnection,
  };
}
