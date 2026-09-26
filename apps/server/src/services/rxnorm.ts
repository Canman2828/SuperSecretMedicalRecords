import type { DrugSearchResult } from '@clearrx/shared';

// RxNorm (NLM) — free, no API key.
// https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
//
// Used ONLY for identity: "Lopressor" / "metoprolol 50mg tab" -> ingredient "metoprolol" (RxCUI 6918).
// Not an interaction engine (RxNav's interaction API was discontinued in Jan 2024).

const BASE = 'https://rxnav.nlm.nih.gov/REST';
const cache = new Map<string, DrugSearchResult[]>();

interface ApproximateResponse {
  approximateGroup?: { candidate?: { rxcui: string; name?: string; rank?: string }[] };
}

interface RelatedResponse {
  relatedGroup?: {
    conceptGroup?: { tty: string; conceptProperties?: { rxcui: string; name: string }[] }[];
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`RxNorm ${res.status}`);
  return res.json() as Promise<T>;
}

/** Ingredient(s) for any RxCUI (brand, clinical drug, etc.). */
async function ingredientsFor(rxcui: string): Promise<DrugSearchResult[]> {
  const data = await getJson<RelatedResponse>(`${BASE}/rxcui/${rxcui}/related.json?tty=IN`);
  const groups = data.relatedGroup?.conceptGroup ?? [];
  return groups.flatMap((g) => g.conceptProperties ?? []).map((c) => ({ name: c.name, rxCui: c.rxcui }));
}

/**
 * Autocomplete + normalization. Returns ingredient-level concepts so the same drug
 * always has the same RxCUI no matter how the user (or OCR) spelled it.
 */
export async function searchDrugs(query: string, limit = 6): Promise<DrugSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hit = cache.get(q);
  if (hit) return hit;

  const approx = await getJson<ApproximateResponse>(
    `${BASE}/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=8`,
  );
  const rxcuis = [...new Set((approx.approximateGroup?.candidate ?? []).map((c) => c.rxcui))].slice(0, 5);

  const ingredientLists = await Promise.all(rxcuis.map((id) => ingredientsFor(id).catch(() => [])));

  const seen = new Set<string>();
  const results: DrugSearchResult[] = [];
  for (const d of ingredientLists.flat()) {
    if (seen.has(d.rxCui)) continue;
    seen.add(d.rxCui);
    results.push({ name: capitalize(d.name), rxCui: d.rxCui });
    if (results.length >= limit) break;
  }

  cache.set(q, results);
  return results;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
