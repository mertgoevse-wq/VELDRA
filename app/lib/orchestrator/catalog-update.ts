import type { ModelCapabilities } from './registries';
import type { EntitlementTier } from './entitlement';

/**
 * Model-catalog update contract: local cache/versioning structure plus the
 * update-service port a host would implement. No backend exists yet, so this
 * is deliberately contract-only -- no real HTTP client, no fake production
 * endpoint. A snapshot is DATA: validated structurally field by field, never
 * evaluated or executed, so a compromised or malformed catalog response can
 * at worst mean stale/rejected model metadata, never code execution.
 */

export const CATALOG_SCHEMA_VERSION = 1;

export interface CatalogSnapshot {
  schemaVersion: number;

  /** Opaque version identifier from the source, e.g. a date or monotonic counter. Never parsed for meaning. */
  catalogVersion: string;

  /** For conditional GETs (If-None-Match) once a real endpoint exists. */
  etag?: string;

  fetchedAt: number;
  models: ModelCapabilities[];
}

export interface CatalogValidationError {
  reason: string;
}

/**
 * Structural validation only -- checks shape and required fields, never
 * executes anything in `candidate`. Rejects a snapshot whose schemaVersion is
 * older than the caller's minimum, so an old client talking to a newer schema
 * fails closed (keeps its last good snapshot) instead of misreading fields.
 */
export function validateCatalogSnapshot(
  candidate: unknown,
  minSchemaVersion: number = CATALOG_SCHEMA_VERSION,
): CatalogValidationError | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return { reason: 'snapshot is not an object' };
  }

  const snapshot = candidate as Partial<CatalogSnapshot>;

  if (typeof snapshot.schemaVersion !== 'number') {
    return { reason: 'missing or invalid schemaVersion' };
  }

  if (snapshot.schemaVersion < minSchemaVersion) {
    return {
      reason: `schemaVersion ${snapshot.schemaVersion} is older than the minimum supported ${minSchemaVersion}`,
    };
  }

  if (typeof snapshot.catalogVersion !== 'string' || !snapshot.catalogVersion) {
    return { reason: 'missing catalogVersion' };
  }

  if (typeof snapshot.fetchedAt !== 'number') {
    return { reason: 'missing or invalid fetchedAt' };
  }

  if (!Array.isArray(snapshot.models)) {
    return { reason: 'models is not an array' };
  }

  for (const [index, entry] of snapshot.models.entries()) {
    if (!entry || typeof entry !== 'object') {
      return { reason: `models[${index}] is not an object` };
    }

    const model = entry as Partial<ModelCapabilities>;

    if (typeof model.provider !== 'string' || !model.provider) {
      return { reason: `models[${index}] is missing provider` };
    }

    if (typeof model.model !== 'string' || !model.model) {
      return { reason: `models[${index}] is missing model id` };
    }

    if (!Array.isArray(model.modalities)) {
      return { reason: `models[${index}] is missing modalities` };
    }

    if (typeof model.contextWindow !== 'number') {
      return { reason: `models[${index}] is missing contextWindow` };
    }

    if (typeof model.lastVerified !== 'number') {
      return { reason: `models[${index}] is missing lastVerified` };
    }
  }

  return null;
}

export interface CatalogFreshnessPolicy {
  maxAgeMs: number;

  /** A snapshot older than maxAgeMs but within maxAgeMs+this window is still usable while revalidating. */
  staleWhileRevalidateMs?: number;
}

export type CatalogFreshnessDecision =
  { action: 'use-cached' } | { action: 'use-cached-and-revalidate' } | { action: 'must-fetch' };

export function evaluateCatalogFreshness(
  cached: CatalogSnapshot | null,
  policy: CatalogFreshnessPolicy,
  now: number = Date.now(),
): CatalogFreshnessDecision {
  if (!cached) {
    return { action: 'must-fetch' };
  }

  const age = now - cached.fetchedAt;

  if (age <= policy.maxAgeMs) {
    return { action: 'use-cached' };
  }

  if (policy.staleWhileRevalidateMs !== undefined && age <= policy.maxAgeMs + policy.staleWhileRevalidateMs) {
    return { action: 'use-cached-and-revalidate' };
  }

  return { action: 'must-fetch' };
}

/**
 * Premium gets fresher metadata, not different architecture -- the freshness
 * policy is the only thing entitlement changes here. PolicyGate/entitlement
 * itself stays the single policy boundary (project/DECISIONS.md D-20); this
 * function only derives numbers from a tier, it does not gate access.
 */
export function catalogFreshnessPolicyForTier(tier: EntitlementTier): CatalogFreshnessPolicy {
  switch (tier) {
    case 'PREMIUM':
    case 'PRO':
    case 'DEVELOPER':
      return { maxAgeMs: 6 * 60 * 60_000, staleWhileRevalidateMs: 24 * 60 * 60_000 }; // 6h, SWR up to 24h more
    case 'FREE':
    default:
      return { maxAgeMs: 24 * 60 * 60_000, staleWhileRevalidateMs: 7 * 24 * 60 * 60_000 }; // 24h, SWR up to 7d more
  }
}

export interface CatalogMergeResult {
  snapshot: CatalogSnapshot;
  changed: boolean;
  rolledBack: boolean;
  reason?: string;
}

/**
 * Applies an incoming (unvalidated) snapshot on top of the current one.
 * An invalid incoming snapshot never overwrites a valid cached one --
 * rollback to the last known good snapshot is the default outcome of a bad
 * update, not an edge case the caller has to remember to implement.
 */
export function applyCatalogUpdate(
  current: CatalogSnapshot | null,
  incoming: unknown,
  minSchemaVersion: number = CATALOG_SCHEMA_VERSION,
): CatalogMergeResult {
  const violation = validateCatalogSnapshot(incoming, minSchemaVersion);

  if (violation) {
    if (current) {
      return { snapshot: current, changed: false, rolledBack: true, reason: violation.reason };
    }

    throw new Error(`invalid catalog snapshot and no cached fallback to roll back to: ${violation.reason}`);
  }

  return { snapshot: incoming as CatalogSnapshot, changed: true, rolledBack: false };
}

export interface CatalogUpdateRequest {
  etag?: string;
  catalogVersion?: string;
}

export type CatalogFetchResult = { status: 'not-modified' } | { status: 'updated'; raw: unknown };

/**
 * Host-supplied port for actually reaching the catalog source (e.g. an HTTP
 * client hitting a future signed VELDRA catalog endpoint with If-None-Match).
 * The core never performs the fetch itself -- same ports-and-adapters
 * separation as every other host capability (app/lib/orchestrator/adapters.ts).
 */
export interface CatalogUpdateSource {
  fetch(request: CatalogUpdateRequest): Promise<CatalogFetchResult>;
}
