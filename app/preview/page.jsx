import { redirect } from 'next/navigation';
import { getSession } from '../../lib/auth';
import { hasN8nCompose } from '../../lib/compose';
import { previewIndexPathFor } from '../../lib/funnel-gates';
import { getLeadByEmail } from '../../lib/leads';

export const dynamic = 'force-dynamic';

/**
 * No token. Signed out: the marketing demo. Signed in with a saved draft:
 * that draft. Signed in with nothing written yet: the brief, never a
 * placeholder release built from the brief fields.
 */
export default async function PreviewIndex() {
  const session = getSession();
  const sessionEmail = session?.email || '';
  let lead = null;
  if (sessionEmail) {
    try {
      lead = await getLeadByEmail(sessionEmail);
    } catch (err) {
      console.error('[preview] lead load failed:', err?.message);
    }
  }
  redirect(previewIndexPathFor({ sessionEmail, lead, hasRealDraft: hasN8nCompose(lead) }));
}
