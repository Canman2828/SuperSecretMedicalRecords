import { ApiError } from '@google/genai';
import type { ChatRequest, ChatStreamEvent } from '@medifyrx/shared';
import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { chatSchema } from '../schemas.js';
import { chatEnabled, streamChatReply } from '../services/chat.js';

export const chatRouter = Router();

// After every 10th question in a conversation, the reply ends with a nudge toward a real professional.
const PROFESSIONAL_NUDGE_EVERY = 10;
const PROFESSIONAL_NUDGE =
  "You've asked a lot of good questions. A pharmacist or your doctor can look at your full situation and give you " +
  'answers that fit you, so it may help to talk with one of them next.';

// POST /api/chat { messages, profile? } — medication Q&A for guests; nothing is stored.
// Streams server-sent events: {type:'text'} chunks, then {type:'done'} or {type:'error'}.
chatRouter.post('/', validateBody(chatSchema), async (req, res) => {
  if (!chatEnabled()) {
    return res.status(503).json({ error: 'The assistant is not configured on this server.' });
  }

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (event: ChatStreamEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  const abort = new AbortController();
  res.on('close', () => abort.abort());

  const questions = (req.body as ChatRequest).messages.filter((m) => m.role === 'user').length;
  const nudge = questions % PROFESSIONAL_NUDGE_EVERY === 0;

  try {
    let text = await streamChatReply(req.body, (chunk) => send({ type: 'text', text: chunk }), abort.signal);
    if (nudge) {
      const addition = `\n\n${PROFESSIONAL_NUDGE}`;
      send({ type: 'text', text: addition });
      text += addition;
    }
    send({ type: 'done', text });
  } catch (err) {
    if (abort.signal.aborted) return; // patient left
    // Log the error only, never the request: it contains health information.
    console.error('Chat failed:', err instanceof Error ? err.message : err);
    send({ type: 'error', message: errorMessage(err) });
  } finally {
    res.end();
  }
});

function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return 'Too many requests right now. Please try again in a moment.';
  if (err instanceof TypeError) return "Couldn't reach the assistant. Please try again."; // fetch network failure
  return 'Something went wrong. Please try again.';
}
