import { ApiError } from '@google/genai';
import type { ChatStreamEvent } from '@medifyrx/shared';
import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { chatSchema } from '../schemas.js';
import { chatEnabled, streamChatReply } from '../services/chat.js';

export const chatRouter = Router();

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

  try {
    const text = await streamChatReply(req.body, (chunk) => send({ type: 'text', text: chunk }), abort.signal);
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
