import { getSession } from './auth';
import { composeJsonToDraft, parseComposeJson } from './compose';
import { DEMO_DRAFT, draftFromBrief, hasRealBrief } from './draft';
import { getLeadByEmail, getLeadById, leadToBriefJson } from './leads';
import { safePreviewToken } from './url';

/**
 * Preview/plate draft for this request. Logged-in leads never fall through
 * to Sal’s Pizza. Saved n8n compose JSON (source:n8n) wins; draftFromBrief
 * is preview fallback only — never a successful compose. DEMO_DRAFT is
 * only the empty unauthenticated demo token.
 *
 * The session wins when it has a lead, because /preview with no token segment
 * of your own must still show your draft. Otherwise the token is resolved:
 * previewTokenFor(lead) is the lead id, so /preview/<token>?shared=1 is
 * readable by whoever holds it — that is the product promise on the share
 * button ("Read-only link. They don't need an account."), not an oversight.
 * A garbage token is a miss, not an error: leads.id is a UUID, so a lookup
 * with a non-UUID token throws in Postgres and must be swallowed here.
 */
export async function loadPreviewDraft(token) {
  const session = getSession();
  const previewToken = safePreviewToken(token);
  let lead = null;
  if (session?.email) {
    try {
      lead = await getLeadByEmail(session.email);
    } catch (err) {
      console.error('[preview] lead load failed:', err?.message);
    }
  }

  if (!lead && previewToken !== 'demo') {
    try {
      lead = await getLeadById(previewToken);
    } catch (err) {
      console.error('[preview] token lead load failed:', err?.message);
    }
  }

  const brief = leadToBriefJson(lead).brief;
  const saved = parseComposeJson(lead?.compose_json);
  if (saved?.source === 'n8n') return composeJsonToDraft(saved, brief || {});

  if (session?.email || hasRealBrief(brief)) {
    return draftFromBrief(brief || {});
  }

  if (previewToken === 'demo') return DEMO_DRAFT;
  return draftFromBrief({});
}
