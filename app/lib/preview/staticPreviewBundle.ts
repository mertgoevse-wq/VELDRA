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
 * Marker property on every message the injected shim posts to the parent window.
 * The parent must ALSO verify `event.source` is the preview iframe's own
 * contentWindow -- this marker only identifies the shape, never the sender.
 */
export const PREVIEW_MESSAGE_MARKER = '__veldraStaticPreview';

export type PreviewRuntimeMessage =
  /** An uncaught script error or unhandled rejection, exactly as the browser reported it. */
  | { kind: 'error'; message: string; source: string; line: number }
  /** A subresource (script/img/link/...) failed to load. */
  | { kind: 'resource-error'; tag: string; url: string }
  /** The document reached `load`. `renderedNodes` counts elements actually in `<body>`. */
  | { kind: 'ready'; renderedNodes: number };

/**
 * Injected as the first thing in the preview document's <head>.
 *
 * Without this, a project the resolver cannot actually run (a `.jsx` entry served
 * verbatim as text/javascript, a bare-specifier import with no module resolver,
 * a typo'd relative path) produces a perfectly successful *build* and a silently
 * blank frame -- so the UI reported success for a broken result. This reports what
 * the browser itself observed, which is the only non-speculative way to know
 * whether the preview really worked.
 *
 * Deliberately contains no `<` or `>`: script text content is serialized raw by
 * `outerHTML`, so an angle bracket here could terminate the element early.
 */
const PREVIEW_RUNTIME_SHIM = `
(function () {
  var post = function (payload) {
    try {
      payload.${PREVIEW_MESSAGE_MARKER} = true;
      parent.postMessage(payload, '*');
    } catch (e) {
      /* preview is detached or blocked -- nothing useful to do */
    }
  };

  addEventListener(
    'error',
    function (event) {
      var el = event.target;

      if (el && el !== window && el.tagName) {
        post({ kind: 'resource-error', tag: String(el.tagName).toLowerCase(), url: String(el.src || el.href || '') });
        return;
      }

      post({
        kind: 'error',
        message: String((event.error && event.error.message) || event.message || 'Script error'),
        source: String(event.filename || ''),
        line: Number(event.lineno) || 0,
      });
    },
    true,
  );

  addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    post({
      kind: 'error',
      message: 'Unhandled promise rejection: ' + String((reason && reason.message) || reason),
      source: '',
      line: 0,
    });
  });

  addEventListener('load', function () {
    post({ kind: 'ready', renderedNodes: document.body ? document.body.querySelectorAll('*').length : 0 });
  });
})();
`;

/**
 * Validate an incoming `message` event payload as a shim message.
 *
 * Shape-checks only -- callers MUST separately confirm the message came from the
 * preview iframe's own contentWindow before acting on it.
 */
export function parsePreviewRuntimeMessage(data: unknown): PreviewRuntimeMessage | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }

  const raw = data as Record<string, unknown>;

  if (raw[PREVIEW_MESSAGE_MARKER] !== true) {
    return undefined;
  }

  if (raw.kind === 'error') {
    return {
      kind: 'error',
      message: String(raw.message ?? 'Script error'),
      source: String(raw.source ?? ''),
      line: Number(raw.line) || 0,
    };
  }

  if (raw.kind === 'resource-error') {
    return { kind: 'resource-error', tag: String(raw.tag ?? ''), url: String(raw.url ?? '') };
  }

  if (raw.kind === 'ready') {
    return { kind: 'ready', renderedNodes: Number(raw.renderedNodes) || 0 };
  }

  return undefined;
}

export interface StaticPreviewStatus {
  tone: 'pending' | 'ok' | 'warn' | 'error';
  headline: string;
  detail?: string;
}

/**
 * Turn the shim's report into the text the preview banner shows.
 *
 * Every branch states only what was actually observed. In particular a loaded page with
 * an empty body is reported as "rendered no visible content" -- a fact -- and never as a
 * failure, because a page is free to render later from a timer or an interaction.
 */
export function describeStaticPreviewStatus(
  status: PreviewRuntimeMessage | null,
  unresolved: string[] = [],
): StaticPreviewStatus {
  const unresolvedDetail =
    unresolved.length > 0
      ? `${unresolved.length} reference${unresolved.length === 1 ? '' : 's'} not found in your project: ${unresolved
          .slice(0, 3)
          .join(', ')}${unresolved.length > 3 ? '…' : ''}`
      : undefined;

  if (status?.kind === 'error') {
    return {
      tone: 'error',
      headline: 'The preview failed to run',
      detail: [status.message, status.source ? `(${status.source}:${status.line})` : undefined]
        .filter(Boolean)
        .join(' '),
    };
  }

  if (status?.kind === 'resource-error') {
    return {
      tone: 'error',
      headline: `A ${status.tag || 'resource'} the page needs could not load`,
      detail: status.url || unresolvedDetail,
    };
  }

  if (status?.kind === 'ready') {
    if (status.renderedNodes === 0) {
      return {
        tone: 'warn',
        headline: 'The page loaded but rendered no visible content',
        detail: unresolvedDetail ?? 'Nothing was found inside the document body.',
      };
    }

    return {
      tone: unresolvedDetail ? 'warn' : 'ok',
      headline: 'Preview running on this device — no build step, no dev server',
      detail: unresolvedDetail,
    };
  }

  return { tone: 'pending', headline: 'Loading preview…', detail: unresolvedDetail };
}

export interface StaticPreviewDocument {
  /** Complete, self-contained HTML ready to be served as the preview document. */
  html: string;

  unresolved: string[];

  /** Release the object URLs created for the transitively-referenced resources. */
  revoke: () => void;
}

/**
 * Build the preview document as a string.
 *
 * Split out from `buildStaticPreview` so the produced HTML -- including the injected
 * reporter -- can be asserted directly. A `blob:` URL cannot be read back in jsdom, so
 * testing through the blob would mean not testing the document at all.
 */
export function buildStaticPreviewDocument(fileMap: FileMap, indexPath: string): StaticPreviewDocument | undefined {
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

  const shim = doc.createElement('script');
  shim.textContent = PREVIEW_RUNTIME_SHIM;
  doc.head.insertBefore(shim, doc.head.firstChild);

  return {
    html: `<!DOCTYPE html>${doc.documentElement.outerHTML}`,
    unresolved,
    revoke: () => cache.forEach((resolved) => resolved.revoke?.()),
  };
}

/**
 * Build a blob-URL preview for `indexPath`, resolving relative script/link/img/source
 * references (and, transitively, CSS url()s and relative JS imports) against `fileMap`.
 */
export function buildStaticPreview(fileMap: FileMap, indexPath: string): StaticPreviewBuild | undefined {
  const built = buildStaticPreviewDocument(fileMap, indexPath);

  if (!built) {
    return undefined;
  }

  const url = URL.createObjectURL(new Blob([built.html], { type: 'text/html' }));

  return {
    url,
    unresolved: built.unresolved,
    revoke: () => {
      URL.revokeObjectURL(url);
      built.revoke();
    },
  };
}
