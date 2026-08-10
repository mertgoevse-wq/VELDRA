import { describe, expect, it } from 'vitest';
import { isValidSessionState, isValidWorkspaceState } from './androidFallbackStorage';

describe('isValidWorkspaceState', () => {
  it('accepts a well-formed workspace record', () => {
    expect(
      isValidWorkspaceState({
        key: 'workspace',
        files: { '/home/project/a.txt': { type: 'file', content: 'hi' } },
        deletedPaths: [],
        updatedAt: '2026-08-10T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('accepts an empty (default-shaped) workspace record', () => {
    expect(isValidWorkspaceState({ key: 'workspace', files: {}, deletedPaths: [] })).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'workspace'],
    ['wrong key', { key: 'session', files: {}, deletedPaths: [] }],
    ['missing files', { key: 'workspace', deletedPaths: [] }],
    ['files not an object', { key: 'workspace', files: 'oops', deletedPaths: [] }],
    ['files is null', { key: 'workspace', files: null, deletedPaths: [] }],
    ['deletedPaths not an array', { key: 'workspace', files: {}, deletedPaths: 'oops' }],
    ['missing deletedPaths', { key: 'workspace', files: {} }],
  ])('rejects a corrupted record: %s', (_label, value) => {
    expect(isValidWorkspaceState(value)).toBe(false);
  });
});

describe('isValidSessionState', () => {
  it('accepts a well-formed session record', () => {
    expect(
      isValidSessionState({
        key: 'session',
        activeWorkspace: 'default',
        updatedAt: '2026-08-10T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['wrong key', { key: 'workspace', activeWorkspace: 'default' }],
    ['missing activeWorkspace', { key: 'session' }],
    ['activeWorkspace not a string', { key: 'session', activeWorkspace: 123 }],
  ])('rejects a corrupted record: %s', (_label, value) => {
    expect(isValidSessionState(value)).toBe(false);
  });
});
