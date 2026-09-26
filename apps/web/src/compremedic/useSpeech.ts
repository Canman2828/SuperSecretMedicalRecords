import { useEffect, useRef, useState } from 'react';
import { spokenString, type Transcript } from './transcript';

// Web Speech accepts rates up to 10×; some voices stop getting faster well before that.
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10] as const;
export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

// Typical text-to-speech pace at 1×, used only to show an estimated timeline.
const WORDS_PER_MINUTE = 165;
export const secondsAt = (wordIndex: number, rate: number) => (wordIndex * 60) / (WORDS_PER_MINUTE * rate);

// Only one track speaks at a time across the page.
let owner: { stop: () => void } | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  // Local voices report word boundaries reliably, which keeps the playhead on the right word.
  return voices.find((v) => v.localService && v.lang.startsWith('en')) ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
}

export interface SpeechTrack {
  /** Index of the word being read (or where playback will start). */
  position: number;
  playing: boolean;
  rate: number;
  total: number;
  toggle: () => void;
  /** Move the playhead to a word. Keeps playing if already playing; `autoplay` starts playback. */
  seek: (wordIndex: number, autoplay?: boolean) => void;
  setRate: (rate: number) => void;
}

/**
 * Browser text-to-speech with a seekable timeline.
 * The Web Speech API can't seek, so the transcript is spoken one short chunk (sentence) at a time;
 * seeking cancels and restarts from the chosen word. Word-boundary events move the playhead
 * within a chunk; chunk ends move it even on voices that don't report boundaries.
 */
export function useSpeechTrack(t: Transcript): SpeechTrack {
  const [position, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const pos = useRef(0);
  const rateRef = useRef(1);
  const playingRef = useRef(false);
  const gen = useRef(0);
  const self = useRef({ stop: () => {} });

  const setPosition = (i: number) => {
    pos.current = i;
    setPos(i);
  };

  const stop = () => {
    gen.current++;
    playingRef.current = false;
    setPlaying(false);
  };
  self.current.stop = stop;

  // A new or edited document: stop and rewind.
  useEffect(() => {
    if (owner === self.current) speechSynthesis.cancel();
    stop();
    setPosition(0);
  }, [t]);

  useEffect(
    () => () => {
      if (owner === self.current) {
        speechSynthesis.cancel();
        owner = null;
      }
      gen.current++;
    },
    [],
  );

  const speakChunk = (from: number, g: number) => {
    if (gen.current !== g) return;
    const words = t.words;
    if (from >= words.length) {
      stop();
      setPosition(words.length);
      return;
    }
    const end = t.chunkStarts.find((c) => c > from) ?? words.length;
    let text = '';
    const starts: number[] = [];
    for (let k = from; k < end; k++) {
      starts.push(text.length);
      const spoken = spokenString(words[k]);
      if (spoken) text += spoken + ' ';
    }
    // Nothing to say (e.g. a line of blanks): move on rather than queue an empty utterance.
    if (!text.trim()) {
      speakChunk(end, g);
      return;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.rate = rateRef.current;
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.onboundary = (e) => {
      if (gen.current !== g || (e.name && e.name !== 'word')) return;
      let k = 0;
      while (k + 1 < starts.length && starts[k + 1] <= e.charIndex) k++;
      setPosition(from + k);
    };
    u.onend = () => {
      if (gen.current !== g) return;
      speakChunk(end, g);
    };
    u.onerror = (e) => {
      if (gen.current !== g || e.error === 'interrupted' || e.error === 'canceled') return;
      stop();
    };
    setPosition(from);
    speechSynthesis.speak(u);
  };

  const play = (from: number) => {
    if (!speechSupported || !t.words.length) return;
    if (owner && owner !== self.current) owner.stop();
    owner = self.current;
    const start = from >= t.words.length ? 0 : Math.max(0, from);
    const g = ++gen.current;
    speechSynthesis.cancel();
    playingRef.current = true;
    setPlaying(true);
    setPosition(start);
    // Chrome can drop an utterance queued in the same tick as cancel().
    setTimeout(() => speakChunk(start, g), 60);
  };

  const pause = () => {
    stop();
    speechSynthesis.cancel();
  };

  return {
    position,
    playing,
    rate,
    total: t.words.length,
    toggle: () => (playingRef.current ? pause() : play(pos.current)),
    seek: (i, autoplay = false) => {
      const at = Math.min(Math.max(0, i), t.words.length);
      if (playingRef.current || autoplay) play(at);
      else setPosition(at);
    },
    setRate: (r) => {
      rateRef.current = r;
      setRateState(r);
      if (playingRef.current) play(pos.current);
    },
  };
}
