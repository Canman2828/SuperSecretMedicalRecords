import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { interactionCheckSchema } from '../schemas.js';
import { resolveProfileRelationships } from '../services/interactionResolver.js';

export const interactionsRouter = Router();

// POST /api/interactions/check — works for guests; nothing is stored.
interactionsRouter.post('/check', validateBody(interactionCheckSchema), async (req, res) => {
  res.json(await resolveProfileRelationships(req.body));
});
