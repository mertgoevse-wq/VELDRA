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

export interface AndroidApiChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AndroidApiChatRequest {
  messages: AndroidApiChatMessage[];
  files?: Record<string, unknown>;
  promptId?: string;
  contextOptimization?: boolean;
  chatMode?: 'discuss' | 'build';
  designScheme?: unknown;
  maxLLMSteps?: number;
  model?: string;
  provider?: string;
}

export interface AndroidApiChatResponse {
  ok: boolean;
  message?: AndroidApiChatMessage;
  text?: string;
  usage?: {
    completionTokens?: number;
    promptTokens?: number;
    totalTokens?: number;
  };
}

export interface AndroidApiEnhancePromptRequest {
  message: string;
  model: string;
  provider: string;
}

export interface AndroidApiEnhancePromptResponse {
  ok: boolean;
  enhancedPrompt: string;
}

export interface AndroidApiProviderConfigValidationRequest {
  provider?: string;
}

export interface AndroidApiProviderConfigValidationResponse {
  ok: boolean;
  configured: boolean;
  provider?: string;
  message?: string;
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

  async health(): Promise<AndroidApiHealthResponse> {
    return this._request<AndroidApiHealthResponse>('/health', { method: 'GET' });
  }

  async listModels(options: { provider?: string } = {}): Promise<AndroidApiModelsResponse> {
    const query = options.provider ? `?provider=${encodeURIComponent(options.provider)}` : '';
    return this._request<AndroidApiModelsResponse>(`/models${query}`, { method: 'GET' });
  }

  async sendChatMessage(request: AndroidApiChatRequest): Promise<AndroidApiChatResponse> {
    return this._request<AndroidApiChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async *streamChatResponse(request: AndroidApiChatRequest): AsyncGenerator<string, void, unknown> {
    let response: Response;

    try {
      response = await fetch(`${this._baseUrl}/chat/stream`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(request),
      });
    } catch {
      throw new Error(`Network failure contacting Android API Backend at ${this._baseUrl}.`);
    }

    if (!response.ok) {
      const detail = await this._readErrorDetail(response);
      throw new Error(this._formatHttpError(response.status, detail));
    }

    if (!response.body) {
      throw new Error('Android API Backend did not return a readable stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        yield decoder.decode(value, { stream: true });
      }

      const trailing = decoder.decode();

      if (trailing) {
        yield trailing;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async enhancePrompt(request: AndroidApiEnhancePromptRequest): Promise<AndroidApiEnhancePromptResponse> {
    return this._request<AndroidApiEnhancePromptResponse>('/enhance', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async validateProviderConfig(
    request: AndroidApiProviderConfigValidationRequest = {},
  ): Promise<AndroidApiProviderConfigValidationResponse> {
    return this._request<AndroidApiProviderConfigValidationResponse>('/provider-config/validate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}
