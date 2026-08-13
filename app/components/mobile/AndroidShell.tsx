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
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { classNames } from '~/utils/classNames';
import AndroidFallbackBanner from '~/components/mobile/AndroidFallbackBanner';
import { BottomNav } from '~/components/mobile/BottomNav';
import type { MobileTab } from '~/components/mobile/BottomNav';
import AndroidSettingsPanel from '~/components/mobile/AndroidSettingsPanel';

import { startNewAndroidChat } from '~/lib/stores/androidChatSession';

import 'react-toastify/dist/ReactToastify.css';

// Lazy-load the heavy chat/workbench components to keep initial load fast
const ChatLazy = React.lazy(() => import('~/components/chat/Chat.client').then((m) => ({ default: m.Chat })));
const WorkbenchLazy = React.lazy(() =>
  import('~/components/workbench/Workbench.client').then((m) => ({ default: m.Workbench })),
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
  const runtime = useStore(runtimeModeStore);
  const [activeTab, setActiveTab] = useState<MobileTab>('chat');

  // Sync theme to HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  // Log platform info on mount
  useEffect(() => {
    console.log('[AndroidShell] Mounted', {
      isAndroid: runtime.isAndroid,
      mode: runtime.mode,
      webContainerAvailable: runtime.webContainerAvailable,
    });
  }, []);

  /*
   * The Files/Preview tabs don't own separate content -- they open the same Workbench
   * component (file tree, editor, code/diff slider, preview) that desktop already uses,
   * controlled by workbenchStore.showWorkbench/currentView. Without this, ActionRunner/
   * FilesStore already correctly persist agent file changes, but there was no way to ever
   * see them on Android -- Workbench was never mounted here.
   */
  useEffect(() => {
    if (activeTab === 'files') {
      workbenchStore.setShowWorkbench(true);
      workbenchStore.currentView.set('code');
    } else if (activeTab === 'preview') {
      workbenchStore.setShowWorkbench(true);
      workbenchStore.currentView.set('preview');
    } else {
      workbenchStore.setShowWorkbench(false);
    }
  }, [activeTab]);

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
      if (workbenchStore.showWorkbench.get()) {
        setActiveTab('chat');
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
  }, [activeTab]);

  const isStreaming = useStore(streamingState);

  return (
    <DndProvider backend={TouchBackend} options={{ enableMouseEvents: true }}>
      {/* Theme-aware root */}
      <div className={classNames('android-shell', `theme-${theme}`)} data-theme={theme}>
        {/* Android fallback mode banner */}
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
            {/* New Chat button — top right */}
            <button className="android-new-chat-btn" onClick={() => startNewAndroidChat()} aria-label="New chat">
              <div className="i-ph:plus-bold" style={{ width: 18, height: 18 }} />
            </button>
            <ChatErrorBoundary>
              <Suspense fallback={<LoadingScreen />}>
                <ChatLazy />
              </Suspense>
            </ChatErrorBoundary>
          </div>

          {/*
           * Workbench (Files/Preview) stays mounted always, not just when active -- it manages
           * its own visibility via workbenchStore.showWorkbench (collapses to width:0 when
           * closed), and unmounting/remounting it on every tab switch would lose file-tree/
           * editor state for no benefit.
           */}
          <Suspense fallback={null}>
            <WorkbenchLazy chatStarted isStreaming={isStreaming} />
          </Suspense>

          {/* Settings tab */}
          {activeTab === 'settings' && <SettingsTab />}
        </main>

        {/* Bottom navigation */}
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} workbenchAvailable />

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
