import { ApiError, GoogleGenAI } from '@google/genai';
import type { MedicationUse } from '@medifyrx/shared';
import { env } from '../env.js';
import { getLabelByName } from './openfda.js';
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

const cache = new Map<string, MedicationUse>();

export async function medicationUses(names: string[], scannedText?: string): Promise<MedicationUse[]> {
  if (scannedText) {
    const found = await findDrugNamesInText(scannedText).catch(() => []);
    names = [...names, ...found];
  }
  // De-dupe case-insensitively while keeping the first spelling the caller used.
  const seen = new Set<string>();
  const unique = names
    .map((n) => n.trim())
    .filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));

  return Promise.all(unique.map((name) => oneMedicationUse(name)));
}

async function oneMedicationUse(medication: string): Promise<MedicationUse> {
  const key = medication.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  // `cacheable` guards against poisoning: a stable answer (a summary, or a real "no label")
  // is cached forever, but a transient miss (AI condense timed out on text we DID find) is
  // left uncached so the next scan can retry instead of showing null for the server's lifetime.
  const { cacheable, ...use } = await resolveUse(medication).catch(() => ({
    medication,
    usedFor: null,
    cacheable: false as const,
  }));
  if (cacheable) cache.set(key, use);
  return use;
}

type Resolved = MedicationUse & { cacheable: boolean };

async function resolveUse(medication: string): Promise<Resolved> {
  // Normalize the spelling to a canonical ingredient (RxNorm), then find that ingredient's
  // official label by name (openFDA). Fall back to the raw OCR/entered name if RxNorm misses.
  const [match] = await searchDrugs(medication, 1);
  const lookupName = match?.name ?? medication;

  const label = await getLabelByName(lookupName);
  const raw = cleanSection(label?.indicationsAndUsage);
  // No label / no indications section: a stable null, safe to cache.
  if (!raw) return { medication, usedFor: null, sourceUrl: label?.dailyMedUrl, cacheable: true };

  const usedFor = (await condense(raw).catch(() => null)) ?? heuristic(raw, lookupName);
  // We had label text: caching a null here would freeze in a transient AI timeout — only cache a hit.
  return { medication, usedFor, sourceUrl: label?.dailyMedUrl, cacheable: usedFor !== null };
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
  return tidy(out);
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
  return tidy(clean);
}

// Trailing/leading junk words that mean the phrase got cut mid-clause (e.g. "hypothyroidism and", "prevent").
const STOPWORD = /^(and|or|to|of|in|for|with|the|a|an|as|is|are|by|due)$/i;

/**
 * Accept only phrases that read like a condition. Rejects the mangled fragments the crude first-sentence
 * heuristic can leave behind ("prevent", "hypothyroidism and", "reading") rather than showing a wrong "used for".
 */
function tidy(s: string): string | null {
  const phrase = s.replace(/\s+/g, ' ').replace(/^the\s+/i, '').replace(/[\s,]+$/, '').trim();
  const words = phrase.split(' ');
  if (words.length < 2) return null; // a single word is almost always a truncated verb, not a condition
  if (STOPWORD.test(words[0]) || STOPWORD.test(words[words.length - 1])) return null;
  return phrase.charAt(0).toLowerCase() + phrase.slice(1);
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
