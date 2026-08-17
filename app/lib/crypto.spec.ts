import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto';

/*
 * A fixed 32-byte (AES-256) raw key, base64-encoded -- what a real caller would source from a
 * platform keystore rather than a passphrase (this module has no KDF of its own).
 */
const TEST_KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 1)));

describe('crypto (AES-GCM)', () => {
  it('round-trips plaintext through encrypt/decrypt', async () => {
    const plaintext = 'sk-ant-super-secret-provider-token';

    const ciphertext = await encrypt(TEST_KEY, plaintext);
    const decrypted = await decrypt(TEST_KEY, ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext across calls (random IV)', async () => {
    const plaintext = 'same input, different output';

    const first = await encrypt(TEST_KEY, plaintext);
    const second = await encrypt(TEST_KEY, plaintext);

    expect(first).not.toBe(second);
  });

  it('rejects tampered ciphertext instead of silently returning garbage (the AES-GCM vs AES-CBC fix)', async () => {
    const ciphertext = await encrypt(TEST_KEY, 'do not tamper with me');

    // Flip one base64 character in the middle of the payload to simulate corruption/tampering.
    const midpoint = Math.floor(ciphertext.length / 2);
    const flippedChar = ciphertext[midpoint] === 'A' ? 'B' : 'A';
    const tampered = ciphertext.slice(0, midpoint) + flippedChar + ciphertext.slice(midpoint + 1);

    await expect(decrypt(TEST_KEY, tampered)).rejects.toThrow();
  });

  it('fails decrypt with the wrong key rather than returning garbage plaintext', async () => {
    const ciphertext = await encrypt(TEST_KEY, 'only readable with the right key');
    const wrongKey = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => 32 - i)));

    await expect(decrypt(wrongKey, ciphertext)).rejects.toThrow();
  });
});
