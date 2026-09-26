import { parseCriticalFields, type Annotation, type OcrWord } from '@medifyrx/shared';

/**
 * A run of text. `lock` = copied exactly from the original and never reworded.
 * Same shape as the server's TranslateSegment, so AI rewrites and this glossary fallback render alike.
 */
export interface Segment {
  text: string;
  lock?: boolean;
  /** Plain-language meaning from the shared glossary, shown next to (never instead of) the printed word. */
  meaning?: string;
  /** Explained jargon (not a protected value). */
  term?: boolean;
}

interface Token {
  text: string;
  space: string; // whitespace that followed it
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(/(\S+)(\s*)/g)) tokens.push({ text: m[1], space: m[2] });
  return tokens;
}

/**
 * Runs the same deterministic parser the phone highlighter uses (no AI).
 * Words get fake 1-unit boxes along x so an annotation's box maps straight back to a word range.
 */
function annotate(tokens: Token[], knownMedications: string[]) {
  const words: OcrWord[] = tokens.map((t, i) => ({ text: t.text, bbox: { x: i, y: 0, width: 1, height: 1 }, confidence: 1 }));
  const byStart = new Map<number, Annotation & { end: number }>();
  for (const a of parseCriticalFields(words, knownMedications)) {
    byStart.set(a.bbox.x, { ...a, end: a.bbox.x + a.bbox.width });
  }
  return byStart;
}

// Two-letter ALL-CAPS tokens are usually acronyms (GI, IV, ER) unless they are everyday words.
const SHORT_WORDS = new Set('OF TO IF OR IN ON BY AT AN AS IS IT BE DO NO SO UP MY WE US ME HE AM GO'.split(' '));
const isAcronym = (s: string) => {
  const w = s.replace(/[^A-Za-z]/g, '');
  return w.length === 2 && w === w.toUpperCase() && !SHORT_WORDS.has(w);
};

const joined = (tokens: Token[]) => tokens.map((t, i) => t.text + (i < tokens.length - 1 ? t.space : '')).join('');

/** Split trailing punctuation off so "DAYS." locks "DAYS" and leaves the full stop as plain text. */
function splitTrailing(s: string): [string, string] {
  const m = s.match(/^(.*?)([.,;:!?)]*)$/s)!;
  return [m[1], m[2]];
}

/** Original text with protected values marked. The text itself is untouched. */
export function originalSegments(text: string, knownMedications: string[] = []): Segment[] {
  const tokens = tokenize(text);
  const ann = annotate(tokens, knownMedications);
  const out: Segment[] = [];
  for (let i = 0; i < tokens.length; ) {
    const a = ann.get(i);
    if (a?.immutable) {
      const span = tokens.slice(i, a.end);
      const [core, tail] = splitTrailing(joined(span));
      out.push({ text: core, lock: true }, { text: tail + span[span.length - 1].space });
      i = a.end;
    } else {
      out.push({ text: tokens[i].text + tokens[i].space });
      i += 1;
    }
  }
  return out;
}

/**
 * Plain-language version. Built only from the glossary:
 *  - protected values (dose, frequency, route, warnings) are copied exactly, with the meaning added beside them
 *  - jargon keeps the printed word, with its glossary meaning beside it
 *  - ALL-CAPS label text is put into sentence case so it's easier to read (short acronyms like GI stay as-is)
 */
export function plainSegments(text: string, knownMedications: string[] = []): Segment[] {
  const tokens = tokenize(text);
  const ann = annotate(tokens, knownMedications);
  const letters = text.replace(/[^A-Za-z]/g, '');
  const shouty = letters.length > 0 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7;

  let sentenceStart = true;
  const soften = (s: string) => {
    let r = shouty && !isAcronym(s) ? s.toLowerCase() : s;
    if (sentenceStart) r = r.charAt(0).toUpperCase() + r.slice(1);
    sentenceStart = /[.!?]$/.test(s);
    return r;
  };

  const out: Segment[] = [];
  for (let i = 0; i < tokens.length; ) {
    // Label lines are sentences of their own: capitalize after a line break too.
    if (i > 0 && tokens[i - 1].space.includes('\n')) sentenceStart = true;
    const a = ann.get(i);
    if (a?.immutable) {
      const span = tokens.slice(i, a.end);
      const [core, tail] = splitTrailing(joined(span));
      out.push({ text: core, lock: true, meaning: a.explanation });
      out.push({ text: tail + span[span.length - 1].space });
      sentenceStart = /[.!?]$/.test(tail);
      i = a.end;
    } else if (a?.explanation) {
      const [core, tail] = splitTrailing(tokens[i].text);
      out.push({ text: soften(core), meaning: a.explanation, term: true });
      out.push({ text: tail + tokens[i].space });
      sentenceStart = /[.!?]$/.test(tail);
      i += 1;
    } else {
      out.push({ text: soften(tokens[i].text) + tokens[i].space });
      i += 1;
    }
  }
  return out;
}
