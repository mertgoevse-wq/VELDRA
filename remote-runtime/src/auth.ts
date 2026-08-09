import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

export const MIN_RUNTIME_TOKEN_LENGTH = 32;

/**
 * Reads the configured runtime token at call time so tests and hosts that load
 * environment bindings after module initialization are handled correctly.
 * There is intentionally no development fallback: an unconfigured runtime
 * must never accept a predictable credential.
 */
export function getConfiguredToken(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  const token = environment.REMOTE_RUNTIME_TOKEN?.trim();

  return token && token.length >= MIN_RUNTIME_TOKEN_LENGTH ? token : undefined;
}

function tokensEqual(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);

  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

/**
 * Validates the auth token. The optional expected token is used by unit tests;
 * production callers use the server's configured environment token.
 */
export function validateToken(token: string | undefined, expectedToken = getConfiguredToken()): boolean {
  if (!token || !expectedToken) {
    return false;
  }

  return tokensEqual(token, expectedToken);
}

/**
 * Express middleware to validate bearer authorization.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!getConfiguredToken()) {
    res.status(503).json({ error: 'Remote Runtime authentication is not configured.' });
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token format.' });
    return;
  }

  const token = authHeader.substring(7).trim();

  if (!validateToken(token)) {
    res.status(403).json({ error: 'Forbidden: Invalid authorization token.' });
    return;
  }

  next();
}
