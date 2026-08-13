import type { SandboxSession, SandboxProcess } from '~/lib/execution/types';
import { atom, type WritableAtom } from 'nanostores';
import type { ITerminal } from '~/types/terminal';
import { newBoltShellProcess, newShellProcess } from '~/utils/shell';
import { coloredText } from '~/utils/terminal';
import { isWebContainerSupported, isCapacitor } from '~/lib/adapters/platform';

export class TerminalStore {
  #getSession: () => Promise<SandboxSession | null>;
  #terminals: Array<{ terminal: ITerminal; process: SandboxProcess }> = [];
  #boltTerminal = newBoltShellProcess();
  #isFallbackMode = false;

  showTerminal: WritableAtom<boolean> = import.meta.hot?.data.showTerminal ?? atom(true);

  constructor(getSession: () => Promise<SandboxSession | null>) {
    this.#getSession = getSession;

    // Check if we're in fallback mode (Android/no WebContainer)
    if (!import.meta.env.SSR) {
      const wcSupported = isWebContainerSupported() && !isCapacitor();

      if (!wcSupported) {
        this.#isFallbackMode = true;
      }
    }

    if (import.meta.hot) {
      import.meta.hot.data.showTerminal = this.showTerminal;
    }
  }
  get boltTerminal() {
    return this.#boltTerminal;
  }

  get isFallbackMode() {
    return this.#isFallbackMode;
  }

  toggleTerminal(value?: boolean) {
    this.showTerminal.set(value !== undefined ? value : !this.showTerminal.get());
  }
  async attachBoltTerminal(terminal: ITerminal) {
    if (this.#isFallbackMode) {
      terminal.write(
        coloredText.yellow('⚠ WebContainer terminal is not available on this device.\n') +
          coloredText.gray('Chat and code generation still work. Preview and shell commands are disabled.\n\n'),
      );
      return;
    }

    try {
      const session = await this.#getSession();

      if (!session) {
        throw new Error('No active sandbox session');
      }

      await this.#boltTerminal.init(session, terminal);
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn bolt shell\n\n') + error.message);
      return;
    }
  }
  async attachTerminal(terminal: ITerminal) {
    if (this.#isFallbackMode) {
      terminal.write(
        coloredText.yellow('⚠ Terminal is not available on this device.\n') +
          coloredText.gray('WebContainer is required for shell access.\n\n'),
      );
      return;
    }

    try {
      const session = await this.#getSession();

      if (!session) {
        throw new Error('No active sandbox session');
      }

      const shellProcess = await newShellProcess(session, terminal);
      this.#terminals.push({ terminal, process: shellProcess });
    } catch (error: any) {
      terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message);
      return;
    }
  }

  onTerminalResize(cols: number, rows: number) {
    if (this.#isFallbackMode) {
      return;
    }

    for (const { process } of this.#terminals) {
      process.resize?.({ cols, rows });
    }
  }

  async detachTerminal(terminal: ITerminal) {
    const terminalIndex = this.#terminals.findIndex((t) => t.terminal === terminal);

    if (terminalIndex !== -1) {
      const { process } = this.#terminals[terminalIndex];

      try {
        process.kill();
      } catch (error) {
        console.warn('Failed to kill terminal process:', error);
      }
      this.#terminals.splice(terminalIndex, 1);
    }
  }
}
