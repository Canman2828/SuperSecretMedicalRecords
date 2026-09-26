// openFDA drug label API — free; an API key is optional (higher rate limits).
// https://open.fda.gov/apis/drug/label/
//
// Phase 6: pull official label sections for a confirmed medication so relationship
// cards can show real source text. Treat this as SOURCE INFORMATION, not a decision engine.

const BASE = 'https://api.fda.gov/drug/label.json';

export interface LabelSections {
  setId?: string;
  drugInteractions?: string[];
  contraindications?: string[];
  warnings?: string[];
  boxedWarning?: string[];
  /** What the drug is indicated to treat — the "used for" source. OTC labels use `purpose` instead. */
  indicationsAndUsage?: string[];
  /** Patient counseling / patient leaflet text (often where food and alcohol advice lives). */
  informationForPatients?: string[];
  dosageAndAdministration?: string[];
  dailyMedUrl?: string;
}

const cache = new Map<string, LabelSections | null>();

export async function getLabelByRxCui(rxCui: string): Promise<LabelSections | null> {
  return getLabel(`rxcui:${rxCui}`, `openfda.rxcui:"${encodeURIComponent(rxCui)}"`);
}

/**
 * Look up a label by drug name. openFDA indexes labels by product RxCUI, not the ingredient
 * RxCUI RxNorm normalizes to — so for a name-based "what is it used for", searching the label's
 * generic_name (then substance_name) is far more reliable. Pass the normalized ingredient name.
 */
export async function getLabelByName(name: string): Promise<LabelSections | null> {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  const enc = encodeURIComponent(`"${q}"`);
  return (
    (await getLabel(`name:${q}:generic`, `openfda.generic_name:${enc}`, q)) ??
    (await getLabel(`name:${q}:substance`, `openfda.substance_name:${enc}`, q))
  );
}

/** Fetch the first matching label for an openFDA `search` expression, parsed into the sections we use. */
async function getLabel(cacheKey: string, search: string, preferName?: string): Promise<LabelSections | null> {
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  // Several products share a name (e.g. ciprofloxacin tablets vs eye drops); prefer a by-mouth label.
  const url = `${BASE}?search=${search}&limit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (res.status === 404) {
    cache.set(cacheKey, null);
    return null;
  }
  if (!res.ok) throw new Error(`openFDA ${res.status}`);

  const data = (await res.json()) as { results?: Record<string, any>[] };
  // Best match: the single-ingredient product with exactly this name (not a combination pill), by mouth.
  const want = preferName?.toLowerCase();
  // "METFORMIN HYDROCHLORIDE" counts as metformin; "SITAGLIPTIN AND METFORMIN ..." does not.
  const single = (g: string) => {
    const n = g.toLowerCase();
    return !!want && (n === want || n.startsWith(`${want} `)) && !/ and |,|\//.test(n);
  };
  const score = (x: Record<string, any>) =>
    (x.openfda?.generic_name?.some(single) ? 2 : 0) + (x.openfda?.route?.includes('ORAL') ? 1 : 0);
  const r = data.results?.reduce<Record<string, any> | undefined>((best, x) => (!best || score(x) > score(best) ? x : best), undefined);
  if (!r) {
    cache.set(cacheKey, null);
    return null;
  }

  const setId: string | undefined = r.set_id;
  const label: LabelSections = {
    setId,
    drugInteractions: r.drug_interactions,
    contraindications: r.contraindications,
    warnings: r.warnings ?? r.warnings_and_cautions,
    boxedWarning: r.boxed_warning,
    indicationsAndUsage: r.indications_and_usage ?? r.purpose,
    informationForPatients: r.information_for_patients ?? r.patient_medication_information ?? r.spl_patient_package_insert,
    dosageAndAdministration: r.dosage_and_administration,
    dailyMedUrl: setId ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}` : undefined,
  };
  cache.set(cacheKey, label);
  return label;
}
