import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { checkAndroidApiAuth, type AndroidApiServerEnv } from '~/lib/.server/android-auth';
import { chatAction } from '~/lib/.server/llm/chat-action';

/**
 * POST /api/android/chat
 *
 * Bearer-token-authenticated Android entry point for the same streaming chat
 * logic /api/chat already implements (see docs/ANDROID_LLM_API_BRIDGE.md).
 * Delegates straight to chatAction() instead of reimplementing streaming,
 * MCP tool handling, context selection, or continuation -- the only
 * difference is auth (Bearer token vs. cookie session) and that no Cookie
 * header reaches chatAction, so its apiKeys/providerSettings resolve to {}
 * and BaseProvider falls back to this backend's own environment variables
 * for provider credentials, never the Android app's storage.
 *
 * The Android client (app/components/chat/Chat.client.tsx via isCapacitor())
 * already embeds `[Model: x]\n\n[Provider: y]\n\n` into the outgoing message
 * exactly like the desktop client does, so no request-shape translation is
 * needed here.
 */
export async function action({ context, request }: ActionFunctionArgs): Promise<Response> {
  const unauthorized = checkAndroidApiAuth(request, context as unknown as AndroidApiServerEnv);

  if (unauthorized) {
    return unauthorized;
  }

  const sanitizedHeaders = new Headers(request.headers);
  sanitizedHeaders.delete('Cookie');

  /*
   * Read the body up front (chat requests are JSON, not large uploads) rather than piping request.body,
   * which would require duplex: 'half' support that varies across the Workers/Node fetch implementations this runs under.
   */
  const bodyText = await request.text();
  const sanitizedRequest = new Request(request.url, {
    method: request.method,
    headers: sanitizedHeaders,
    body: bodyText,
  });

  return chatAction({ context, request: sanitizedRequest, params: {} });
}
