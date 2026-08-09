import { afterEach, describe, expect, it, vi } from 'vitest';
import NvidiaNimProvider, { normalizeNvidiaNimBaseUrl } from './nvidia-nim';

const TEST_API_KEY = 'nvapi-test-placeholder';

describe('NVIDIA NIM provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes hosted and self-hosted endpoints to /v1', () => {
    expect(normalizeNvidiaNimBaseUrl()).toBe('https://integrate.api.nvidia.com/v1');
    expect(normalizeNvidiaNimBaseUrl('https://integrate.api.nvidia.com')).toBe('https://integrate.api.nvidia.com/v1');
    expect(normalizeNvidiaNimBaseUrl('http://localhost:8000/v1/')).toBe('http://localhost:8000/v1');
  });

  it('discovers models through the OpenAI-compatible endpoint without real credentials', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://nim.example.test/v1/models');
      expect(init?.headers).toEqual({ Authorization: `Bearer ${TEST_API_KEY}` });

      return new Response(JSON.stringify({ data: [{ id: 'nvidia/test-model' }, { id: 'unknown-model' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new NvidiaNimProvider();
    const models = await provider.getDynamicModels(
      { NvidiaNim: TEST_API_KEY },
      { baseUrl: 'https://nim.example.test' },
    );

    expect(models).toEqual([
      {
        name: 'nvidia/test-model',
        label: 'nvidia/test-model',
        provider: 'NvidiaNim',
        maxTokenAllowed: 8000,
      },
      {
        name: 'unknown-model',
        label: 'unknown-model',
        provider: 'NvidiaNim',
        maxTokenAllowed: 8000,
      },
    ]);
  });

  it('does not make a network request without a configured key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new NvidiaNimProvider();

    await expect(provider.getDynamicModels()).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
