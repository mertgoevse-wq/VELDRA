import { useStore } from '@nanostores/react';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Panel, type ImperativePanelHandle } from 'react-resizable-panels';
import { IconButton } from '~/components/ui/IconButton';
import { shortcutEventEmitter } from '~/lib/hooks';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { Terminal, type TerminalRef } from './Terminal';
import { TerminalManager } from './TerminalManager';
import { createScopedLogger } from '~/utils/logger';
import { runtimeModeStore } from '~/lib/stores/runtime-mode';
import type { RuntimeModeState } from '~/lib/stores/runtime-mode';
import { isCapacitor } from '~/lib/adapters/platform';
import { toast } from 'react-toastify';
import {
  REMOTE_COMMAND_PROFILES,
  RemoteRuntimeClient,
  type RemoteCommandProfile,
  type RemoteCommandStatus,
  type RemoteRuntimeEvent,
} from '~/lib/remote-runtime/RemoteRuntimeClient';

const logger = createScopedLogger('Terminal');

const MAX_TERMINALS = 3;
export const DEFAULT_TERMINAL_SIZE = 25;

export const TerminalTabs = memo(() => {
  const showTerminal = useStore(workbenchStore.showTerminal);
  const theme = useStore(themeStore);
  const runtime = useStore(runtimeModeStore);
  const showRemoteCommandPanel = runtime.mode === 'remote' && (runtime.isAndroid || !runtime.webContainerAvailable);
  const showTerminalFallback = !runtime.capabilities.terminal || showRemoteCommandPanel;

  const terminalRefs = useRef<Map<number, TerminalRef>>(new Map());
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const terminalToggledByShortcut = useRef(false);

  const [activeTerminal, setActiveTerminal] = useState(0);
  const [terminalCount, setTerminalCount] = useState(0);

  const addTerminal = () => {
    if (terminalCount < MAX_TERMINALS) {
      setTerminalCount(terminalCount + 1);
      setActiveTerminal(terminalCount);
    }
  };

  const closeTerminal = useCallback(
    (index: number) => {
      if (index === 0) {
        return;
      } // Can't close bolt terminal

      const terminalRef = terminalRefs.current.get(index);

      if (terminalRef?.getTerminal) {
        const terminal = terminalRef.getTerminal();

        if (terminal) {
          workbenchStore.detachTerminal(terminal);
        }
      }

      // Remove the terminal from refs
      terminalRefs.current.delete(index);

      // Adjust terminal count and active terminal
      setTerminalCount(terminalCount - 1);

      if (activeTerminal === index) {
        setActiveTerminal(Math.max(0, index - 1));
      } else if (activeTerminal > index) {
        setActiveTerminal(activeTerminal - 1);
      }
    },
    [activeTerminal, terminalCount],
  );

  useEffect(() => {
    return () => {
      terminalRefs.current.forEach((ref, index) => {
        if (index > 0 && ref?.getTerminal) {
          const terminal = ref.getTerminal();

          if (terminal) {
            workbenchStore.detachTerminal(terminal);
          }
        }
      });
    };
  }, []);

  useEffect(() => {
    const { current: terminal } = terminalPanelRef;

    if (!terminal) {
      return;
    }

    const isCollapsed = terminal.isCollapsed();

    if (!showTerminal && !isCollapsed) {
      terminal.collapse();
    } else if (showTerminal && isCollapsed) {
      terminal.resize(DEFAULT_TERMINAL_SIZE);
    }

    terminalToggledByShortcut.current = false;
  }, [showTerminal]);

  useEffect(() => {
    const unsubscribeFromEventEmitter = shortcutEventEmitter.on('toggleTerminal', () => {
      terminalToggledByShortcut.current = true;
    });

    const unsubscribeFromThemeStore = themeStore.subscribe(() => {
      terminalRefs.current.forEach((ref) => {
        ref?.reloadStyles();
      });
    });

    return () => {
      unsubscribeFromEventEmitter();
      unsubscribeFromThemeStore();
    };
  }, []);

  return (
    <Panel
      ref={terminalPanelRef}
      defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
      minSize={10}
      collapsible
      onExpand={() => {
        if (!terminalToggledByShortcut.current) {
          workbenchStore.toggleTerminal(true);
        }
      }}
      onCollapse={() => {
        if (!terminalToggledByShortcut.current) {
          workbenchStore.toggleTerminal(false);
        }
      }}
    >
      <div className="h-full">
        <div className="bg-bolt-elements-terminals-background h-full flex flex-col">
          <div className="flex items-center bg-bolt-elements-background-depth-2 border-y border-bolt-elements-borderColor gap-1.5 min-h-[34px] p-2">
            {/*
             * Tab switching / add-terminal / reset only make sense for the real xterm terminals
             * rendered in the branch below -- RemoteCommandPanel ignores terminalCount/
             * activeTerminal entirely, so showing those controls here would be dead UI: tapping
             * "+" adds a tab with no visible effect, "Reset Terminal" looks up a terminalRefs
             * entry that's never populated in this mode and silently no-ops. Just label what's
             * actually shown.
             */}
            {showTerminalFallback ? (
              <span className="flex items-center gap-1.5 text-sm text-bolt-elements-textSecondary px-1">
                <div className="i-ph:terminal-window-duotone text-lg" />
                Remote Runtime Commands
              </span>
            ) : (
              <>
                {Array.from({ length: terminalCount + 1 }, (_, index) => {
                  const isActive = activeTerminal === index;

                  return (
                    <React.Fragment key={index}>
                      {index == 0 ? (
                        <button
                          key={index}
                          className={classNames(
                            'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                            {
                              'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary':
                                isActive,
                              'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                                !isActive,
                            },
                          )}
                          onClick={() => setActiveTerminal(index)}
                        >
                          <div className="i-ph:terminal-window-duotone text-lg" />
                          VELDRA Terminal
                        </button>
                      ) : (
                        <React.Fragment>
                          <button
                            key={index}
                            className={classNames(
                              'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                              {
                                'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': isActive,
                                'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                                  !isActive,
                              },
                            )}
                            onClick={() => setActiveTerminal(index)}
                          >
                            <div className="i-ph:terminal-window-duotone text-lg" />
                            Terminal {terminalCount > 1 && index}
                            <button
                              className="bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-transparent rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                closeTerminal(index);
                              }}
                            >
                              <div className="i-ph:x text-xs" />
                            </button>
                          </button>
                        </React.Fragment>
                      )}
                    </React.Fragment>
                  );
                })}
                {terminalCount < MAX_TERMINALS && <IconButton icon="i-ph:plus" size="md" onClick={addTerminal} />}
                <IconButton
                  icon="i-ph:arrow-clockwise"
                  title="Reset Terminal"
                  size="md"
                  onClick={() => {
                    const ref = terminalRefs.current.get(activeTerminal);

                    if (ref?.getTerminal()) {
                      const terminal = ref.getTerminal()!;
                      terminal.clear();
                      terminal.focus();

                      if (activeTerminal === 0) {
                        workbenchStore.attachBoltTerminal(terminal);
                      } else {
                        workbenchStore.attachTerminal(terminal);
                      }
                    }
                  }}
                />
              </>
            )}
            <IconButton
              className="ml-auto"
              icon="i-ph:caret-down"
              title="Close"
              size="md"
              onClick={() => workbenchStore.toggleTerminal(false)}
            />
          </div>
          {showTerminalFallback ? (
            <RemoteCommandPanel runtime={runtime} showRemoteCommandPanel={showRemoteCommandPanel} />
          ) : (
            Array.from({ length: terminalCount + 1 }, (_, index) => {
              const isActive = activeTerminal === index;

              logger.debug(`Starting bolt terminal [${index}]`);

              if (index == 0) {
                return (
                  <React.Fragment key={`terminal-container-${index}`}>
                    <Terminal
                      key={`terminal-${index}`}
                      id={`terminal_${index}`}
                      className={classNames('h-full overflow-hidden modern-scrollbar-invert', {
                        hidden: !isActive,
                      })}
                      ref={(ref) => {
                        if (ref) {
                          terminalRefs.current.set(index, ref);
                        }
                      }}
                      onTerminalReady={(terminal) => workbenchStore.attachBoltTerminal(terminal)}
                      onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                      theme={theme}
                    />
                    <TerminalManager
                      terminal={terminalRefs.current.get(index)?.getTerminal() || null}
                      isActive={isActive}
                    />
                  </React.Fragment>
                );
              } else {
                return (
                  <React.Fragment key={`terminal-container-${index}`}>
                    <Terminal
                      key={`terminal-${index}`}
                      id={`terminal_${index}`}
                      className={classNames('modern-scrollbar h-full overflow-hidden', {
                        hidden: !isActive,
                      })}
                      ref={(ref) => {
                        if (ref) {
                          terminalRefs.current.set(index, ref);
                        }
                      }}
                      onTerminalReady={(terminal) => workbenchStore.attachTerminal(terminal)}
                      onTerminalResize={(cols, rows) => workbenchStore.onTerminalResize(cols, rows)}
                      theme={theme}
                    />
                    <TerminalManager
                      terminal={terminalRefs.current.get(index)?.getTerminal() || null}
                      isActive={isActive}
                    />
                  </React.Fragment>
                );
              }
            })
          )}
        </div>
      </div>
    </Panel>
  );
});

function RemoteCommandPanel({
  runtime,
  showRemoteCommandPanel,
}: {
  runtime: RuntimeModeState;
  showRemoteCommandPanel: boolean;
}) {
  type CommandSummary = {
    commandProfile?: RemoteCommandProfile;
    commandId?: string;
    status: RemoteCommandStatus | 'idle' | 'starting' | 'input_ignored' | string;
    lastOutputAt?: string;
    exitCode?: number | null;
  };

  const wsRef = useRef<WebSocket | null>(null);
  const [output, setOutput] = useState('');
  const [activeCommandId, setActiveCommandId] = useState<string | undefined>();
  const [runningProfile, setRunningProfile] = useState<RemoteCommandProfile | undefined>();
  const [lastCommand, setLastCommand] = useState<CommandSummary>({ status: 'idle' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>();

  const missingConfig = [
    !runtime.remoteRuntimeUrl.trim() ? 'server URL' : undefined,
    !runtime.remoteAuthToken.trim() ? 'auth token' : undefined,
    !runtime.remoteWorkspaceId.trim() ? 'workspace ID' : undefined,
  ].filter(Boolean) as string[];
  const remoteConfigured = showRemoteCommandPanel && missingConfig.length === 0;

  const appendOutput = useCallback((chunk: string) => {
    setOutput((current) => {
      const next = `${current}${chunk}`;
      return next.length > 20000 ? next.slice(-20000) : next;
    });
  }, []);

  const updateCommandSummary = useCallback((event: RemoteRuntimeEvent) => {
    const { payload } = event;
    const isCommandEvent = Boolean(payload.commandId || payload.commandProfile);

    if (!isCommandEvent && payload.status !== 'input_ignored') {
      return;
    }

    setLastCommand((current) => ({
      commandProfile: payload.commandProfile ?? current.commandProfile,
      commandId: payload.commandId ?? current.commandId,
      status: payload.status ?? current.status,
      lastOutputAt: event.timestamp,
      exitCode: event.type === 'exit' ? (payload.exitCode ?? null) : current.exitCode,
    }));
  }, []);

  const createClient = useCallback(() => {
    return new RemoteRuntimeClient(runtime.remoteRuntimeUrl, runtime.remoteAuthToken, runtime.remoteWorkspaceId);
  }, [runtime.remoteAuthToken, runtime.remoteRuntimeUrl, runtime.remoteWorkspaceId]);

  const handleEvent = useCallback(
    (event: RemoteRuntimeEvent) => {
      const { payload } = event;
      updateCommandSummary(event);

      if (event.type === 'stdout' || event.type === 'stderr') {
        appendOutput(payload.output ?? '');
        return;
      }

      if (event.type === 'status') {
        if (payload.status === 'connected') {
          appendOutput('[remote] connected\n');
        } else if (payload.output) {
          appendOutput(`[remote] ${payload.output}`);
        }

        return;
      }

      if (event.type === 'exit') {
        const status = payload.status ?? 'exited';
        const code = payload.exitCode === null || payload.exitCode === undefined ? '' : ` code=${payload.exitCode}`;
        const error = payload.error ? ` error=${payload.error}` : '';
        appendOutput(`\n[remote] command ${status}${code}${error}\n`);
        setActiveCommandId(undefined);
        setRunningProfile(undefined);
      }
    },
    [appendOutput, updateCommandSummary],
  );

  const connectEvents = useCallback(async () => {
    if (!remoteConfigured) {
      throw new Error(`Remote Runtime is not configured. Missing: ${missingConfig.join(', ')}.`);
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);

    await new Promise<void>((resolve, reject) => {
      const ws = createClient().connectEvents(handleEvent);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        resolve();
      };

      ws.onerror = () => {
        setIsConnecting(false);
        reject(new Error('Remote Runtime event stream failed to connect.'));
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      };
    });
  }, [createClient, handleEvent, missingConfig, remoteConfigured]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const handleOpenSettings = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (isCapacitor()) {
      window.dispatchEvent(new CustomEvent('open-mobile-tab', { detail: 'settings' }));
    } else {
      toast.info('Please open Settings > Runtime Mode from the sidebar to configure Remote Runtime.');
    }
  }, []);

  const runProfile = useCallback(
    async (commandProfile: RemoteCommandProfile) => {
      setLastError(undefined);

      try {
        await connectEvents();
        appendOutput(`\n$ ${commandProfile}\n`);
        setLastCommand({
          commandProfile,
          status: 'starting',
          lastOutputAt: new Date().toISOString(),
          exitCode: undefined,
        });

        const command = await createClient().runCommand(commandProfile);
        setActiveCommandId(command.commandId);
        setRunningProfile(commandProfile);
        setLastCommand({
          commandProfile: command.commandProfile,
          commandId: command.commandId,
          status: command.status,
          lastOutputAt: command.startedAt,
          exitCode: command.exitCode,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run remote command.';
        setLastError(message);
        appendOutput(`\n[remote:error] ${message}\n`);
        setLastCommand((current) => ({ ...current, status: 'error', lastOutputAt: new Date().toISOString() }));
      }
    },
    [appendOutput, connectEvents, createClient],
  );

  const stopActiveCommand = useCallback(async () => {
    if (!activeCommandId) {
      return;
    }

    setLastError(undefined);

    try {
      const stoppedCommand = await createClient().stopCommand(activeCommandId);
      setLastCommand({
        commandProfile: stoppedCommand.commandProfile,
        commandId: stoppedCommand.commandId,
        status: stoppedCommand.status,
        lastOutputAt: stoppedCommand.endedAt ?? new Date().toISOString(),
        exitCode: stoppedCommand.exitCode,
      });
      setActiveCommandId(undefined);
      setRunningProfile(undefined);
      appendOutput(`\n[remote] stop requested for ${activeCommandId}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop remote command.';
      setLastError(message);
      appendOutput(`\n[remote:error] ${message}\n`);
      setLastCommand((current) => ({ ...current, status: 'error', lastOutputAt: new Date().toISOString() }));
    }
  }, [activeCommandId, appendOutput, createClient]);

  if (!remoteConfigured) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-bolt-elements-terminals-background text-bolt-elements-textPrimary">
        <div className="i-ph:terminal-window-duotone text-5xl text-bolt-elements-textSecondary mb-3" />
        <h3 className="text-md font-semibold mb-1">Terminal Unavailable</h3>
        <p className="text-xs text-bolt-elements-textSecondary max-w-sm mb-4 leading-relaxed">
          Interactive terminals require WebContainer or a configured Remote Runtime. Remote Runtime runs only safe
          predefined command profiles.
        </p>
        {showRemoteCommandPanel && missingConfig.length > 0 && (
          <p className="text-xs text-amber-400 max-w-sm mb-4">Missing: {missingConfig.join(', ')}.</p>
        )}
        <button
          onClick={handleOpenSettings}
          className="px-3.5 py-1.5 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-lg text-xs font-medium transition-colors"
        >
          Configure Remote Runtime
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bolt-elements-terminals-background text-bolt-elements-textPrimary">
      <div className="border-b border-bolt-elements-borderColor p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Remote Runtime Commands</h3>
            <p className="text-xs text-bolt-elements-textSecondary">
              Safe predefined profiles only. Free-form terminal input is disabled.
            </p>
          </div>
          <div className="text-[10px] uppercase text-bolt-elements-textSecondary">
            {isConnecting ? 'connecting' : runningProfile ? `running ${runningProfile}` : 'ready'}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {REMOTE_COMMAND_PROFILES.map((profile) => (
            <button
              key={profile}
              onClick={() => runProfile(profile)}
              disabled={Boolean(activeCommandId) || isConnecting}
              className="px-3 py-2 rounded-md border border-bolt-elements-borderColor text-xs font-medium text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {profile}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={stopActiveCommand}
            disabled={!activeCommandId}
            className="px-3 py-1.5 rounded-md bg-red-600/90 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Stop running command
          </button>
          <button
            onClick={() => setOutput('')}
            className="px-3 py-1.5 rounded-md border border-bolt-elements-borderColor text-xs text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3"
          >
            Clear output
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2 text-[10px]">
          <CommandSummaryField label="Last profile" value={lastCommand.commandProfile ?? 'None'} />
          <CommandSummaryField label="Command ID" value={lastCommand.commandId ?? 'None'} />
          <CommandSummaryField label="Status" value={lastCommand.status} />
          <CommandSummaryField
            label="Last output"
            value={lastCommand.lastOutputAt ? new Date(lastCommand.lastOutputAt).toLocaleTimeString() : 'None'}
          />
          <CommandSummaryField
            label="Exit code"
            value={
              lastCommand.exitCode === undefined || lastCommand.exitCode === null
                ? 'None'
                : String(lastCommand.exitCode)
            }
          />
        </div>

        {lastError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{lastError}</div>
        )}
      </div>

      <pre className="flex-1 min-h-0 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-bolt-elements-textSecondary">
        {output || '[remote] Select a command profile to start.\n'}
      </pre>
    </div>
  );
}

function CommandSummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="uppercase text-bolt-elements-textTertiary">{label}</div>
      <div className="truncate font-medium text-bolt-elements-textPrimary" title={value}>
        {value}
      </div>
    </div>
  );
}
