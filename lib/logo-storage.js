/**
 * Logo storage adapter.
 *
 * Vercel Blob is the preferred provider (BLOB_READ_WRITE_TOKEN).
 * If no provider is configured, every upload returns a launch-blocker error
 * rather than silently discarding the file. Never store only the filename.
 *
 * Server-only. Do not import from client components.
 */

const MAX_LOGO_BYTES = 8 * 1024 * 1024; // 8 MB generous limit after client downscale
// SVG is deliberately absent. It is a scriptable document, and blob storage
// serves what we upload with the content type we hand it, so an <svg> carrying
// <script> becomes stored XSS on the blob origin the moment anyone opens the
// URL. Raster formats only; there is no sanitizer here to get wrong.
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
// Every allowed type has magic bytes, so no format gets a free pass below.
const SIGNATURES = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
];

export function isLogoStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function checkMimeSignature(buffer, declaredMime) {
  for (const sig of SIGNATURES) {
    if (sig.mime !== declaredMime) continue;
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) return false;
    return sig.bytes.every((b, i) => buffer[offset + i] === b);
  }
  return false; // no signature on file for this mime — refuse rather than trust it
}

/**
 * Validate an uploaded logo Buffer/Uint8Array.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export function validateLogoBuffer(buffer, mimeType, fileSize) {
  if (!ALLOWED_MIME.has(mimeType)) {
    return { ok: false, error: 'Logo must be a PNG, JPEG, or WebP image.' };
  }
  if (fileSize > MAX_LOGO_BYTES) {
    return { ok: false, error: 'Logo file is too large (max 8 MB).' };
  }
  if (buffer && !checkMimeSignature(buffer, mimeType)) {
    return { ok: false, error: 'Logo file type does not match its content.' };
  }
  return { ok: true };
}

/**
 * Store a logo blob.
 * Returns { ok: true, key, url, name, type, size } or { ok: false, error }.
 */
export async function storeLogo({ buffer, mimeType, originalName, leadId }) {
  if (!isLogoStorageConfigured()) {
    console.error('[logo-storage] LAUNCH BLOCKER: BLOB_READ_WRITE_TOKEN is not set');
    return {
      ok: false,
      error:
        'Logo storage is not configured. Add BLOB_READ_WRITE_TOKEN to your environment (see README).',
      launchBlocker: true,
    };
  }

  // Validate before storage
  const validation = validateLogoBuffer(buffer, mimeType, buffer?.length ?? 0);
  if (!validation.ok) return validation;

  try {
    // Dynamic import to avoid bundling @vercel/blob in environments without it
    const { put } = await import('@vercel/blob');
    const ext = extensionFor(mimeType);
    const key = `logos/${leadId}/${Date.now()}-${sanitizeName(originalName)}${ext}`;
    const blob = await put(key, buffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return {
      ok: true,
      key: blob.pathname || key,
      url: blob.url,
      name: originalName,
      type: mimeType,
      size: buffer.length,
    };
  } catch (err) {
    console.error('[logo-storage] upload failed:', err?.message);
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
    default:
      return '';
  }
}
