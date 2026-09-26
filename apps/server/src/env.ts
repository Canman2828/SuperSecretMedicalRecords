import 'dotenv/config';

const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret',
  corsOrigins,
  aiApiKey: process.env.AI_API_KEY ?? '',
  // Where password-reset links point. Defaults to the first CORS origin (the web dev server).
  appUrl: (process.env.APP_URL || corsOrigins[0] || 'http://localhost:5173').replace(/\/$/, ''),
  // Optional outgoing mail, e.g. smtp://user:pass@smtp.example.com:587. Blank = reset links are printed to the console.
  smtpUrl: process.env.SMTP_URL ?? '',
  mailFrom: process.env.MAIL_FROM ?? 'medify.Rx <no-reply@medify.local>',
};
