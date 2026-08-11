import { describe, expect, it } from 'vitest';
import {
  applyCatalogUpdate,
  CATALOG_SCHEMA_VERSION,
  catalogFreshnessPolicyForTier,
  evaluateCatalogFreshness,
  validateCatalogSnapshot,
  type CatalogSnapshot,
} from './catalog-update';
import type { ModelCapabilities } from './registries';

function validModel(overrides: Partial<ModelCapabilities> = {}): ModelCapabilities {
  return {
    provider: 'Anthropic',
    model: 'claude-sonnet-5',
    modalities: ['text'],
    contextWindow: 1_000_000,
    lastVerified: 100,
    availability: 'available',
    ...overrides,
  };
}

function validSnapshot(overrides: Partial<CatalogSnapshot> = {}): CatalogSnapshot {
  return {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    catalogVersion: '2026-08-09',
    fetchedAt: 1000,
    models: [validModel()],
    ...overrides,
  };
}

describe('validateCatalogSnapshot', () => {
  it('accepts a well-formed snapshot', () => {
    expect(validateCatalogSnapshot(validSnapshot())).toBeNull();
  });

  it('rejects a non-object', () => {
    expect(validateCatalogSnapshot('not an object')?.reason).toMatch(/not an object/);
    expect(validateCatalogSnapshot(null)?.reason).toMatch(/not an object/);
  });

  it('rejects a schemaVersion older than the minimum supported', () => {
    const violation = validateCatalogSnapshot(validSnapshot({ schemaVersion: 0 }), 1);
    expect(violation?.reason).toMatch(/older than the minimum supported/);
  });

  it('rejects models that are not an array', () => {
    const violation = validateCatalogSnapshot({ ...validSnapshot(), models: 'nope' });
    expect(violation?.reason).toMatch(/models is not an array/);
  });

  it('rejects a model entry missing required fields', () => {
    const violation = validateCatalogSnapshot(validSnapshot({ models: [validModel({ provider: undefined })] }));
    expect(violation?.reason).toMatch(/models\[0\] is missing provider/);
  });

  it('never executes anything in the candidate -- a function-valued field is inert data', () => {
    const modelWithExtraField = { ...validModel(), maliciousPayload: () => 'never runs' };
    const withFunction = validSnapshot({ models: [modelWithExtraField as unknown as ModelCapabilities] });
    expect(validateCatalogSnapshot(withFunction)).toBeNull();
  });
});

describe('evaluateCatalogFreshness', () => {
  const policy = { maxAgeMs: 1000, staleWhileRevalidateMs: 500 };

  it('requires a fetch when nothing is cached', () => {
    expect(evaluateCatalogFreshness(null, policy, 10_000)).toEqual({ action: 'must-fetch' });
  });

  it('uses the cache within maxAgeMs', () => {
    const cached = validSnapshot({ fetchedAt: 1000 });
    expect(evaluateCatalogFreshness(cached, policy, 1500)).toEqual({ action: 'use-cached' });
  });

  it('uses the cache and revalidates within the stale-while-revalidate window', () => {
    const cached = validSnapshot({ fetchedAt: 1000 });
    expect(evaluateCatalogFreshness(cached, policy, 2200)).toEqual({ action: 'use-cached-and-revalidate' });
  });

  it('requires a fetch once past the stale-while-revalidate window', () => {
    const cached = validSnapshot({ fetchedAt: 1000 });
    expect(evaluateCatalogFreshness(cached, policy, 3000)).toEqual({ action: 'must-fetch' });
  });
});

describe('catalogFreshnessPolicyForTier', () => {
  it('gives PREMIUM, PRO and DEVELOPER a shorter max age than FREE', () => {
    const free = catalogFreshnessPolicyForTier('FREE');
    const premium = catalogFreshnessPolicyForTier('PREMIUM');
    const pro = catalogFreshnessPolicyForTier('PRO');
    const developer = catalogFreshnessPolicyForTier('DEVELOPER');

    expect(premium.maxAgeMs).toBeLessThan(free.maxAgeMs);
    expect(pro.maxAgeMs).toBeLessThan(free.maxAgeMs);
    expect(developer.maxAgeMs).toBeLessThan(free.maxAgeMs);
  });

  it('does not silently fall through PRO to the FREE-tier policy', () => {
    const premium = catalogFreshnessPolicyForTier('PREMIUM');
    const pro = catalogFreshnessPolicyForTier('PRO');
    expect(pro).toEqual(premium);
  });
});

describe('applyCatalogUpdate', () => {
  it('accepts a valid incoming snapshot', () => {
    const result = applyCatalogUpdate(null, validSnapshot());
    expect(result).toMatchObject({ changed: true, rolledBack: false });
  });

  it('rolls back to the current snapshot when the incoming one is invalid', () => {
    const current = validSnapshot({ catalogVersion: 'good' });
    const result = applyCatalogUpdate(current, { not: 'a valid snapshot' });

    expect(result.rolledBack).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.snapshot).toBe(current);
    expect(result.reason).toBeDefined();
  });

  it('throws when the incoming snapshot is invalid and there is no cached fallback', () => {
    expect(() => applyCatalogUpdate(null, { not: 'valid' })).toThrow(/no cached fallback/);
  });
});
