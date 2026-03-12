/**
 * cryptoService.ts — AES-GCM-256 message encryption via the Web Crypto API.
 *
 * All operations are browser-native (window.crypto.subtle) — no extra
 * dependencies are needed. Keys are generated once per conversation and
 * stored in the `conversationKeys` Firestore collection, access-controlled
 * to the two conversation participants by Security Rules.
 *
 * HIPAA §3.4 — Application-layer encryption before Firestore write so that
 * message content is opaque at the database level.
 */

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_BYTES = 12; // 96-bit IV recommended for AES-GCM

// ─── Key generation ───────────────────────────────────────────────────────────

/** Generate a new AES-GCM-256 key and return it as a base64 string. */
export async function generateConversationKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true, // extractable so we can export and store it
    ['encrypt', 'decrypt']
  );
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufToB64(raw);
}

// ─── Encryption ───────────────────────────────────────────────────────────────

export interface EncryptedPayload {
  iv: string;         // base64-encoded 96-bit IV
  ciphertext: string; // base64-encoded AES-GCM ciphertext + auth tag
}

/** Encrypt a plaintext string with the given base64 key. */
export async function encryptMessage(
  keyB64: string,
  plaintext: string
): Promise<EncryptedPayload> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuf = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

  return {
    iv: bufToB64(iv.buffer),
    ciphertext: bufToB64(cipherBuf),
  };
}

// ─── Decryption ───────────────────────────────────────────────────────────────

/** Decrypt a ciphertext string with the given base64 key and IV. */
export async function decryptMessage(
  keyB64: string,
  iv: string,
  ciphertext: string
): Promise<string> {
  const key = await importKey(keyB64);
  const ivBuf = b64ToBuf(iv);
  const cipherBuf = b64ToBuf(ciphertext);

  const plainBuf = await crypto.subtle.decrypt({ name: ALGO, iv: ivBuf }, key, cipherBuf);
  return new TextDecoder().decode(plainBuf);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = b64ToBuf(keyB64);
  return crypto.subtle.importKey('raw', raw, { name: ALGO }, false, ['encrypt', 'decrypt']);
}

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
