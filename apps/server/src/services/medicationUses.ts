import { ApiError, GoogleGenAI } from '@google/genai';
import type { MedicationUse } from '@medifyrx/shared';
import { env } from '../env.js';
import { getLabelByName, type LabelSections } from './openfda.js';
import { findDrugNamesInText, searchDrugs } from './rxnorm.js';

// "What is this medicine used for?" for the scanner's plain-language panel.
//
// SOURCE INFORMATION, not a decision engine (same rule as openfda.ts): the summary is
// condensed strictly from the drug's official FDA label (indications_and_usage), and every
// result carries the DailyMed URL it came from. The AI only shortens sourced text — it never
// invents an indication, and any output that sneaks in a number is rejected.

// Same model aliases + 503 fallback as services/ai.ts, chat.ts, translate.ts.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const client = env.aiApiKey ? new GoogleGenAI({ apiKey: env.aiApiKey }) : null;

const CONDENSE_SYSTEM_PROMPT = `You are given the "indications and usage" section from an official medicine label.
Say what the medicine is used to treat, in plain, simple words at about a 6th-grade reading level.
Use ONLY what the label text says. Do not add conditions, advice, or facts that are not in the text.
Reply with a short phrase of at most 12 words, no leading "used for", no sentence, no ending period.
You may keep a number only when it is part of a condition's name, like "type 2 diabetes".
Never write a dose, strength, age, or any measurement. If the text does not clearly say what it treats, reply exactly NONE.`;

// A dose/age/measurement: a number next to a unit. Condition names like "type 2 diabetes" are fine.
const DOSE_OR_AGE = /\d\s*(mg|mcg|µg|ml|mL|g\b|kg|%|years?|yrs?|months?|weeks?|days?|hours?|hrs?|times?)/i;

// Cache the finished "used for" line per label (keyed by DailyMed set id), so repeated scans and
// OCR variants of the same drug reuse one answer. Only stable answers are cached (see below).
const useCache = new Map<string, string>();

export async function medicationUses(names: string[], scannedText?: string): Promise<MedicationUse[]> {
  if (scannedText) {
    const found = await findDrugNamesInText(scannedText).catch(() => []);
    names = [...names, ...found];
  }
  // De-dupe the input spellings case-insensitively first.
  const seenName = new Set<string>();
  const uniqueNames = names
    .map((n) => n.trim())
    .filter((n) => n && !seenName.has(n.toLowerCase()) && seenName.add(n.toLowerCase()));

  // Resolve each spelling to its official label, then collapse by label identity so "atomoxetine",
  // "Strattera" and an OCR garble like "Atoncy" become ONE entry (and one AI call) instead of three.
  const resolved = await Promise.all(uniqueNames.map((n) => resolveLabel(n).catch(() => null)));

  const byLabel = new Map<string, { display: string; label: LabelSections }>();
  const noLabel: MedicationUse[] = [];
  for (const r of resolved) {
    if (!r) continue;
    if (!r.label?.setId) {
      // Couldn't find a label: keep it as a (null) entry, de-duped by display name.
      if (!noLabel.some((u) => u.medication.toLowerCase() === r.display.toLowerCase())) {
        noLabel.push({ medication: r.display, usedFor: null, sourceUrl: r.label?.dailyMedUrl });
      }
      continue;
    }
    if (!byLabel.has(r.label.setId)) byLabel.set(r.label.setId, { display: r.display, label: r.label });
  }

  const summarized = await Promise.all(
    [...byLabel.values()].map(({ display, label }) => usedForLabel(display, label)),
  );
  return [...summarized, ...noLabel];
}

/** Normalize a spelling to a canonical ingredient (RxNorm), then fetch that ingredient's label (openFDA). */
async function resolveLabel(medication: string): Promise<{ display: string; label: LabelSections | null }> {
  const [match] = await searchDrugs(medication, 1);
  const display = match?.name ?? medication;
  const label = await getLabelByName(display);
  return { display, label };
}

/** Condense one label's indications into a "used for" line, caching only stable answers. */
async function usedForLabel(display: string, label: LabelSections): Promise<MedicationUse> {
  const base = { medication: display, sourceUrl: label.dailyMedUrl };
  const cached = label.setId ? useCache.get(label.setId) : undefined;
  if (cached) return { ...base, usedFor: cached };

  const raw = cleanSection(label.indicationsAndUsage);
  if (!raw) return { ...base, usedFor: null };

  const usedFor = (await condense(raw).catch(() => null)) ?? heuristic(raw, display);
  // Only cache a real hit: caching a null would freeze in a transient AI timeout/quota error and
  // never retry. A miss stays uncached so the next scan can try again.
  if (usedFor && label.setId) useCache.set(label.setId, usedFor);
  return { ...base, usedFor };
}

/** Join the label section, drop the "1 INDICATIONS AND USAGE" heading, collapse whitespace. */
function cleanSection(section?: string[]): string {
  const text = (section ?? []).join(' ').replace(/\s+/g, ' ').trim();
  return text.replace(/^[\d.\s]*indications?\s+and\s+usage\s*/i, '').trim();
}

/** AI condense, grounded on the label text. Rejects empty, "NONE", or any output with digits. */
async function condense(labelText: string): Promise<string | null> {
  if (!client) return null;
  const input = labelText.slice(0, 1500); // first part of the section is enough; keeps tokens down
  // Cap the model call so a slow/queued response falls back to the heuristic instead of hanging the request.
  const raw = await Promise.race([
    callModel(input),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('condense timeout')), 12000)),
  ]);
  const out = raw.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '');
  if (!out || /^none$/i.test(out) || DOSE_OR_AGE.test(out)) return null;
  return tidy(out, false); // the model's own phrasing is trusted; single words like "ADHD" are fine
}

/** Sourced fallback when AI is off or its output failed the guard: first clause of the label sentence. */
function heuristic(labelText: string, drugName: string): string | null {
  const firstSentence = labelText.split(/(?<=[.;])\s/)[0] ?? labelText;
  const stripped = firstSentence
    .replace(new RegExp(`^${escapeRegex(drugName)}\\b`, 'i'), '')
    .replace(/^[^a-z]*\b(is|are)\b\s*/i, '')
    .replace(/^(indicated|used)\s+(for|in|to|as)\s+(the\s+)?(treatment|management|relief|prevention)?\s*(of\s+)?/i, '')
    .replace(/[.;].*$/, '')
    .trim();
  const clean = stripped.replace(/\s+/g, ' ');
  if (!clean || clean.length > 120 || DOSE_OR_AGE.test(clean)) return null;
  return tidy(clean, true); // the crude first-sentence cut can leave fragments; require a real phrase
}

// Trailing/leading junk words that mean the phrase got cut mid-clause (e.g. "hypothyroidism and", "prevent").
const STOPWORD = /^(and|or|to|of|in|for|with|the|a|an|as|is|are|by|due)$/i;

/**
 * Clean up a candidate phrase. With `strict` (the crude heuristic), reject the mangled fragments it can
 * leave behind ("prevent", "hypothyroidism and", "reading"). Without it (trusted AI output), keep short
 * but valid answers like "ADHD" or "asthma" — only drop something that is empty or a bare stopword.
 */
function tidy(s: string, strict: boolean): string | null {
  const phrase = s.replace(/\s+/g, ' ').replace(/^the\s+/i, '').replace(/[\s,]+$/, '').trim();
  if (!phrase) return null;
  const words = phrase.split(' ');
  if (STOPWORD.test(words[0]) || STOPWORD.test(words[words.length - 1])) return null;
  if (strict && words.length < 2) return null; // a lone word from the heuristic is usually a truncated verb
  // Lower-case the first letter for a mid-sentence feel, but leave acronyms ("ADHD", "COPD") alone.
  const acronym = /[A-Z]/.test(words[0].slice(1));
  return acronym ? phrase : phrase.charAt(0).toLowerCase() + phrase.slice(1);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function callModel(labelText: string): Promise<string> {
  if (!client) throw new Error('AI provider not configured');
  for (const [i, model] of MODELS.entries()) {
    try {
      const res = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: `Label text:\n${labelText}` }] }],
        config: { systemInstruction: CONDENSE_SYSTEM_PROMPT, maxOutputTokens: 64, temperature: 0.1 },
      });
      return res.text ?? '';
    } catch (err) {
      const overloaded = err instanceof ApiError && err.status === 503;
      if (!overloaded || i === MODELS.length - 1) throw err;
    }
  }
  throw new Error('unreachable');
}
