// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { FileMap } from '~/lib/stores/files';
import {
  PREVIEW_MESSAGE_MARKER,
  buildStaticPreviewDocument,
  describeStaticPreviewStatus,
  parsePreviewRuntimeMessage,
} from './staticPreviewBundle';

/**
 * These cover the honesty guarantees of the static preview, which is the ONLY renderer on
 * Android: the build step succeeding says nothing about whether the page runs, so the built
 * document has to be able to report its own failure, and the status text must never upgrade
 * an unverified or failed load into a success.
 */

function fileMapOf(entries: Record<string, string>): FileMap {
  return Object.fromEntries(
    Object.entries(entries).map(([key, content]) => [key, { type: 'file' as const, content, isBinary: false }]),
  ) as FileMap;
}

describe('buildStaticPreviewDocument -- injected runtime reporter', () => {
  it('preserves the author document and adds the reporter as the first thing in <head>', () => {
    const built = buildStaticPreviewDocument(
      fileMapOf({
        'index.html': '<html><head><title>Mine</title></head><body><p>hello</p></body></html>',
      }),
      'index.html',
    );

    expect(built).toBeDefined();
    expect(built!.html).toContain('<title>Mine</title>');
    expect(built!.html).toContain('<p>hello</p>');
    expect(built!.html).toContain(PREVIEW_MESSAGE_MARKER);
    expect(built!.html).toContain("addEventListener('unhandledrejection'");

    // Must run before any author script can throw, or the throw goes unreported.
    const doc = new DOMParser().parseFromString(built!.html, 'text/html');
    const firstHeadScript = doc.head.querySelector('script');
    expect(firstHeadScript).toBe(doc.head.firstElementChild);
    expect(firstHeadScript!.textContent).toContain(PREVIEW_MESSAGE_MARKER);

    built!.revoke();
  });

  it('keeps the reporter free of angle brackets, which would close the script element early', () => {
    const built = buildStaticPreviewDocument(
      fileMapOf({ 'index.html': '<html><body><p>hi</p></body></html>' }),
      'index.html',
    );

    const doc = new DOMParser().parseFromString(built!.html, 'text/html');
    const shim = doc.head.querySelector('script')!.textContent ?? '';

    expect(shim.length).toBeGreaterThan(100);
    expect(shim).not.toMatch(/[<>]/);

    built!.revoke();
  });

  it('does not report success for a project with no entry point', () => {
    expect(buildStaticPreviewDocument(fileMapOf({ 'app.js': 'console.log(1)' }), 'index.html')).toBeUndefined();
  });

  it('still reports refs it could not resolve so the UI can name them', () => {
    const built = buildStaticPreviewDocument(
      fileMapOf({ 'index.html': '<html><body><script src="./missing.js"></script></body></html>' }),
      'index.html',
    );

    expect(built!.unresolved).toEqual(['./missing.js']);
    built!.revoke();
  });
});

describe('parsePreviewRuntimeMessage', () => {
  it('rejects anything without the marker -- an unrelated postMessage cannot fake a verdict', () => {
    expect(parsePreviewRuntimeMessage({ kind: 'error', message: 'fake' })).toBeUndefined();
    expect(parsePreviewRuntimeMessage('error')).toBeUndefined();
    expect(parsePreviewRuntimeMessage(null)).toBeUndefined();
    expect(parsePreviewRuntimeMessage({ [PREVIEW_MESSAGE_MARKER]: true, kind: 'nonsense' })).toBeUndefined();
  });

  it('normalises an error report', () => {
    expect(
      parsePreviewRuntimeMessage({
        [PREVIEW_MESSAGE_MARKER]: true,
        kind: 'error',
        message: "Unexpected token '<'",
        source: 'blob:app.jsx',
        line: '12',
      }),
    ).toEqual({ kind: 'error', message: "Unexpected token '<'", source: 'blob:app.jsx', line: 12 });
  });

  it('normalises resource and ready reports', () => {
    expect(
      parsePreviewRuntimeMessage({ [PREVIEW_MESSAGE_MARKER]: true, kind: 'resource-error', tag: 'script' }),
    ).toEqual({ kind: 'resource-error', tag: 'script', url: '' });

    expect(parsePreviewRuntimeMessage({ [PREVIEW_MESSAGE_MARKER]: true, kind: 'ready' })).toEqual({
      kind: 'ready',
      renderedNodes: 0,
    });
  });
});

describe('describeStaticPreviewStatus', () => {
  it('never claims success before the document has reported anything', () => {
    const status = describeStaticPreviewStatus(null);

    expect(status.tone).toBe('pending');
    expect(status.headline).not.toMatch(/running|started|success/i);
  });

  it("surfaces the browser's own error text rather than a generic failure", () => {
    const status = describeStaticPreviewStatus({
      kind: 'error',
      message: "Unexpected token '<'",
      source: 'blob:app.jsx',
      line: 12,
    });

    expect(status.tone).toBe('error');
    expect(status.detail).toContain("Unexpected token '<'");
    expect(status.detail).toContain('blob:app.jsx:12');
  });

  it('reports an empty render as a fact, not as a failure', () => {
    const status = describeStaticPreviewStatus({ kind: 'ready', renderedNodes: 0 });

    expect(status.tone).toBe('warn');
    expect(status.headline).toMatch(/no visible content/i);
  });

  it('only reports success once the page actually loaded with content', () => {
    const status = describeStaticPreviewStatus({ kind: 'ready', renderedNodes: 14 });

    expect(status.tone).toBe('ok');
    expect(status.headline).toMatch(/running/i);
    expect(status.detail).toBeUndefined();
  });

  it('downgrades a loaded page to a warning when references are missing', () => {
    const status = describeStaticPreviewStatus({ kind: 'ready', renderedNodes: 14 }, ['./a.js', './b.css']);

    expect(status.tone).toBe('warn');
    expect(status.detail).toContain('./a.js');
    expect(status.detail).toContain('2 references');
  });
});
