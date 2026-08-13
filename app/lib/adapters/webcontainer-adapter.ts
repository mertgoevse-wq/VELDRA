/**
 * WebContainer Platform Adapter
 *
 * Wraps the existing @webcontainer/api in the PlatformAdapter interface
 * for desktop browser environments where WebContainer is supported.
 */

import { WebContainer } from '@webcontainer/api';
import type { PlatformAdapter, PlatformInfo, IFileSystem, ITerminalProcess, IPreview } from './types';
import type { ITerminal } from '~/types/terminal';
import { WORK_DIR_NAME } from '~/utils/constants';
import { newShellProcess } from '~/utils/shell';

export class WebContainerAdapter implements PlatformAdapter {
  private _instance: WebContainer | null = null;
  private _ready = false;
  private _serverReadyCallbacks: ((port: number, url: string) => void)[] = [];
  private _portCallbacks: ((port: number, type: 'open' | 'close', url: string) => void)[] = [];
  private _previewCallbacks: ((message: any) => void)[] = [];
  private _previews: IPreview[] = [];

  getPlatformInfo(): PlatformInfo {
    return {
      type: 'webcontainer',
      isMobile: false,
      isAndroid: false,
      isWebContainerSupported: true,
      isElectron: false,
    };
  }

  async boot(): Promise<void> {
    if (this._instance) {
      return;
    }

    this._instance = await WebContainer.boot({
      coep: 'credentialless',
      workdirName: WORK_DIR_NAME,
      forwardPreviewErrors: true,
    });

    this._ready = true;

    this._instance.on('server-ready', (port, url) => {
      this._serverReadyCallbacks.forEach((cb) => cb(port, url));
    });

    this._instance.on('port', (port, type, url) => {
      this._portCallbacks.forEach((cb) => cb(port, type, url));
    });

    this._instance.on('preview-message', (message) => {
      this._previewCallbacks.forEach((cb) => cb(message));
    });
  }

  isReady(): boolean {
    return this._ready;
  }

  getFileSystem(): IFileSystem {
    if (!this._instance) {
      throw new Error('WebContainer not booted');
    }

    const wc = this._instance;

    return {
      async readFile(path: string) {
        const data = await wc.fs.readFile(path);
        const buffer = new Uint8Array(data.byteLength);
        buffer.set(new Uint8Array(data));

        const isBinary = buffer.some((byte) => byte === 0);
        const content = isBinary ? '' : new TextDecoder().decode(buffer);

        return { content, isBinary };
      },

      async writeFile(path: string, content: string | Uint8Array) {
        if (typeof content === 'string') {
          await wc.fs.writeFile(path, content);
        } else {
          await wc.fs.writeFile(path, content);
        }
      },

      async mkdir(path: string, recursive?: boolean) {
        if (recursive) {
          await wc.fs.mkdir(path, { recursive: true });
        } else {
          await wc.fs.mkdir(path);
        }
      },

      async readdir(path: string) {
        const entries = await wc.fs.readdir(path, { withFileTypes: true });
        return entries.map((entry) => ({
          name: entry.name,
          path: `${path}/${entry.name}`,
          type: entry.isDirectory() ? ('folder' as const) : ('file' as const),
        }));
      },

      async rm(path: string, recursive?: boolean) {
        if (recursive) {
          await wc.fs.rm(path, { recursive: true });
        } else {
          await wc.fs.rm(path);
        }
      },

      async rename(oldPath: string, newPath: string) {
        await wc.fs.rename(oldPath, newPath);
      },

      async watch(path: string, callback: (event: any) => void) {
        const watcher = await wc.fs.watch(path, { recursive: true });
        (watcher as any).addEventListener('change', (event: any) => {
          callback({ path: event.filename || path, type: 'change' });
        });

        return () => watcher.close();
      },
    };
  }

  async spawnShell(terminal: ITerminal): Promise<ITerminalProcess> {
    if (!this._instance) {
      throw new Error('WebContainer not booted');
    }

    /*
     * TODO: Architectural mismatch - newShellProcess expects SandboxSession but receives WebContainer.
     * This should be refactored to use WebContainerSession from lib/execution/webcontainer.ts
     */
    const process = await newShellProcess(this._instance as any, terminal);

    return {
      get input() {
        // process.input is guaranteed to exist for interactive shells
        return process.input!.getWriter();
      },
      get output() {
        return process.output;
      },
      resize(cols: number, rows: number) {
        process.resize?.({ cols, rows });
      },
      kill() {
        process.kill();
      },
    };
  }

  async executeCommand(command: string): Promise<{ output: string; exitCode: number }> {
    if (!this._instance) {
      throw new Error('WebContainer not booted');
    }

    const process = await this._instance.spawn('jsh', ['-c', command]);
    const output = await process.output;
    const reader = output.getReader();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      result += value;
    }

    const exitCode = (await process.exit) as number;

    return { output: result, exitCode };
  }

  onServerReady(callback: (port: number, url: string) => void): void {
    this._serverReadyCallbacks.push(callback);
  }

  onPortEvent(callback: (port: number, type: 'open' | 'close', url: string) => void): void {
    this._portCallbacks.push(callback);
  }

  onPreviewMessage(callback: (message: any) => void): void {
    this._previewCallbacks.push(callback);
  }

  async setPreviewScript(script: string): Promise<void> {
    if (this._instance) {
      await this._instance.setPreviewScript(script);
    }
  }

  getPreviews(): IPreview[] {
    return this._previews;
  }

  async shutdown(): Promise<void> {
    // WebContainer doesn't have a public shutdown method
    this._ready = false;
    this._instance = null;
  }
}
