import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient } from './api';

function streamResponse(parts: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('chat uses the supplied native transport and handles split SSE frames', async () => {
  const controller = new AbortController();
  const body = { messages: [{ role: 'user' as const, text: 'What can the app do?' }] };
  const chunks: string[] = [];
  const api = createApiClient('http://example.test', undefined, async (url, init) => {
    assert.equal(url, 'http://example.test/api/chat');
    assert.deepEqual(JSON.parse(String(init?.body)), body);
    assert.equal(init?.signal, controller.signal);
    return streamResponse([
      'data: {"type":"te',
      'xt","text":"Hello "}\n',
      '\ndata: {"type":"text","text":"there"}\n\ndata: {"type":"done","text":"Hello there"}\n\n',
    ]);
  });
  assert.equal(await api.chat(body, text => chunks.push(text), controller.signal), 'Hello there');
  assert.deepEqual(chunks, ['Hello ', 'there']);
});

test('chat surfaces server errors instead of treating them as answers', async () => {
  const api = createApiClient('http://example.test', undefined, async () =>
    streamResponse(['data: {"type":"error","message":"Please try again."}\n\n']));
  await assert.rejects(api.chat({ messages: [{ role: 'user', text: 'Hello' }] }, () => {}), /Please try again/);
});

test('chat rejects a stream that ends without a complete answer', async () => {
  const api = createApiClient('http://example.test', undefined, async () =>
    streamResponse(['data: {"type":"text","text":"Partial"}\n\n']));
  await assert.rejects(api.chat({ messages: [{ role: 'user', text: 'Hello' }] }, () => {}), /reply was cut off/);
});
