import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { checkAndroidApiAuth, type AndroidApiServerEnv } from '~/lib/.server/android-auth';
import { enhancerAction } from '~/lib/.server/llm/enhancer-action';

/**
 * POST /api/android/enhance
 *
 * Bearer-token-authenticated Android entry point for the same prompt-enhancement logic
 * /api/enhancer already implements (see docs/ANDROID_LLM_API_BRIDGE.md and
 * api.android.chat.ts, which follows the identical pattern). Delegates straight to
 * enhancerAction() instead of reimplementing the enhancement prompt or streaming.
 */
export async function action({ context, request }: ActionFunctionArgs): Promise<Response> {
  const unauthorized = checkAndroidApiAuth(request, context as unknown as AndroidApiServerEnv);

  if (unauthorized) {
    return unauthorized;
  }

  const sanitizedHeaders = new Headers(request.headers);
  sanitizedHeaders.delete('Cookie');

  const bodyText = await request.text();
  const sanitizedRequest = new Request(request.url, {
    method: request.method,
    headers: sanitizedHeaders,
    body: bodyText,
  });

  return enhancerAction({ context, request: sanitizedRequest, params: {} });
}
