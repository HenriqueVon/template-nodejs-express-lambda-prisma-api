import './config/zod-openapi';
import 'reflect-metadata';
import express from 'express';
import {
  requestIdMiddleware,
  accessLogMiddleware,
  requestContainerMiddleware,
  apiKeyMiddleware,
  errorHandler
} from '@shared/http/middlewares/';
import routes from './routes';
import '@shared/container';

export const app = express();

// The id and the access log come first, so a request rejected by the body parser still has both
app.use(requestIdMiddleware);
app.use(accessLogMiddleware);
app.use(express.json());
app.use(requestContainerMiddleware);

// Public liveness check, mounted before the API key middleware
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'my-service-api' });
});

app.use(apiKeyMiddleware); // Global API key enforcement: every endpoint after this line is protected
app.use(routes);
app.use(errorHandler);
