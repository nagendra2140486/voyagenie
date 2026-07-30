import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db.js';
import type { AiServiceMeta } from './aiClient.js';

export interface CachedResponse {
  content: string;
  meta: AiServiceMeta;
}

export const promptHash = (feature: string, payload: unknown): string =>
  createHash('sha256')
    .update(`${config.llm.provider}:${config.llm.model}:${feature}:${JSON.stringify(payload)}`)
    .digest('hex');

export const readCache = async (hash: string): Promise<CachedResponse | null> => {
  if (!config.llm.cacheEnabled) return null;
  const rows = await query<{ response_json: CachedResponse }>(
    'SELECT response_json FROM llm_cache WHERE prompt_hash = $1',
    [hash],
  );
  return rows[0]?.response_json ?? null;
};

export const writeCache = async (hash: string, feature: string, response: CachedResponse): Promise<void> => {
  if (!config.llm.cacheEnabled) return;
  await query(
    `INSERT INTO llm_cache (prompt_hash, feature, provider, model, response_json)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (prompt_hash) DO UPDATE SET response_json = EXCLUDED.response_json, created_at = now()`,
    [hash, feature, config.llm.provider, config.llm.model, JSON.stringify(response)],
  );
};
