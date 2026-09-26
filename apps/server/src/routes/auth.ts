import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import { requireDb, signToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { sendPasswordReset } from '../services/mailer.js';

export const authRouter = Router();
authRouter.use(requireDb);

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const forgotSchema = z.object({ email: z.email() });

const resetSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
});

const RESET_TTL_MS = 30 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  const { name, email, password } = req.body as z.infer<typeof registerSchema>;
  if (await User.exists({ email })) return res.status(409).json({ error: 'Email already registered' });

  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: signToken(user.id) });
});

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user.id) });
});

// Always answers the same way, so this can't be used to find out which emails have accounts.
authRouter.post('/forgot-password', validateBody(forgotSchema), async (req, res) => {
  const { email } = req.body as z.infer<typeof forgotSchema>;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    const token = randomBytes(32).toString('hex');
    user.set({ resetTokenHash: hashToken(token), resetTokenExpires: new Date(Date.now() + RESET_TTL_MS) });
    await user.save();
    try {
      await sendPasswordReset(user.email, `${env.appUrl}/#reset?token=${token}`);
    } catch (err) {
      console.error('Password reset email failed:', err instanceof Error ? err.message : err);
    }
  }
  res.json({ ok: true });
});

// One-time use: the token is cleared on success. Signs the user in with the new password.
authRouter.post('/reset-password', validateBody(resetSchema), async (req, res) => {
  const { token, password } = req.body as z.infer<typeof resetSchema>;
  const user = await User.findOne({ resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ error: 'Reset link is invalid or has expired' });

  user.set({ passwordHash: await bcrypt.hash(password, 10), resetTokenHash: undefined, resetTokenExpires: undefined });
  await user.save();
  res.json({ token: signToken(user.id) });
});
