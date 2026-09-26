import { lookupGlossary, type ExplainResponse } from '@clearrx/shared';
import { env } from '../env.js';

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

async function callModel(_term: string, _context?: string): Promise<string> {
  // TODO(phase 8): call your AI provider here with EXPLAIN_SYSTEM_PROMPT.
  // Keep the key server-side; never ship it in the web or mobile bundle.
  throw new Error('AI provider not configured');
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
