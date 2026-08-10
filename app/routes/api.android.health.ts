/**
 * GET /api/android/health
 *
 * Deliberately unauthenticated (docs/ANDROID_LLM_API_BRIDGE.md): reachability
 * only, never provider or backend-token status, so a health probe can't be
 * used to fingerprint whether the backend token is configured.
 */
export async function loader(): Promise<Response> {
  return Response.json({ ok: true, service: 'veldra-android-api', version: '1.0.0' });
}
