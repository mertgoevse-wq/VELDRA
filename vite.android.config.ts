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
          if (id.includes('node_modules')) {
            /*
             * react/react-dom must NOT be split into their own isolated chunk while other
             * manual chunks (ai SDK hooks, framer-motion, Radix) also depend on them: Rollup's
             * manualChunks resolves cross-chunk references by first-discoverer, which can
             * produce a circular chunk reference -- e.g. a peer chunk ending up importing its
             * React binding through another peer instead of directly, and reading it before
             * that binding was initialized, throwing "Cannot read properties of undefined
             * (reading 'useState')" on every load (100% reproducible, verified via headless
             * Chromium against the built output -- a full white-screen crash, not a dev-only
             * artifact). Fix: keep every react-consuming vendor lib in the same chunk as react
             * itself so there is one evaluation unit and no cross-chunk ordering to get wrong.
             */
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/ai/') ||
              id.includes('@ai-sdk/') ||
              id.includes('framer-motion') ||
              id.includes('@radix-ui/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('@codemirror/')) return 'vendor-codemirror';
            if (id.includes('shiki') || id.includes('@shikijs/')) return 'vendor-shiki';
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('unified') || id.includes('unist')) return 'vendor-markdown';
          }
          if (id.includes('/components/workbench/') || id.includes('/components/editor/')) return 'app-workbench';
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
    ],
  },
});
