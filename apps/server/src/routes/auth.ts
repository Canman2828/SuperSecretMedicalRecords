import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { requireDb, signToken } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { User } from '../models/User.js';

export const authRouter = Router();
authRouter.use(requireDb);

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  password: z.string().min(8).max(200),
  securityAnswer: z.string().trim().min(1).max(100),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const resetSchema = z.object({
  email: z.email(),
  securityAnswer: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
});

// Security-question resets are guessable, so wrong answers lock the account's resets for a while.
const MAX_RESET_ATTEMPTS = 5;
const RESET_LOCK_MS = 15 * 60 * 1000;

// "Jamie ", "jamie" and "JAMIE" all count as the same answer.
const normalizeAnswer = (answer: string) => answer.trim().toLowerCase().replace(/\s+/g, ' ');

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  const { name, email, password, securityAnswer } = req.body as z.infer<typeof registerSchema>;
  if (await User.exists({ email })) return res.status(409).json({ error: 'Email already registered' });

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    securityAnswerHash: await bcrypt.hash(normalizeAnswer(securityAnswer), 10),
  });
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

// Reset by answering "Who is your favorite cousin?". The same error is returned for an unknown
// email, an account without an answer, and a wrong answer, so this can't reveal who has an account.
authRouter.post('/reset-password', validateBody(resetSchema), async (req, res) => {
  const { email, securityAnswer, password } = req.body as z.infer<typeof resetSchema>;
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+securityAnswerHash +resetAttempts +resetLockedUntil',
  );

  if (user?.resetLockedUntil && user.resetLockedUntil > new Date()) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const correct =
    !!user?.securityAnswerHash && (await bcrypt.compare(normalizeAnswer(securityAnswer), user.securityAnswerHash));
  if (!user || !correct) {
    if (user) {
      const attempts = (user.resetAttempts ?? 0) + 1;
      const locked = attempts >= MAX_RESET_ATTEMPTS;
      user.set({
        resetAttempts: locked ? 0 : attempts,
        resetLockedUntil: locked ? new Date(Date.now() + RESET_LOCK_MS) : undefined,
      });
      await user.save();
    }
    return res.status(401).json({ error: 'Email or answer does not match' });
  }

  user.set({ passwordHash: await bcrypt.hash(password, 10), resetAttempts: 0, resetLockedUntil: undefined });
  await user.save();
  res.json({ token: signToken(user.id) });
});
