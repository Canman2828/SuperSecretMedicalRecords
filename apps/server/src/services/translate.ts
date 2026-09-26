import { ApiError, GoogleGenAI } from '@google/genai';
import { maskProtected, restoreProtected, type TranslateResponse } from '@medifyrx/shared';
import { env } from '../env.js';

// Same model aliases and 503 fallback as services/ai.ts and services/chat.ts.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

const client = env.aiApiKey ? new GoogleGenAI({ apiKey: env.aiApiKey }) : null;

// "AI translates but doesn't modify important things, especially dosage."
// Protected values are replaced with [[n]] placeholders before the model sees the text,
// and restoreProtected() rejects any output that touches them or adds numbers.
export const TRANSLATE_SYSTEM_PROMPT = `You rewrite text from a prescription label or medical consent form so a patient can understand it.
Write it in plain, simple words at about a 6th-grade reading level, in the language requested.
The text contains placeholders like [[1]], [[2]]. Each stands for an exact dose, time, drug name, or warning.
Copy every placeholder exactly once, unchanged, where it belongs in your sentence. Never write out, guess, or add what a placeholder means.
Do not write any digits or numbers of your own. Do not add advice, safety opinions, or information that is not in the text.
Keep every instruction and warning; do not drop or soften any. Return only the rewritten text.`;

// "Important parts only": the same protected-value contract, but the model is told to keep just the
// medical instructions and throw away the label's boilerplate (name, address, pharmacy, store/Rx
// numbers). It must still copy EVERY placeholder — those are the doses/warnings/drug names — so the
// restoreProtected guard still catches any tampering. Dropping stray unprotected numbers is required
// anyway (the guard rejects loose digits), which is exactly what makes a label with a street address
// summarize cleanly where a faithful rewrite would fail.
export const SUMMARY_SYSTEM_PROMPT = `You summarize a prescription label for a patient in plain, simple words (about a 6th-grade reading level).
Keep ONLY the medical instructions: what the medicine is, how much to take, how to take it, when to take it, and any warnings.
Leave OUT the patient's name, the street address, the pharmacy name or phone, the prescriber, and any store, Rx, or phone numbers.
The text has placeholders like [[1]], [[2]]. Each is an exact dose, time, drug name, or warning. Copy every placeholder exactly once, unchanged. Never write out or guess what a placeholder means.
Do not write any digits or numbers of your own, and do not keep any number that is not inside a placeholder.
Write two or three short sentences. Do not add advice or facts that are not in the text. Return only the summary.`;

export type TranslateMode = 'faithful' | 'summary';

export async function translateDocument(
  text: string,
  language = 'plain English',
  knownMedications: string[] = [],
  mode: TranslateMode = 'faithful',
): Promise<TranslateResponse> {
  if (!client) return { segments: [], source: 'none' };

  const prompt = mode === 'summary' ? SUMMARY_SYSTEM_PROMPT : TRANSLATE_SYSTEM_PROMPT;
  const { masked, locks } = maskProtected(text, knownMedications);
  const raw = await callModel(masked, language, prompt).catch(() => '');
  const segments = raw ? restoreProtected(raw.trim(), locks) : null;
  return segments ? { segments, source: 'ai' } : { segments: [], source: 'none' };
}

async function callModel(masked: string, language: string, systemInstruction: string): Promise<string> {
  if (!client) throw new Error('AI provider not configured');

  for (const [i, model] of MODELS.entries()) {
    try {
      const res = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: `Language: ${language}\n\nText:\n${masked}` }] }],
        config: { systemInstruction, maxOutputTokens: 2048, temperature: 0.2 },
      });
      return res.text ?? '';
    } catch (err) {
      const overloaded = err instanceof ApiError && err.status === 503;
      if (!overloaded || i === MODELS.length - 1) throw err;
    }
  }
  throw new Error('unreachable');
}
