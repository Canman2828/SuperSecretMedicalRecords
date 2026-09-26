import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { documentsRouter } from './routes/documents.js';
import { drugsRouter } from './routes/drugs.js';
import { explainRouter } from './routes/explain.js';
import { interactionsRouter } from './routes/interactions.js';
import { medicationsRouter } from './routes/medications.js';
import { profileRouter } from './routes/profile.js';
import { translateRouter } from './routes/translate.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins }));

  // Saved-document photos are base64 (a few MB), so this route needs a larger body than the
  // 200kb default. Mounted before the global parser so only /api/documents gets the big limit.
  app.use('/api/documents', express.json({ limit: '15mb' }), documentsRouter);

  app.use(express.json({ limit: '200kb' }));

  // No request logging of bodies: they contain health information.

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/drugs', drugsRouter);
  app.use('/api/explain', explainRouter);
  app.use('/api/interactions', interactionsRouter);
  app.use('/api/medications', medicationsRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/translate', translateRouter);

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = typeof err?.status === 'number' ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err?.message ?? 'Server error' });
  };
  app.use(onError);

  return app;
}
