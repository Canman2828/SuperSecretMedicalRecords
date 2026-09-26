import { ApiError, FinishReason, GoogleGenAI, type Content, type Part } from '@google/genai';
import type { ChatMessage, ChatRequest } from '@medifyrx/shared';
import { env } from '../env.js';

// Aliases that track Google's current Flash models; pin specific versions for stable behavior.
// The lighter model is a fallback for when the main one is overloaded (Gemini returns 503).
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];

// Same contract as EXPLAIN_SYSTEM_PROMPT in ai.ts: the model helps patients understand
// their medications; it never decides safety, invents interactions, or changes doses.
export const CHAT_SYSTEM_PROMPT = `You are the medify.Rx assistant, on the Medictionary page. medify.Rx helps patients
understand their prescriptions. Your role is limited to: explaining what a medication is generally used
for, explaining terms and instructions on a prescription label in plain language, describing general
information that appears on drug labels (such as common side effects or storage), and explaining how to
use medify.Rx's features (Compremedic, which reads a label aloud in plain language; Prescriptive, where
the "Check relationships" button builds an interaction tree from their medication list; and the phone
app's live prescription scanner).

You do not diagnose, suggest possible conditions, or interpret test results. Do not recommend
starting, stopping, skipping, or changing any medication. Do not change, calculate, infer, or
recommend a dose; if asked, point the patient to their label and their pharmacist or prescriber.
Do not say whether a medication or combination is safe for them, and do not state interactions
as fact; say that interactions should be confirmed with a pharmacist, and that the "Check
relationships" tool on the Prescriptive page shows sourced label information.

The patient's medication list, if provided, was typed in by the patient and is unverified.

Keep responses brief (under 120 words) and in plain language. Write plain text only, with no Markdown
(no asterisks, headings, or bullet symbols); the chat window shows it as-is. End by pointing to a next step,
usually asking their pharmacist or prescriber. If the patient asks the same question
repeatedly or seems anxious, do not provide additional possibilities or reassurance. Gently
name that their pharmacist or prescriber can give them real answers.

If the patient describes anything that could be an emergency, including a possible overdose,
taking the wrong medication, or a severe reaction such as trouble breathing or swelling of the
face or throat, stop and tell them to call 911 immediately (Poison Control: 1-800-222-1222;
988 for a mental health crisis).

Stay on topic. For unrelated requests, briefly say you can only help with understanding their
medications here and redirect.`;

export const CHAT_FALLBACK_REPLY =
  "I'm sorry, I can't help with that here. Your pharmacist or prescriber is the best person to ask. " +
  'If this is an emergency, call 911 (Poison Control: 1-800-222-1222).';

const client = env.aiApiKey ? new GoogleGenAI({ apiKey: env.aiApiKey }) : null;

export const chatEnabled = () => client !== null;

// Gemini stops with one of these when its safety filters decline to answer.
const BLOCKED = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
]);

/** Streams the reply to `onText` and resolves with the full reply text. */
export async function streamChatReply(
  { messages, profile }: ChatRequest,
  onText: (chunk: string) => void,
  signal: AbortSignal,
): Promise<string> {
  if (!client) throw new Error('AI provider not configured');

  for (const [i, model] of MODELS.entries()) {
    try {
      return await streamFrom(client, model, messages, profile, onText, signal);
    } catch (err) {
      const overloaded = err instanceof ApiError && err.status === 503;
      if (!overloaded || i === MODELS.length - 1) throw err;
    }
  }
  throw new Error('unreachable');
}

// Overload errors arrive before the first chunk, so a retry never repeats streamed text.
async function streamFrom(
  client: GoogleGenAI,
  model: string,
  messages: ChatMessage[],
  profile: ChatRequest['profile'],
  onText: (chunk: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const stream = await client.models.generateContentStream({
    model,
    contents: toApiContents(messages, profile),
    config: {
      systemInstruction: CHAT_SYSTEM_PROMPT,
      maxOutputTokens: 2048,
      abortSignal: signal,
    },
  });

  let reply = '';
  for await (const chunk of stream) {
    if (chunk.promptFeedback?.blockReason) return CHAT_FALLBACK_REPLY;
    const finish = chunk.candidates?.[0]?.finishReason;
    if (finish && BLOCKED.has(finish)) return CHAT_FALLBACK_REPLY;
    const text = chunk.text;
    if (text) {
      reply += text;
      onText(text);
    }
  }
  return reply || CHAT_FALLBACK_REPLY;
}

// The profile rides along as a separate part on the first patient turn, so the
// system instruction stays identical across patients.
function toApiContents(messages: ChatMessage[], profile: ChatRequest['profile']): Content[] {
  return messages.map((m, i) => {
    const parts: Part[] = [{ text: m.text }];
    if (i === 0 && m.role === 'user' && profile) parts.unshift({ text: describeProfile(profile) });
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
}

function describeProfile({ medications, allergies }: NonNullable<ChatRequest['profile']>): string {
  const meds = medications.length
    ? medications
        .map((m) => [m.normalizedName ?? m.enteredName, m.strength, m.frequency].filter(Boolean).join(', '))
        .join('; ')
    : 'none listed';
  const allergyList = allergies.length ? allergies.map((a) => a.substance).join(', ') : 'none listed';
  return `<patient_profile>\nMedications: ${meds}\nAllergies: ${allergyList}\n</patient_profile>`;
}
