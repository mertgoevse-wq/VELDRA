/**
 * Lazy shiki highlighter for Android.
 *
 * Instead of importing all ~200 language grammars eagerly (which adds ~800KB+ to the
 * initial bundle), this module creates a single shared highlighter that loads languages
 * on demand. On first use of a language, it's dynamically imported and cached.
 *
 * Falls back to unhighlighted <pre><code> if shiki hasn't loaded yet or the language
 * fails to load — graceful degradation over a loading delay.
 */

import type { BundledLanguage, HighlighterGeneric, SpecialLanguage } from 'shiki';

let highlighterPromise: Promise<HighlighterGeneric<any, any>> | null = null;
let highlighterInstance: HighlighterGeneric<any, any> | null = null;

const loadedLanguages = new Set<string>(['plaintext', 'text', 'txt']);

async function getHighlighter(): Promise<HighlighterGeneric<any, any>> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(async ({ createHighlighter }) => {
      const instance = await createHighlighter({
        themes: ['dark-plus', 'light-plus'],
        langs: [],
      });
      highlighterInstance = instance;

      return instance;
    });
  }

  return highlighterPromise;
}

const COMMON_LANGS: BundledLanguage[] = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'html',
  'css',
  'python',
  'bash',
  'markdown',
];

let commonLangsLoaded = false;

async function ensureCommonLangs(hl: HighlighterGeneric<any, any>) {
  if (commonLangsLoaded) {
    return;
  }

  commonLangsLoaded = true;

  const { bundledLanguages } = await import('shiki');

  const toLoad = COMMON_LANGS.filter((l) => !loadedLanguages.has(l) && l in bundledLanguages);

  if (toLoad.length > 0) {
    await hl.loadLanguage(...toLoad);
    toLoad.forEach((l) => loadedLanguages.add(l));
  }
}

export async function highlightCode(
  code: string,
  language: BundledLanguage | SpecialLanguage = 'plaintext',
  theme: 'dark-plus' | 'light-plus' = 'dark-plus',
): Promise<string | null> {
  try {
    const hl = await getHighlighter();

    await ensureCommonLangs(hl);

    const lang = language as string;

    if (!loadedLanguages.has(lang)) {
      const { bundledLanguages, isSpecialLang } = await import('shiki');

      if (isSpecialLang(language) || lang in bundledLanguages) {
        if (!isSpecialLang(language)) {
          await hl.loadLanguage(language as BundledLanguage);
        }

        loadedLanguages.add(lang);
      } else {
        loadedLanguages.add(lang);
        return hl.codeToHtml(code, { lang: 'plaintext', theme });
      }
    }

    return hl.codeToHtml(code, { lang, theme });
  } catch {
    return null;
  }
}
