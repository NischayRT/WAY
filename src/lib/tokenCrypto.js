import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encryption at rest for OAuth tokens (Google Health, Strava).
 *
 * Tokens live in tables the signed-in user can read with the public anon
 * key, so a cross-site-scripting bug or a malicious browser extension could
 * otherwise lift a long-lived Google refresh token straight from the
 * database. With this, the database only ever holds ciphertext; the key
 * stays on the server (Vercel env TOKEN_ENCRYPTION_KEY) and never reaches
 * the browser.
 *
 * Format: enc:v1:<iv>:<tag>:<ciphertext>  (AES-256-GCM, base64url parts)
 *
 * Rollout-safe: values without the prefix are treated as legacy plaintext
 * and re-encrypted the next time they are written. In production a missing
 * key is an error: tokens are never stored unencrypted there. Elsewhere
 * (local dev, preview deployments without the key) they are stored as before
 * with a warning, so development never breaks.
 */

const PREFIX = 'enc:v1:';

// Vercel production (or any production build outside Vercel).
function isProduction() {
  return process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : process.env.NODE_ENV === 'production';
}
let warned = false;

function key() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    if (isProduction()) {
      throw new Error('TOKEN_ENCRYPTION_KEY is not set; refusing to store OAuth tokens unencrypted in production.');
    }
    if (!warned) {
      console.warn('[tokenCrypto] TOKEN_ENCRYPTION_KEY is not set; OAuth tokens are stored unencrypted.');
      warned = true;
    }
    return null;
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).');
  }
  return buf;
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptToken(plain) {
  if (plain == null || plain === '') return plain;
  const k = key();
  if (!k) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ct.toString('base64url')}`;
}

export function decryptToken(stored) {
  if (!isEncrypted(stored)) return stored; // legacy plaintext (or null)
  const k = key();
  if (!k) throw new Error('Encrypted token found but TOKEN_ENCRYPTION_KEY is not set.');
  const [iv, tag, ct] = stored.slice(PREFIX.length).split(':');
  const tagBuf = Buffer.from(tag ?? '', 'base64url');
  if (tagBuf.length !== 16) throw new Error('Malformed encrypted token.');
  const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'), { authTagLength: 16 });
  decipher.setAuthTag(tagBuf);
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8');
}
