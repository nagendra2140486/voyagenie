import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from '../config.js';
import { openApiDocument } from './document.js';

export const openApiRouter = Router();

openApiRouter.use((_req, res, next) => {
  if (!config.docsEnabled) {
    res.status(404).json({ code: 'not_found', message: 'Unknown endpoint.' });
    return;
  }
  next();
});

openApiRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

openApiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Voyagenie API' }));
