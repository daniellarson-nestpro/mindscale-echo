/**
 * The only module that imports the Anthropic SDK.
 *
 * Everything else in the compose path — prompt assembly, fact hand-off, response
 * shaping — is pure and unit-tested. Keeping the network call behind this single
 * seam is what lets the engine be tested with an injected fake.
 *
 * Server-only.
 */

import Anthropic from '@anthropic-ai/sdk';

export const COMPOSE_MODEL = 'claude-opus-5';

/** Non-streaming ceiling. Stage 2 writes 3–5 short paragraphs; this is ample. */
const MAX_TOKENS = 16000;

let cached = null;

export function isComposeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client() {
  // Resolves ANTHROPIC_API_KEY from the environment.
  if (!cached) cached = new Anthropic();
  return cached;
}

/**
 * Map an SDK failure onto the error vocabulary the compose route already
 * understands. statusForComposeError treats timeout/network as transient (502)
 * and everything else as a terminal 200, so the classification matters.
 */
function classify(err) {
  if (err?.name === 'AbortError' || /timeout/i.test(err?.message || '')) return 'timeout';
  if (err instanceof Anthropic.RateLimitError) return 'network'; // transient; worth a retry
  if (err instanceof Anthropic.APIConnectionError) return 'network';
  if (err instanceof Anthropic.AuthenticationError) return 'compose_failed';
  if (err instanceof Anthropic.APIError && err.status >= 500) return 'network';
  return 'compose_failed';
}

/** Pull the JSON object out of a structured-output response. */
function readStructured(response) {
  if (response?.parsed_output) return response.parsed_output;
  const text = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('');
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    // The schema is enforced server-side, so this should not happen. If it
    // does, report it rather than attempting to repair half-written JSON.
    return null;
  }
}

/**
 * One schema-constrained model call.
 * Returns { ok: true, data } or { ok: false, error }.
 */
export async function callStructuredModel({
  instructions,
  input,
  schema,
  effort = 'high',
  timeoutMs = 60_000,
} = {}) {
  if (!isComposeConfigured()) {
    console.error('[compose] LAUNCH BLOCKER: ANTHROPIC_API_KEY is not set');
    return { ok: false, error: 'unavailable' };
  }

  const started = Date.now();
  try {
    const response = await client().beta.messages.create(
      {
        model: COMPOSE_MODEL,
        max_tokens: MAX_TOKENS,
        // Opus 5 thinks by default; stated explicitly so the intent survives edits.
        thinking: { type: 'adaptive' },
        output_config: {
          effort,
          format: { type: 'json_schema', schema },
        },
        // A release is written about arbitrary real businesses; a policy decline
        // would otherwise end the turn with no draft at all.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: instructions,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
      },
      { timeout: timeoutMs }
    );

    if (response?.stop_reason === 'refusal') {
      console.info('[compose] refused', { category: response?.stop_details?.category });
      return { ok: false, error: 'refused' };
    }

    const data = readStructured(response);
    if (!data) return { ok: false, error: 'compose_failed' };
    return { ok: true, data };
  } catch (err) {
    const error = classify(err);
    console.error('[compose] model call failed:', error, err?.message);
    return { ok: false, error };
  } finally {
    console.info('[compose] model call', { durationMs: Date.now() - started });
  }
}
