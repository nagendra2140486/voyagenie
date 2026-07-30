import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';

export const tripsRouter = Router();

export const tripCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  destination: z.string().trim().min(2).max(120),
  days: z.number().int().min(1).max(60).optional(),
  budget: z.string().trim().max(60).optional(),
  travelType: z.string().trim().max(60).optional(),
  source: z.enum(['ai_itinerary', 'ai_budget', 'manual', 'package']).default('ai_itinerary'),
  itineraryText: z.string().min(1).max(20000),
});

export const tripUpdateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  destination: z.string().trim().min(2).max(120).optional(),
  budget: z.string().trim().max(60).optional(),
});

tripsRouter.get('/', async (req, res) => {
  const rows = await query('SELECT * FROM trips WHERE session_id = $1 ORDER BY created_at DESC', [req.sessionId]);
  res.json({ count: rows.length, trips: rows });
});

tripsRouter.post('/', async (req, res) => {
  const parsed = tripCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'invalid_trip', message: parsed.error.issues[0]?.message ?? 'Invalid trip payload.' });
    return;
  }
  const t = parsed.data;
  const [trip] = await query(
    `INSERT INTO trips (session_id, title, destination, days, budget, travel_type, source, itinerary_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [req.sessionId, t.title, t.destination, t.days ?? null, t.budget ?? null, t.travelType ?? null, t.source, t.itineraryText],
  );
  res.status(201).json({ trip });
});

tripsRouter.get('/:id', async (req, res) => {
  const [trip] = await query('SELECT * FROM trips WHERE id = $1 AND session_id = $2', [
    Number(req.params.id),
    req.sessionId,
  ]);
  if (!trip) {
    res.status(404).json({ code: 'not_found', message: 'Trip not found.' });
    return;
  }
  res.json({ trip });
});

tripsRouter.patch('/:id', async (req, res) => {
  const parsed = tripUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: 'invalid_trip', message: 'Invalid update payload.' });
    return;
  }
  const [trip] = await query(
    `UPDATE trips SET
       title = COALESCE($3, title),
       destination = COALESCE($4, destination),
       budget = COALESCE($5, budget)
     WHERE id = $1 AND session_id = $2 RETURNING *`,
    [Number(req.params.id), req.sessionId, parsed.data.title ?? null, parsed.data.destination ?? null, parsed.data.budget ?? null],
  );
  if (!trip) {
    res.status(404).json({ code: 'not_found', message: 'Trip not found.' });
    return;
  }
  res.json({ trip });
});

tripsRouter.post('/:id/clone', async (req, res) => {
  const [trip] = await query(
    `INSERT INTO trips (session_id, title, destination, days, budget, travel_type, source, itinerary_text)
     SELECT session_id, title || ' (copy)', destination, days, budget, travel_type, source, itinerary_text
     FROM trips WHERE id = $1 AND session_id = $2
     RETURNING *`,
    [Number(req.params.id), req.sessionId],
  );
  if (!trip) {
    res.status(404).json({ code: 'not_found', message: 'Trip not found.' });
    return;
  }
  res.status(201).json({ trip });
});

tripsRouter.delete('/:id', async (req, res) => {
  const rows = await query('DELETE FROM trips WHERE id = $1 AND session_id = $2 RETURNING id', [
    Number(req.params.id),
    req.sessionId,
  ]);
  if (!rows.length) {
    res.status(404).json({ code: 'not_found', message: 'Trip not found.' });
    return;
  }
  res.status(204).send();
});
