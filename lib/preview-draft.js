import { getSession } from './auth';
import { composeJsonToDraft, parseComposeJson } from './compose';
import { DEMO_DRAFT, draftFromBrief, hasRealBrief } from './draft';
import { getLeadByEmail, leadToBriefJson } from './leads';
import { safePreviewToken } from './url';

/**
 * Preview/plate draft for this request. Logged-in leads never fall through
 * to Sal’s Pizza. Saved n8n compose JSON (source:n8n) wins; draftFromBrief
 * is preview fallback only — never a successful compose. DEMO_DRAFT is
 * only the empty unauthenticated demo token.
 */
export async function loadPreviewDraft(token) {
  const session = getSession();
  let lead = null;
  if (session?.email) {
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

  const previewToken = safePreviewToken(token);
  if (previewToken === 'demo') return DEMO_DRAFT;
  return draftFromBrief({});
}
