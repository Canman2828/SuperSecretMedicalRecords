import { useEffect, useState } from 'react';

export const SPEEDS = [0.75, 1, 1.25] as const;

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Browser text-to-speech (Web Speech API). Only one voice plays at a time across the page. */
export function useSpeech() {
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => { if (supported) speechSynthesis.cancel(); }, []);

  const toggle = (id: string, text: string, rate: number) => {
    if (!supported) return;
    speechSynthesis.cancel();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.onend = u.onerror = () => setPlaying((p) => (p === id ? null : p));
    setPlaying(id);
    speechSynthesis.speak(u);
  };

  return { supported, playing, toggle };
}
