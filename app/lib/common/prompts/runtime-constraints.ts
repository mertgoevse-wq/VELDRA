/**
 * Runtime-capability prompt constraints.
 *
 * Every system prompt in this repo (`prompts.ts`, `new-prompt.ts`, `optimized.ts`)
 * opens by asserting "You are operating in WebContainer, an in-browser Node.js
 * runtime" and then steers the model toward Vite + `package.json` + `npm install`
 * + a `start` action. That is true for the desktop/browser build and **false on
 * Android**, where `runtimeModeStore`'s default mode is `android-fallback`:
 * `commandExecution`, `packageInstall` and `devServer` are all `false`
 * (see `app/lib/stores/runtime-mode.ts`), so those actions are rejected by
 * `action-runner.ts`'s capability gate, and the only thing that can render is
 * `app/lib/preview/staticPreviewBundle.ts` -- a relative-path resolver, NOT a
 * bundler or transpiler. It serves `.jsx`/`.tsx`/`.ts` as `text/javascript`
 * verbatim and cannot resolve bare specifiers, so a Vite/React project renders
 * as a blank frame.
 *
 * Rather than let the model plan against a runtime that isn't there, this module
 * turns the *actual* capability flags into a prompt block that states the truth.
 * It returns an empty string for a full WebContainer session, so the desktop
 * prompt is byte-for-byte unchanged and cannot regress.
 */

export type RuntimePromptMode = 'webcontainer' | 'android-fallback' | 'remote';

/**
 * The subset of `RuntimeModeState` that is safe and useful to describe to a model.
 * Deliberately a structural copy rather than an import of the store's own type:
 * the store is client-only (`localStorage`, `window`) and this runs server-side
 * inside the prompt builders.
 */
export interface RuntimePromptCapabilities {
  mode: RuntimePromptMode;

  /** A real dev server (`npm run dev`) can be started and served. */
  devServer: boolean;

  /** Dependencies declared in `package.json` will actually be installed. */
  packageInstall: boolean;

  /** Arbitrary model-authored shell text can execute. */
  commandExecution: boolean;
}

/** A session where the model may plan exactly as the base prompt already describes. */
function isFullNodeRuntime(runtime: RuntimePromptCapabilities): boolean {
  return runtime.devServer && runtime.packageInstall && runtime.commandExecution;
}

/**
 * A session with no Node.js runtime at all: no shell, no installer, no dev server.
 * The only renderer is the in-memory static preview bundler.
 */
function isZeroBuildRuntime(runtime: RuntimePromptCapabilities): boolean {
  return !runtime.devServer && !runtime.packageInstall;
}

const ZERO_BUILD_CONSTRAINTS = `
<runtime_environment>
  CRITICAL -- read this before planning anything. Where this section conflicts with
  any other part of this prompt, THIS SECTION WINS.

  You are NOT running in WebContainer. This session has no Node.js runtime, no
  shell, no package manager and no dev server. The user's device renders the files
  you write directly in a sandboxed browser frame, with no build step of any kind.

  Consequences you MUST design around:
    - NEVER emit a \`shell\` or \`start\` action. They cannot execute; the user sees a
      "Command Execution Unavailable" error instead of a result.
    - NEVER depend on \`npm install\`. Dependencies declared in a \`package.json\` are
      never installed, so do not write one unless the user explicitly asks for it.
    - The entry point MUST be \`index.html\` at the project root. It is the only file
      the renderer can load first. A project without it renders nothing.
    - Ship ONLY what a browser can run as-is:
        * Plain HTML, modern CSS, and vanilla ES2020+ JavaScript.
        * \`<script type="module" src="./app.js">\` with RELATIVE paths -- these resolve.
        * NO JSX, NO TypeScript, NO \`.tsx\`/\`.jsx\`/\`.ts\` files, NO Sass/SCSS, and
          nothing else that needs compiling. Such files are served verbatim and throw
          a syntax error, leaving the user with a blank screen.
        * NO bare-specifier imports (\`import React from 'react'\`) -- there is no module
          resolver. If a library is genuinely required, load it from a public CDN using
          a complete absolute https URL (\`<script src="https://...">\`, or
          \`import x from 'https://...'\`). Absolute URLs are passed through untouched
          and do work.
    - Prefer one self-contained, genuinely beautiful page over a multi-file framework
      app. This is a hard capability limit of the device, not a stylistic preference --
      and it is not an excuse for a plain-looking result: use modern CSS
      (custom properties, grid, clamp(), gradients, transitions) to make it excellent.
    - Never tell the user to run a command, open a terminal, or visit a localhost URL.
      Their result appears by itself in the Preview pane.
</runtime_environment>
`;

const NO_RAW_SHELL_CONSTRAINTS = `
<runtime_environment>
  You are NOT running in WebContainer. This session executes against a Remote Runtime
  server. Writing files, installing dependencies, \`npm run build\` and \`npm run dev\`
  all genuinely work, and the preview is served by that remote dev server.

  One difference you MUST respect:
    - NEVER emit a \`shell\` action containing arbitrary command text. The server accepts
      only a fixed allowlist of safe command profiles; anything else is rejected with
      "Command Execution Unavailable".
    - Use a \`start\` action for the dev server and a \`build\` action for the production
      build instead of shelling out to them.
    - Everything else in this prompt (declare dependencies in \`package.json\` first,
      prefer Vite, rely on the dev server picking up file changes) applies normally.
</runtime_environment>
`;

/**
 * Narrow a `runtimeModeStore` value down to the capability subset above, for sending
 * to the server as part of the chat request body.
 *
 * Structurally typed on purpose -- `RuntimeModeState` satisfies it without this module
 * importing the store, which is client-only (`window`, `localStorage`) while the prompt
 * builders that consume the result run server-side.
 */
export function toRuntimePromptCapabilities(state: {
  mode: RuntimePromptMode;
  capabilities: { devServer: boolean; packageInstall: boolean; commandExecution: boolean };
}): RuntimePromptCapabilities {
  return {
    mode: state.mode,
    devServer: state.capabilities.devServer,
    packageInstall: state.capabilities.packageInstall,
    commandExecution: state.capabilities.commandExecution,
  };
}

/**
 * Build the runtime-truth prompt block for a session.
 *
 * Returns `''` when the runtime is unknown (no capability info reached the server)
 * or is a full Node.js runtime -- in both cases the base prompt is already accurate,
 * and emitting nothing keeps existing behaviour bit-identical.
 */
export function getRuntimeConstraintsPrompt(runtime?: RuntimePromptCapabilities): string {
  if (!runtime) {
    return '';
  }

  if (isFullNodeRuntime(runtime)) {
    return '';
  }

  if (isZeroBuildRuntime(runtime)) {
    return ZERO_BUILD_CONSTRAINTS;
  }

  return NO_RAW_SHELL_CONSTRAINTS;
}
