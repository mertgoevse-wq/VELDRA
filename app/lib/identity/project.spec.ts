// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { getCurrentProject, getCurrentProjectId } from './project';

describe('project identity', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('derives the current project ID from the chat URL, matching getCurrentChatId', () => {
    window.history.pushState({}, '', '/chat/abc123');
    expect(getCurrentProjectId()).toBe('abc123');
  });

  it('falls back to "default" outside a /chat/:id route, same as chat identity does', () => {
    window.history.pushState({}, '', '/settings');
    expect(getCurrentProjectId()).toBe('default');
  });

  it('getCurrentProject wraps the ID in a real ProjectIdentity object', () => {
    window.history.pushState({}, '', '/chat/xyz789');
    expect(getCurrentProject()).toEqual({ id: 'xyz789' });
  });
});
