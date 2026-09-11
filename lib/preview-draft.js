import { getSession } from './auth';
import { composeJsonToDraft, parseComposeJson } from './compose';
import { DEMO_DRAFT, draftFromBrief, hasRealBrief } from './draft';
import { getLeadByEmail, getLeadById, leadToBriefJson } from './leads';
import { safePreviewToken } from './url';

/**
 * Preview/plate draft for this request. The URL token is the lead id
 * (unguessable UUID); share links load that lead without a session.
 * Saved n8n compose JSON (source:n8n) wins; draftFromBrief is preview
 * fallback only — never a successful compose. Logged-in leads never
 * fall through to Sal’s Pizza. DEMO_DRAFT is only the empty
 * unauthenticated demo token.
 */
export async function loadPreviewDraft(token) {
  const session = getSession();
  const previewToken = safePreviewToken(token);
  let lead = null;

  // The token is the lead id, so a share link resolves without a session. A
  // non-UUID token throws in Postgres — that is a miss, not an error.
  if (previewToken !== 'demo') {
    try {
      lead = await getLeadById(previewToken);
    } catch (err) {
      console.error('[preview] lead load by id failed:', err?.message);
    }
  }

  // No token (bare /preview) or an unknown one: fall back to whoever is signed in.
  if (!lead && session?.email) {
    try {
      lead = await getLeadByEmail(session.email);
    } catch (err) {
      console.error('[preview] lead load failed:', err?.message);
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
