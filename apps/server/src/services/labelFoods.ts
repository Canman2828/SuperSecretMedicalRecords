import { getLabelByName, getLabelByRxCui, type LabelSections } from './openfda.js';

// "What can't I eat or drink with this medicine?" — read straight from the drug's official FDA label.
//
// SOURCE INFORMATION, not a decision engine (same rule as openfda.ts): a food is only reported when a
// sentence in the label BOTH names it AND tells the reader to avoid it ("do not", "avoid", "should not",
// "contraindicated"...). That exact sentence is returned as the source quote, with the DailyMed link.
// No AI is involved, so nothing is paraphrased or invented. A food the label only mentions in passing
// (e.g. "may be taken with or without food") is ignored.

export interface LabelFoodHit {
  /** Display name, also used for the related node's id so it merges with curated demo rules. */
  label: string;
  kind: 'food' | 'other';
  /** The exact label sentence that says to avoid it. */
  sentence: string;
  sourceUrl?: string;
}

interface FoodTerm {
  label: string;
  kind: 'food' | 'other';
  pattern: RegExp;
}

// Foods and drinks labels commonly warn about. Patterns are deliberately narrow to avoid false hits
// (e.g. "benzyl alcohol" is an ingredient, "human milk" is about breastfeeding).
const FOODS: FoodTerm[] = [
  { label: 'Grapefruit', kind: 'food', pattern: /\bgrapefruits?\b/i },
  { label: 'Seville oranges & pomelos', kind: 'food', pattern: /\b(seville oranges?|pomelos?|tangelos?)\b/i },
  {
    label: 'Alcohol',
    kind: 'other',
    pattern: /(?<!\b(?:benzyl|cetyl|stearyl|cetostearyl|polyvinyl|isopropyl|oleyl|lanolin|phenylethyl|dehydrated)\s)\b(alcohol(?:ic beverages?)?|ethanol)\b/i,
  },
  { label: 'Tyramine-rich foods', kind: 'food', pattern: /\btyramine\b/i },
  {
    label: 'Dairy (milk, yogurt)',
    kind: 'food',
    pattern: /(?<!\b(?:human|breast|mother'?s|in)\s)\b(milk|dairy(?: products?)?|yogh?urt)\b/i,
  },
  { label: 'Aged cheese', kind: 'food', pattern: /\bcheeses?\b/i },
  { label: 'Vitamin K–rich greens', kind: 'food', pattern: /\b(leafy (?:green )?vegetables|green leafy|vitamin k[- ]rich|spinach|kale)\b/i },
  { label: 'Potassium salt substitutes', kind: 'other', pattern: /\b(salt substitutes?|potassium[- ]containing salt)\b/i },
  { label: 'Caffeine', kind: 'other', pattern: /\b(caffeine|coffee)\b/i },
  { label: 'Black licorice', kind: 'food', pattern: /\b(licorice|liquorice|glycyrrhiz\w*)\b/i },
  { label: 'High-fat meals', kind: 'food', pattern: /\bhigh[- ]fat (?:meals?|foods?|diet)\b/i },
  { label: 'Cranberry', kind: 'food', pattern: /\bcranberr(?:y|ies)\b/i },
  { label: "St. John's wort", kind: 'other', pattern: /\bst\.? john'?s wort\b/i },
];

/** Avoid-language. A sentence must contain one of these for the food in it to count. */
const AVOID =
  /\b(do not|don['’]t|should not|must not|cannot|avoid(?:ed|ing)?|contraindicated|not be (?:taken|used|consumed|combined)|not recommended|refrain|abstain|not to (?:use|take|eat|drink|consume)|(?:advise[sd]?|warn(?:ed)?|caution(?:ed)?)\s+(?:\w+\s+){0,3}against)\b/i;

// Sections where food/drink warnings appear. Dosage text is included for "do not take with milk" style lines.
const SECTIONS: (keyof LabelSections)[] = [
  'boxedWarning',
  'contraindications',
  'drugInteractions',
  'warnings',
  'informationForPatients',
  'dosageAndAdministration',
];

const KEEP_STEADY = /\bavoid\s+(?:\w+\s+){0,2}changes\b/i;

const MAX_QUOTE = 420;
/** The avoid-wording must be this close (in characters) to the food's name, so a table row that says
 *  "Avoid use" for one drug doesn't get pinned on a food mentioned further along the same line. */
const NEAR = 90;

const positions = (re: RegExp, s: string) => [...s.matchAll(new RegExp(re.source, 'gi'))].map((m) => m.index!);

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    // Break at sentence ends, bullets, and numbered headings ("7.2 Drug Interactions").
    .split(/(?<=[.!?])\s+(?=[A-Z(•])|\s+•\s+|\s+(?=\d+\.\d+(?:\.\d+)*\s+[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

export function scanLabelForFoods(label: LabelSections): LabelFoodHit[] {
  const hits = new Map<string, LabelFoodHit>();
  for (const key of SECTIONS) {
    const parts = label[key];
    if (!Array.isArray(parts)) continue;
    for (const s of parts.flatMap((p) => sentences(String(p)))) {
      const avoidAt = positions(AVOID, s);
      // "Avoid drastic changes in your diet" means keep it steady, not "never eat it".
      if (!avoidAt.length || KEEP_STEADY.test(s)) continue;
      for (const f of FOODS) {
        if (hits.has(f.label)) continue;
        const foodAt = positions(f.pattern, s);
        if (!foodAt.some((i) => avoidAt.some((j) => Math.abs(i - j) <= NEAR))) continue;
        // "tyramine" sentences list cheese etc.; report those under tyramine, not as separate foods.
        if ((f.label.startsWith('Dairy') || f.label === 'Aged cheese') && /\btyramine\b/i.test(s)) continue;
        hits.set(f.label, {
          label: f.label,
          kind: f.kind,
          sentence: s.length > MAX_QUOTE ? `${s.slice(0, MAX_QUOTE).trimEnd()}…` : s,
          sourceUrl: label.dailyMedUrl,
        });
      }
    }
  }
  return [...hits.values()];
}

const cache = new Map<string, LabelFoodHit[]>();

/** Foods/drinks the medication's label says to avoid. Empty if there's no label or nothing found. */
export async function foodsToAvoid(med: { name: string; rxCui?: string }): Promise<LabelFoodHit[]> {
  const key = (med.rxCui ?? med.name).toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const label = (await getLabelByName(med.name).catch(() => null)) ?? (med.rxCui ? await getLabelByRxCui(med.rxCui).catch(() => null) : null);
  const hits = label ? scanLabelForFoods(label) : [];
  cache.set(key, hits);
  return hits;
}

/** True if a food the user entered (e.g. "grapefruit juice") is the same thing as a label hit. */
export function matchesFood(hit: LabelFoodHit, entered: string): boolean {
  const term = FOODS.find((f) => f.label === hit.label);
  return !!term && term.pattern.test(entered);
}
