import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';

/*
 * Go/Rust/Shell/C/Java/Kotlin have no dedicated Lezer grammar package (unlike the
 * @codemirror/lang-* entries below), but @codemirror/legacy-modes ships CodeMirror 5's
 * stream-based parsers for them -- a real, official CodeMirror package, not a hack. Wrapped
 * in StreamLanguage.define() + LanguageSupport since LanguageDescription.load() requires a
 * Promise<LanguageSupport>, and a bare StreamLanguage doesn't satisfy that type.
 */
async function legacyLanguage(
  loadMode: () => Promise<Record<string, unknown>>,
  exportName: string,
): Promise<LanguageSupport> {
  const mod = await loadMode();
  return new LanguageSupport(
    StreamLanguage.define(mod[exportName] as import('@codemirror/language').StreamParser<unknown>),
  );
}

export const supportedLanguages = [
  LanguageDescription.of({
    name: 'VUE',
    extensions: ['vue'],
    async load() {
      return import('@codemirror/lang-vue').then((module) => module.vue());
    },
  }),
  LanguageDescription.of({
    name: 'TS',
    extensions: ['ts'],
    async load() {
      return import('@codemirror/lang-javascript').then((module) => module.javascript({ typescript: true }));
    },
  }),
  LanguageDescription.of({
    name: 'JS',
    extensions: ['js', 'mjs', 'cjs'],
    async load() {
      return import('@codemirror/lang-javascript').then((module) => module.javascript());
    },
  }),
  LanguageDescription.of({
    name: 'TSX',
    extensions: ['tsx'],
    async load() {
      return import('@codemirror/lang-javascript').then((module) => module.javascript({ jsx: true, typescript: true }));
    },
  }),
  LanguageDescription.of({
    name: 'JSX',
    extensions: ['jsx'],
    async load() {
      return import('@codemirror/lang-javascript').then((module) => module.javascript({ jsx: true }));
    },
  }),
  LanguageDescription.of({
    name: 'HTML',
    extensions: ['html'],
    async load() {
      return import('@codemirror/lang-html').then((module) => module.html());
    },
  }),
  LanguageDescription.of({
    name: 'CSS',
    extensions: ['css'],
    async load() {
      return import('@codemirror/lang-css').then((module) => module.css());
    },
  }),
  LanguageDescription.of({
    name: 'SASS',
    extensions: ['sass'],
    async load() {
      return import('@codemirror/lang-sass').then((module) => module.sass({ indented: true }));
    },
  }),
  LanguageDescription.of({
    name: 'SCSS',
    extensions: ['scss'],
    async load() {
      return import('@codemirror/lang-sass').then((module) => module.sass({ indented: false }));
    },
  }),
  LanguageDescription.of({
    name: 'JSON',
    extensions: ['json'],
    async load() {
      return import('@codemirror/lang-json').then((module) => module.json());
    },
  }),
  LanguageDescription.of({
    name: 'Markdown',
    extensions: ['md'],
    async load() {
      return import('@codemirror/lang-markdown').then((module) => module.markdown());
    },
  }),
  LanguageDescription.of({
    name: 'Wasm',
    extensions: ['wat'],
    async load() {
      return import('@codemirror/lang-wast').then((module) => module.wast());
    },
  }),
  LanguageDescription.of({
    name: 'Python',
    extensions: ['py'],
    async load() {
      return import('@codemirror/lang-python').then((module) => module.python());
    },
  }),
  LanguageDescription.of({
    name: 'C++',
    extensions: ['cpp', 'cc', 'cxx', 'hpp'],
    async load() {
      return import('@codemirror/lang-cpp').then((module) => module.cpp());
    },
  }),
  LanguageDescription.of({
    name: 'C',
    extensions: ['c', 'h'],
    async load() {
      return legacyLanguage(() => import('@codemirror/legacy-modes/mode/clike'), 'c');
    },
  }),
  LanguageDescription.of({
    name: 'Java',
    extensions: ['java'],
    async load() {
      return legacyLanguage(() => import('@codemirror/legacy-modes/mode/clike'), 'java');
    },
  }),
  LanguageDescription.of({
    name: 'Kotlin',
    extensions: ['kt', 'kts'],
    async load() {
      return legacyLanguage(() => import('@codemirror/legacy-modes/mode/clike'), 'kotlin');
    },
  }),
  LanguageDescription.of({
    name: 'Go',
    extensions: ['go'],
    async load() {
      return legacyLanguage(() => import('@codemirror/legacy-modes/mode/go'), 'go');
    },
  }),
  LanguageDescription.of({
    name: 'Rust',
    extensions: ['rs'],
    async load() {
      return legacyLanguage(() => import('@codemirror/legacy-modes/mode/rust'), 'rust');
    },
  }),
  LanguageDescription.of({
    name: 'Shell',
    extensions: ['sh', 'bash'],
    async load() {
      return legacyLanguage(() => import('@codemirror/legacy-modes/mode/shell'), 'shell');
    },
  }),
];

export async function getLanguage(fileName: string) {
  const languageDescription = LanguageDescription.matchFilename(supportedLanguages, fileName);

  if (languageDescription) {
    return await languageDescription.load();
  }

  return undefined;
}
