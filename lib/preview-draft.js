import { getSession } from './auth';
import { DEMO_DRAFT, draftFromBrief, hasRealBrief } from './draft';
import { getLeadByEmail, leadToBriefJson } from './leads';
import { safePreviewToken } from './url';

/**
 * Preview/plate draft for this request. Logged-in leads never fall through
 * to Sal’s Pizza. DEMO_DRAFT is only the empty unauthenticated demo token.
 * HOOK: swap in draft_body when the composer exists. Do not call n8n.
 */
export async function loadPreviewDraft(token) {
  const session = getSession();
  let brief = null;
  if (session?.email) {
    try {
      const lead = await getLeadByEmail(session.email);
      brief = leadToBriefJson(lead).brief;
    } catch (err) {
      console.error('[preview] lead load failed:', err?.message);
    }
  }

  if (session?.email || hasRealBrief(brief)) {
    return draftFromBrief(brief || {});
  }

  const previewToken = safePreviewToken(token);
  if (previewToken === 'demo') return DEMO_DRAFT;
  return draftFromBrief({});
}
