import type { ExplainResponse } from '@medifyrx/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { PageHead } from '../layout/Shell';
import { Icon } from '../ui/Icon';

const CATEGORIES = ['Medicines', 'Dosage terms', 'Symptoms', 'Tests and procedures', 'Words I heard'] as const;
const DEPTHS = ['Just the basics', 'A little more', 'The full picture'];
const PAUSE_AFTER_MIN = 15;

// Built-in sample so the depth control has something to show before the first question.
const SAMPLE = {
  term: 'Fever',
  levels: [
    ['A fever means your body is warmer than usual. It is often a sign that your body is fighting off an infection, like a cold or the flu.'],
    ['For most adults, a temperature of 100.4°F (38°C) or higher counts as a fever.', 'Rest, fluids and light clothing can help you feel more comfortable while your body does its work.'],
    ['Fevers are part of how the immune system responds. Many go away on their own within a few days.', 'Call a doctor if a fever lasts more than a few days, keeps rising, or comes with other symptoms that worry you. For babies and young children, check with a pediatrician sooner.'],
  ],
};

const SOURCE_LABEL: Record<ExplainResponse['source'], string> = {
  glossary: 'From the medify glossary',
  ai: 'AI explanation, please verify',
  none: 'No trusted explanation found',
};

/** Minutes the user has spent on this page this visit. Drives the gentle "take a pause" nudge. */
function useReadingMinutes() {
  const [min, setMin] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setMin(Math.floor((Date.now() - started) / 60000)), 15000);
    return () => clearInterval(t);
  }, []);
  return min;
}

export function MedictionaryPage() {
  const [q, setQ] = useState('PRN');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Dosage terms');
  const [answer, setAnswer] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState(0);
  const minutes = useReadingMinutes();

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    try {
      setAnswer(await api.explain({ term: term.slice(0, 100), context: category }));
      setDepth(0);
    } catch (err) {
      setError(`Could not reach the dictionary. ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  // Live answers are one short definition today; deeper levels only exist for the built-in sample.
  const levels = answer ? [[answer.simpleDefinition]] : SAMPLE.levels;
  const maxDepth = levels.length - 1;
  const shown = levels.slice(0, Math.min(depth, maxDepth) + 1).flat();
  const pct = Math.min(1, minutes / PAUSE_AFTER_MIN);

  return (
    <section className="page acc-lav">
      <PageHead icon="book" goal="Conscious learning" title="Medictionary">
        Ask about a medicine, a dosage term or a word you heard at an appointment. Answers start small, and you decide
        when to go deeper.
      </PageHead>

      <form className="ask" onSubmit={ask}>
        <Icon name="search" size={22} style={{ color: 'var(--dusk)' }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Your question" placeholder="A word or term, e.g. PRN" maxLength={100} />
        <button className="btn btn-jelly" disabled={loading}>
          <span>{loading ? 'Looking…' : 'Ask'}</span>
          <Icon name="arrow-right" />
        </button>
      </form>
      <div className="chips" style={{ marginBlock: '20px 30px' }}>
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip${category === c ? ' on' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="grid-side" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,330px)' }}>
        <div className="panel card answer">
          <div className="panel-head">
            <span className="field-label" style={{ margin: 0 }}>How much do you want to know?</span>
            {answer ? <span className="sample-tag">{SOURCE_LABEL[answer.source]}</span> : <span className="sample-tag">Sample answer</span>}
          </div>
          <div className="depth" role="group" aria-label="Answer depth">
            {DEPTHS.map((d, i) => (
              <button key={d} aria-pressed={depth === i} onClick={() => setDepth(i)}>{d}</button>
            ))}
          </div>
          <div style={{ marginTop: 26 }} aria-live="polite">
            {error && <p className="error">{error}</p>}
            <h3>{answer ? answer.term : SAMPLE.term}</h3>
            <div className="body">
              {shown.map((t) => <p key={t}>{t}</p>)}
              {answer && depth > maxDepth && (
                <p className="muted">
                  That is everything we have for this term from trusted sources. Your pharmacist or doctor can tell you
                  more about how it applies to you.
                </p>
              )}
              {answer?.needsVerification && (
                <p className="small muted">Please check this with a pharmacist or healthcare professional.</p>
              )}
            </div>
          </div>
          <div className="reveal">
            {depth < DEPTHS.length - 1 && (
              <button className="btn btn-neu" style={{ height: 42 }} onClick={() => setDepth(depth + 1)}>
                Go one step further<Icon name="arrow-right" />
              </button>
            )}
            <span className="small muted">Nothing extra appears unless you ask for it.</span>
          </div>
        </div>

        <div className="panel card">
          <h3 style={{ justifyContent: 'center', marginBottom: 6 }}>Reading time</h3>
          <div className="gauge">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#E1DDE8" strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" style={{ stroke: 'var(--acc-deep)', transition: 'stroke-dashoffset .6s' }} strokeWidth="6" strokeLinecap="round" strokeDasharray="276.5" strokeDashoffset={276.5 * (1 - pct)} />
            </svg>
            <div className="c"><strong>{minutes}</strong><br /><span>of {PAUSE_AFTER_MIN} min</span></div>
          </div>
          {minutes >= PAUSE_AFTER_MIN && (
            <p className="pause-note neu-in small">You have been reading for a while. This might be a good moment for a short break.</p>
          )}
          <ul className="checks">
            <li><span className="tick"><Icon name="check" /></span>No worst-case lists unless you ask for them</li>
            <li><span className="tick"><Icon name="check" /></span>A gentle pause after {PAUSE_AFTER_MIN} minutes of reading</li>
            <li><span className="tick"><Icon name="check" /></span>Personal questions point you to a clinician</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
