const encoder = new TextEncoder();
const decoder = new TextDecoder();

/*
 * AES-GCM's recommended nonce length (NIST SP 800-38D) -- also doubles as authenticated
 * encryption, unlike AES-CBC, so tampered ciphertext fails decrypt() loudly instead of
 * silently producing garbage plaintext.
 */
const IV_LENGTH = 12;

export async function encrypt(key: string, data: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await getKey(key);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    cryptoKey,
    encoder.encode(data),
  );

  const bundle = new Uint8Array(IV_LENGTH + ciphertext.byteLength);

  bundle.set(new Uint8Array(ciphertext));
  bundle.set(iv, ciphertext.byteLength);

  return decodeBase64(bundle);
}

export async function decrypt(key: string, payload: string) {
  const bundle = encodeBase64(payload);

  /*
   * .slice() copies into a fresh, offset-0 buffer, so this is correct regardless of the
   * source Uint8Array's own byteOffset -- unlike a raw `new Uint8Array(bundle.buffer, ...)`
   * view, which would silently read the wrong bytes if bundle ever came from a sliced/offset
   * buffer instead of encodeBase64()'s own always-offset-0 output.
   */
  const iv = bundle.slice(bundle.byteLength - IV_LENGTH);
  const ciphertext = bundle.slice(0, bundle.byteLength - IV_LENGTH);

  const cryptoKey = await getKey(key);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    cryptoKey,
    ciphertext,
  );

  return decoder.decode(plaintext);
}

/**
 * Given a raw key handle, wraps it for AES-GCM use. Deliberately has no key-generation or
 * key-storage logic of its own -- callers are expected to source `key` from a platform-backed
 * keystore (e.g. Android Keystore via a future secure-storage bridge) rather than a plain
 * passphrase, since this module has no KDF/salt/stretching step.
 */
async function getKey(key: string) {
  return await crypto.subtle.importKey('raw', encodeBase64(key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function decodeBase64(encoded: Uint8Array) {
  const byteChars = Array.from(encoded, (byte) => String.fromCodePoint(byte));

  return btoa(byteChars.join(''));
}

function encodeBase64(data: string) {
  return Uint8Array.from(atob(data), (ch) => ch.codePointAt(0)!);
}
