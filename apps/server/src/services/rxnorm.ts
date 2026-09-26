import type { DrugSearchResult } from '@medifyrx/shared';

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

interface DrugsResponse {
  drugGroup?: { conceptGroup?: { tty: string; conceptProperties?: unknown[] }[] };
}

const drugNameCache = new Map<string, boolean>();

/** True if RxNorm knows `word` as an ingredient or brand, i.e. it has actual products under it. */
async function isDrugName(word: string): Promise<boolean> {
  const q = word.toLowerCase();
  const hit = drugNameCache.get(q);
  if (hit !== undefined) return hit;
  const data = await getJson<DrugsResponse>(`${BASE}/drugs.json?name=${encodeURIComponent(q)}`);
  const found = (data.drugGroup?.conceptGroup ?? []).some((g) => g.conceptProperties?.length);
  drugNameCache.set(q, found);
  return found;
}

// Everyday label words that are also RxNorm ingredient names, or just never worth a lookup.
const LABEL_WORDS = new Set(
  `take tablet tablets capsule capsules mouth daily every morning evening night bedtime hours
  with without food water meal meals refill refills before after needed pain doctor pharmacy
  quantity qty discard date use until finished apply swallow whole chew crush drink plenty
  alcohol sodium oxygen calcium iron zinc sugar salt oral topical solution extended release
  delayed tabs caps once twice three times week weeks days month months street avenue suite
  patient prescriber generic substitute manufactured`.split(/\s+/),
);

/**
 * Drug names printed on a scanned label, in the order they appear. Checks each distinct
 * word against RxNorm so the result reflects the paper, not the user's saved profile.
 * OCR typos won't match (on purpose: a wrong drug is worse than none).
 */
export async function findDrugNamesInText(text: string, limit = 5): Promise<string[]> {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const [word] of text.matchAll(/[A-Za-z]{4,}/g)) {
    const w = word.toLowerCase();
    if (seen.has(w) || LABEL_WORDS.has(w)) continue;
    seen.add(w);
    candidates.push(w);
    if (candidates.length >= 40) break;
  }
  const checks = await Promise.all(candidates.map((w) => isDrugName(w).catch(() => false)));
  return candidates.filter((_, i) => checks[i]).slice(0, limit).map(capitalize);
}
