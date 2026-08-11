import { describe, expect, it } from 'vitest';
import { parseEditorOrigin } from './webcontainer.connect.$id';

describe('parseEditorOrigin', () => {
  it('accepts a clean https origin', () => {
    expect(parseEditorOrigin('https://example.com')).toBe('https://example.com');
  });

  it('accepts a clean http origin', () => {
    expect(parseEditorOrigin('http://localhost:5173')).toBe('http://localhost:5173');
  });

  it('rejects null', () => {
    expect(parseEditorOrigin(null)).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(parseEditorOrigin('')).toBeNull();
  });

  it('rejects a value with a path, since it is not a bare origin', () => {
    expect(parseEditorOrigin('https://example.com/some/path')).toBeNull();
  });

  it('rejects a value with a query string', () => {
    expect(parseEditorOrigin('https://example.com?x=1')).toBeNull();
  });

  it('rejects a non-http(s) protocol', () => {
    expect(parseEditorOrigin('javascript:alert(1)')).toBeNull();
  });

  it('rejects an unparseable string', () => {
    expect(parseEditorOrigin('not a url')).toBeNull();
  });

  it(
    'does not itself guarantee the value is free of quote characters -- WHATWG URL parsing is ' +
      'lenient enough to round-trip some unusual strings as their own origin',
    () => {
      const tricky = "https://example.com'});alert(document.cookie);('";
      expect(parseEditorOrigin(tricky)).toBe(tricky);

      /*
       * This is exactly why the loader embeds the value via JSON.stringify() rather than raw
       * template interpolation: JSON.stringify wraps it in a single double-quoted literal with no
       * unescaped double quotes inside, so it can never break out of the script regardless of what
       * parseEditorOrigin lets through.
       */
      expect(JSON.stringify(tricky)).not.toMatch(/[^\\]'\)/);
    },
  );
});
