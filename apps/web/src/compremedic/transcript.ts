import type { Segment } from './plainLanguage';

/**
 * A transcript is the text split into words. Each word is one clickable button in the UI and one
 * position on the audio timeline, so selecting, explaining and seeking all share the same index.
 */
export interface Word {
  /** Leading punctuation, e.g. "(" — shown but not part of the button. */
  lead: string;
  /** The word itself (the clickable part). */
  text: string;
  /** Trailing punctuation, e.g. "." */
  tail: string;
  /** Whitespace after the word (may contain line breaks). */
  space: string;
  /** Protected-value group: consecutive words with the same id were copied exactly from the document. */
  lock?: number;
  /** Part of a glossary meaning added beside a word, e.g. "(by mouth)". */
  meaning?: boolean;
  /** A jargon word that has its meaning added beside it. */
  term?: boolean;
  sentence: number;
}

export interface Transcript {
  words: Word[];
  /** Indices where a new speech chunk starts (sentence starts, or every ~25 words in long runs). */
  chunkStarts: number[];
}

const CHUNK_MAX_WORDS = 25;

function tokenize(text: string): Omit<Word, 'sentence'>[] {
  const out: Omit<Word, 'sentence'>[] = [];
  for (const m of text.matchAll(/(\S+)(\s*)/g)) {
    const parts = m[1].match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    const [lead, core, tail] = parts && parts[2] ? [parts[1], parts[2], parts[3]] : ['', m[1], ''];
    out.push({ lead, text: core, tail, space: m[2] });
  }
  return out;
}

/** Build a transcript from display segments (the original, the AI rewrite, or the glossary version). */
export function toTranscript(segments: Segment[]): Transcript {
  const words: Omit<Word, 'sentence'>[] = [];
  let lockId = 0;

  const push = (text: string, extra: Partial<Word> = {}) => {
    // Whitespace at the start of a segment belongs after the previous word.
    const leadingSpace = text.match(/^\s*/)![0];
    if (leadingSpace && words.length) words[words.length - 1].space += leadingSpace;
    for (const t of tokenize(text)) {
      const prev = words[words.length - 1];
      // Bare punctuation glued to the previous word (". Take" after a locked value) joins its tail.
      if (!/[\p{L}\p{N}]/u.test(t.text) && prev && !prev.space) {
        prev.tail += t.lead + t.text + t.tail;
        prev.space = t.space;
        continue;
      }
      words.push({ ...t, ...extra });
    }
  };

  for (const s of segments) {
    if (s.lock) push(s.text, { lock: ++lockId });
    else push(s.text, s.term ? { term: true } : {});
    if (s.meaning && words.length) {
      const last = words[words.length - 1];
      const after = last.space;
      last.space = ' ';
      const added = tokenize(s.meaning).map((t) => ({ ...t, meaning: true }));
      if (added.length) {
        added[0].lead = '(' + added[0].lead;
        added[added.length - 1].tail += ')';
        added[added.length - 1].space = after;
        words.push(...added);
      }
    }
  }

  // Sentences and speech chunks. Chunking keeps each utterance short, which is what makes
  // seeking work (and avoids Chrome cutting off long utterances).
  const out: Word[] = [];
  const chunkStarts: number[] = [];
  let sentence = 0;
  let sinceChunk = 0;
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const endedSentence = !prev || /[.!?;:]/.test(prev.tail) || prev.space.includes('\n');
    if (prev && endedSentence) sentence++;
    if (endedSentence || sinceChunk >= CHUNK_MAX_WORDS) {
      chunkStarts.push(i);
      sinceChunk = 0;
    }
    sinceChunk++;
    out.push({ ...w, sentence });
  });
  return { words: out, chunkStarts };
}

/** How a word is spoken / copied: with its punctuation, which gives the voice natural pauses. */
export const wordString = (w: Word) => w.lead + w.text + w.tail;

/**
 * What text-to-speech actually says for a word. Fill-in blanks ("________") and runs of symbols
 * ("-----", "*****", "!!!") would otherwise be read out character by character.
 */
export function spokenString(w: Word): string {
  const s = wordString(w);
  if (!/[\p{L}\p{N}]/u.test(s) && s.length > 1) return ''; // a symbols-only token like "----" or "***": silent
  return s
    .replace(/_+/g, ' ') // "X______" -> "X"
    .replace(/([^\p{L}\p{N}\s])\1+/gu, '$1') // "...", "!!!", "--" -> one
    .trim();
}

/** The sentence a word sits in, as plain text (context for explanations). */
export function sentenceOf(t: Transcript, index: number): string {
  const s = t.words[index]?.sentence;
  return t.words.filter((w) => w.sentence === s).map((w) => wordString(w)).join(' ');
}

/** Group selected word indices into runs of consecutive words ("phrases"). */
export function phrases(selected: Iterable<number>): number[][] {
  const sorted = [...selected].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const i of sorted) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1] === i - 1) run.push(i);
    else runs.push([i]);
  }
  return runs;
}
