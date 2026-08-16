import { describe, it, expect } from 'vitest';
import { classifyFileToolCall, extractFilePath, redactSecrets, summarizeForEvent } from './subagent-tool-events';

describe('extractFilePath', () => {
  it('finds a real path arg under any of the recognized key names', () => {
    expect(extractFilePath({ path: 'a.ts' })).toBe('a.ts');
    expect(extractFilePath({ filePath: 'b.ts' })).toBe('b.ts');
    expect(extractFilePath({ file_path: 'c.ts' })).toBe('c.ts');
    expect(extractFilePath({ filename: 'd.ts' })).toBe('d.ts');
  });

  it('returns undefined when there is no recognizable path arg', () => {
    expect(extractFilePath({ unrelated: true })).toBeUndefined();
    expect(extractFilePath(undefined)).toBeUndefined();
    expect(extractFilePath('not an object')).toBeUndefined();
    expect(extractFilePath({ path: 123 })).toBeUndefined();
  });
});

describe('classifyFileToolCall', () => {
  it('classifies a write-like tool name with a real path as file.changed', () => {
    expect(classifyFileToolCall('write_file', { path: 'a.ts' })).toBe('file.changed');
    expect(classifyFileToolCall('edit_file', { path: 'a.ts' })).toBe('file.changed');
    expect(classifyFileToolCall('create_file', { path: 'a.ts' })).toBe('file.changed');
  });

  it('classifies a read-like tool name with a real path as file.read', () => {
    expect(classifyFileToolCall('read_file', { path: 'a.ts' })).toBe('file.read');
    expect(classifyFileToolCall('get_file', { path: 'a.ts' })).toBe('file.read');
  });

  it('does not classify a tool with no path arg, even if the name matches', () => {
    expect(classifyFileToolCall('write_file', { content: 'x' })).toBeUndefined();
  });

  it('does not classify a tool with a path arg but an unrelated name (no guessing)', () => {
    expect(classifyFileToolCall('run_command', { path: '/usr/bin/node' })).toBeUndefined();
  });
});

describe('summarizeForEvent', () => {
  it('passes short strings through unchanged', () => {
    expect(summarizeForEvent('hello')).toBe('hello');
  });

  it('bounds long values so an event payload can never be unbounded', () => {
    const long = 'x'.repeat(1000);
    const result = summarizeForEvent(long, 50);
    expect(result.length).toBe(51); // 50 chars + ellipsis
    expect(result.endsWith('…')).toBe(true);
  });

  it('never throws on a value that cannot be JSON-serialized', () => {
    const circular: any = {};
    circular.self = circular;
    expect(() => summarizeForEvent(circular)).not.toThrow();
  });

  it('redacts a Bearer token before it reaches an event payload', () => {
    const result = summarizeForEvent('request failed: Authorization: Bearer sk-abcdefghijklmno1234567890');
    expect(result).not.toContain('sk-abcdefghijklmno1234567890');
    expect(result).toContain('[redacted]');
  });
});

describe('redactSecrets', () => {
  it('redacts a Bearer token, keeping surrounding text', () => {
    const result = redactSecrets('failed request: Authorization: Bearer abc.def-ghi_123');
    expect(result).toBe('failed request: Authorization: [redacted]');
  });

  it('redacts common API-key-shaped prefixes (sk-, ghp_, AKIA...)', () => {
    expect(redactSecrets('key=sk-proj-abcdefghijklmnopqrst')).not.toContain('sk-proj-abcdefghijklmnopqrst');
    expect(redactSecrets('token ghp_ABCDEFGHIJ1234567890')).not.toContain('ghp_ABCDEFGHIJ1234567890');
    expect(redactSecrets('AKIAABCDEFGHIJKLMNOP is the key id')).not.toContain('AKIAABCDEFGHIJKLMNOP');
  });

  it('redacts a key=value/json-style secret assignment while keeping the key name visible', () => {
    const result = redactSecrets('{"apiKey": "abcdef123456"}');
    expect(result).not.toContain('abcdef123456');
    expect(result).toContain('apiKey');
  });

  it('leaves ordinary error text with no secret-shaped substring unchanged', () => {
    const text = "ENOENT: no such file or directory, open '/tmp/x.txt'";
    expect(redactSecrets(text)).toBe(text);
  });
});
