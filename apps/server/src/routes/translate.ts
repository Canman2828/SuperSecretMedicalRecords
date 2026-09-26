import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { translateSchema } from '../schemas.js';
import { translateDocument } from '../services/translate.js';

export const translateRouter = Router();

// POST /api/translate { text, language?, knownMedications?, mode? } — plain-language side-by-side view for the iOS scanner.
// mode 'summary' returns only the important medical instructions. Guest OK.
// source: 'none' means the client should fall back to its glossary-only version.
translateRouter.post('/', validateBody(translateSchema), async (req, res) => {
  res.json(await translateDocument(req.body.text, req.body.language, req.body.knownMedications, req.body.mode));
});
