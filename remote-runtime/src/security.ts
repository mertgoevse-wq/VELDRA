export function configuredOrigins(environment: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (environment.REMOTE_RUNTIME_ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  return (
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost' ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
}

/**
 * Requests without an Origin header are allowed for native clients and CLI
 * tools; browser origins must be explicitly configured in production.
 */
export function isAllowedCorsOrigin(origin: string | undefined, environment: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin) {
    return true;
  }

  if (configuredOrigins(environment).has(origin)) {
    return true;
  }

  return environment.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(origin);
}
