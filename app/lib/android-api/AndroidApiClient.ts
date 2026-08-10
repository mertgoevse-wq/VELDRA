export interface AndroidApiHealthResponse {
  ok: boolean;
  service?: string;
  version?: string;
  message?: string;
}

export interface AndroidApiModelInfo {
  name: string;
  label?: string;
  provider: string;
  maxTokenAllowed?: number;
  maxCompletionTokens?: number;
}

export interface AndroidApiProviderInfo {
  name: string;
  label?: string;
  icon?: string;
  configured?: boolean;
}

export interface AndroidApiModelsResponse {
  modelList: AndroidApiModelInfo[];
  providers: AndroidApiProviderInfo[];
  defaultProvider?: AndroidApiProviderInfo;
}

export interface AndroidApiClientOptions {
  baseUrl: string;
  token?: string;
}

export class AndroidApiClient {
  private readonly _baseUrl: string;
  private readonly _token: string;

  constructor({ baseUrl, token = '' }: AndroidApiClientOptions) {
    this._baseUrl = baseUrl.replace(/\/$/, '');
    this._token = token;
  }

  private _getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (this._token) {
      headers.Authorization = `Bearer ${this._token}`;
    }

    return headers;
  }

  private async _request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this._baseUrl}${path}`, {
        ...init,
        headers: this._getHeaders(init.headers as Record<string, string> | undefined),
      });
    } catch {
      throw new Error(`Network failure contacting Android API Backend at ${this._baseUrl}.`);
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

  private _formatHttpError(status: number, detail?: string) {
    const suffix = detail ? ` ${detail}` : '';

    if (status === 401 || status === 403) {
      return `Android API Backend authentication failed (${status}). Check the backend token.${suffix}`;
    }

    if (status === 404) {
      return `Android API Backend endpoint was not found (404). Check the backend URL.${suffix}`;
    }

    if (status >= 500) {
      return `Android API Backend server error (${status}). Check backend logs.${suffix}`;
    }

    return `Android API Backend request failed (${status}).${suffix}`;
  }

  /** Backed by the real app/routes/api.android.health.ts route. */
  async health(): Promise<AndroidApiHealthResponse> {
    return this._request<AndroidApiHealthResponse>('/api/android/health', { method: 'GET' });
  }

  /** Backed by the real app/routes/api.android.models.ts route. */
  async listModels(options: { provider?: string } = {}): Promise<AndroidApiModelsResponse> {
    const query = options.provider ? `?provider=${encodeURIComponent(options.provider)}` : '';
    return this._request<AndroidApiModelsResponse>(`/api/android/models${query}`, { method: 'GET' });
  }
}
