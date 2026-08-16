import { describe, it, expect } from 'vitest';
import { LANGUAGE_CAPABILITIES, getCapabilityForExtension } from './capabilities';
import { getLanguage } from '~/components/editor/codemirror/languages';

describe('LANGUAGE_CAPABILITIES', () => {
  it('every entry claiming editorSupport actually resolves a real CodeMirror language (no silent drift from reality)', async () => {
    for (const lang of LANGUAGE_CAPABILITIES) {
      if (!lang.editorSupport) {
        continue;
      }

      for (const ext of lang.extensions) {
        const resolved = await getLanguage(`file.${ext}`);
        expect(resolved, `${lang.name}'s claimed extension ".${ext}" should resolve a real language`).toBeDefined();
      }
    }
  });

  it('no language claims runtimeSupport/buildSupport/previewSupport unless it is also a Node/web language with dependencySupport', () => {
    /*
     * The honest finding this matrix documents: WebContainer and Remote Runtime are both
     * Node.js-only. Nothing should claim it can actually run/build/preview without also
     * being able to manage its dependencies through the same npm/pnpm-backed path.
     */
    for (const lang of LANGUAGE_CAPABILITIES) {
      if (lang.runtimeSupport || lang.buildSupport || lang.previewSupport) {
        expect(lang.dependencySupport, `${lang.name} claims execution but not dependency support`).toBe(true);
      }
    }
  });

  it('getCapabilityForExtension finds the right language regardless of a leading dot', () => {
    expect(getCapabilityForExtension('py')?.name).toBe('Python');
    expect(getCapabilityForExtension('.py')?.name).toBe('Python');
    expect(getCapabilityForExtension('rs')?.name).toBe('Rust');
  });

  it('returns undefined for an extension with no real capability entry', () => {
    expect(getCapabilityForExtension('nonexistent-ext')).toBeUndefined();
  });
});
