/** Applies db/schema.sql and db/seed.sql against DATABASE_URL. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../db');

const run = async (file: string): Promise<void> => {
  const sql = await fs.readFile(path.join(dbDir, file), 'utf8');
  await pool.query(sql);
  console.log(`applied ${file}`);
};

await run('schema.sql');
await run('seed.sql');
await pool.end();
