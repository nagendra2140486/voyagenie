import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';

export const contactRouter = Router();

export const inquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(2000),
});

contactRouter.post('/', async (req, res) => {
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: 'invalid_inquiry',
      message: parsed.error.issues[0]?.message ?? 'Invalid inquiry payload.',
      field: parsed.error.issues[0]?.path.join('.'),
    });
    return;
  }
  const { name, email, subject, message } = parsed.data;
  const [inquiry] = await query<{ id: number; created_at: string }>(
    'INSERT INTO contact_inquiries (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
    [name, email, subject ?? null, message],
  );
  res.status(201).json({ inquiry });
});

contactRouter.get('/', async (_req, res) => {
  const rows = await query('SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 50');
  res.json({ count: rows.length, inquiries: rows });
});
