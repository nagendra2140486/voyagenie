import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';

export const packagesRouter = Router();

const listSchema = z.object({
  style: z.string().trim().max(60).optional(),
  maxPrice: z.coerce.number().int().positive().max(100000).optional(),
});

const SELECT_PACKAGES = `
  SELECT p.*, d.city AS destination_city, d.country AS destination_country
  FROM packages p LEFT JOIN destinations d ON d.id = p.destination_id`;

packagesRouter.get('/', async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ code: 'invalid_filters', message: 'One or more filters are invalid.' });
    return;
  }
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (parsed.data.style) {
    params.push(parsed.data.style);
    clauses.push(`p.travel_style = $${params.length}`);
  }
  if (parsed.data.maxPrice) {
    params.push(parsed.data.maxPrice);
    clauses.push(`p.price_from_usd <= $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(`${SELECT_PACKAGES} ${where} ORDER BY p.price_from_usd`, params);
  res.json({ count: rows.length, packages: rows });
});

packagesRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ code: 'invalid_id', message: 'Package id must be an integer.' });
    return;
  }
  const [pkg] = await query(`${SELECT_PACKAGES} WHERE p.id = $1`, [id]);
  if (!pkg) {
    res.status(404).json({ code: 'not_found', message: 'Package not found.' });
    return;
  }
  res.json({ package: pkg });
});
