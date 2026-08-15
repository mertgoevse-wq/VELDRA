/**
 * No-op stub for `ai/mcp-stdio`'s Experimental_StdioMCPTransport in Android SPA builds.
 * The real transport spawns a local process via node:child_process to talk to a stdio-based
 * MCP server -- fundamentally unavailable in a browser/WebView, which cannot spawn local
 * processes at all (same category of gap as the WebContainer/terminal fallbacks documented
 * elsewhere). mcpService.ts imports this directly (not conditionally), so without this
 * alias the Android production build fails entirely at bundle time -- found while attempting
 * this round's first real Android build+screenshot verification pass.
 */

interface StdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

interface JSONRPCMessage {
  [key: string]: unknown;
}

class StdioMCPTransport {
  onclose?: () => void;
  onerror?: (error: unknown) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(_server: StdioConfig) {
    // No-op: nothing to set up, this transport can never actually start.
  }

  async start(): Promise<void> {
    throw new Error('Stdio-based MCP servers are not available on Android (no local process execution).');
  }

  async close(): Promise<void> {
    // No-op: nothing was ever started.
  }

  async send(_message: JSONRPCMessage): Promise<void> {
    throw new Error('Stdio-based MCP servers are not available on Android (no local process execution).');
  }
}

export { StdioMCPTransport as Experimental_StdioMCPTransport };
