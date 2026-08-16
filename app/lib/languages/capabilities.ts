/**
 * Language capability matrix -- a truthful map of what VELDRA actually supports per
 * language, split into the distinct capabilities the product mandate asked to separate
 * rather than one vague "supported" flag. Every value here is derived from real, checkable
 * facts in the codebase (see each field's own comment), not aspiration.
 *
 * The load-bearing finding this file documents: WebContainer and Remote Runtime are BOTH
 * fundamentally Node.js-only execution environments today.
 *   - WebContainer (app/lib/webcontainer/): a WASM Node.js runtime -- it cannot execute
 *     Python/Go/Rust/Java/Kotlin/C/C++ at all, only JS/TS via Node.
 *   - Remote Runtime (app/lib/remote-runtime/RemoteRuntimeClient.ts): its command execution
 *     API is a fixed, deliberately narrow allowlist -- REMOTE_COMMAND_PROFILES is exactly
 *     ['npm install', 'npm run dev', 'npm run build', 'pnpm install', 'pnpm run dev',
 *     'pnpm run build']. There is no server-side capability to run `python`, `go build`,
 *     `cargo`, `javac`, etc. -- and the client deliberately cannot send arbitrary commands
 *     (see runtime-mode.ts's agentBuildCommands doc comment for why: an unrestricted remote
 *     shell would be a real security regression, not a feature gap).
 * So today, runtimeSupport/buildSupport/previewSupport are only ever true for the Node.js/
 * web ecosystem (JS/TS/HTML/CSS and the frameworks built on them) -- everything else has
 * real editor support (syntax highlighting you can trust) but is fundamentally a text file
 * to VELDRA's runtime, the same as any other language it can't execute.
 */

export interface LanguageCapability {
  /** Display name, matching app/components/editor/codemirror/languages.ts's LanguageDescription.name where one exists. */
  name: string;

  /** Representative file extensions (not exhaustive) -- see languages.ts for the authoritative list this editor support is checked against. */
  extensions: string[];

  /**
   * Real syntax highlighting in the live file editor (CodeMirror, via
   * app/components/editor/codemirror/languages.ts). Verified directly against that file's
   * supportedLanguages list, not assumed -- see languages.spec.ts for a runtime check that
   * every claimed extension actually resolves to a working LanguageSupport.
   */
  editorSupport: boolean;

  /**
   * A curated starter template exists for this language (app/utils/constants.ts's
   * STARTER_TEMPLATES). Checked directly: as of 2026-08-16, all 13 templates are JS/TS
   * web frameworks (Vite/Next.js/Remix/Astro/Vue/Angular/SolidJS/SvelteKit/Qwik/Expo/
   * Slidev) -- zero non-JS/TS templates exist.
   */
  templateSupport: boolean;

  /**
   * VELDRA can install/manage this language's real dependencies (package.json via npm/pnpm
   * install, the same REMOTE_COMMAND_PROFILES-backed path build/start actions use). No
   * equivalent exists for pip/cargo/go mod/maven/gradle etc. in either WebContainer or
   * Remote Runtime today.
   */
  dependencySupport: boolean;

  /**
   * Code in this language can actually execute (WebContainer's Node.js WASM runtime, or
   * Remote Runtime's fixed npm/pnpm command-profile allowlist). False for every non-Node
   * language -- there is no real execution path, not a missing UI affordance for one.
   */
  runtimeSupport: boolean;

  /** A real build step can run for this language (`npm run build`/`pnpm run build` only). */
  buildSupport: boolean;

  /**
   * Output can be shown in the Preview panel. True for the Node/web ecosystem (real dev
   * server via WebContainer/Remote Runtime, or the static-HTML Blob-URL fallback for a
   * project that happens to produce one) and for any language's static index.html output
   * specifically -- but not as a language-level guarantee (see staticPreviewBundle.ts,
   * which only ever compiles an existing index.html, it doesn't compile/transpile/interpret
   * any language into one).
   */
  previewSupport: boolean;
}

export const LANGUAGE_CAPABILITIES: LanguageCapability[] = [
  {
    name: 'HTML',
    extensions: ['html'],
    editorSupport: true,
    templateSupport: true,
    dependencySupport: true,
    runtimeSupport: true,
    buildSupport: true,
    previewSupport: true,
  },
  {
    name: 'CSS',
    extensions: ['css', 'scss', 'sass'],
    editorSupport: true,
    templateSupport: true,
    dependencySupport: true,
    runtimeSupport: true,
    buildSupport: true,
    previewSupport: true,
  },
  {
    name: 'JavaScript',
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    editorSupport: true,
    templateSupport: true,
    dependencySupport: true,
    runtimeSupport: true,
    buildSupport: true,
    previewSupport: true,
  },
  {
    name: 'TypeScript',
    extensions: ['ts', 'tsx'],
    editorSupport: true,
    templateSupport: true,
    dependencySupport: true,
    runtimeSupport: true,
    buildSupport: true,
    previewSupport: true,
  },
  {
    name: 'Python',
    extensions: ['py'],
    editorSupport: true,
    templateSupport: false,
    dependencySupport: false,
    runtimeSupport: false,
    buildSupport: false,
    previewSupport: false,
  },
  {
    name: 'Go',
    extensions: ['go'],
    editorSupport: true,
    templateSupport: false,
    dependencySupport: false,
    runtimeSupport: false,
    buildSupport: false,
    previewSupport: false,
  },
  {
    name: 'Rust',
    extensions: ['rs'],
    editorSupport: true,
    templateSupport: false,
    dependencySupport: false,
    runtimeSupport: false,
    buildSupport: false,
    previewSupport: false,
  },
  {
    name: 'Java',
    extensions: ['java'],
    editorSupport: true,
    templateSupport: false,
    dependencySupport: false,
    runtimeSupport: false,
    buildSupport: false,
    previewSupport: false,
  },
  {
    name: 'Kotlin',
    extensions: ['kt', 'kts'],
    editorSupport: true,
    templateSupport: false,
    dependencySupport: false,
    runtimeSupport: false,
    buildSupport: false,
    previewSupport: false,
  },
  {
    name: 'C',
    extensions: ['c', 'h'],
    editorSupport: true,
    templateSupport: false,
    dependencySupport: false,
    runtimeSupport: false,
    buildSupport: false,
    previewSupport: false,
  },
  {
    name: 'C++',
    extensions: ['cpp', 'cc', 'cxx', 'hpp'],
    editorSupport: true,
    templateSupport: false,
    dependencySupport: false,
    runtimeSupport: false,
    buildSupport: false,
    previewSupport: false,
  },
  {
    name: 'Shell',
    extensions: ['sh', 'bash'],
    editorSupport: true,
    templateSupport: false,
    dependencySupport: false,

    /*
     * Distinct from the others: real shell execution exists (WebContainer's shell, or the
     * fixed Remote Runtime command profiles), but only for VELDRA's own predetermined
     * commands (npm/pnpm install/dev/build) -- an agent cannot run arbitrary shell content
     * as a genuine capability the way it can generate/run JS. See action-runner.ts's
     * commandExecution vs. agentBuildCommands split for the real distinction. Marked false
     * here since "runtime support for the Shell *language*" would overclaim what's real.
     */
    runtimeSupport: false,
    buildSupport: false,
    previewSupport: false,
  },
];

/** Looks up a language's capability entry by file extension (without the leading dot). */
export function getCapabilityForExtension(extension: string): LanguageCapability | undefined {
  const normalized = extension.replace(/^\./, '').toLowerCase();
  return LANGUAGE_CAPABILITIES.find((lang) => lang.extensions.includes(normalized));
}
