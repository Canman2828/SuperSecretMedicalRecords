import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import type { Transcript, Word } from './transcript';
import { secondsAt, speechSupported, SPEEDS, type SpeechTrack } from './useSpeech';

interface TranscriptProps {
  transcript: Transcript;
  selected: Set<number>;
  /** Word being read aloud right now, if this track is playing. */
  reading: number | null;
  onToggle: (i: number) => void;
  onSeek: (i: number) => void;
  label: string;
  mono?: boolean;
}

/**
 * Every word is an invisible button: left-click toggles its highlight, right-click
 * (or the keyboard's context-menu key) jumps the audio to where it's read.
 */
export function TranscriptView({ transcript, selected, reading, onToggle, onSeek, label, mono }: TranscriptProps) {
  const box = useRef<HTMLDivElement>(null);

  // Keep the word being read in view inside the scrollable pane.
  useEffect(() => {
    if (reading === null || !box.current) return;
    const el = box.current.querySelector<HTMLElement>(`[data-i="${reading}"]`);
    if (!el) return;
    const { scrollTop, clientHeight } = box.current;
    if (el.offsetTop < scrollTop || el.offsetTop > scrollTop + clientHeight - 40) {
      box.current.scrollTo({ top: el.offsetTop - clientHeight / 3, behavior: 'smooth' });
    }
  }, [reading]);

  const indexOf = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    return el ? Number(el.dataset.i) : null;
  };

  const words = transcript.words;
  const out: ReactNode[] = [];
  const renderWord = (w: Word, i: number, withTail = true) => (
    <span key={i}>
      {w.lead}
      <button
        type="button"
        data-i={i}
        className={`w${w.term ? ' term' : ''}${selected.has(i) ? ' sel' : ''}${reading === i ? ' reading' : ''}`}
        aria-pressed={selected.has(i)}
      >
        {w.text}
      </button>
      {withTail && w.tail + w.space}
    </span>
  );

  // Group protected values (.lock) and added meanings (.meaning) so they render as one highlight.
  for (let i = 0; i < words.length; ) {
    const w = words[i];
    const same = (x: Word | undefined) => !!x && (w.lock ? x.lock === w.lock : w.meaning ? !!x.meaning : false);
    if (!w.lock && !w.meaning) {
      out.push(renderWord(w, i));
      i++;
      continue;
    }
    let j = i;
    while (same(words[j + 1])) j++;
    const group = words.slice(i, j + 1);
    const last = words[j];
    out.push(
      <span key={`g${i}`}>
        <span className={w.lock ? 'lock' : 'meaning'} title={w.lock ? 'Copied exactly from your document' : undefined}>
          {group.map((g, k) => renderWord(g, i + k, k < group.length - 1))}
          {w.meaning && last.tail}
        </span>
        {!w.meaning && last.tail}
        {last.space}
      </span>,
    );
    i = j + 1;
  }

  return (
    <div
      ref={box}
      className={`pane-text transcript${mono ? ' orig' : ''}`}
      role="group"
      aria-label={`${label}. Select words to explain them.`}
      onClick={(e) => {
        const i = indexOf(e);
        if (i !== null) onToggle(i);
      }}
      onContextMenu={(e) => {
        const i = indexOf(e);
        if (i === null) return;
        e.preventDefault();
        onSeek(i);
      }}
    >
      {out}
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const BARS = Array.from({ length: 48 }, (_, i) => 20 + 60 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.4)));

/** Labeled read-aloud player: play/pause, a scrubbable waveform, estimated time, and speed. */
export function Player({ label, track }: { label: string; track: SpeechTrack }) {
  const { position, playing, rate, total } = track;
  const progress = total ? position / total : 0;
  const disabled = !speechSupported || total === 0;

  return (
    <div className="player-wrap">
      <span className="player-label"><Icon name="volume" size={15} />{label}</span>
      <div className="player neu">
        <button className="play btn-jelly" aria-label={playing ? `Pause ${label}` : `Play ${label}`} disabled={disabled} onClick={track.toggle}>
          <svg aria-hidden="true"><use href={playing ? '#i-pause' : '#i-play'} /></svg>
        </button>
        <div className={`wave scrub${playing ? ' playing' : ''}`}>
          {BARS.map((h, i) => (
            <i key={i} className={i / BARS.length < progress ? 'past' : undefined} style={{ height: `${h}%`, animationDelay: `${-i * 0.07}s` }} />
          ))}
          <input
            type="range"
            min={0}
            max={Math.max(total, 1)}
            step={1}
            value={position}
            disabled={disabled}
            aria-label={`Scrub through ${label}`}
            aria-valuetext={`Word ${Math.min(position + 1, total)} of ${total}`}
            onChange={(e) => track.seek(Number(e.target.value))}
          />
        </div>
        <span className="time" aria-hidden="true">
          {fmt(secondsAt(position, rate))} / {fmt(secondsAt(total, rate))}
        </span>
        <select className="speed-select" value={rate} aria-label={`Reading speed for ${label}`} onChange={(e) => track.setRate(Number(e.target.value))}>
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </div>
    </div>
  );
}
