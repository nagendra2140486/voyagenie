import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './document.js';

export const openApiRouter = Router();

openApiRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});

openApiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Voyagenie API' }));
