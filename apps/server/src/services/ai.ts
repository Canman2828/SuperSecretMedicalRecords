import { ApiError, GoogleGenAI } from '@google/genai';
import { lookupGlossary, type ExplainResponse } from '@medifyrx/shared';
import { env } from '../env.js';

// Aliases that track Google's current Flash models; the lite model is a fallback
// for when the main one is overloaded (Gemini returns 503). Matches services/chat.ts.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

const client = env.aiApiKey ? new GoogleGenAI({ apiKey: env.aiApiKey }) : null;

// The AI contract from the design docs. The model only EXPLAINS a term;
// it never decides safety, invents interactions, or restates dosages.
export const EXPLAIN_SYSTEM_PROMPT = `You explain medical terminology to patients.
Return JSON only: {"simpleDefinition": string, "needsVerification": boolean}.
Do not change, infer, calculate, recommend, or restate a dosage.
Do not give treatment advice or say whether anything is safe.
Explain only the highlighted term in plain language (one or two short sentences).
If the term or context is ambiguous, set needsVerification to true.`;

/**
 * Glossary first, AI last (design doc §4).
 * Phase 8: wire `callModel` to your AI provider using env.aiApiKey.
 */
export async function explainTerm(term: string, context?: string): Promise<ExplainResponse> {
  const entry = lookupGlossary(term);
  if (entry) {
    return { term, simpleDefinition: entry.meaning, source: 'glossary', needsVerification: false };
  }

  if (!env.aiApiKey) {
    return {
      term,
      simpleDefinition: 'No explanation available yet for this term.',
      source: 'none',
      needsVerification: true,
    };
  }

  const raw = await callModel(term, context).catch(() => '');
  const parsed = safeParse(raw);
  if (!parsed) {
    return { term, simpleDefinition: 'Could not generate an explanation.', source: 'none', needsVerification: true };
  }
  // Protected-value guard: reject explanations that introduce numbers (doses, frequencies).
  if (/\d/.test(parsed.simpleDefinition)) {
    return { term, simpleDefinition: 'Verify this term with your pharmacist.', source: 'none', needsVerification: true };
  }
  return { term, ...parsed, source: 'ai' };
}

// Calls Gemini for a single plain-language explanation, returning the raw JSON text
// (parsed/guarded by the caller). The key stays server-side; it is never sent to the
// web or mobile bundle.
async function callModel(term: string, context?: string): Promise<string> {
  if (!client) throw new Error('AI provider not configured');

  const userText = context ? `Term: ${term}\nContext: ${context}` : `Term: ${term}`;

  for (const [i, model] of MODELS.entries()) {
    try {
      const res = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        config: {
          systemInstruction: EXPLAIN_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          maxOutputTokens: 512,
        },
      });
      return res.text ?? '';
    } catch (err) {
      const overloaded = err instanceof ApiError && err.status === 503;
      if (!overloaded || i === MODELS.length - 1) throw err;
    }
  }
  throw new Error('unreachable');
}

function safeParse(raw: string): { simpleDefinition: string; needsVerification: boolean } | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj.simpleDefinition !== 'string') return null;
    return { simpleDefinition: obj.simpleDefinition, needsVerification: Boolean(obj.needsVerification) };
  } catch {
    return null;
  }
}
