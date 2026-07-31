import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { query } from '../db.js';

const SESSION_HEADER = 'x-session-id';

/**
 * A client-supplied session id is persisted and echoed back in a response header, so it is
 * untrusted input on an output path. Only canonical UUIDs are accepted; anything else is
 * replaced with a freshly generated id.
 */
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

declare module 'express-serve-static-core' {
  interface Request {
    sessionId: string;
  }
}

/**
 * Mock session identity: the client sends a stable id, the server persists it.
 * Production-grade auth is explicitly out of scope for this AUT.
 */
export const sessionMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const incoming = req.header(SESSION_HEADER);
  const sessionId = incoming && SESSION_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  req.sessionId = sessionId;
  res.setHeader(SESSION_HEADER, sessionId);
  try {
    await query('INSERT INTO app_sessions (session_id) VALUES ($1) ON CONFLICT (session_id) DO NOTHING', [
      sessionId,
    ]);
    next();
  } catch (error) {
    next(error);
  }
};
