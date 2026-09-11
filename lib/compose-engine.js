/**
 * Two-stage press-release composer.
 *
 *   1. Extract structured facts from the customer's article clip.
 *   2. Write the release from those facts ALONE.
 *
 * Stage 2 never sees the clip. That is the whole design: a writer given the
 * original article paraphrases the journalist and pads with invented colour,
 * and this product publishes about real businesses under their own name.
 *
 * Replaces the n8n webhook. The result contract is unchanged from the old
 * callN8nCompose — { ok, draft, error, status } — so the compose route, the
 * lock, and compose_runs did not have to move.
 */

import {
  DRAFT_INSTRUCTIONS,
  DRAFT_SCHEMA,
  FACTS_INSTRUCTIONS,
  FACTS_SCHEMA,
  buildDraftInput,
  buildFactsInput,
} from './compose-prompt.js';

/** Extraction is mechanical; composition is the part worth spending on. */
const FACTS_EFFORT = 'medium';
const DRAFT_EFFORT = 'high';

const FACTS_TIMEOUT_MS = 45_000;
const DRAFT_TIMEOUT_MS = 90_000;

/** Transient failures are worth a retry; everything else is terminal. */
const TRANSIENT = new Set(['timeout', 'network']);

function statusFor(error) {
  if (!error) return 200;
  return TRANSIENT.has(error) ? 502 : 200;
}

function fail(error, stage) {
  return { ok: false, error: error || 'compose_failed', stage, status: statusFor(error) };
}

/**
 * Compose a release from a buildComposePayload() payload.
 *
 * `callModel` is injected so the orchestration can be tested without the SDK or
 * a network. Production passes the real callStructuredModel.
 */
export async function composeRelease(payload = {}, { callModel } = {}) {
  if (typeof callModel !== 'function') return fail('unavailable', 'config');

  // ---- Stage 1: facts -----------------------------------------------------
  const factsCall = await callModel({
    instructions: FACTS_INSTRUCTIONS,
    input: buildFactsInput(payload),
    schema: FACTS_SCHEMA,
    effort: FACTS_EFFORT,
    timeoutMs: FACTS_TIMEOUT_MS,
  });

  if (!factsCall?.ok) return fail(factsCall?.error, 'facts');

  const facts = factsCall.data;
  if (!facts || facts.ok !== true) {
    // The extractor could not find a real event in the clip. That is a content
    // problem, not an outage — surface the reason it gave.
    return fail(facts?.error || 'fact_extract_failed', 'facts');
  }

  // ---- Stage 2: composition ----------------------------------------------
  const draftCall = await callModel({
    instructions: DRAFT_INSTRUCTIONS,
    input: buildDraftInput(payload, facts),
    schema: DRAFT_SCHEMA,
    effort: DRAFT_EFFORT,
    timeoutMs: DRAFT_TIMEOUT_MS,
  });

  if (!draftCall?.ok) return fail(draftCall?.error, 'draft');

  const draft = draftCall.data;
  if (!draft || draft.ok !== true) return fail(draft?.error || 'compose_failed', 'draft');

  return { ok: true, draft, status: 200 };
}
