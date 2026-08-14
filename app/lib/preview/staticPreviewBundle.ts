/**
 * Builds a "live enough" static preview for platforms without a real dev
 * server (Android fallback mode, or any WebContainer-less runtime).
 *
 * Resolves same-origin relative references in the entry HTML file --
 * <script src>, <link href>, <img src>/<source src>, CSS `url(...)`, and
 * simple relative ES-module imports/`import()` calls in JS/TS -- against
 * the in-memory FileMap, and rewrites them to object/data URLs so a
 * multi-file project (not just a single self-contained HTML file) can
 * render without a server. This is a best-effort resolver, not a bundler:
 * it does not do module resolution algorithms (no bare specifiers,
 * no package.json "main"/"exports"), only relative-path lookups.
 */
import type { FileMap } from '~/lib/stores/files';
import { path } from '~/utils/path';

const MIME_BY_EXT: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  jsx: 'text/javascript',
  ts: 'text/javascript',
  tsx: 'text/javascript',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  txt: 'text/plain',
};

const RELATIVE_JS_IMPORT = /(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.[^'"]*)\2/g;
const CSS_URL_REF = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

function extOf(filePath: string): string {
  const ext = filePath.split('.').pop();
  return ext ? ext.toLowerCase() : '';
}

function isRewritable(ref: string): boolean {
  if (!ref || ref.startsWith('#')) {
    return false;
  }

  return !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref) && ref !== '';
}

/** Resolve `ref` (as written in `fromPath`) against the FileMap, trying a few common extensionless fallbacks. */
function resolveFileKey(fileMap: FileMap, fromPath: string, ref: string): string | undefined {
  const base = ref.startsWith('/') ? ref : path.join(path.dirname(fromPath), ref);
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`, `${base}/index.js`];

  return candidates.find((candidate) => fileMap[candidate]?.type === 'file');
}

interface Resolved {
  url: string;
  revoke?: () => void;
}

function resourceUrlFor(fileMap: FileMap, filePath: string, cache: Map<string, Resolved>): Resolved | undefined {
  const cached = cache.get(filePath);

  if (cached) {
    return cached;
  }

  const file = fileMap[filePath];

  if (!file || file.type !== 'file') {
    return undefined;
  }

  const mime = MIME_BY_EXT[extOf(filePath)] ?? 'application/octet-stream';

  if (file.isBinary) {
    const resolved: Resolved = { url: `data:${mime};base64,${file.content}` };
    cache.set(filePath, resolved);

    return resolved;
  }

  let content = file.content;

  if (mime === 'text/css') {
    content = rewriteCssUrls(content, filePath, fileMap, cache);
  } else if (mime === 'text/javascript') {
    content = rewriteJsImports(content, filePath, fileMap, cache);
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const resolved: Resolved = { url, revoke: () => URL.revokeObjectURL(url) };
  cache.set(filePath, resolved);

  return resolved;
}

function rewriteCssUrls(css: string, cssPath: string, fileMap: FileMap, cache: Map<string, Resolved>): string {
  return css.replace(CSS_URL_REF, (match, _quote: string, ref: string) => {
    if (!isRewritable(ref)) {
      return match;
    }

    const key = resolveFileKey(fileMap, cssPath, ref);
    const resolved = key ? resourceUrlFor(fileMap, key, cache) : undefined;

    return resolved ? `url("${resolved.url}")` : match;
  });
}

function rewriteJsImports(js: string, jsPath: string, fileMap: FileMap, cache: Map<string, Resolved>): string {
  return js.replace(RELATIVE_JS_IMPORT, (match, prefix: string, quote: string, ref: string) => {
    const key = resolveFileKey(fileMap, jsPath, ref);
    const resolved = key ? resourceUrlFor(fileMap, key, cache) : undefined;

    return resolved ? `${prefix}${quote}${resolved.url}${quote}` : match;
  });
}

export interface StaticPreviewBuild {
  url: string;
  revoke: () => void;

  /** Relative refs found in the entry HTML that couldn't be resolved against the workspace. */
  unresolved: string[];
}

/**
 * Build a blob-URL preview for `indexPath`, resolving relative script/link/img/source
 * references (and, transitively, CSS url()s and relative JS imports) against `fileMap`.
 */
export function buildStaticPreview(fileMap: FileMap, indexPath: string): StaticPreviewBuild | undefined {
  const entry = fileMap[indexPath];

  if (!entry || entry.type !== 'file') {
    return undefined;
  }

  const cache = new Map<string, Resolved>();
  const unresolved: string[] = [];

  const doc = new DOMParser().parseFromString(entry.content, 'text/html');
  const refAttrs: Array<[string, string]> = [
    ['script[src]', 'src'],
    ['link[href]', 'href'],
    ['img[src]', 'src'],
    ['source[src]', 'src'],
    ['audio[src]', 'src'],
    ['video[src]', 'src'],
  ];

  for (const [selector, attr] of refAttrs) {
    doc.querySelectorAll(selector).forEach((el) => {
      const ref = el.getAttribute(attr);

      if (!ref || !isRewritable(ref)) {
        return;
      }

      const key = resolveFileKey(fileMap, indexPath, ref);
      const resolved = key ? resourceUrlFor(fileMap, key, cache) : undefined;

      if (resolved) {
        el.setAttribute(attr, resolved.url);
      } else {
        unresolved.push(ref);
      }
    });
  }

  const html = `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const revoke = () => {
    URL.revokeObjectURL(url);
    cache.forEach((resolved) => resolved.revoke?.());
  };

  return { url, revoke, unresolved };
}
