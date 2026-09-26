import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { medicationUsesSchema } from '../schemas.js';
import { medicationUses } from '../services/medicationUses.js';

export const medicationsRouter = Router();

// POST /api/medications/uses { medications: string[] } — what each drug is used for,
// condensed from the official FDA label (sourced; each result cites its DailyMed page).
// Guest OK. usedFor === null means no label was found for that name.
medicationsRouter.post('/uses', validateBody(medicationUsesSchema), async (req, res) => {
  res.json({ uses: await medicationUses(req.body.medications) });
});
