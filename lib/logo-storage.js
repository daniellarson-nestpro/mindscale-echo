/**
 * Logo storage adapter.
 *
 * Vercel Blob is the preferred provider (BLOB_READ_WRITE_TOKEN).
 * If no provider is configured, every upload returns a launch-blocker error
 * rather than silently discarding the file. Never store only the filename.
 *
 * Server-only. Do not import from client components.
 *
 * Static import of @vercel/blob is required so Next.js bundles it into the
 * serverless function. A dynamic import was omitted from the Preview bundle
 * and put() never ran.
 */

import { put } from '@vercel/blob';

const MAX_LOGO_BYTES = 8 * 1024 * 1024; // 8 MB generous limit after client downscale
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const SIGNATURES = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
];

export function isLogoStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function inferImageMime(buffer) {
  if (!buffer || !buffer.length) return '';
  for (const sig of SIGNATURES) {
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    if (sig.bytes.every((b, i) => buffer[offset + i] === b)) return sig.mime;
  }
  const head = Buffer.from(buffer.slice(0, 256)).toString('utf8');
  if (/<svg[\s>]/i.test(head) || head.trimStart().startsWith('<?xml')) {
    return 'image/svg+xml';
  }
  return '';
}

function checkMimeSignature(buffer, declaredMime) {
  if (declaredMime === 'image/svg+xml') return true;
  for (const sig of SIGNATURES) {
    if (sig.mime !== declaredMime) continue;
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) return false;
    return sig.bytes.every((b, i) => buffer[offset + i] === b);
  }
  return true;
}

/**
 * Validate an uploaded logo Buffer/Uint8Array.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function validateLogoBuffer(buffer, mimeType, fileSize) {
  if (!ALLOWED_MIME.has(mimeType)) {
    return { ok: false, error: 'Logo must be PNG, JPEG, WebP, or SVG.' };
  }
  if (fileSize > MAX_LOGO_BYTES) {
    return { ok: false, error: 'Logo file is too large (max 8 MB).' };
  }
  if (buffer && !checkMimeSignature(buffer, mimeType)) {
    return { ok: false, error: 'Logo file type does not match its content.' };
  }
  return { ok: true };
}

export function blobPutOptions({ mimeType, token, access = 'public' }) {
  const options = {
    access,
    contentType: mimeType,
    addRandomSuffix: true,
  };
  // Pass the RW token explicitly. On Vercel, VERCEL_OIDC_TOKEN + BLOB_STORE_ID
  // otherwise take precedence and ignore BLOB_READ_WRITE_TOKEN, which 502s
  // when OIDC is not enabled for that environment.
  if (token) options.token = token;
  return options;
}

export function shouldRetryAsPrivate(err) {
  const msg = String(err?.message || err || '');
  return /private store|must be ['"]?private|access.*private|not a public store|public access/i.test(
    msg
  );
}

/**
 * put() with public access first (letterhead img src), then private if the
 * store forbids public blobs.
 */
export async function putLogoBlob(pathname, body, { mimeType, token, putImpl = put } = {}) {
  const publicOpts = blobPutOptions({ mimeType, token, access: 'public' });
  try {
    return await putImpl(pathname, body, publicOpts);
  } catch (err) {
    if (!shouldRetryAsPrivate(err)) throw err;
    const privateOpts = blobPutOptions({ mimeType, token, access: 'private' });
    return await putImpl(pathname, body, privateOpts);
  }
}

function toPutBody(buffer) {
  // Uint8Array is a valid fetch body; Node Buffer has caused undici TypeErrors
  // in some serverless runtimes.
  if (buffer instanceof Uint8Array) return buffer;
  return new Uint8Array(buffer);
}

/**
 * Store a logo blob.
 * Returns { ok: true, key, url, name, type, size } or { ok: false, error }.
 */
export async function storeLogo({ buffer, mimeType, originalName, leadId, putImpl }) {
  if (!isLogoStorageConfigured()) {
    console.error('[logo-storage] LAUNCH BLOCKER: BLOB_READ_WRITE_TOKEN is not set');
    return {
      ok: false,
      error:
        'Logo storage is not configured. Add BLOB_READ_WRITE_TOKEN to your environment (see README).',
      launchBlocker: true,
    };
  }

  const resolvedMime = ALLOWED_MIME.has(mimeType) ? mimeType : inferImageMime(buffer);
  const validation = validateLogoBuffer(buffer, resolvedMime, buffer?.length ?? 0);
  if (!validation.ok) return validation;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const ext = extensionFor(resolvedMime);
  const key = `logos/${leadId}/${Date.now()}-${sanitizeName(originalName)}${ext}`;

  try {
    const blob = await putLogoBlob(key, toPutBody(buffer), {
      mimeType: resolvedMime,
      token,
      putImpl,
    });
    return {
      ok: true,
      key: blob.pathname || key,
      url: blob.url,
      name: originalName,
      type: resolvedMime,
      size: buffer.length,
    };
  } catch (err) {
    console.error('[logo-storage] upload failed:', err?.name || 'Error', err?.message);
    return { ok: false, error: 'Logo upload failed. Please try again.' };
  }
}

function sanitizeName(name) {
  if (!name) return 'logo';
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
}

function extensionFor(mime) {
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/svg+xml':
      return '.svg';
    default:
      return '';
  }
}
