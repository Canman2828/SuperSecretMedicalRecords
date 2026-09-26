import { api } from '../api/client';
import { plainSegments, type Segment } from './plainLanguage';

export type SimplifySource = 'ai' | 'glossary' | 'mixed';

// The server accepts up to 4000 characters per /api/translate call.
const CHUNK_CHARS = 3500;

/** Split on paragraph breaks (then sentence ends) so each piece fits one request. */
function splitText(text: string): string[] {
  const pieces: string[] = [];
  let cur = '';
  const add = (part: string, sep: string) => {
    if (cur && cur.length + sep.length + part.length > CHUNK_CHARS) {
      pieces.push(cur);
      cur = '';
    }
    cur = cur ? cur + sep + part : part;
  };
  for (const para of text.split(/\n{2,}/)) {
    if (para.length <= CHUNK_CHARS) add(para, '\n\n');
    else for (const sentence of para.match(/[^.!?]+[.!?]*\s*/g) ?? [para]) add(sentence.slice(0, CHUNK_CHARS), '');
  }
  if (cur) pieces.push(cur);
  return pieces;
}

/**
 * Plain-language rewrite. Uses the server's protected AI rewrite (doses, times, drug names and
 * warnings are masked before the model sees them and verified afterwards). Any piece the AI can't
 * do, or whose output fails that check, falls back to the glossary-only version.
 */
export async function simplify(text: string, knownMedications: string[]): Promise<{ segments: Segment[]; source: SimplifySource }> {
  const pieces = splitText(text);
  const results = await Promise.all(
    pieces.map(async (piece) => {
      try {
        const res = await api.translate({ text: piece, knownMedications, mode: 'simple' });
        if (res.source === 'ai' && res.segments.length) return { segments: res.segments as Segment[], ai: true };
      } catch {
        /* server down or AI error: fall through to the glossary */
      }
      return { segments: plainSegments(piece, knownMedications), ai: false };
    }),
  );

  const segments = results.flatMap((r, i) => (i ? [{ text: '\n\n' }, ...r.segments] : r.segments));
  const ai = results.filter((r) => r.ai).length;
  return { segments, source: ai === results.length ? 'ai' : ai === 0 ? 'glossary' : 'mixed' };
}
