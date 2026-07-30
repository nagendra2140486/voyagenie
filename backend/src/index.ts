import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { sessionMiddleware } from './middleware/session.js';
import { aiRouter } from './routes/ai.js';
import { contactRouter } from './routes/contact.js';
import { destinationsRouter } from './routes/destinations.js';
import { governanceRouter } from './routes/governance.js';
import { packagesRouter } from './routes/packages.js';
import { tripsRouter } from './routes/trips.js';

const app = express();

app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    exposedHeaders: ['x-session-id', 'x-ratelimit-limit', 'x-ratelimit-remaining'],
  }),
);
app.use(express.json({ limit: '256kb' }));
app.use(sessionMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'voyagenie-backend', provider: config.llm.provider });
});

app.use('/api/destinations', destinationsRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/contact', contactRouter);
app.use('/api', governanceRouter);
app.use('/ai', aiRouter);

app.use((_req, res) => {
  res.status(404).json({ code: 'not_found', message: 'Unknown endpoint.' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[backend]', error.message);
  res.status(500).json({ code: 'internal_error', message: 'Something went wrong. Please try again.' });
});

app.listen(config.port, () => {
  console.log(`Voyagenie backend listening on http://localhost:${config.port} (LLM provider: ${config.llm.provider})`);
});
