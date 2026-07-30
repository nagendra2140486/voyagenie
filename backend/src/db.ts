import pg from 'pg';
import { config } from './config.js';

// `pg` is CommonJS; named ESM imports are not available from it.
export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export const query = async <T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const result = await pool.query(text, params);
  return result.rows as T[];
};
