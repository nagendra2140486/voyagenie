import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query } from '../db.js';

export const contactRouter = Router();

const hourWindow = (): Date => {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now;
};

/**
 * Unauthenticated writes need a ceiling, or the inquiry table is a free mailbox for anyone with
 * curl. Counted per session per hour in the table the AI features already use.
 */
const consumeInquiryQuota = async (sessionId: string): Promise<boolean> => {
  const rows = await query<{ request_count: number }>(
    `INSERT INTO rate_limit_counter (session_id, feature, hour_window, request_count)
     VALUES ($1, 'contact', $2, 1)
     ON CONFLICT (session_id, feature, hour_window)
     DO UPDATE SET request_count = rate_limit_counter.request_count + 1
     RETURNING request_count`,
    [sessionId, hourWindow()],
  );
  return Number(rows[0]?.request_count ?? 1) <= config.contactInquiriesPerHour;
};

export const inquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(2000),
});

contactRouter.post('/', async (req, res) => {
  // Validate before consuming quota: a typo in the form is not an inquiry, and spending the
  // hourly allowance on rejected payloads locks a legitimate sender out of their own form.
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: 'invalid_inquiry',
      message: parsed.error.issues[0]?.message ?? 'Invalid inquiry payload.',
      field: parsed.error.issues[0]?.path.join('.'),
    });
    return;
  }
  if (!(await consumeInquiryQuota(req.sessionId))) {
    res.status(429).json({
      code: 'rate_limited',
      message: 'Too many inquiries from this session. Please try again later.',
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
