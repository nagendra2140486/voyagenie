import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';

export const destinationsRouter = Router();

export const destinationFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  budget: z.enum(['low', 'medium', 'high']).optional(),
  season: z.string().trim().max(60).optional(),
  style: z.string().trim().max(60).optional(),
});

destinationsRouter.get('/', async (req, res) => {
  const parsed = destinationFiltersSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ code: 'invalid_filters', message: 'One or more filters are invalid.' });
    return;
  }
  const { q, country, budget, season, style } = parsed.data;

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(city ILIKE $${params.length} OR country ILIKE $${params.length} OR summary ILIKE $${params.length})`);
  }
  if (country) {
    params.push(country);
    clauses.push(`country = $${params.length}`);
  }
  if (budget) {
    params.push(budget);
    clauses.push(`budget_level = $${params.length}`);
  }
  if (season) {
    params.push(`%${season}%`);
    clauses.push(`best_season ILIKE $${params.length}`);
  }
  if (style) {
    params.push(style);
    clauses.push(`travel_style = $${params.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM destinations ${where} ORDER BY city`, params);
  res.json({ count: rows.length, destinations: rows });
});

destinationsRouter.get('/filters', async (_req, res) => {
  const [countries, styles, seasons] = await Promise.all([
    query<{ country: string }>('SELECT DISTINCT country FROM destinations ORDER BY country'),
    query<{ travel_style: string }>('SELECT DISTINCT travel_style FROM destinations ORDER BY travel_style'),
    query<{ best_season: string }>('SELECT DISTINCT best_season FROM destinations ORDER BY best_season'),
  ]);
  res.json({
    countries: countries.map((c) => c.country),
    styles: styles.map((s) => s.travel_style),
    seasons: seasons.map((s) => s.best_season),
    budgetLevels: ['low', 'medium', 'high'],
  });
});

destinationsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ code: 'invalid_id', message: 'Destination id must be an integer.' });
    return;
  }
  const [destination] = await query<{ id: number; country: string; travel_style: string }>(
    'SELECT * FROM destinations WHERE id = $1',
    [id],
  );
  if (!destination) {
    res.status(404).json({ code: 'not_found', message: 'Destination not found.' });
    return;
  }
  const [related, packages] = await Promise.all([
    query(
      `SELECT id, city, country, summary, image_url, budget_level FROM destinations
       WHERE id <> $1 AND (country = $2 OR travel_style = $3) ORDER BY random() LIMIT 3`,
      [id, destination.country, destination.travel_style],
    ),
    query('SELECT * FROM packages WHERE destination_id = $1', [id]),
  ]);
  res.json({ destination, related, packages });
});
