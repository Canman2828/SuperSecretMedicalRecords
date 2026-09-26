import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { explainSchema } from '../schemas.js';
import { explainTerm } from '../services/ai.js';

export const explainRouter = Router();

// POST /api/explain { term, context? } — used by the iOS scanner when a tapped term isn't in the local glossary.
explainRouter.post('/', validateBody(explainSchema), async (req, res) => {
  res.json(await explainTerm(req.body.term, req.body.context));
});
