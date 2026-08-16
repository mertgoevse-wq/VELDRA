// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Preview } from './Preview';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { RemoteRuntimeClient, type RemotePreviewResponse } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { remotePreviewRefreshSignal, triggerRemotePreviewRefresh } from '~/lib/stores/remotePreviewSignal';

/**
 * Block 2 of the "real end-to-end creation loop" mandate: Live Preview is P0, and had zero
 * test coverage before this file. These tests prove Preview.tsx never invents success --
 * every state it can render (not-configured, starting, running-without-a-url, failed,
 * network/disconnect error) is driven by a real RemoteRuntimeClient response or rejection,
 * not assumed. RemoteRuntimeClient.prototype.getPreviewUrl is spied on (not RemoteRuntimeClient
 * itself), matching action-runner.spec.ts's convention -- the client's real URL-building/error-
 * formatting logic stays exercised, only the actual network call is replaced.
 */

const REMOTE_STATE = {
  mode: 'remote' as const,
  webContainerAvailable: false,
  isAndroid: false,
  remoteRuntimeUrl: 'https://runtime.example.com',
  remoteAuthToken: 'test-token',
  remoteWorkspaceId: 'workspace-1',
  capabilities: {
    fileSystem: true,
    terminal: true,
    commandExecution: false,
    agentBuildCommands: true,
    packageInstall: true,
    devServer: true,
    preview: true,
    persistentFileSystem: false,
  },
  autoDetected: false,
};

function makePreviewResponse(overrides: Partial<RemotePreviewResponse> = {}): RemotePreviewResponse {
  return {
    ok: true,
    status: 'none',
    message: 'No dev server detected yet.',
    ...overrides,
  };
}

describe('Preview -- Remote Runtime live preview honesty', () => {
  const originalState = runtimeModeStore.get();

  beforeEach(() => {
    /*
     * jsdom lacks matchMedia; framer-motion's internal reduced-motion detection (used by
     * ExpoQrModal's Dialog, mounted but closed by default) reads it at module init and
     * throws without both the modern and legacy MediaQueryList method pairs stubbed.
     */
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    cleanup();
    runtimeModeStore.set(originalState);
    remotePreviewRefreshSignal.set(0);
    vi.restoreAllMocks();
  });

  it('never calls RemoteRuntimeClient and shows an honest not-configured state when Remote Runtime is unset', async () => {
    const getPreviewUrl = vi.spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl');
    runtimeModeStore.set({
      ...REMOTE_STATE,
      remoteRuntimeUrl: '',
      remoteAuthToken: '',
      remoteWorkspaceId: '',
    });

    render(<Preview />);

    expect(await screen.findByText(/Remote preview needs:/)).toBeInTheDocument();
    expect(getPreviewUrl).not.toHaveBeenCalled();
  });

  it('shows a real running preview iframe only once the server actually reports status=running with a URL', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl').mockResolvedValue(
      makePreviewResponse({ status: 'running', previewUrl: 'https://preview.example.com', port: 5173 }),
    );
    runtimeModeStore.set(REMOTE_STATE);

    render(<Preview />);

    const iframe = await screen.findByTitle('remote-preview');
    expect(iframe).toHaveAttribute('src', 'https://preview.example.com');
    expect(screen.getByText(/Remote Preview: https:\/\/preview\.example\.com/)).toBeInTheDocument();
  });

  it('does NOT claim success when the server reports status=running but no URL yet (never fabricates a preview URL)', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl').mockResolvedValue(
      makePreviewResponse({ status: 'running', message: 'Dev server starting, port not detected yet.' }),
    );
    runtimeModeStore.set(REMOTE_STATE);

    render(<Preview />);

    await screen.findByText('running');
    expect(screen.queryByTitle('remote-preview')).not.toBeInTheDocument();
    expect(screen.getByText('Live Preview Unavailable')).toBeInTheDocument();
  });

  it('reports a real build/start failure honestly instead of showing a blank or fake-success preview', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl').mockResolvedValue(
      makePreviewResponse({ status: 'failed', message: 'npm run dev exited with code 1' }),
    );
    runtimeModeStore.set(REMOTE_STATE);

    render(<Preview />);

    await screen.findByText('failed');
    expect(screen.getByText('npm run dev exited with code 1')).toBeInTheDocument();
    expect(screen.queryByTitle('remote-preview')).not.toBeInTheDocument();
  });

  it('surfaces a real network/disconnect failure as an explicit error, not a silent or fake-success state', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl').mockRejectedValue(
      new Error('Network failure contacting Remote Runtime at https://runtime.example.com.'),
    );
    runtimeModeStore.set(REMOTE_STATE);

    render(<Preview />);

    expect(
      await screen.findByText('Network failure contacting Remote Runtime at https://runtime.example.com.'),
    ).toBeInTheDocument();
    expect(screen.queryByTitle('remote-preview')).not.toBeInTheDocument();
  });

  it('re-checks real preview status when the agent-issued start bridge signals a refresh, without a manual click', async () => {
    const getPreviewUrl = vi
      .spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl')
      .mockResolvedValueOnce(makePreviewResponse({ status: 'none' }))
      .mockResolvedValueOnce(
        makePreviewResponse({ status: 'running', previewUrl: 'https://preview.example.com/started' }),
      );
    runtimeModeStore.set(REMOTE_STATE);

    render(<Preview />);

    await waitFor(() => expect(getPreviewUrl).toHaveBeenCalledTimes(1));
    expect(screen.queryByTitle('remote-preview')).not.toBeInTheDocument();

    // Same signal action-runner.ts's #runStartActionRemote() fires on a real dev-server start.
    triggerRemotePreviewRefresh();

    const iframe = await screen.findByTitle('remote-preview');
    expect(iframe).toHaveAttribute('src', 'https://preview.example.com/started');
    expect(getPreviewUrl).toHaveBeenCalledTimes(2);
  });

  it('drops back to the honest not-configured state if Remote Runtime config is cleared after a successful preview', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl').mockResolvedValue(
      makePreviewResponse({ status: 'running', previewUrl: 'https://preview.example.com' }),
    );
    runtimeModeStore.set(REMOTE_STATE);

    render(<Preview />);
    await screen.findByTitle('remote-preview');

    runtimeModeStore.set({ ...REMOTE_STATE, remoteRuntimeUrl: '' });

    await waitFor(() => expect(screen.queryByTitle('remote-preview')).not.toBeInTheDocument());
    expect(screen.getByText(/Remote preview needs:/)).toBeInTheDocument();
  });
});
