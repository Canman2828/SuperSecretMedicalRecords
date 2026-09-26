import { lookupGlossary, normalizeToken } from './glossary';
import type { Annotation, AnnotationCategory, BBox } from './types';

/** One OCR word, in image-pixel coordinates. */
export interface OcrWord {
  text: string;
  bbox: BBox;
  /** 0..1 */
  confidence: number;
}

const UNITS = new Set(['MG', 'MCG', 'G', 'ML', 'L', 'UNITS', 'UNIT', 'IU', 'MEQ', '%']);
const COUNT_NOUNS = new Set(['TABLET', 'TABLETS', 'TAB', 'TABS', 'CAPSULE', 'CAPSULES', 'CAP', 'CAPS', 'DROP', 'DROPS', 'PUFF', 'PUFFS', 'SPRAY', 'SPRAYS']);
const TIME_NOUNS = new Set(['HOUR', 'HOURS', 'HR', 'HRS', 'DAY', 'DAYS', 'WEEK', 'WEEKS', 'MONTH', 'MONTHS']);
const NEGATIONS = new Set(['DO NOT', 'DONT', 'NEVER', 'AVOID', 'NOT']);
const NUMBER_RE = /^\d+(\.\d+)?$/;
const NUMBER_WITH_UNIT_RE = /^(\d+(\.\d+)?)(MG|MCG|G|ML|L|IU|MEQ|%)$/;

/** Below this, the UI shows "Not confident — verify the printed text". */
export const LOW_CONFIDENCE = 0.6;

function mergeBoxes(boxes: BBox[]): BBox {
  const x1 = Math.min(...boxes.map((b) => b.x));
  const y1 = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.width));
  const y2 = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

let counter = 0;
function makeAnnotation(
  words: OcrWord[],
  category: AnnotationCategory,
  immutable: boolean,
  explanation?: string,
  source?: string,
): Annotation {
  const sourceText = words.map((w) => w.text).join(' ');
  return {
    id: `ann-${++counter}`,
    sourceText,
    normalizedText: normalizeToken(sourceText),
    bbox: mergeBoxes(words.map((w) => w.bbox)),
    confidence: Math.min(...words.map((w) => w.confidence)),
    category,
    immutable,
    explanation,
    source,
  };
}

/**
 * Deterministic pass that runs BEFORE any AI call.
 * Finds dosing values, frequencies, routes, negations, and glossary terms.
 * `knownMedications` lets you highlight drug names (e.g. from RxNorm or a demo list).
 */
export function parseCriticalFields(
  words: OcrWord[],
  knownMedications: string[] = [],
): Annotation[] {
  const meds = new Set(knownMedications.map(normalizeToken));
  const out: Annotation[] = [];
  let i = 0;

  while (i < words.length) {
    const w = words[i];
    const t = normalizeToken(w.text);
    const next = words[i + 1];
    const nextT = next ? normalizeToken(next.text) : '';

    // "500mg"
    if (NUMBER_WITH_UNIT_RE.test(w.text.toUpperCase().replace(/\s/g, ''))) {
      out.push(makeAnnotation([w], 'critical', true));
      i += 1;
      continue;
    }

    // "500 mg", "1 capsule", "7 days"
    if (NUMBER_RE.test(w.text) && next && (UNITS.has(nextT) || COUNT_NOUNS.has(nextT) || TIME_NOUNS.has(nextT))) {
      const span = [w, next];
      // include a preceding "for" / "every" so "for 7 days" stays together
      const prev = words[i - 1];
      const prevT = prev ? normalizeToken(prev.text) : '';
      if (prev && (prevT === 'FOR' || prevT === 'EVERY')) {
        span.unshift(prev);
      }
      out.push(makeAnnotation(span, 'critical', true));
      i += 2;
      continue;
    }

    // "do not crush", "avoid alcohol"
    const two = `${t} ${nextT}`;
    if (NEGATIONS.has(two) || NEGATIONS.has(t)) {
      const len = NEGATIONS.has(two) ? 2 : 1;
      const span = words.slice(i, Math.min(i + len + 1, words.length)); // negation + the word it applies to
      out.push(makeAnnotation(span, 'warning', true));
      i += span.length;
      continue;
    }

    // "penicillin allergy", "sulfa allergies"
    if (nextT === 'ALLERGY' || nextT === 'ALLERGIES' || nextT === 'ALLERGIC') {
      out.push(makeAnnotation([w, next], 'warning', true));
      i += 2;
      continue;
    }

    if (meds.has(t)) {
      out.push(makeAnnotation([w], 'medication', true));
      i += 1;
      continue;
    }

    const entry = lookupGlossary(w.text);
    if (entry) {
      out.push(makeAnnotation([w], entry.category, entry.immutable, entry.meaning, 'glossary'));
      i += 1;
      continue;
    }

    i += 1;
  }

  return out;
}
