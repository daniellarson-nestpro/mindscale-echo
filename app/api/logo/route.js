import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { isDatabaseConfigured } from '../../../lib/db';
import { getLeadByEmail } from '../../../lib/leads';
import { isLogoStorageConfigured, storeLogo, validateLogoBuffer } from '../../../lib/logo-storage';
import { saveLogoOnLead } from '../../../lib/leads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * POST /api/logo — multipart upload of a business logo.
 * Requires authentication. Validates MIME/signature, stores durably.
 * Returns { ok, logoUrl, logoKey, name, type, size } or { ok:false, error }.
 */
export async function POST(request) {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'auth' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  // Launch blocker: no storage = clear error, not silent discard
  if (!isLogoStorageConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Logo storage is not configured. Add BLOB_READ_WRITE_TOKEN to your environment before accepting logo uploads.',
        launchBlocker: true,
      },
      { status: 503 }
    );
  }

  let lead;
  try {
    lead = await getLeadByEmail(session.email);
  } catch (err) {
    console.error('[api/logo] lead lookup failed:', err?.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  if (!lead?.id) {
    return NextResponse.json({ error: 'No lead found. Please start your brief first.' }, { status: 404 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 });
  }

  const file = formData.get('logo');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No logo file provided.' }, { status: 400 });
  }

  const mimeType = file.type || '';
  const originalName = file.name || 'logo';

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Logo file is empty.' }, { status: 400 });
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Logo file is too large (max 8 MB).' }, { status: 413 });
  }

  const validation = validateLogoBuffer(buffer, mimeType, buffer.length);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 422 });
  }

  const stored = await storeLogo({ buffer, mimeType, originalName, leadId: lead.id });
  if (!stored.ok) {
    return NextResponse.json({ ok: false, error: stored.error, launchBlocker: stored.launchBlocker }, { status: stored.launchBlocker ? 503 : 502 });
  }

  // Save logo metadata onto the lead
  try {
    await saveLogoOnLead({
      leadId: lead.id,
      storageKey: stored.key,
      storageUrl: stored.url,
      name: stored.name,
      type: stored.type,
      size: stored.size,
    });
  } catch (err) {
    console.error('[api/logo] save logo on lead failed:', err?.message);
    // Storage succeeded but DB write failed — not fatal for the user
  }

  console.info('[api/logo] logo stored', { leadId: lead.id, type: stored.type });

  return NextResponse.json({
    ok: true,
    logoUrl: stored.url,
    logoKey: stored.key,
    name: stored.name,
    type: stored.type,
    size: stored.size,
  });
}
