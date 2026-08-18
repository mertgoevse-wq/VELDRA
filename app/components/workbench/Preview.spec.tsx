// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Preview } from './Preview';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { RemoteRuntimeClient, type RemotePreviewResponse } from '~/lib/remote-runtime/RemoteRuntimeClient';
import { remotePreviewRefreshSignal, triggerRemotePreviewRefresh } from '~/lib/stores/remotePreviewSignal';
import { workbenchStore } from '~/lib/stores/workbench';
import { isCapacitor } from '~/lib/adapters/platform';
import { PREVIEW_MESSAGE_MARKER } from '~/lib/preview/staticPreviewBundle';

/*
 * Only the platform probe is mocked, not the preview pipeline: the static-preview tests below
 * need the Capacitor-gated auto-start branch to run, and jsdom is not Capacitor. Everything
 * else -- buildStaticPreview, the blob document, the message listener -- stays real.
 */
vi.mock('~/lib/adapters/platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/lib/adapters/platform')>()),
  isCapacitor: vi.fn(() => false),
}));

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

  it('ignores a stale response from an older overlapping refresh request (no request-ordering guard = a race)', async () => {
    let resolveFirst!: (value: RemotePreviewResponse) => void;
    const firstCallPromise = new Promise<RemotePreviewResponse>((resolve) => {
      resolveFirst = resolve;
    });

    const getPreviewUrl = vi
      .spyOn(RemoteRuntimeClient.prototype, 'getPreviewUrl')
      .mockImplementationOnce(() => firstCallPromise)
      .mockResolvedValueOnce(
        makePreviewResponse({ status: 'running', previewUrl: 'https://preview.example.com/fresh' }),
      );

    runtimeModeStore.set(REMOTE_STATE);
    render(<Preview />);

    // Mount fires the first (now-pending) request.
    await waitFor(() => expect(getPreviewUrl).toHaveBeenCalledTimes(1));

    // A second, newer refresh is issued (e.g. the agent-start signal) before the first resolves.
    triggerRemotePreviewRefresh();
    await waitFor(() => expect(getPreviewUrl).toHaveBeenCalledTimes(2));

    const freshIframe = await screen.findByTitle('remote-preview');
    expect(freshIframe).toHaveAttribute('src', 'https://preview.example.com/fresh');

    // The older, slower request finally resolves with stale data -- it must be discarded.
    resolveFirst(makePreviewResponse({ status: 'running', previewUrl: 'https://preview.example.com/STALE' }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.getByTitle('remote-preview')).toHaveAttribute('src', 'https://preview.example.com/fresh');
  });
});

/**
 * The Android-only static preview path, which had no component coverage at all: on
 * `android-fallback` there is no dev server, so `staticPreviewBundle.ts`'s blob document IS
 * the product's live preview. The build step producing a URL proves nothing about whether the
 * page runs -- this runtime has no compiler and no module resolver -- so these tests drive the
 * real reporter round trip (document -> postMessage -> listener -> banner) and pin the rule
 * that no branch may claim success the frame did not actually report.
 */
describe('Preview -- Android static preview honesty', () => {
  const originalState = runtimeModeStore.get();

  const ANDROID_STATE = {
    mode: 'android-fallback' as const,
    webContainerAvailable: false,
    isAndroid: true,
    remoteRuntimeUrl: '',
    remoteAuthToken: '',
    remoteWorkspaceId: '',
    capabilities: {
      fileSystem: true,
      terminal: false,
      commandExecution: false,
      agentBuildCommands: false,
      packageInstall: false,
      devServer: false,
      preview: false,
      persistentFileSystem: true,
    },
    autoDetected: true,
  };

  beforeEach(() => {
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

    // The auto-start effect is deliberately Capacitor-gated; this path only exists on Android.
    vi.mocked(isCapacitor).mockReturnValue(true);
    runtimeModeStore.set(ANDROID_STATE);
    workbenchStore.files.set({
      'index.html': {
        type: 'file',
        content: '<html><head><title>Dash</title></head><body><h1>Dashboard</h1></body></html>',
        isBinary: false,
      },
    });
  });

  afterEach(() => {
    cleanup();
    runtimeModeStore.set(originalState);
    workbenchStore.files.set({});
    vi.restoreAllMocks();
  });

  /** Post as the preview document itself -- the listener requires `source` to be its contentWindow. */
  function reportFromPreviewDocument(iframe: HTMLIFrameElement, payload: Record<string, unknown>) {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { [PREVIEW_MESSAGE_MARKER]: true, ...payload },
        source: iframe.contentWindow,
      }),
    );
  }

  it('auto-starts a real static preview from generated files, with no click and no dev server', async () => {
    render(<Preview />);

    const iframe = (await screen.findByTitle('static-preview')) as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toMatch(/^blob:/);
  });

  it('does not claim the preview works until the document itself reports back', async () => {
    render(<Preview />);
    await screen.findByTitle('static-preview');

    expect(screen.getByText('Loading preview…')).toBeInTheDocument();
    expect(screen.queryByText(/Preview running/)).not.toBeInTheDocument();
  });

  it("shows the browser's own error text when the preview document reports a real failure", async () => {
    render(<Preview />);
    const iframe = (await screen.findByTitle('static-preview')) as HTMLIFrameElement;

    reportFromPreviewDocument(iframe, {
      kind: 'error',
      message: "Unexpected token '<'",
      source: 'blob:app.jsx',
      line: 3,
    });

    expect(await screen.findByText('The preview failed to run')).toBeInTheDocument();
    expect(screen.getByText(/Unexpected token '<'/)).toBeInTheDocument();
    expect(screen.queryByText(/Preview running/)).not.toBeInTheDocument();
  });

  it('reports success only after a real load that rendered content', async () => {
    render(<Preview />);
    const iframe = (await screen.findByTitle('static-preview')) as HTMLIFrameElement;

    reportFromPreviewDocument(iframe, { kind: 'ready', renderedNodes: 12 });

    expect(await screen.findByText(/Preview running/)).toBeInTheDocument();
  });

  it('keeps a reported error visible when a later load event arrives (a blank frame still has a cause)', async () => {
    render(<Preview />);
    const iframe = (await screen.findByTitle('static-preview')) as HTMLIFrameElement;

    reportFromPreviewDocument(iframe, { kind: 'error', message: 'ReferenceError: React', source: '', line: 0 });
    await screen.findByText('The preview failed to run');

    // A module script throws before `load` fires, so 'ready' arrives second and must not erase it.
    reportFromPreviewDocument(iframe, { kind: 'ready', renderedNodes: 0 });

    await waitFor(() => expect(screen.getByText('The preview failed to run')).toBeInTheDocument());
    expect(screen.getByText(/ReferenceError: React/)).toBeInTheDocument();
  });

  it('ignores a verdict from anything that is not the preview frame', async () => {
    render(<Preview />);
    await screen.findByTitle('static-preview');

    // Correct shape, wrong sender: an unrelated frame or extension must not be able to fake a pass.
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { [PREVIEW_MESSAGE_MARKER]: true, kind: 'ready', renderedNodes: 99 },
        source: window,
      }),
    );

    await waitFor(() => expect(screen.getByText('Loading preview…')).toBeInTheDocument());
    expect(screen.queryByText(/Preview running/)).not.toBeInTheDocument();
  });
});
