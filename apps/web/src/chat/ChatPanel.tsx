import type { ChatMessage, Profile } from '@medifyrx/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { Icon } from '../ui/Icon';

const GREETING =
  "Hi, I'm the medify.Rx assistant. Ask me what a medication is for or what something on your label means. " +
  "I can't give medical advice or change doses. In an emergency, call 911.";

export function ChatPanel({ profile }: { profile: Profile }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const history: ChatMessage[] = [...messages, { role: 'user', text }];
    const setReply = (reply: string) => setMessages([...history, { role: 'assistant', text: reply }]);

    setInput('');
    setError(null);
    setSending(true);
    setReply('');

    try {
      let streamed = '';
      const reply = await api.chat(
        {
          messages: history,
          profile: {
            medications: profile.medications.map(({ enteredName, normalizedName, strength, frequency }) => ({
              enteredName,
              normalizedName,
              strength,
              frequency,
            })),
            allergies: profile.allergies.map(({ substance }) => ({ substance })),
          },
        },
        (chunk) => setReply((streamed += chunk)),
      );
      setReply(reply);
    } catch (e) {
      // Drop the unanswered turn so the history keeps alternating.
      setMessages(messages);
      setInput(text);
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel card chat">
      <div className="panel-head">
        <h3><Icon name="pill" /> Medify?</h3>
        <span className="sample-tag">AI answers, please verify</span>
      </div>
      <div className="chat-log inset" ref={logRef} aria-live="polite">
        <p className="chat-msg chat-assistant">{GREETING}</p>
        {messages.map((m, i) => (
          <p key={i} className={`chat-msg chat-${m.role}`}>
            {m.text || '…'}
          </p>
        ))}
      </div>
      {error && <p className="error small">{error}</p>}
      <form className="ask chat-ask" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What is atorvastatin for?"
          aria-label="Message"
          maxLength={2000}
        />
        <button type="submit" className="btn btn-jelly" disabled={sending || !input.trim()}>
          <span>{sending ? 'Thinking…' : 'Send'}</span>
          <Icon name="arrow-right" />
        </button>
      </form>
      <p className="small muted">
        General information only, not medical advice. Ask your pharmacist or prescriber before changing how you take
        any medication. Emergency: 911 · Poison Control: 1-800-222-1222.
      </p>
    </div>
  );
}
