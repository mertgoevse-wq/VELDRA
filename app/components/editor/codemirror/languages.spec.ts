import { describe, it, expect } from 'vitest';
import { LanguageSupport } from '@codemirror/language';
import { getLanguage } from './languages';

/**
 * Real coverage that every file extension VELDRA claims editor support for actually
 * resolves to a working CodeMirror language, not just an entry in the list. Particularly
 * covers Go/Rust/Java/Kotlin/C/Shell (added via @codemirror/legacy-modes, 2026-08-16) --
 * these have no dedicated Lezer grammar package, so the load() path is real, non-obvious
 * wiring (StreamLanguage.define + LanguageSupport), worth verifying it actually resolves.
 */
describe('getLanguage', () => {
  const casesWithRealSupport: Array<[fileName: string, label: string]> = [
    ['main.go', 'Go'],
    ['lib.rs', 'Rust'],
    ['Main.java', 'Java'],
    ['App.kt', 'Kotlin'],
    ['program.c', 'C'],
    ['deploy.sh', 'Shell'],
    ['index.ts', 'TypeScript'],
    ['index.py', 'Python'],
  ];

  it.each(casesWithRealSupport)('resolves a real LanguageSupport for %s (%s)', async (fileName) => {
    const language = await getLanguage(fileName);
    expect(language).toBeInstanceOf(LanguageSupport);
  });

  it('returns undefined for a file extension with no registered language (honest, not a silent fallback)', async () => {
    const language = await getLanguage('data.xyz-unknown');
    expect(language).toBeUndefined();
  });
});
