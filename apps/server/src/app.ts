import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { env } from './env.js';
import { authRouter } from './routes/auth.js';
import { chatRouter } from './routes/chat.js';
import { drugsRouter } from './routes/drugs.js';
import { explainRouter } from './routes/explain.js';
import { interactionsRouter } from './routes/interactions.js';
import { profileRouter } from './routes/profile.js';
import { translateRouter } from './routes/translate.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins }));
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
