// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { RemoteCommandPanel } from './TerminalTabs';
import type { RuntimeModeState } from '~/lib/stores/runtime-mode';
import { RemoteRuntimeClient } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { remotePreviewRefreshSignal } from '~/lib/stores/remotePreviewSignal';

/**
 * Block 3 of the runtime mandate: Terminal and Preview must share real runtime state. A dev
 * server the user starts by hand from this manual Remote Runtime panel is exactly as real as
 * one the agent starts through action-runner.ts's #runStartActionRemote() (already covered by
 * action-runner.spec.ts's "triggers a real Preview refresh..." test) -- Preview must learn
 * about both the same way, and must also learn when a running command exits/crashes so it
 * doesn't keep showing a stale "running" preview.
 *
 * RemoteCommandPanel is tested directly (not through the parent TerminalTabs/Panel tree) --
 * it has no dependency on react-resizable-panels itself, and rendering it standalone avoids a
 * real jsdom limitation: react-resizable-panels' Panel needs real layout measurement
 * (ResizeObserver-driven size data) jsdom cannot provide, which made a full TerminalTabs
 * render fail with "Panel size not found" regardless of runtime-mode/network mocking.
 */

const REMOTE_ANDROID_STATE: RuntimeModeState = {
  mode: 'remote',
  webContainerAvailable: false,
  isAndroid: true,
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

class MockWebSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(public url: string) {
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    });
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  emit(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

describe('RemoteCommandPanel -- keeps Preview in sync with real runtime state', () => {
  const originalWebSocket = global.WebSocket;
  let lastSocket: MockWebSocket | undefined;

  beforeEach(() => {
    remotePreviewRefreshSignal.set(0);
    lastSocket = undefined;
    (global as any).WebSocket = vi.fn((url: string) => {
      lastSocket = new MockWebSocket(url);
      return lastSocket;
    });
    (global as any).WebSocket.OPEN = MockWebSocket.OPEN;
  });

  afterEach(() => {
    cleanup();
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  it('triggers a real Preview refresh once a manually-run "npm run dev" actually starts', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockResolvedValue({
      commandId: 'cmd-manual-1',
      commandProfile: 'npm run dev',
      workspaceId: 'workspace-1',
      status: 'running',
      startedAt: new Date(0).toISOString(),
    });

    render(<RemoteCommandPanel runtime={REMOTE_ANDROID_STATE} showRemoteCommandPanel={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'npm run dev' }));

    await waitFor(() => expect(remotePreviewRefreshSignal.get()).toBe(1));
  });

  it('does NOT trigger a Preview refresh for a non-dev-server profile like "npm install"', async () => {
    const runCommand = vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockResolvedValue({
      commandId: 'cmd-manual-2',
      commandProfile: 'npm install',
      workspaceId: 'workspace-1',
      status: 'running',
      startedAt: new Date(0).toISOString(),
    });

    render(<RemoteCommandPanel runtime={REMOTE_ANDROID_STATE} showRemoteCommandPanel={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'npm install' }));

    await waitFor(() => expect(runCommand).toHaveBeenCalled());
    expect(remotePreviewRefreshSignal.get()).toBe(0);
  });

  it('triggers a real Preview refresh when a running remote command exits, so a crashed dev server is not shown as stale success', async () => {
    vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand').mockResolvedValue({
      commandId: 'cmd-manual-3',
      commandProfile: 'npm run dev',
      workspaceId: 'workspace-1',
      status: 'running',
      startedAt: new Date(0).toISOString(),
    });

    render(<RemoteCommandPanel runtime={REMOTE_ANDROID_STATE} showRemoteCommandPanel={true} />);

    fireEvent.click(screen.getByRole('button', { name: 'npm run dev' }));
    await waitFor(() => expect(remotePreviewRefreshSignal.get()).toBe(1));
    await waitFor(() => expect(lastSocket).toBeDefined());

    lastSocket!.emit({
      type: 'exit',
      timestamp: new Date().toISOString(),
      payload: { commandId: 'cmd-manual-3', status: 'exited', exitCode: 1, error: 'crashed' },
    });

    await waitFor(() => expect(remotePreviewRefreshSignal.get()).toBe(2));
  });

  it('shows an honest not-configured state and never calls the Remote Runtime when config is missing', () => {
    const runCommand = vi.spyOn(RemoteRuntimeClient.prototype, 'runCommand');

    render(
      <RemoteCommandPanel runtime={{ ...REMOTE_ANDROID_STATE, remoteRuntimeUrl: '' }} showRemoteCommandPanel={true} />,
    );

    expect(screen.getByText('Terminal Unavailable')).toBeInTheDocument();
    expect(runCommand).not.toHaveBeenCalled();
  });
});
