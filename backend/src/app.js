import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requireAuth } from './auth.js';
import { createDataApi } from './dataApi.js';
import { contactsRouter } from './routes/contacts.js';
import { ApiError } from './errors.js';

/**
 * Build the Express application.
 *
 * Dependencies are injected so the test suite can supply a fake Data API and a
 * fake authenticator without touching the network.
 */
export const createApp = ({ config, dataApi = createDataApi(config), authenticate } = {}) => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin/curl requests send no Origin header; browsers always do.
        if (!origin) return callback(null, true);
        if (config.allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new ApiError(403, 'This origin is not allowed to call the API.'));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86400,
    })
  );
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'networking-tracker-api' }));

  app.use('/api/contacts', authenticate ?? requireAuth(config), contactsRouter(dataApi));

  app.use((_req, _res, next) => next(ApiError.notFound('That endpoint does not exist.')));

  // Central error handler. Only ApiError messages reach the client; anything
  // else is logged server-side and reported as a generic 500.
  // eslint-disable-next-line no-unused-vars
  app.use((error, _req, res, _next) => {
    if (error instanceof ApiError) {
      const body = { error: error.message };
      if (error.fields) body.fields = error.fields;
      return res.status(error.status).json(body);
    }
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'That request body was not valid JSON.' });
    }
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'That request was too large.' });
    }
    console.error('[unhandled]', error);
    return res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  });

  return app;
};
