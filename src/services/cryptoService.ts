/**
 * cryptoService.ts — AES-GCM-256 message encryption/decryption.
 * Used by firebaseService for end-to-end encrypted messaging (Block 3).
 * All keys are generated in the browser and stored per-conversation in
 * Firestore, access-controlled to the two participants by Security Rules.
 */

/** Generate a new AES-GCM-256 key and return it as a base64 string. */
export async function generateConversationKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/** Encrypt a plaintext message. Returns base64-encoded IV and ciphertext. */
export async function encryptMessage(
  keyBase64: string,
  plaintext: string
): Promise<{ iv: string; ciphertext: string }> {
  const keyBytes  = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const encoded   = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
  return {
    iv:         btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
}

/** Decrypt a ciphertext that was produced by encryptMessage. */
export async function decryptMessage(
  keyBase64: string,
  ivBase64:  string,
  ciphertext: string
): Promise<string> {
  const keyBytes  = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv        = Uint8Array.from(atob(ivBase64),  (c) => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);
  return new TextDecoder().decode(decrypted);
}
