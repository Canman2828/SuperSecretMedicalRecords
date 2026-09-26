import { lookupGlossary, type ExplainResponse, type MedDocument } from '@medifyrx/shared';
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { api } from '../api/client';
import { PageHead } from '../layout/Shell';
import { Icon } from '../ui/Icon';
import { CameraCapture } from './CameraCapture';
import { ACCEPT, ExtractError, extractText, type ExtractMethod } from './extractText';
import { originalSegments, type Segment } from './plainLanguage';
import { simplify, type SimplifySource } from './simplify';
import { phrases, sentenceOf, toTranscript, type Transcript } from './transcript';
import { Player, TranscriptView } from './TranscriptView';
import { useSpeechTrack } from './useSpeech';

type View = 'orig' | 'plain' | 'both';
type Side = 'orig' | 'plain';

// Synthetic sample for demos.
const SAMPLE_TEXT =
  'AMOXICILLIN 500 MG CAPSULES\nTAKE 1 CAPSULE PO 3 TIMES DAILY FOR 10 DAYS. COMPLETE FULL COURSE OF THERAPY. MAY CAUSE GI UPSET; MAY TAKE WITH FOOD. DISCONTINUE AND CONTACT PRESCRIBER IF RASH OR URTICARIA OCCURS.';

const METHOD_LABEL: Record<ExtractMethod | 'sample' | 'saved', string> = {
  photo: 'Read from photo',
  pdf: 'Read from PDF',
  'scanned-pdf': 'Read from scanned PDF',
  docx: 'Read from Word document',
  sample: 'Sample label',
  saved: 'Saved from your phone',
};

const SOURCE_NOTE: Record<SimplifySource, string> = {
  ai: 'Rewritten in plain words. Doses, times and warnings are locked.',
  mixed: 'Partly rewritten; some parts use the medify glossary. Locked values are unchanged.',
  glossary: 'Simplified with the medify glossary (AI rewrite unavailable).',
};

const EXPLAIN_SOURCE: Record<ExplainResponse['source'], string> = {
  glossary: 'medify glossary',
  ai: 'AI explanation, please verify',
  none: 'No trusted explanation found',
};

const EMPTY: Transcript = { words: [], chunkStarts: [] };

interface Doc {
  name: string;
  method: ExtractMethod | 'sample' | 'saved';
  confidence?: number;
  text: string;
}

/** The single explanation for the most recent "Explain selected words" click. */
interface Explanation {
  phrases: { text: string; locked: boolean }[];
  sentences: string[];
  parts: { word: string; meaning: string }[];
  status: 'loading' | 'done' | 'error';
  result?: ExplainResponse;
}

const isTouch = () => matchMedia('(pointer: coarse)').matches;

export function CompremedicPage({ knownMedications, loggedIn }: { knownMedications: string[]; loggedIn: boolean }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [open, setOpen] = useState({ upload: true, read: false, saved: false });

  // Documents the user saved from the phone app (Compremedic cloud save). Signed-in users only.
  const [saved, setSaved] = useState<MedDocument[]>([]);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [viewingSaved, setViewingSaved] = useState<MedDocument | null>(null);
  const [busy, setBusy] = useState<{ label: string; fraction?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [camera, setCamera] = useState(false);

  const [simplified, setSimplified] = useState<{ segments: Segment[]; source: SimplifySource } | null>(null);
  const [simplifying, setSimplifying] = useState(false);
  const [view, setView] = useState<View>('both');
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<Side, Set<number>>>({ orig: new Set(), plain: new Set() });
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  // Bumped on every explain/clear so a slow reply for an older selection is ignored.
  const explainRequest = useRef(0);

  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const origT = useMemo(() => (doc ? toTranscript(originalSegments(doc.text, knownMedications)) : EMPTY), [doc, knownMedications]);
  const plainT = useMemo(() => (simplified ? toTranscript(simplified.segments) : EMPTY), [simplified]);
  const origTrack = useSpeechTrack(origT);
  const plainTrack = useSpeechTrack(plainT);
  const transcripts: Record<Side, Transcript> = { orig: origT, plain: plainT };

  // New text: rewrite it in plain words and clear anything tied to the old words.
  useEffect(() => {
    clearSelection();
    setSimplified(null);
    if (!doc) return;
    let cancelled = false;
    setSimplifying(true);
    simplify(doc.text, knownMedications)
      .then((r) => !cancelled && setSimplified(r))
      .finally(() => !cancelled && setSimplifying(false));
    return () => {
      cancelled = true;
    };
  }, [doc, knownMedications]);

  const accept = (d: Doc) => {
    setDoc(d);
    setEditing(null);
    setOpen((o) => ({ ...o, upload: false, read: true }));
  };

  // Load the user's cloud-saved documents (from the phone app) once signed in.
  useEffect(() => {
    if (!loggedIn) {
      setSaved([]);
      return;
    }
    let alive = true;
    setSavedError(null);
    api
      .listDocuments()
      .then((r) => {
        if (!alive) return;
        setSaved(r.documents);
        if (r.documents.length) setOpen((o) => ({ ...o, saved: true })); // surface them, don't hide behind a collapsed step
      })
      .catch(() => alive && setSavedError('Could not load your saved documents. Please try again.'));
    return () => {
      alive = false;
    };
  }, [loggedIn]);

  // Open a saved document in the reader above (re-simplifies its original text).
  const openSaved = (d: MedDocument) => {
    accept({ name: d.docType ?? 'Saved document', method: 'saved', text: d.originalText || d.plainText });
    setOpen((o) => ({ ...o, read: true }));
    setTimeout(() => document.getElementById('step-read')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const deleteSaved = (id: string) => {
    const prev = saved;
    setSaved((s) => s.filter((x) => x.id !== id)); // optimistic
    api.deleteDocument(id).catch(() => {
      setSaved(prev);
      setSavedError('Could not delete that document. Please try again.');
    });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setError(null);
    setBusy({ label: 'Starting…' });
    try {
      const r = await extractText(file, (label, fraction) => setBusy({ label, fraction }));
      accept({ name: file.name, method: r.method, confidence: r.confidence, text: r.text });
    } catch (e) {
      setError(e instanceof ExtractError ? e.message : 'Something went wrong while reading that file. Please try another photo or file.');
    } finally {
      setBusy(null);
      // The file isn't kept anywhere: clear the inputs so the same file can be chosen again.
      if (fileInput.current) fileInput.current.value = '';
      if (cameraInput.current) cameraInput.current.value = '';
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void handleFile(e.dataTransfer.files[0]);
  };

  const takePhoto = () => {
    if (!isTouch() && 'mediaDevices' in navigator) setCamera(true);
    else cameraInput.current?.click();
  };

  const toggleWord = (side: Side, i: number) =>
    setSelected((s) => {
      const next = new Set(s[side]);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return { ...s, [side]: next };
    });

  const seekTo = (side: Side, i: number) => (side === 'orig' ? origTrack : plainTrack).seek(i, true);

  const selectionCount = selected.orig.size + selected.plain.size;
  const visibleSides: Side[] = view === 'both' ? ['orig', 'plain'] : [view];

  function clearSelection() {
    explainRequest.current++;
    setSelected({ orig: new Set(), plain: new Set() });
    setExplanation(null);
  }

  // One explanation for the whole current selection. Each click replaces the previous one.
  const explainSelected = () => {
    const found: Explanation['phrases'] = [];
    const sentences = new Set<string>();
    const words: string[] = [];
    for (const side of ['orig', 'plain'] as Side[]) {
      const t = transcripts[side];
      for (const run of phrases(selected[side])) {
        const ws = run.map((i) => t.words[i]).filter(Boolean);
        if (!ws.length) continue;
        const text = ws.map((w, k) => (k ? w.lead : '') + w.text + (k < ws.length - 1 ? w.tail : '')).join(' ');
        if (!found.some((p) => p.text.toLowerCase() === text.toLowerCase())) found.push({ text, locked: ws.every((w) => w.lock) });
        run.forEach((i) => sentences.add(sentenceOf(t, i)));
        words.push(...ws.map((w) => w.text));
      }
    }
    if (!found.length) return;

    const parts =
      words.length > 1
        ? [...new Set(words.map((w) => w.toUpperCase()))].flatMap((w) => {
            const g = lookupGlossary(w);
            return g ? [{ word: w, meaning: g.meaning }] : [];
          })
        : [];
    const id = ++explainRequest.current;
    setExplanation({ phrases: found, sentences: [...sentences], parts, status: 'loading' });
    api
      .explain({
        term: found.map((p) => p.text).join(', ').slice(0, 100),
        context: `From a medical document: "${[...sentences].join(' ')}"`.slice(0, 1000),
      })
      .then((result) => id === explainRequest.current && setExplanation((x) => x && { ...x, status: 'done', result }))
      .catch(() => id === explainRequest.current && setExplanation((x) => x && { ...x, status: 'error' }));
  };

  const uploaded = !!doc;
  const lowConfidence = doc?.confidence !== undefined && doc.confidence < 0.75;

  return (
    <section className="page acc-steel">
      <PageHead icon="scan" goal="Comprehension" title="Compremedic">
        Snap a picture or upload an image, .docx, or pdf document of a prescription, consent form, or other medical
        document. Read or listen to the document rewritten in plain words, free of medical jargon or complicated legal
        language, and highlight text to get further explanations where needed.
      </PageHead>

      <div className="howto">
        <span className="howto-item neu-in">
          <span className="mouse l" aria-hidden="true"><Icon name="pointer" size={16} /></span>
          <span><b>Left-click</b> any word to highlight it, then choose <b>Explain selected words</b>.</span>
        </span>
        <span className="howto-item neu-in">
          <span className="mouse r" aria-hidden="true"><Icon name="play" size={14} /></span>
          <span><b>Right-click</b> any word to jump the audio to where it’s read.</span>
        </span>
      </div>

      <ol className="checklist">
        {/* ---------- Step 1 ---------- */}
        <Step
          n={1}
          id="upload"
          title="Upload or take a photo"
          done={uploaded}
          open={open.upload}
          onToggle={() => setOpen((o) => ({ ...o, upload: !o.upload }))}
          status={uploaded && <span className="cl-ok"><Icon name="check" size={14} />Upload successful</span>}
          summary={doc && <span className="cl-file"><Icon name="file" size={15} />{doc.name}</span>}
        >
          <div
            className={`drop${over ? ' over' : ''}${busy ? ' busy' : ''}`}
            onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
            onDrop={onDrop}
          >
            {busy ? (
              <div className="progress-box" aria-live="polite">
                <span className="icon-btn"><Icon name="scan" /></span>
                <strong>{busy.label}</strong>
                <span className="progress"><span style={{ width: `${Math.round((busy.fraction ?? 0.04) * 100)}%` }} /></span>
                <span className="muted small">Your document is read on this device and isn’t uploaded or saved.</span>
              </div>
            ) : (
              <>
                <span className="icon-btn"><Icon name="camera" /></span>
                <strong>Take a photo or drop a file here</strong>
                <span className="muted small">Photos, PDFs and Word documents (.docx). Scanned PDFs work too.</span>
                <span className="drop-actions">
                  <button type="button" className="btn btn-jelly" style={{ height: 44 }} onClick={takePhoto}><Icon name="camera" />Take photo</button>
                  <button type="button" className="btn btn-neu" style={{ height: 44 }} onClick={() => fileInput.current?.click()}><Icon name="upload" />Upload file</button>
                </span>
              </>
            )}
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
          <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => handleFile(e.target.files?.[0])} />

          {error && <p className="step-error" role="alert">{error}</p>}
          <p className="small muted sample-line">
            No document handy?{' '}
            <button type="button" className="text-btn" disabled={!!busy} onClick={() => accept({ name: 'Sample prescription label', method: 'sample', text: SAMPLE_TEXT })}>
              Try a sample label
            </button>
          </p>
        </Step>

        {/* ---------- Step 2 ---------- */}
        <Step
          n={2}
          id="read"
          title="Read and listen"
          done={false}
          disabled={!uploaded}
          open={open.read && uploaded}
          onToggle={() => setOpen((o) => ({ ...o, read: !o.read }))}
          status={!uploaded && <span className="cl-wait">Unlocks after your upload</span>}
        >
          <div className="read-toolbar">
            <div className="seg view-seg" role="group" aria-label="Which text to show">
              <button aria-pressed={view === 'orig'} onClick={() => setView('orig')}>Original Text</button>
              <button aria-pressed={view === 'plain'} onClick={() => setView('plain')}>Simplified Text</button>
              <button aria-pressed={view === 'both'} onClick={() => setView('both')}>Show Both</button>
            </div>
            {doc && <span className="sample-tag">{METHOD_LABEL[doc.method]}</span>}
          </div>

          {lowConfidence && (
            <p className="notice neu-in small">
              Some words may have been misread. Compare the original text with your document, and use{' '}
              <b>Correct the text</b> to fix any mistakes.
            </p>
          )}

          <div className={`read-cols${view === 'both' ? ' both' : ''}`}>
            {visibleSides.map((side) => (
              <div className="pane" key={side}>
                <div className="pane-head">
                  <span className="field-label" style={{ margin: 0 }}>{side === 'orig' ? 'Original text' : 'Simplified text'}</span>
                  {side === 'orig' && editing === null && doc && (
                    <button className="text-btn small" onClick={() => setEditing(doc.text)}>Correct the text</button>
                  )}
                  {side === 'plain' && simplified && <span className="small muted">{SOURCE_NOTE[simplified.source]}</span>}
                </div>

                {side === 'orig' && editing !== null ? (
                  <div className="edit-box">
                    <textarea className="textbox" rows={10} value={editing} onChange={(e) => setEditing(e.target.value)} aria-label="Original text" />
                    <div className="btn-row">
                      <button className="btn btn-jelly" style={{ height: 40 }} disabled={!editing.trim()} onClick={() => doc && accept({ ...doc, text: editing.trim(), confidence: undefined })}>Save text</button>
                      <button className="btn btn-neu" style={{ height: 40 }} onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : side === 'plain' && !simplified ? (
                  <div className="pane-text pending-text" aria-live="polite">
                    {simplifying ? 'Rewriting in plain words…' : 'The simplified version will appear here.'}
                  </div>
                ) : (
                  <TranscriptView
                    transcript={transcripts[side]}
                    selected={selected[side]}
                    reading={(side === 'orig' ? origTrack : plainTrack).playing ? (side === 'orig' ? origTrack : plainTrack).position : null}
                    onToggle={(i) => toggleWord(side, i)}
                    onSeek={(i) => seekTo(side, i)}
                    label={side === 'orig' ? 'Original text' : 'Simplified text'}
                    mono={side === 'orig'}
                  />
                )}

                <Player label={side === 'orig' ? 'Listen to the original text' : 'Listen to the simplified text'} track={side === 'orig' ? origTrack : plainTrack} />
              </div>
            ))}
          </div>

          <div className="explain-bar">
            <button className="btn btn-jelly" disabled={selectionCount === 0} onClick={explainSelected}>
              <Icon name="sparkle" />Explain selected words{selectionCount > 0 && ` (${selectionCount})`}
            </button>
            {(selectionCount > 0 || explanation) && (
              <button className="btn btn-neu" style={{ height: 44 }} onClick={clearSelection}>Clear selection</button>
            )}
            <span className="small muted">
              {selectionCount === 0 ? 'Left-click words in either text to select them.' : 'Your whole selection is explained together.'}
            </span>
          </div>

          {explanation && (
            <article className="explain-card" aria-live="polite">
              <div className="explain-top">
                <h3><Icon name="book" size={20} />Explanation</h3>
                <div className="btn-row">
                  {explanation.result && <span className="sample-tag">{EXPLAIN_SOURCE[explanation.result.source]}</span>}
                  <button className="icon-btn close" aria-label="Close explanation" onClick={() => setExplanation(null)}><Icon name="x" size={16} /></button>
                </div>
              </div>
              <div className="explain-phrases">
                {explanation.phrases.map((p) => <span key={p.text} className={p.locked ? 'lock' : 'phrase'}>{p.text}</span>)}
              </div>
              <blockquote>“{explanation.sentences.join(' ')}”</blockquote>
              {explanation.status === 'loading' && <p className="muted">Looking this up…</p>}
              {explanation.status === 'error' && <p className="error">Couldn’t reach the explanation service. Please try again.</p>}
              {explanation.result && <p>{explanation.result.simpleDefinition}</p>}
              {explanation.parts.length > 0 && (
                <ul className="parts">
                  {explanation.parts.map((p) => <li key={p.word}><b>{p.word}</b>: {p.meaning}</li>)}
                </ul>
              )}
              {explanation.phrases.some((p) => p.locked) && (
                <p className="small muted">Highlighted values are copied exactly from your document and never reworded. If one looks wrong, trust the printed document and ask your pharmacist.</p>
              )}
              {explanation.result?.needsVerification && (
                <p className="small muted">Please check this with a pharmacist or healthcare professional.</p>
              )}
            </article>
          )}

          <div className="guard neu-in">
            <span className="icon-btn"><Icon name="lock" /></span>
            <div>
              <h4>Protected details</h4>
              <p className="small muted">
                Highlighted values are copied exactly from the original and never rewritten: dose, how often, how long
                and warnings. If anything looks different from your document, trust the document and ask your pharmacist.
              </p>
            </div>
          </div>
        </Step>

        {/* ---------- Step 3: documents saved from the phone app ---------- */}
        <Step
          n={3}
          id="saved"
          title="Saved from your phone"
          done={false}
          open={open.saved}
          onToggle={() => setOpen((o) => ({ ...o, saved: !o.saved }))}
          status={
            loggedIn
              ? saved.length > 0 && <span className="cl-ok"><Icon name="check" size={14} />{saved.length} saved</span>
              : <span className="cl-wait">Sign in to see these</span>
          }
        >
          {!loggedIn ? (
            <p className="small muted">
              Documents you save in the phone app appear here.{' '}
              <a className="text-btn" href="#signin">Sign in</a> to see them.
            </p>
          ) : savedError ? (
            <p className="step-error" role="alert">{savedError}</p>
          ) : saved.length === 0 ? (
            <p className="small muted">
              No saved documents yet. In the phone app’s Compremedic, photograph a document and tap “Save to cloud.”
            </p>
          ) : (
            <ul className="saved-list">
              {saved.map((d) => (
                <li key={d.id} className="saved-item neu-in">
                  <button className="saved-open" onClick={() => setViewingSaved(d)} aria-label={`View ${d.docType ?? 'document'}`}>
                    <img className="saved-thumb" src={`data:${d.mimeType};base64,${d.imageBase64}`} alt="" />
                    <span className="saved-meta">
                      <span className="saved-type">{d.docType ?? 'Document'}</span>
                      <span className="small muted">{new Date(d.createdAt).toLocaleDateString()}</span>
                      <span className="saved-text">{d.plainText}</span>
                    </span>
                    <Icon name="arrow-right" size={16} />
                  </button>
                  <button className="icon-btn close" aria-label="Delete document" onClick={() => deleteSaved(d.id)}>
                    <Icon name="x" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Step>
      </ol>

      {camera && (
        <CameraCapture
          onClose={() => setCamera(false)}
          onCapture={(f) => {
            setCamera(false);
            void handleFile(f);
          }}
        />
      )}

      {viewingSaved && (
        <SavedDocModal
          doc={viewingSaved}
          knownMedications={knownMedications}
          onClose={() => setViewingSaved(null)}
          onOpenInReader={() => {
            openSaved(viewingSaved);
            setViewingSaved(null);
          }}
          onDelete={() => {
            deleteSaved(viewingSaved.id);
            setViewingSaved(null);
          }}
        />
      )}
    </section>
  );
}

/** Full view of a document saved from the phone: the whole photo plus its text, read aloud on demand. */
function SavedDocModal({
  doc,
  knownMedications,
  onClose,
  onOpenInReader,
  onDelete,
}: {
  doc: MedDocument;
  knownMedications: string[];
  onClose: () => void;
  onOpenInReader: () => void;
  onDelete: () => void;
}) {
  const origT = useMemo(
    () => toTranscript(originalSegments(doc.originalText || doc.plainText, knownMedications)),
    [doc.originalText, doc.plainText, knownMedications],
  );
  const plainT = useMemo(() => toTranscript(originalSegments(doc.plainText, knownMedications)), [doc.plainText, knownMedications]);
  const origTrack = useSpeechTrack(origT);
  const plainTrack = useSpeechTrack(plainT);

  return (
    <div className="doc-backdrop" role="dialog" aria-modal="true" aria-label="Saved document" onClick={onClose}>
      <div className="doc-viewer card" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h3><Icon name="file" size={20} />{doc.docType ?? 'Document'}</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="doc-scroll">
          <img className="doc-image" src={`data:${doc.mimeType};base64,${doc.imageBase64}`} alt="Saved document" />
          <p className="small muted">Saved {new Date(doc.createdAt).toLocaleString()}</p>

          {doc.originalText && (
            <div className="pane">
              <span className="field-label" style={{ margin: 0 }}>Original text</span>
              <p className="pane-text doc-orig">{doc.originalText}</p>
              <Player label="Listen to the original text" track={origTrack} />
            </div>
          )}

          <div className="pane">
            <span className="field-label" style={{ margin: 0 }}>Simplified text</span>
            <p className="pane-text">{doc.plainText}</p>
            <Player label="Listen to the simplified text" track={plainTrack} />
          </div>

          <div className="btn-row">
            <button className="btn btn-jelly" onClick={onOpenInReader}>Open in reader</button>
            <button className="btn btn-neu" onClick={onDelete}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  n: number;
  id: string;
  title: string;
  done: boolean;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  status?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}

function Step({ n, id, title, done, open, disabled, onToggle, status, summary, children }: StepProps) {
  return (
    <li className={`cl-step card${open ? ' open' : ''}${done ? ' done' : ''}${disabled ? ' locked' : ''}`}>
      <button className="cl-head" aria-expanded={open} aria-controls={`step-${id}`} disabled={disabled} onClick={onToggle}>
        <span className="cl-n" aria-hidden="true">{done ? <Icon name="check" size={18} /> : n}</span>
        <span className="cl-title">
          <span className="cl-name">{n}. {title}</span>
          {status}
        </span>
        {!open && summary}
        {!disabled && <span className="cl-chev" aria-hidden="true"><Icon name="chevron-down" size={18} /></span>}
      </button>
      {open && (
        <div className="cl-body" id={`step-${id}`}>
          {children}
        </div>
      )}
    </li>
  );
}
