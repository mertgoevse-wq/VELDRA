import { afterEach, describe, expect, it } from 'vitest';
import { androidActiveChatId, startNewAndroidChat } from './androidChatSession';

describe('androidActiveChatId', () => {
  afterEach(() => {
    androidActiveChatId.set(undefined);
  });

  it('starts undefined (no active chat)', () => {
    expect(androidActiveChatId.get()).toBeUndefined();
  });

  it('holds whatever chat id is set', () => {
    androidActiveChatId.set('chat-123');
    expect(androidActiveChatId.get()).toBe('chat-123');
  });

  it('startNewAndroidChat resets it to undefined', () => {
    androidActiveChatId.set('chat-123');
    startNewAndroidChat();
    expect(androidActiveChatId.get()).toBeUndefined();
  });
});
