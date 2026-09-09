/**
 * compose_runs table operations.
 * The exact request payload is saved BEFORE the n8n call.
 * The response is saved after. This is the audit trail.
 *
 * Server-only. Do not import from client components.
 */

import { getSql } from './db.js';

/**
 * Insert a compose_run row with the request payload BEFORE calling n8n.
 * Returns the created row or null.
 */
export async function createComposeRun({ leadId, requestPayload }) {
  const sql = await getSql();
  if (!sql) return null;

  // Never log the full payload — log only the ID and lead_id
  try {
    const rows = await sql`
      INSERT INTO compose_runs (lead_id, request_payload)
      VALUES (${leadId}, ${JSON.stringify(requestPayload)})
      RETURNING id, lead_id, request_at
    `;
    const row = rows[0] || null;
    if (row) {
      console.info('[compose-runs] created', { runId: row.id, leadId });
    }
    return row;
  } catch (err) {
    console.error('[compose-runs] createComposeRun failed:', err?.message);
    return null;
  }
}

/**
 * Update the compose_run row after n8n responds (or fails/times out).
 */
export async function finishComposeRun({
  runId,
  ok,
  responsePayload,
  error,
  httpStatus,
  durationMs,
  n8nRunId,
}) {
  const sql = await getSql();
  if (!sql || !runId) return;

  try {
    await sql`
      UPDATE compose_runs SET
        response_payload = ${responsePayload ? JSON.stringify(responsePayload) : null},
        response_at = now(),
        ok = ${ok === true},
        error = ${error || null},
        http_status = ${httpStatus || null},
        duration_ms = ${durationMs || null},
        n8n_run_id = ${n8nRunId || null},
        updated_at = now()
      WHERE id = ${runId}
    `;
    console.info('[compose-runs] finished', { runId, ok, durationMs });
  } catch (err) {
    console.error('[compose-runs] finishComposeRun failed:', err?.message);
  }
}

/**
 * Get the most recent successful compose_run for a lead.
 */
export async function getLatestSuccessfulComposeRun(leadId) {
  const sql = await getSql();
  if (!sql || !leadId) return null;

  try {
    const rows = await sql`
      SELECT id, lead_id, response_payload, response_at, n8n_run_id
      FROM compose_runs
      WHERE lead_id = ${leadId} AND ok = true
      ORDER BY response_at DESC
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (err) {
    console.error('[compose-runs] getLatestSuccessfulComposeRun failed:', err?.message);
    return null;
  }
}

/**
 * Get a compose_run by ID. Validates ownership by leadId.
 */
export async function getComposeRunById(runId, leadId) {
  const sql = await getSql();
  if (!sql || !runId) return null;

  try {
    const rows = await sql`
      SELECT id, lead_id, response_payload, ok, error, response_at, n8n_run_id
      FROM compose_runs
      WHERE id = ${runId}
        ${leadId ? sql`AND lead_id = ${leadId}` : sql``}
      LIMIT 1
    `;
    return rows[0] || null;
  } catch (err) {
    console.error('[compose-runs] getComposeRunById failed:', err?.message);
    return null;
  }
}
