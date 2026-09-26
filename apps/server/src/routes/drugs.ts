import { Router } from 'express';
import { searchDrugs } from '../services/rxnorm.js';

export const drugsRouter = Router();

// GET /api/drugs/search?q=metoprol
drugsRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '');
  try {
    res.json({ results: await searchDrugs(q) });
  } catch (err) {
    console.error('RxNorm search failed', (err as Error).message);
    res.status(502).json({ error: 'Medication search is unavailable right now', results: [] });
  }
});
