import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { extractPdfText, isPdf } from '../../../../lib/pdf-text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // matches the client-side cap in ArticleDrop

/**
 * Failures are named for the customer, not for the log. Someone who uploads a
 * scan of a newspaper clipping has done nothing wrong and needs to be told the
 * one thing that will work, which is pasting the text.
 */
const REASONS = {
  not_pdf: 'That file is not a readable PDF. If you have the text, paste it instead.',
  no_text_layer:
    'This PDF has no text we can read — it looks like a scan or a photo of the page. Please paste the article text instead.',
  unreadable:
    'We could not read that PDF. Please paste the article text instead, and we will take it from there.',
};

/**
 * POST /api/article/upload — extract the text of an uploaded article PDF.
 *
 * Extraction only: the text is handed back to the brief form, which saves it
 * through PATCH /api/brief like every other field. Keeping one write path means
 * a PDF and a pasted article cannot drift apart.
 */
export async function POST(request) {
  const session = getSession();
  if (!session?.email) {
    return NextResponse.json({ error: 'auth' }, { status: 401 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid upload request.' }, { status: 400 });
  }

  const file = formData.get('article');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'No PDF provided.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ ok: false, error: 'That PDF is empty.' }, { status: 400 });
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'PDF must be under 20 MB.' }, { status: 413 });
  }
  // Trust the bytes, not the declared type.
  if (!isPdf(buffer)) {
    return NextResponse.json({ ok: false, error: REASONS.not_pdf }, { status: 422 });
  }

  const result = extractPdfText(buffer);
  if (!result.ok) {
    console.info('[article/upload] extraction failed:', result.reason);
    return NextResponse.json(
      { ok: false, error: REASONS[result.reason] || REASONS.unreadable, reason: result.reason },
      { status: 422 }
    );
  }

  const words = result.text.split(/\s+/).filter(Boolean).length;
  console.info('[article/upload] extracted', { words, bytes: buffer.length });

  return NextResponse.json({
    ok: true,
    text: result.text,
    words,
    name: typeof file.name === 'string' ? file.name : 'article.pdf',
  });
}
