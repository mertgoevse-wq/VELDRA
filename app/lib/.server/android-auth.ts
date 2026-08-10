/**
 * Auth gate for the Android API Backend routes (app/routes/api.android.*.ts).
 *
 * This token authenticates the Android app/user to this backend only -- it is
 * never a provider API key. Provider keys stay in this backend's own
 * environment (see docs/ANDROID_LLM_API_BRIDGE.md, Option B) and are resolved
 * by BaseProvider's existing serverEnv/process.env fallback once the Android
 * request reaches the shared chat/model logic with no cookie-sourced keys.
 */

const ANDROID_API_BACKEND_TOKEN_ENV_KEY = 'ANDROID_API_BACKEND_TOKEN';

export interface AndroidApiServerEnv {
  cloudflare?: {
    env?: Record<string, string>;
  };
}

function getConfiguredToken(context: AndroidApiServerEnv): string | undefined {
  return (
    context.cloudflare?.env?.[ANDROID_API_BACKEND_TOKEN_ENV_KEY] || process?.env?.[ANDROID_API_BACKEND_TOKEN_ENV_KEY]
  );
}

/**
 * Constant-time string comparison so a token check can't leak how many
 * leading characters matched via response-time differences. No node:crypto
 * import -- this file also runs in the Cloudflare Workers runtime, which
 * only guarantees Web Crypto, not Node's crypto module, without the
 * nodejs_compat flag.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;

  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

export function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.get('Authorization');

  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }

  return header.slice('Bearer '.length).trim();
}

/**
 * Returns null when the request is authorized, or the Response to return
 * (401/500) otherwise -- fails closed when no backend token is configured,
 * same as Remote Runtime's REMOTE_RUNTIME_TOKEN (project/DECISIONS.md D-005).
 */
export function checkAndroidApiAuth(request: Request, context: AndroidApiServerEnv): Response | null {
  const configuredToken = getConfiguredToken(context);

  if (!configuredToken) {
    return Response.json(
      { ok: false, error: 'Android API Backend is not configured (missing ANDROID_API_BACKEND_TOKEN).' },
      { status: 500 },
    );
  }

  const providedToken = extractBearerToken(request);

  if (!providedToken || !timingSafeStringEqual(providedToken, configuredToken)) {
    return Response.json({ ok: false, error: 'Invalid or missing Android API Backend token.' }, { status: 401 });
  }

  return null;
}
