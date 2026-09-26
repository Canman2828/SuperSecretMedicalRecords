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
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

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
