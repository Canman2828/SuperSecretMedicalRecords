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
const FREQUENCY_NOUNS = new Set(['TIME', 'TIMES']); // "3 times daily"
const NEGATIONS = new Set(['DO NOT', 'DONT', 'NEVER', 'AVOID', 'NOT']);
const NUMBER_RE = /^\d+(\.\d+)?$/;

// Signature fields ("Patient Signature ______", "X ______", "Initials").
const SIGNATURE_WORDS = new Set(['SIGNATURE', 'SIGNATURES', 'SIGNED', 'INITIALS']);
const BLANK_LINE_RE = /^[xX]?_{3,}$/;

// "When": dates, clock times, times of day.
const DATE_RE = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})$/;
const CLOCK_RE = /^\d{1,2}:\d{2}(AM|PM)?$/i;
const MERIDIEM = new Set(['AM', 'PM']);
const MONTHS = new Set(['JAN', 'JANUARY', 'FEB', 'FEBRUARY', 'MAR', 'MARCH', 'APR', 'APRIL', 'MAY', 'JUN', 'JUNE', 'JUL', 'JULY', 'AUG', 'AUGUST', 'SEP', 'SEPT', 'SEPTEMBER', 'OCT', 'OCTOBER', 'NOV', 'NOVEMBER', 'DEC', 'DECEMBER']);
const TIME_OF_DAY = new Set(['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'NIGHTLY', 'BEDTIME', 'NOON', 'MIDNIGHT', 'BREAKFAST', 'LUNCH', 'DINNER', 'MEALS', 'MEAL']);
// Pulled in before a time of day so "at bedtime" / "before breakfast" / "in the morning" stay together.
const TIME_LEADS = new Set(['AT', 'IN', 'THE', 'WITH', 'BEFORE', 'AFTER', 'EVERY', 'EACH']);
const DATE_LABELS = new Set(['DATE', 'DATED', 'EXP', 'EXPIRES', 'EXPIRATION', 'FILLED', 'DISCARD']);

/** Strip trailing punctuation OCR tends to attach ("12/01/2026," -> "12/01/2026"). */
const bare = (s: string) => s.replace(/[.,;:)]+$/, '');
const isDateAt = (words: OcrWord[], j: number) => j < words.length && DATE_RE.test(bare(words[j].text));
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
  let claimed = 0; // words before this index already belong to an annotation
  let emitted = 0;

  const emit = (span: OcrWord[], category: AnnotationCategory, immutable: boolean, start: number) => {
    out.push(makeAnnotation(span, category, immutable));
    i = start + span.length;
  };

  while (i < words.length) {
    if (out.length !== emitted) {
      emitted = out.length;
      claimed = i;
    }
    const w = words[i];
    const t = normalizeToken(w.text);
    const next = words[i + 1];
    const nextT = next ? normalizeToken(next.text) : '';

    // --- Signature: "Signature ______", "X ______", a bare blank line ---
    if (SIGNATURE_WORDS.has(t) || (t === 'SIGN' && nextT === 'HERE')) {
      const len = t === 'SIGN' || (next && BLANK_LINE_RE.test(next.text)) ? 2 : 1;
      emit(words.slice(i, i + len), 'signature', false, i);
      continue;
    }
    if (BLANK_LINE_RE.test(w.text) || (t === 'X' && next && BLANK_LINE_RE.test(next.text))) {
      emit(words.slice(i, i + (t === 'X' ? 2 : 1)), 'signature', false, i);
      continue;
    }

    // --- When: dates and times, shown exactly as printed ---
    // "Date ______" is a field to fill in, not a printed value
    if (DATE_LABELS.has(t) && next && BLANK_LINE_RE.test(next.text)) {
      emit([w, next], 'timing', false, i);
      continue;
    }
    // "Date: 12/01/2026", "Exp 03/2027" labels keep their value together
    if (DATE_LABELS.has(t) && isDateAt(words, i + 1)) {
      emit([w, next], 'timing', true, i);
      continue;
    }
    if (isDateAt(words, i)) {
      emit([w], 'timing', true, i);
      continue;
    }
    // "Jan 5, 2026", "March 3"
    if (MONTHS.has(t) && next && /^\d{1,2}(st|nd|rd|th)?,?$/i.test(next.text)) {
      const year = words[i + 2] && /^\d{4}$/.test(bare(words[i + 2].text)) ? 1 : 0;
      emit(words.slice(i, i + 2 + year), 'timing', true, i);
      continue;
    }
    // "8:00", "8:00 AM", "8 PM"
    if (CLOCK_RE.test(bare(w.text)) || (NUMBER_RE.test(w.text) && MERIDIEM.has(nextT))) {
      emit(MERIDIEM.has(nextT) ? [w, next] : [w], 'timing', true, i);
      continue;
    }
    // "at bedtime", "in the morning", "before breakfast"
    if (TIME_OF_DAY.has(t)) {
      let start = i;
      while (start - 1 >= claimed && start > i - 2 && TIME_LEADS.has(normalizeToken(words[start - 1].text))) start -= 1;
      emit(words.slice(start, i + 1), 'timing', true, start);
      continue;
    }

    // "500mg"
    if (NUMBER_WITH_UNIT_RE.test(w.text.toUpperCase().replace(/\s/g, ''))) {
      out.push(makeAnnotation([w], 'critical', true));
      i += 1;
      continue;
    }

    // "500 mg", "1 capsule", "7 days", "3 times"
    if (NUMBER_RE.test(w.text) && next && (UNITS.has(nextT) || COUNT_NOUNS.has(nextT) || TIME_NOUNS.has(nextT) || FREQUENCY_NOUNS.has(nextT))) {
      const span = [w, next];
      // include a preceding "for" / "every" so "for 7 days" stays together
      const prev = words[i - 1];
      const prevT = prev ? normalizeToken(prev.text) : '';
      if (prev && (prevT === 'FOR' || prevT === 'EVERY')) {
        span.unshift(prev);
      }
      // keep "3 times daily" / "3 times a day" together so "daily" isn't explained on its own as "once a day"
      let consumed = 2;
      if (FREQUENCY_NOUNS.has(nextT)) {
        const t2 = words[i + 2] ? normalizeToken(words[i + 2].text) : '';
        const t3 = words[i + 3] ? normalizeToken(words[i + 3].text) : '';
        if (t2 === 'DAILY' || t2 === 'WEEKLY') consumed = 3;
        else if ((t2 === 'A' || t2 === 'PER') && (t3 === 'DAY' || t3 === 'WEEK')) consumed = 4;
        span.push(...words.slice(i + 2, i + consumed));
      }
      out.push(makeAnnotation(span, 'critical', true));
      i += consumed;
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
