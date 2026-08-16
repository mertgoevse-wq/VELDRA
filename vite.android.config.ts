/**
 * Vite config for Android shell build.
 *
 * Produces a pure SPA (no Remix server, no Cloudflare Worker) suitable
 * for bundling inside the Capacitor WebView as build/client/index.html.
 *
 * Key differences from vite.config.ts:
 *  - No remixVitePlugin (no SSR, no Cloudflare Dev Proxy)
 *  - react() plugin instead → plain CSR React app
 *  - rollupOptions.input = android-entry.html
 *  - outDir = build/client  (same dir Capacitor reads from)
 *  - VITE_ANDROID_BUILD = 'true' env flag for conditional imports
 */

import react from '@vitejs/plugin-react';
import UnoCSS from 'unocss/vite';
import { defineConfig, type Plugin } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * After the Vite build, rename android-index.html → index.html
 * in the output directory. Capacitor requires build/client/index.html
 * as the entry point.
 */
function renameOutputHtml(outputHtmlName: string): Plugin {
  return {
    name: 'rename-output-html',
    closeBundle() {
      const outDir = resolve(__dirname, 'build/client');
      const src = resolve(outDir, outputHtmlName);
      const dst = resolve(outDir, 'index.html');

      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
        console.log(`[rename-output-html] ${outputHtmlName} → index.html`);
      }
    },
  };
}

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.VITE_ANDROID_BUILD': JSON.stringify('true'),
  },
  build: {
    target: 'esnext',
    outDir: 'build/client',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: resolve(__dirname, 'android-index.html'),
      output: {
        manualChunks(id) {
          /*
           * Only ONE manual split survives: vendor-shiki. Everything else -- react/react-dom,
           * ai SDK hooks, framer-motion, Radix, CodeMirror/lezer/uiw-codemirror,
           * react-markdown/remark/rehype/unified/unist, and this app's own
           * /components/workbench//components/editor code -- previously had its own manual
           * chunk(s), and EVERY one of those splits turned out to depend on React somewhere in
           * its graph. Rollup's manualChunks resolves cross-chunk references by
           * first-discoverer, which can produce a circular chunk reference -- a peer chunk
           * reading its React (or other shared) binding through another peer instead of
           * directly, before that binding finished initializing.
           *
           * This was chased incrementally across this round's first-ever real Android
           * build+screenshot verification and kept reproducing under a new name each time a
           * split was "fixed" by merging one more package into vendor-react: "Cannot read
           * properties of undefined (reading 'useState')" (original, react+ai+framer-motion+
           * radix) -> "Cannot access 'L' before initialization" (codemirror, missing lezer/uiw)
           * -> "Cannot access 'Fp' before initialization" (codemirror's own internal circularity
           * even once fully isolated) -> "Cannot read properties of undefined (reading
           * 'useLayoutEffect')" (app-workbench, once codemirror's split was removed and the
           * chunk graph shifted again). Four confirmed crashes chasing four different manual
           * chunk boundaries is a pattern, not a one-off -- this dependency graph is too
           * interconnected for hand-picked splits to be reliably safe. Falling back to ONE
           * shared chunk for everything React-adjacent is the correctness-first choice; if a
           * genuine bundle-size need justifies re-splitting later, any new split must be
           * verified with a real build+screenshot check, not assumed safe from the source
           * import list alone.
           */
          if (id.includes('node_modules') && (id.includes('shiki') || id.includes('@shikijs/'))) {
            return 'vendor-shiki';
          }

          return undefined;
        },
      },
    },
    sourcemap: false,
    minify: 'esbuild',
  },
  plugins: [
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream'],
      globals: {
        Buffer: true,
        process: true,
        global: true,
      },
      protocolImports: true,
      exclude: ['child_process', 'fs', 'path'],
    }),
    react(),
    UnoCSS(),
    tsconfigPaths(),
    renameOutputHtml('android-index.html'),
  ],
  envPrefix: [
    'VITE_',
    'OPENAI_LIKE_API_BASE_URL',
    'OPENAI_LIKE_API_MODELS',
    'OLLAMA_API_BASE_URL',
    'LMSTUDIO_API_BASE_URL',
    'TOGETHER_API_BASE_URL',
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  resolve: {
    alias: [
      // Point ~ to app/ for tsconfigPaths compat
      { find: '~', replacement: resolve(__dirname, 'app') },

      // Stub out Remix router hooks — Android SPA doesn't have a Remix server
      { find: '@remix-run/react', replacement: resolve(__dirname, 'src/shims/remix-react.tsx') },

      // Stub out Cloudflare-specific imports not needed in SPA
      { find: '@remix-run/cloudflare', replacement: resolve(__dirname, 'src/shims/remix-cloudflare.ts') },

      // Stub out server-only providers that use node:child_process
      { find: /.*providers\/external-cli/, replacement: resolve(__dirname, 'src/shims/external-cli-provider.ts') },

      // Stub out the stdio MCP transport, which also uses node:child_process
      { find: 'ai/mcp-stdio', replacement: resolve(__dirname, 'src/shims/mcp-stdio.ts') },
    ],
  },
});
