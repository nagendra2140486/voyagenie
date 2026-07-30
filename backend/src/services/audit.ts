import { config } from '../config.js';
import { query } from '../db.js';

export interface AuditEntry {
  sessionId: string;
  feature: string;
  status: string;
  detail?: string;
  provider?: string;
  model?: string;
  promptChars?: number;
  tokenEstimate?: number;
  latencyMs?: number;
  cached?: boolean;
}

/** Records LLM usage for governance. API keys are never part of the payload. */
export const recordAudit = async (entry: AuditEntry): Promise<void> => {
  await query(
    `INSERT INTO llm_audit_log
       (session_id, feature, provider, model, status, detail, prompt_chars, token_estimate, latency_ms, cached)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      entry.sessionId,
      entry.feature,
      entry.provider ?? config.llm.provider,
      entry.model ?? config.llm.model,
      entry.status,
      entry.detail ?? null,
      entry.promptChars ?? 0,
      entry.tokenEstimate ?? 0,
      entry.latencyMs ?? 0,
      entry.cached ?? false,
    ],
  );
};

export interface AuditRow {
  id: number;
  session_id: string;
  feature: string;
  provider: string;
  model: string;
  status: string;
  detail: string | null;
  prompt_chars: number;
  token_estimate: number;
  latency_ms: number;
  cached: boolean;
  created_at: string;
}

export const listAudit = async (limit: number): Promise<AuditRow[]> =>
  query<AuditRow>('SELECT * FROM llm_audit_log ORDER BY created_at DESC, id DESC LIMIT $1', [limit]);

export const auditSummary = async (): Promise<Record<string, number>> => {
  const rows = await query<{ status: string; count: string }>(
    'SELECT status, COUNT(*)::text AS count FROM llm_audit_log GROUP BY status',
  );
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
};
