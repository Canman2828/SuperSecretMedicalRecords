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
  dailyMedUrl?: string;
}

const cache = new Map<string, LabelSections | null>();

export async function getLabelByRxCui(rxCui: string): Promise<LabelSections | null> {
  if (cache.has(rxCui)) return cache.get(rxCui)!;

  const url = `${BASE}?search=openfda.rxcui:"${encodeURIComponent(rxCui)}"&limit=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (res.status === 404) {
    cache.set(rxCui, null);
    return null;
  }
  if (!res.ok) throw new Error(`openFDA ${res.status}`);

  const data = (await res.json()) as { results?: Record<string, any>[] };
  const r = data.results?.[0];
  if (!r) {
    cache.set(rxCui, null);
    return null;
  }

  const setId: string | undefined = r.set_id;
  const label: LabelSections = {
    setId,
    drugInteractions: r.drug_interactions,
    contraindications: r.contraindications,
    warnings: r.warnings ?? r.warnings_and_cautions,
    boxedWarning: r.boxed_warning,
    dailyMedUrl: setId ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}` : undefined,
  };
  cache.set(rxCui, label);
  return label;
}
