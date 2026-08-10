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

    const reader = response.body?.getReader();

    const originalInput = input;

    if (reader) {
      const decoder = new TextDecoder();

      let _input = '';
      let _error;

      try {
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
      } catch (error) {
        _error = error;
        setInput(originalInput);
      } finally {
        if (_error) {
          logger.error(_error);
        }

        setEnhancingPrompt(false);
        setPromptEnhanced(true);

        setTimeout(() => {
          setInput(_input);
        });
      }
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
