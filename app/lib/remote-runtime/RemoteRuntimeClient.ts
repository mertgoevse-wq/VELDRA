export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
}

export interface WorkspaceResponse {
  workspaceId: string;
  createdAt: string;
}

export interface RemoteFileItem {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  content?: string;
  isBinary?: boolean;
}

export interface ListFilesResponse {
  files: RemoteFileItem[];
}

export interface SyncFilesResponse {
  ok: boolean;
  writtenFileCount: number;
  files: RemoteFileItem[];
}

export interface ReadFileResponse {
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
}

export const REMOTE_COMMAND_PROFILES = [
  'npm install',
  'npm run dev',
  'npm run build',
  'pnpm install',
  'pnpm run dev',
  'pnpm run build',
] as const;

export type RemoteCommandProfile = (typeof REMOTE_COMMAND_PROFILES)[number];
export type RemoteCommandStatus = 'running' | 'exited' | 'stopped' | 'error' | 'timed-out';

export interface RemoteCommandResponse {
  commandId: string;
  commandProfile: RemoteCommandProfile;
  workspaceId: string;
  status: RemoteCommandStatus;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  signal?: string | null;
  error?: string;
}

export interface RemoteRuntimeEvent {
  type: 'status' | 'stdout' | 'stderr' | 'exit';
  timestamp: string;
  payload: {
    commandId?: string;
    commandProfile?: RemoteCommandProfile;
    status?: RemoteCommandStatus | string;
    output?: string;
    exitCode?: number | null;
    signal?: string | null;
    error?: string;
    workspaceId?: string;
  };
}

export type RemotePreviewStatus = 'none' | 'starting' | 'running' | 'failed';

export interface RemotePreviewResponse {
  ok: true;
  status: RemotePreviewStatus;
  port?: number;
  localUrl?: string;
  networkUrl?: string;
  proxyUrl?: string;
  previewUrl?: string;
  lastDetectedAt?: string;
  commandId?: string;
  message: string;
}

/**
 * RemoteRuntimeClient
 *
 * Client SDK to communicate with the VELDRA Remote Runtime server.
 * Handles server health status checks, workspace creation, files syncing,
 * allowlisted command profiles, and WebSocket event streaming.
 */
export class RemoteRuntimeClient {
  private _serverUrl: string;
  private _token: string;
  private _workspaceId: string;

  constructor(serverUrl: string, token: string = '', workspaceId: string = '') {
    // Normalize URL to remove trailing slash
    this._serverUrl = serverUrl.replace(/\/$/, '');
    this._token = token;
    this._workspaceId = workspaceId;
  }

  private _getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this._token) {
      headers.Authorization = `Bearer ${this._token}`;
    }

    return headers;
  }

  private async _request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this._serverUrl}${path}`, {
        ...init,
        headers: {
          ...this._getHeaders(),
          ...(init.headers ?? {}),
        },
      });
    } catch {
      throw new Error(
        `Network failure contacting Remote Runtime at ${this._serverUrl}. Check that the server is reachable from this device.`,
      );
    }

    if (!response.ok) {
      const detail = await this._readErrorDetail(response);
      throw new Error(this._formatHttpError(response.status, detail));
    }

    return response.json() as Promise<T>;
  }

  private async _readErrorDetail(response: Response): Promise<string | undefined> {
    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      return payload.error ?? payload.message;
    } catch {
      return undefined;
    }
  }

  private _formatHttpError(status: number, detail?: string): string {
    const suffix = detail ? ` ${detail}` : '';

    if (status === 401 || status === 403) {
      return `Remote Runtime authentication failed (${status}). Check the auth token.${suffix}`;
    }

    if (status === 404) {
      return `Remote Runtime endpoint or workspace was not found (404). Check the server URL and workspace ID.${suffix}`;
    }

    if (status >= 500) {
      return `Remote Runtime server error (${status}). Check the server logs.${suffix}`;
    }

    return `Remote Runtime request failed (${status}).${suffix}`;
  }

  /**
   * Health Check: GET /health
   */
  async checkHealth(): Promise<HealthResponse> {
    return this._request<HealthResponse>('/health', { method: 'GET' });
  }

  /**
   * Health Check alias
   */
  async health(): Promise<HealthResponse> {
    return this.checkHealth();
  }

  /**
   * Workspace Creation: POST /workspace
   */
  async createWorkspace(template: string = 'node-clean'): Promise<WorkspaceResponse> {
    const data = await this._request<WorkspaceResponse>('/workspace', {
      method: 'POST',
      body: JSON.stringify({ template }),
    });

    this._workspaceId = data.workspaceId;

    return data;
  }

  /**
   * List Files: GET /workspace/:id/files
   */
  async listFiles(options: { includeContent?: boolean } = {}): Promise<ListFilesResponse> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    const query = options.includeContent ? '?includeContent=true' : '';

    return this._request<ListFilesResponse>(`/workspace/${this._workspaceId}/files${query}`, { method: 'GET' });
  }

  /**
   * Sync Files: PUT /workspace/:id/files
   */
  async syncFiles(files: Record<string, string>): Promise<SyncFilesResponse> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    return this._request<SyncFilesResponse>(`/workspace/${this._workspaceId}/files`, {
      method: 'PUT',
      body: JSON.stringify({ files }),
    });
  }

  /**
   * Write Single File: PUT /workspace/:id/files
   */
  async writeFile(filePath: string, content: string): Promise<SyncFilesResponse> {
    return this.syncFiles({ [filePath]: content });
  }

  /**
   * Read Single File: GET /workspace/:id/files/content?path=...
   */
  async readFile(filePath: string): Promise<ReadFileResponse> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    return this._request<ReadFileResponse>(
      `/workspace/${this._workspaceId}/files/content?path=${encodeURIComponent(filePath)}`,
      { method: 'GET' },
    );
  }

  /**
   * Run allowlisted command profile: POST /workspace/:id/commands
   */
  async runCommand(commandProfile: RemoteCommandProfile): Promise<RemoteCommandResponse> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    return this._request<RemoteCommandResponse>(`/workspace/${this._workspaceId}/commands`, {
      method: 'POST',
      body: JSON.stringify({ commandProfile }),
    });
  }

  /**
   * Get command status: GET /workspace/:id/commands/:commandId
   */
  async getCommandStatus(commandId: string): Promise<RemoteCommandResponse> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    return this._request<RemoteCommandResponse>(`/workspace/${this._workspaceId}/commands/${commandId}`, {
      method: 'GET',
    });
  }

  /**
   * Stop command: POST /workspace/:id/commands/:commandId/stop
   */
  async stopCommand(commandId: string): Promise<RemoteCommandResponse> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    return this._request<RemoteCommandResponse>(`/workspace/${this._workspaceId}/commands/${commandId}/stop`, {
      method: 'POST',
    });
  }

  /**
   * Get live preview status: GET /workspace/:id/preview
   */
  async getPreviewUrl(): Promise<RemotePreviewResponse> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    return this._request<RemotePreviewResponse>(`/workspace/${this._workspaceId}/preview`, { method: 'GET' });
  }

  /**
   * WebSocket Connection: WS /workspace/:id/events
   */
  connectWebSocket(onMessage: (event: RemoteRuntimeEvent) => void): WebSocket {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    const wsScheme = this._serverUrl.startsWith('https') ? 'wss' : 'ws';
    const cleanHost = this._serverUrl.replace(/^https?:\/\//, '');
    const canUseSubprotocol = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(this._token);
    const tokenQuery = this._token && !canUseSubprotocol ? `?token=${encodeURIComponent(this._token)}` : '';
    const wsUrl = `${wsScheme}://${cleanHost}/workspace/${this._workspaceId}/events${tokenQuery}`;

    /*
     * Prefer the subprotocol so valid tokens do not appear in URL logs. Keep a
     * query-token fallback for legacy servers or tokens that cannot be encoded
     * as an RFC 6455 protocol value.
     */
    const ws = canUseSubprotocol ? new WebSocket(wsUrl, [this._token]) : new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage(parsed);
      } catch (err) {
        console.error('[RemoteRuntimeClient] Error parsing WebSocket message:', err);
      }
    };

    return ws;
  }

  /**
   * Connect Events alias
   */
  connectEvents(onMessage: (event: RemoteRuntimeEvent) => void): WebSocket {
    return this.connectWebSocket(onMessage);
  }

  /**
   * Safe Git Status: GET /workspace/:id/git/status
   */
  async gitStatus(): Promise<{ ok: boolean; status?: string; error?: string }> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    return this._request<{ ok: boolean; status?: string; error?: string }>(
      `/workspace/${this._workspaceId}/git/status`,
      { method: 'GET' },
    );
  }

  /**
   * Safe Git Init: POST /workspace/:id/git/init
   */
  async gitInit(): Promise<{ ok: boolean; output?: string; error?: string }> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    return this._request<{ ok: boolean; output?: string; error?: string }>(`/workspace/${this._workspaceId}/git/init`, {
      method: 'POST',
    });
  }

  /**
   * Safe Git Commit: POST /workspace/:id/git/commit
   */
  async gitCommit(message: string): Promise<{ ok: boolean; output?: string; error?: string }> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    if (!message || !message.trim()) {
      throw new Error('Commit message is required.');
    }

    return this._request<{ ok: boolean; output?: string; error?: string }>(
      `/workspace/${this._workspaceId}/git/commit`,
      {
        method: 'POST',
        body: JSON.stringify({ message }),
      },
    );
  }

  /**
   * Safe Git Push: POST /workspace/:id/git/push
   */
  async gitPush(options: {
    token: string;
    repoUrl: string;
  }): Promise<{ ok: boolean; output?: string; error?: string }> {
    if (!this._workspaceId) {
      throw new Error('Workspace ID is not set.');
    }

    const { token, repoUrl } = options;

    if (!token || !token.trim()) {
      throw new Error('GitHub token is required.');
    }

    if (!repoUrl || !repoUrl.trim()) {
      throw new Error('Remote repository URL is required.');
    }

    try {
      return await this._request<{ ok: boolean; output?: string; error?: string }>(
        `/workspace/${this._workspaceId}/git/push`,
        {
          method: 'POST',
          body: JSON.stringify({ token, repoUrl }),
        },
      );
    } catch (error: unknown) {
      let message = error instanceof Error ? error.message : 'Git push request failed.';

      if (token) {
        message = message.replace(token, '[TOKEN_REDACTED]');
      }

      throw new Error(message);
    }
  }
}
