import { Router } from 'express';
import { requireAuth, requireDb, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { profileSchema } from '../schemas.js';

export const profileRouter = Router();
profileRouter.use(requireDb, requireAuth);

function toProfile(user: { profile?: any } | null) {
  const p = user?.profile ?? {};
  const strip = (arr: any[] = []) =>
    arr.map((x) => {
      const { createdAt, updatedAt, ...rest } = typeof x.toObject === 'function' ? x.toObject() : x;
      return rest;
    });
  return { medications: strip(p.medications), allergies: strip(p.allergies), foods: strip(p.foods) };
}

// GET /api/profile — the logged-in user's saved profile
profileRouter.get('/', async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(toProfile(user));
});

// PUT /api/profile — replace the saved profile. The client only calls this after
// the user explicitly checks "Save this profile to my account".
// Deleting an item = PUT the profile without it.
profileRouter.put('/', validateBody(profileSchema), async (req: AuthedRequest, res) => {
  const user = await User.findByIdAndUpdate(req.userId, { profile: req.body }, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(toProfile(user));
});

// DELETE /api/profile — wipe all saved health info for this user
profileRouter.delete('/', async (req: AuthedRequest, res) => {
  await User.findByIdAndUpdate(req.userId, { profile: { medications: [], allergies: [], foods: [] } });
  res.status(204).end();
});
