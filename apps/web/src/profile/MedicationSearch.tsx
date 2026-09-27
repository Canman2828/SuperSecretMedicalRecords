import type { DrugSearchResult } from '@medifyrx/shared';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Icon } from '../ui/Icon';

interface Props {
  onSelect: (drug: DrugSearchResult | { name: string; rxCui?: undefined }) => void;
}

/** RxNorm-backed autocomplete so the same drug always gets the same RxCUI. */
export function MedicationSearch({ onSelect }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults((await api.searchDrugs(q)).results);
      } catch {
        setError('Search unavailable. You can still add it as typed.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (d: DrugSearchResult | { name: string }) => {
    onSelect(d);
    setQ('');
    setResults([]);
  };

  return (
    <div className="search">
      <label className="field-label" htmlFor="medIn">Add a medication</label>
      <form
        className="input"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) pick(results[0] ?? { name: q.trim() });
        }}
      >
        <input
          id="medIn"
          placeholder="e.g. Lopressor"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
        />
        <button className="icon-btn" aria-label="Add medication"><Icon name="plus" /></button>
      </form>
      {(results.length > 0 || loading || error || q.trim().length >= 2) && (
        <ul className="search-results">
          {loading && <li className="muted small">Searching RxNorm…</li>}
          {error && <li className="muted small">{error}</li>}
          {results.map((r) => (
            <li key={r.rxCui}>
              <button type="button" onClick={() => pick(r)}>
                {r.name} <span className="muted small">RxCUI {r.rxCui}</span>
              </button>
            </li>
          ))}
          {!loading && q.trim().length >= 2 && (
            <li>
              <button type="button" className="muted" onClick={() => pick({ name: q.trim() })}>
                Add “{q.trim()}” as typed
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
