import { useState } from 'react';
import { toast } from 'react-toastify';
import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { isCapacitor } from '~/lib/adapters/platform';
import { getAndroidEnhanceRequest } from '~/lib/android-api/backend-config';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (
    input: string,
    setInput: (value: string) => void,
    model: string,
    provider: ProviderInfo,
    apiKeys?: Record<string, string>,
  ) => {
    /*
     * '/api/enhancer' is a Remix server route -- it does not exist inside the Android WebView
     * (no server process to run it against). Route through the configured Android API Backend
     * bridge instead (see docs/ANDROID_LLM_API_BRIDGE.md).
     */
    const androidRequest = isCapacitor() ? getAndroidEnhanceRequest() : undefined;

    if (isCapacitor() && !androidRequest) {
      toast.error('Set an Android API Backend URL in Settings before enhancing a prompt.');
      return;
    }

    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const requestBody: any = {
      message: input,
      model,
      provider,
    };

    if (apiKeys) {
      requestBody.apiKeys = apiKeys;
    }

    const originalInput = input;

    /*
     * The whole request -- not just the stream-reading loop below -- must be inside this
     * try/catch. It previously wasn't: a fetch() rejection (network down, CORS, an
     * unreachable Android API Backend) had no handler at all, becoming an unhandled promise
     * rejection with zero user-facing feedback, while ChatBox.tsx's caller showed
     * "Prompt enhanced!" unconditionally and immediately on click regardless of outcome --
     * a real fake-success bug this fixes at the source instead of papering over at the
     * call site.
     */
    try {
      const response = androidRequest
        ? await fetch(androidRequest.url, {
            method: 'POST',
            headers: { ...androidRequest.headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          })
        : await fetch('/api/enhancer', {
            method: 'POST',
            body: JSON.stringify(requestBody),
          });

      if (!response.ok) {
        throw new Error(`Enhancer request failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Enhancer response had no readable body.');
      }

      const decoder = new TextDecoder();
      let _input = '';

      setInput('');

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        _input += decoder.decode(value);

        logger.trace('Set input', _input);

        setInput(_input);
      }

      setPromptEnhanced(true);
      toast.success('Prompt enhanced!');

      setTimeout(() => {
        setInput(_input);
      });
    } catch (error) {
      logger.error(error);
      setInput(originalInput);
      toast.error('Could not enhance the prompt. Please try again.');
    } finally {
      setEnhancingPrompt(false);
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
