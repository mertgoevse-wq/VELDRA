import type { CatalogManifest, LicenseInfo, Provenance } from '@studio/catalog/types';
import { RISK_LEVELS } from '@studio/catalog/types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown, field: string, errors: string[]) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${field} must be a non-empty string`);
  }
}

function stringArray(value: unknown, field: string, errors: string[]) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    errors.push(`${field} must be an array of non-empty strings`);
  }
}

function validateProvenance(value: unknown, errors: string[]) {
  if (!isObject(value)) {
    errors.push('source must be an object');
    return;
  }

  for (const field of ['sourceId', 'repository', 'revision', 'path']) {
    requiredString(value[field], `source.${field}`, errors);
  }

  if (!['metadata', 'pattern-derived', 'internal'].includes(value.importedAs as string)) {
    errors.push('source.importedAs is invalid');
  }
}

function validateLicense(value: unknown, errors: string[]) {
  if (!isObject(value)) {
    errors.push('license must be an object');
    return;
  }

  requiredString(value.spdx, 'license.spdx', errors);

  if (value.evidence !== undefined) {
    requiredString(value.evidence, 'license.evidence', errors);
  }

  if (value.noticeRequired !== undefined && typeof value.noticeRequired !== 'boolean') {
    errors.push('license.noticeRequired must be boolean');
  }

  if (!['permissive', 'copyleft', 'restricted', 'unknown', 'internal'].includes(value.status as string)) {
    errors.push('license.status is invalid');
  }
}

function validateCommon(manifest: Record<string, unknown>, errors: string[]) {
  if (manifest.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }

  for (const field of ['id', 'name', 'description', 'kind']) {
    requiredString(manifest[field], field, errors);
  }

  for (const field of ['capabilities', 'domains', 'risk_level']) {
    if (field === 'risk_level') {
      if (!RISK_LEVELS.includes(manifest[field] as (typeof RISK_LEVELS)[number])) {
        errors.push('risk_level is invalid');
      }
    } else {
      stringArray(manifest[field], field, errors);
    }
  }

  if (typeof manifest.enabled !== 'boolean') {
    errors.push('enabled must be boolean');
  }

  validateProvenance(manifest.source, errors);
  validateLicense(manifest.license, errors);
}

export function validateAgentManifest(value: unknown): string[] {
  const errors: string[] = [];

  if (!isObject(value)) {
    return ['manifest must be an object'];
  }

  validateCommon(value, errors);

  if (value.kind !== 'agent') {
    errors.push('kind must be agent');
  }

  for (const field of ['languages', 'frameworks', 'task_types', 'required_tools', 'compatible_skills']) {
    stringArray(value[field], field, errors);
  }

  if (typeof value.approval_required !== 'boolean') {
    errors.push('approval_required must be boolean');
  }

  if (!isObject(value.context_requirements)) {
    errors.push('context_requirements must be an object');
  } else {
    const context = value.context_requirements;

    if (
      context.estimatedTokens !== undefined &&
      (typeof context.estimatedTokens !== 'number' ||
        !Number.isInteger(context.estimatedTokens) ||
        context.estimatedTokens < 0)
    ) {
      errors.push('context_requirements.estimatedTokens must be a non-negative integer');
    }

    for (const field of ['requiredFiles', 'requiredArtifacts']) {
      if (context[field] !== undefined) {
        stringArray(context[field], `context_requirements.${field}`, errors);
      }
    }
  }

  return errors;
}

export function validateSkillManifest(value: unknown): string[] {
  const errors: string[] = [];

  if (!isObject(value)) {
    return ['manifest must be an object'];
  }

  validateCommon(value, errors);

  if (value.kind !== 'skill') {
    errors.push('kind must be skill');
  }

  for (const field of ['triggers', 'dependencies', 'conflicts']) {
    stringArray(value[field], field, errors);
  }

  return errors;
}

export function validateManifest(value: unknown): string[] {
  if (isObject(value) && value.kind === 'agent') {
    return validateAgentManifest(value);
  }

  if (isObject(value) && value.kind === 'skill') {
    return validateSkillManifest(value);
  }

  return ['kind must be agent or skill'];
}

export function assertValidManifest<T extends CatalogManifest>(value: T): T {
  const errors = validateManifest(value);

  if (errors.length > 0) {
    throw new Error(`Invalid ${value.kind} manifest: ${errors.join('; ')}`);
  }

  return value;
}

export function permissiveLicense(spdx: string, evidence: string): LicenseInfo {
  return { spdx, status: 'permissive', evidence, noticeRequired: spdx !== 'CC0-1.0' };
}

export function unknownLicense(evidence: string): LicenseInfo {
  return { spdx: 'NOASSERTION', status: 'unknown', evidence, noticeRequired: false };
}

export function provenance(
  input: Omit<Provenance, 'importedAs'> & { importedAs?: Provenance['importedAs'] },
): Provenance {
  return { ...input, importedAs: input.importedAs ?? 'metadata' };
}
