import { parseCriticalFields, type OcrWord } from './criticalParser';
import type { TranslateSegment } from './types';

/**
 * Guard rails for AI rewrites: "AI translates but doesn't modify important things".
 *
 * Every protected span the deterministic parser finds (dose, frequency, duration, route,
 * warnings, drug names, dates/times) is swapped for a numbered placeholder before the text
 * goes to the model, and swapped back afterwards. The model never sees those values, so it
 * can't reword them. `restoreProtected` rejects any output that drops, duplicates or invents
 * a placeholder, or that introduces a number of its own.
 */

export interface ProtectedSpan {
  text: string;
  /** Glossary meaning, shown beside (never instead of) the printed value. */
  meaning?: string;
}

export interface MaskedText {
  masked: string;
  locks: ProtectedSpan[];
}

const placeholder = (n: number) => `[[${n}]]`;
const PLACEHOLDER_RE = /\[\[(\d+)\]\]/g;

export function maskProtected(text: string, knownMedications: string[] = []): MaskedText {
  const tokens = [...text.matchAll(/(\S+)(\s*)/g)].map((m) => ({ text: m[1], space: m[2] }));
  // Fake 1-unit boxes along x so each annotation maps straight back to a token range.
  const words: OcrWord[] = tokens.map((t, i) => ({ text: t.text, bbox: { x: i, y: 0, width: 1, height: 1 }, confidence: 1 }));
  const byStart = new Map<number, { end: number; meaning?: string }>();
  for (const a of parseCriticalFields(words, knownMedications)) {
    if (a.immutable) byStart.set(a.bbox.x, { end: a.bbox.x + a.bbox.width, meaning: a.explanation });
  }

  const locks: ProtectedSpan[] = [];
  let masked = '';
  for (let i = 0; i < tokens.length; ) {
    const a = byStart.get(i);
    if (!a) {
      masked += tokens[i].text + tokens[i].space;
      i += 1;
      continue;
    }
    const span = tokens.slice(i, a.end);
    const joined = span.map((t, j) => t.text + (j < span.length - 1 ? t.space : '')).join('');
    // Keep sentence punctuation outside the lock: "DAYS." locks "DAYS".
    const [, core, tail] = joined.match(/^(.*?)([.,;:!?)]*)$/)!;
    locks.push({ text: core, meaning: a.meaning });
    masked += placeholder(locks.length) + tail + span[span.length - 1].space;
    i = a.end;
  }
  return { masked, locks };
}

/** Put the exact original values back. Returns null if the model tampered with them. */
export function restoreProtected(output: string, locks: ProtectedSpan[]): TranslateSegment[] | null {
  const seen = new Map<number, number>();
  for (const m of output.matchAll(PLACEHOLDER_RE)) {
    const n = Number(m[1]);
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  if (seen.size !== locks.length) return null;
  for (let n = 1; n <= locks.length; n++) if (seen.get(n) !== 1) return null;

  const segments: TranslateSegment[] = [];
  let last = 0;
  for (const m of output.matchAll(PLACEHOLDER_RE)) {
    const between = output.slice(last, m.index);
    // Any digit outside a placeholder is a number the model made up (or moved out of a lock).
    if (/\d/.test(between) || between.includes('[[')) return null;
    if (between) segments.push({ text: between });
    const lock = locks[Number(m[1]) - 1];
    segments.push({ text: lock.text, lock: true, meaning: lock.meaning });
    last = m.index! + m[0].length;
  }
  const rest = output.slice(last);
  if (/\d/.test(rest) || rest.includes('[[')) return null;
  if (rest) segments.push({ text: rest });
  return segments;
}
