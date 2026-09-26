import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';

export const SPEEDS = [0.75, 1, 1.25] as const;

/** On-device text-to-speech (web: useSpeech on the Web Speech API). Only one voice plays at a time. */
export function useSpeech() {
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => { Speech.stop(); }, []);

  const toggle = (id: string, text: string, rate: number) => {
    Speech.stop();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const done = () => setPlaying((p) => (p === id ? null : p));
    setPlaying(id);
    Speech.speak(text, { rate, language: 'en-US', onDone: done, onStopped: done, onError: done });
  };

  return { playing, toggle };
}
