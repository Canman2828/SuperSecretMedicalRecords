import { useMemo, useState, type DragEvent } from 'react';
import { PageHead } from '../layout/Shell';
import { Icon } from '../ui/Icon';
import { originalSegments, plainSegments, spokenText, type Segment } from './plainLanguage';
import { SPEEDS, useSpeech } from './useSpeech';

const DOC_TYPES = ['Consent form', 'Prescription label', 'Pill bottle', 'Contact lens box'] as const;
type DocType = (typeof DOC_TYPES)[number];

// Synthetic sample text only.
const SAMPLES: Record<DocType, string> = {
  'Prescription label':
    'AMOXICILLIN 500 MG CAPSULES. TAKE 1 CAPSULE PO 3 TIMES DAILY FOR 10 DAYS. COMPLETE FULL COURSE OF THERAPY. MAY CAUSE GI UPSET; MAY TAKE WITH FOOD. DISCONTINUE AND CONTACT PRESCRIBER IF RASH OR URTICARIA OCCURS.',
  'Pill bottle':
    'IBUPROFEN 200 MG TABLETS. TAKE 1 TABLET PO Q6H PRN FOR PAIN. DO NOT EXCEED 6 TABLETS IN 24 HOURS. TAKE WITH FOOD. AVOID ALCOHOL.',
  'Consent form':
    'I give my CONSENT for the procedure described above. I understand that ADVERSE reactions, including HYPERSENSITIVITY, may occur. This AUTHORIZATION remains in effect until I revoke it in writing.',
  'Contact lens box':
    'DAILY DISPOSABLE CONTACT LENSES. REPLACE EVERY 1 DAY. DO NOT SLEEP IN LENSES. DO NOT RINSE WITH WATER. REMOVE AND CONSULT YOUR EYE CARE PROFESSIONAL IF IRRITATION OCCURS.',
};

interface Props {
  /** Medication names from the profile, so they get highlighted too. */
  knownMedications: string[];
}

export function CompremedicPage({ knownMedications }: Props) {
  const [docType, setDocType] = useState<DocType>('Prescription label');
  const [text, setText] = useState(SAMPLES['Prescription label']);
  const [fileName, setFileName] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [listened, setListened] = useState(false);
  const speech = useSpeech();

  const isSample = Object.values(SAMPLES).includes(text);
  const original = useMemo(() => originalSegments(text, knownMedications), [text, knownMedications]);
  const plain = useMemo(() => plainSegments(text, knownMedications), [text, knownMedications]);

  const pickType = (t: DocType) => {
    setDocType(t);
    if (isSample) setText(SAMPLES[t]); // never overwrite text the user typed
  };

  // The file is not uploaded or kept: only its name is shown (web OCR isn't wired up yet).
  const takeFile = (f: File | undefined) => setFileName(f ? f.name : null);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    takeFile(e.dataTransfer.files[0]);
  };

  const hasText = text.trim().length > 0;
  const done = [hasText || !!fileName, hasText, hasText, listened];
  const now = done.indexOf(false);

  return (
    <section className="page acc-steel">
      <PageHead icon="scan" goal="Comprehension" title="Compremedic">
        Bring the text from a consent form or a prescription label. We place a plain-language version beside the
        original and read either one aloud. Doses, timing and warnings are never reworded.
      </PageHead>

      <div className="stepper card">
        {['Capture', 'Read text', 'Simplify', 'Listen'].map((s, i) => (
          <div key={s} className={`step${done[i] ? ' done' : ''}${i === now ? ' now' : ''}`}>
            <span className="n">{done[i] ? <Icon name="check" size={14} /> : i + 1}</span>
            {s}
          </div>
        ))}
      </div>

      <div className="grid-side">
        <div className="panel card">
          <div className="panel-head"><h3>Add a document</h3></div>
          <label
            className={`drop${over ? ' over' : ''}`}
            htmlFor="docFile"
            onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
            onDrop={onDrop}
          >
            <span className="icon-btn"><Icon name="camera" /></span>
            <strong>Photograph or drop a file</strong>
            <span className="muted small">Paper forms, pill bottles, blister packs, contact lens boxes</span>
            <span className="drop-actions">
              <span className="btn btn-jelly" style={{ height: 44 }}><Icon name="camera" />Take photo</span>
              <span className="btn btn-neu" style={{ height: 44 }}><Icon name="upload" />Upload</span>
            </span>
            {fileName && (
              <span className="file-name">
                Ready: {fileName}
                <span className="muted small file-note">
                  Reading text from photos happens on-device in the iPhone app. Here, type or paste it below.
                </span>
              </span>
            )}
          </label>
          <input type="file" id="docFile" accept="image/*,application/pdf" capture="environment" hidden onChange={(e) => takeFile(e.target.files?.[0])} />

          <p className="field-label" style={{ marginTop: 22 }}>What is it?</p>
          <div className="chips">
            {DOC_TYPES.map((t) => (
              <button key={t} className="chip" aria-pressed={docType === t} onClick={() => pickType(t)}>{t}</button>
            ))}
          </div>

          <label className="field-label" htmlFor="docText" style={{ marginTop: 22 }}>Text on the document</label>
          <textarea
            id="docText"
            className="textbox"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste the text exactly as printed"
          />
        </div>

        <div className="panel card">
          <div className="panel-head">
            <h3>Side by side</h3>
            {isSample && <span className="sample-tag">Sample {docType.toLowerCase()}</span>}
          </div>
          <div className="grid-2">
            <div className="pane">
              <span className="field-label" style={{ margin: 0 }}>Original text</span>
              <div className="pane-text orig"><Segments segments={original} /></div>
              <Player
                label="Listen to original"
                playing={speech.playing === 'orig'}
                disabled={!speech.supported || !hasText}
                onPlay={(rate) => { speech.toggle('orig', text, rate); setListened(true); }}
              />
            </div>
            <div className="pane">
              <span className="field-label" style={{ margin: 0 }}>In plain words</span>
              <div className="pane-text"><Segments segments={plain} /></div>
              <Player
                label="Listen to plain version"
                playing={speech.playing === 'plain'}
                disabled={!speech.supported || !hasText}
                onPlay={(rate) => { speech.toggle('plain', spokenText(plain), rate); setListened(true); }}
              />
            </div>
          </div>
          <div className="guard neu-in">
            <span className="icon-btn"><Icon name="lock" /></span>
            <div>
              <h4>Protected details</h4>
              <p className="small muted">
                Highlighted values are copied exactly from the original and never rewritten: dose, how often, how long
                and warnings. If anything looks different from your label, trust the label and ask your pharmacist.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.lock ? (
          <span key={i}>
            <span className="lock">{s.text}</span>
            {s.meaning && <span className="meaning"> ({s.meaning})</span>}
          </span>
        ) : s.term ? (
          <span key={i}>
            <span className="term">{s.text}</span>
            <span className="meaning"> ({s.meaning})</span>
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

// Static bar heights for the waveform, same formula as the design mock.
const BARS = Array.from({ length: 38 }, (_, i) => 20 + 60 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.4)));

function Player({ label, playing, disabled, onPlay }: { label: string; playing: boolean; disabled: boolean; onPlay: (rate: number) => void }) {
  const [si, setSi] = useState(1);
  return (
    <div className="player neu">
      <button className="play btn-jelly" aria-label={playing ? 'Stop' : label} disabled={disabled} onClick={() => onPlay(SPEEDS[si])}>
        <svg aria-hidden="true"><use href={playing ? '#i-pause' : '#i-play'} /></svg>
      </button>
      <div className={`wave${playing ? ' playing' : ''}`}>
        {BARS.map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${-i * 0.07}s` }} />)}
      </div>
      <button className="speed" aria-label="Reading speed" onClick={() => setSi((si + 1) % SPEEDS.length)}>{SPEEDS[si]}×</button>
    </div>
  );
}
