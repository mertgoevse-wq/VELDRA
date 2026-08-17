/**
 * AndroidShell
 *
 * Top-level React component for the Android SPA build.
 * This replaces the Remix routing layer and renders a self-contained
 * mobile UI with:
 *   - DnD provider (TouchBackend for mobile)
 *   - Theme system
 *   - Toast notifications
 *   - Android fallback banner
 *   - Bottom navigation (Chat / Files / Settings tabs)
 *   - Tab-based view management
 *
 * Existing stores, adapters, and components are reused through the VELDRA shell.
 * Only the routing glue is replaced with tab-based navigation.
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useStore } from '@nanostores/react';
import { DndProvider } from 'react-dnd';
import { TouchBackend } from 'react-dnd-touch-backend';
import { cssTransition, ToastContainer } from 'react-toastify';
import { App as CapacitorApp } from '@capacitor/app';
import { themeStore } from '~/lib/stores/theme';
import { skinStore } from '~/lib/stores/skin';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { classNames } from '~/utils/classNames';
import AndroidFallbackBanner from '~/components/mobile/AndroidFallbackBanner';
import { BottomNav } from '~/components/mobile/BottomNav';
import type { MobileTab } from '~/components/mobile/BottomNav';
import AndroidSettingsPanel from '~/components/mobile/AndroidSettingsPanel';

import { startNewAndroidChat } from '~/lib/stores/androidChatSession';
import { ChatHistoryDrawer } from '~/components/mobile/ChatHistoryDrawer';
import { ConnectionBanner } from '~/components/mobile/ConnectionBanner';
import { activeTemplateStore, clearTemplate } from '~/lib/stores/template';
import { workspaceLayoutStore, panelToTab } from '~/lib/stores/workspaceLayout';
import { computed } from 'nanostores';

import 'react-toastify/dist/ReactToastify.css';

// Lazy-load the heavy chat/workbench components to keep initial load fast
const ChatLazy = React.lazy(() => import('~/components/chat/Chat.client').then((m) => ({ default: m.Chat })));
const AndroidWorkbenchLazy = React.lazy(() =>
  import('~/components/mobile/AndroidWorkbenchScreen').then((m) => ({ default: m.AndroidWorkbenchScreen })),
);

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

/**
 * Minimal loading spinner shown while the chat chunk loads.
 */
function LoadingScreen() {
  return (
    <div className="android-loading-screen">
      <div className="android-loading-inner">
        <div className="android-spinner" />
        <p className="android-loading-text">Loading VELDRA…</p>
      </div>
    </div>
  );
}

/**
 * Error boundary for the lazy-loaded chat.
 */
class ChatErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="android-error-screen">
          <div className="android-error-inner">
            <div className="i-ph:warning-circle-fill android-error-icon" />
            <h2 className="android-error-title">Failed to load chat</h2>
            <p className="android-error-message">{this.state.error.message}</p>
            <button className="android-error-retry" onClick={() => window.location.reload()}>
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Settings panel placeholder — wraps AndroidSettingsPanel in a full-screen sheet.
 */
function SettingsTab() {
  return (
    <div className="android-tab-content android-settings-tab">
      <Suspense fallback={<LoadingScreen />}>
        <AndroidSettingsPanel />
      </Suspense>
    </div>
  );
}

export default function AndroidShell() {
  const theme = useStore(themeStore);
  const skin = useStore(skinStore);
  const runtime = useStore(runtimeModeStore);
  const activeTemplate = useStore(activeTemplateStore);
  const workspaceLayout = useStore(workspaceLayoutStore);
  const [activeTab, setActiveTab] = useState<MobileTab>('chat');
  const [historyOpen, setHistoryOpen] = useState(false);

  // Sync theme + skin to HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-skin', skin);
  }, [skin]);

  // Handle programmatic tab changes (e.g. from fallback buttons)
  useEffect(() => {
    const handleOpenTab = (e: Event) => {
      const customEvent = e as CustomEvent<MobileTab>;

      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };

    window.addEventListener('open-mobile-tab', handleOpenTab);

    return () => {
      window.removeEventListener('open-mobile-tab', handleOpenTab);
    };
  }, []);

  // When a template is applied, switch to the tab matching its primary panel
  useEffect(() => {
    if (activeTemplate) {
      const targetTab = panelToTab(workspaceLayout.primaryPanel);

      if (targetTab === 'workbench') {
        workbenchStore.currentView.set(workspaceLayout.primaryPanel === 'preview' ? 'preview' : 'code');
      }

      setActiveTab(targetTab);
    }
  }, [activeTemplate, workspaceLayout.primaryPanel]);

  // Auto-navigate to preview when AI writes an index.html
  const hasIndexHtml = useStore(
    computed(workbenchStore.files, (files) =>
      Object.keys(files).some((p) => p === 'index.html' || p.endsWith('/index.html')),
    ),
  );
  const prevHasIndexHtmlRef = React.useRef(false);

  useEffect(() => {
    const hadFile = prevHasIndexHtmlRef.current;

    if (!hadFile && hasIndexHtml && activeTab === 'chat') {
      // Brief delay so AI finishes writing other files first
      const t = window.setTimeout(() => {
        workbenchStore.currentView.set('preview');
        setActiveTab('workbench');
      }, 1200);
      return () => window.clearTimeout(t);
    }

    prevHasIndexHtmlRef.current = hasIndexHtml;

    return undefined;
  }, [hasIndexHtml, activeTab]);

  // Log platform info on mount
  useEffect(() => {
    console.log('[AndroidShell] Mounted', {
      isAndroid: runtime.isAndroid,
      mode: runtime.mode,
      webContainerAvailable: runtime.webContainerAvailable,
    });
  }, []);

  /*
   * The Workbench tab doesn't own separate content per se -- it mounts AndroidWorkbenchScreen
   * (file tree, editor, code/diff/preview segments, terminal sheet), which reads/writes
   * workbenchStore.currentView itself once mounted. This shell only owns the coarse
   * mount/unmount (showWorkbench), not which internal segment is selected -- ActionRunner/
   * FilesStore already correctly persist agent file changes regardless of which tab is active.
   */
  useEffect(() => {
    workbenchStore.setShowWorkbench(activeTab === 'workbench');
  }, [activeTab]);

  /*
   * The sync above is one-directional (activeTab -> showWorkbench). But showWorkbench also has
   * writers this shell doesn't control -- Artifact.tsx's chat-message toggle, and
   * useMessageParser.ts auto-opening it the moment the AI starts streaming file content. When
   * either of those flips it true while activeTab is still 'chat', the Workbench screen (which
   * mounts independent of activeTab) would render, but the bottom nav still highlights "Chat"
   * and .android-tab-active/-hidden still says the Chat pane is what's showing -- two state
   * sources disagreeing about what's on screen. Close the loop: whenever showWorkbench becomes
   * true for a reason other than this shell's own tab switch, follow it to the 'workbench' tab
   * so nav/visibility/panel all agree.
   */
  const showWorkbench = useStore(workbenchStore.showWorkbench);

  useEffect(() => {
    if (showWorkbench && activeTab !== 'workbench') {
      setActiveTab('workbench');
    }
  }, [showWorkbench, activeTab]);

  /*
   * Android hardware back button: once a JS listener is registered, Capacitor stops applying
   * its own default behavior (WebView back / minimize) entirely -- every case must be handled
   * explicitly here, or back does nothing. Handles the two levels of navigation state this
   * shell itself owns: the Files/Preview Workbench overlay, and the bottom-nav tab. Re-registers
   * on every activeTab change instead of using a ref so the listener always closes over the
   * current tab without needing extra indirection.
   *
   * NOT handled here (known, deferred gap -- see project/SESSION-HANDOFF.md): drawers/dialogs
   * owned by deeper components (MobileFileTreeDrawer, MobileTerminalDrawer, the Settings
   * ControlPanel's own sub-panels, delete-confirmation dialogs) have local state this shell
   * can't see, so back skips past them straight to the tab/overlay level while they're open.
   * A proper fix needs a shared "back handler stack" components can register into -- a bigger
   * change than this slice.
   */
  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    let cancelled = false;

    CapacitorApp.addListener('backButton', () => {
      if (historyOpen) {
        setHistoryOpen(false);
        return;
      }

      if (activeTab !== 'chat') {
        setActiveTab('chat');
        return;
      }

      CapacitorApp.exitApp();
    })
      .then((registered) => {
        if (cancelled) {
          registered.remove();
          return;
        }

        handle = registered;
      })
      .catch((error) => {
        console.warn('[AndroidShell] Failed to register back button handler', error);
      });

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [activeTab, historyOpen]);

  const isStreaming = useStore(streamingState);

  return (
    <DndProvider backend={TouchBackend} options={{ enableMouseEvents: true }}>
      {/* Theme-aware root */}
      <div className={classNames('android-shell', `theme-${theme}`)} data-theme={theme}>
        {/* Connection status + fallback banners */}
        <ConnectionBanner />
        <AndroidFallbackBanner />

        {/* Main content area */}
        <main className="android-main">
          {/* Chat tab */}
          <div
            className={classNames('android-tab-content', {
              'android-tab-active': activeTab === 'chat',
              'android-tab-hidden': activeTab !== 'chat',
            })}
            aria-hidden={activeTab !== 'chat'}
          >
            {/* Active template badge */}
            {activeTemplate && (
              <div className="android-template-badge">
                <div className={`android-template-badge-icon ${activeTemplate.icon}`} />
                <span>{activeTemplate.name}</span>
                <button
                  className="android-template-badge-dismiss"
                  onClick={() => clearTemplate()}
                  aria-label="Clear template"
                >
                  <div className="i-ph:x-bold" />
                </button>
              </div>
            )}

            {/* Top action buttons */}
            <button
              className="android-new-chat-btn"
              style={{ right: 12 }}
              onClick={() => startNewAndroidChat()}
              aria-label="New chat"
            >
              <div className="i-ph:plus-bold" style={{ width: 18, height: 18 }} />
            </button>
            <button
              className="android-new-chat-btn"
              style={{ right: 60 }}
              onClick={() => setHistoryOpen(true)}
              aria-label="Chat history"
            >
              <div className="i-ph:clock-counter-clockwise-bold" style={{ width: 18, height: 18 }} />
            </button>
            <ChatErrorBoundary>
              <Suspense fallback={<LoadingScreen />}>
                <ChatLazy />
              </Suspense>
            </ChatErrorBoundary>
          </div>

          {/*
           * Workbench tab: mounted only while active. All state it reads/writes
           * (files, selectedFile, currentView, unsavedFiles) lives in workbenchStore, not local
           * component state, so unmount/remount on tab switch loses nothing -- and not keeping a
           * CodeMirror instance alive off-screen is a real memory/battery win on Android.
           */}
          {activeTab === 'workbench' && (
            <Suspense fallback={<LoadingScreen />}>
              <AndroidWorkbenchLazy isStreaming={isStreaming} onBack={() => setActiveTab('chat')} />
            </Suspense>
          )}

          {/* Settings tab */}
          {activeTab === 'settings' && <SettingsTab />}
        </main>

        {/* Bottom navigation */}
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} workbenchAvailable />

        {/* Chat history drawer */}
        <ChatHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />

        {/* Toasts */}
        <ToastContainer
          position="top-center"
          autoClose={3000}
          pauseOnFocusLoss
          transition={toastAnimation}
          closeButton={({ closeToast }) => (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          )}
          icon={({ type }) => {
            if (type === 'success') {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }

            if (type === 'error') {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }

            return undefined;
          }}
        />
      </div>
    </DndProvider>
  );
}
