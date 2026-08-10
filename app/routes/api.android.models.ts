import { checkAndroidApiAuth } from '~/lib/.server/android-auth';
import { getModelsData } from './api.models';

/**
 * GET /api/android/models[?provider=Anthropic]
 *
 * Same LLMManager lookup as the cookie-authenticated /api/models (see
 * getModelsData in api.models.ts), but Bearer-token authenticated and with
 * no cookie-sourced apiKeys/providerSettings -- BaseProvider.
 * getProviderBaseUrlAndKey() already falls back to serverEnv/process.env per
 * provider when the apiKeys map is empty, so provider keys configured on
 * this backend's environment are picked up automatically (docs/
 * ANDROID_LLM_API_BRIDGE.md, Option B: keys live on the backend, never in
 * the Android bundle).
 */
export async function loader({
  request,
  context,
}: {
  request: Request;
  context: { cloudflare?: { env: Record<string, string> } };
}): Promise<Response> {
  const unauthorized = checkAndroidApiAuth(request, context);

  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') ?? undefined;

  const data = await getModelsData({
    provider,
    apiKeys: {},
    providerSettings: {},
    serverEnv: context.cloudflare?.env,
  });

  return Response.json(data);
}
