import { newId, type InteractionCheckResponse, type Profile } from '@medifyrx/shared';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { PageHead } from '../layout/Shell';
import { ProfilePanel } from '../profile/ProfilePanel';
import { Icon } from '../ui/Icon';
import { PrescriptiveIntro } from './PrescriptiveIntro';
import { NODE_COLOR, TONE } from './status';
import { TreeViewer, type TreeViewerHandle } from './TreeViewer';

export const EMPTY_PROFILE: Profile = { medications: [], allergies: [], foods: [] };

const DISCLAIMER =
  'Please note, Prescriptive is a tool to help you explore how food, medications, and supplements interact with one another. Consult your doctor or pharmacist for professional medical advice.';

// Synthetic demo patient "Alex" from the design doc. Never use real patient data for judging.
const demoAlex = (): Profile => ({
  medications: [
    { id: newId('med'), enteredName: 'Warfarin', normalizedName: 'Warfarin', rxCui: '11289', source: 'manual' },
    { id: newId('med'), enteredName: 'Aspirin', normalizedName: 'Aspirin', rxCui: '1191', source: 'manual' },
    { id: newId('med'), enteredName: 'Atorvastatin', normalizedName: 'Atorvastatin', rxCui: '83367', source: 'manual' },
    { id: newId('med'), enteredName: 'Metformin', normalizedName: 'Metformin', rxCui: '6809', source: 'manual' },
  ],
  allergies: [{ id: newId('allergy'), substance: 'Penicillin', type: 'medication', reaction: 'Hives', source: 'user' }],
  foods: [{ id: newId('food'), name: 'Grapefruit', reason: 'regularly-consume' }],
});

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

interface Props {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  loggedIn: boolean;
}

export function PrescriptivePage({ profile, onProfileChange, loggedIn }: Props) {
  const [result, setResult] = useState<InteractionCheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOptIn, setSaveOptIn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const viewer = useRef<TreeViewerHandle>(null);
  const disclaimerBtn = useRef<HTMLButtonElement>(null);

  const total = profile.medications.length + profile.allergies.length + profile.foods.length;

  // The tree updates by itself whenever the profile changes (debounced).
  useEffect(() => {
    if (total === 0) {
      setResult(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setChecking(true);
      setError(null);
      try {
        const r = await api.checkInteractions({
          medications: profile.medications.map(({ enteredName, normalizedName, rxCui }) => ({ enteredName, normalizedName, rxCui })),
          allergies: profile.allergies.map(({ substance, type }) => ({ substance, type })),
          foods: profile.foods.map(({ name }) => ({ name })),
          includeRelated: true,
        });
        if (!cancelled) setResult(r);
      } catch (e) {
        if (!cancelled) setError(`Couldn’t check your profile right now. ${(e as Error).message}`);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [profile, total]);

  useEffect(() => {
    if (showDisclaimer) disclaimerBtn.current?.focus();
  }, [showDisclaimer]);

  const save = async () => {
    try {
      await api.saveProfile(profile);
      setStatus('Profile saved to your account.');
    } catch (e) {
      setStatus(`Save failed: ${(e as Error).message}`);
    }
  };

  const mineWithNoLinks = result
    ? result.nodes.filter(
        (n) =>
          n.type !== 'patient' &&
          !n.related &&
          !result.relationships.some((r) => r.sourceNodeId === n.id || r.targetNodeId === n.id),
      )
    : [];

  return (
    <section className="page acc-blush">
      <PageHead icon="tree" goal="Awareness" title="Prescriptive">
        Explore how your medicines, allergies and foods interact, in 3D or on the table in front of you. Red cables
        mean never combine, yellow means avoid, and green means often paired. Every link comes from a real drug label.
      </PageHead>

      <div className="panel card tree-panel">
        <TreeViewer ref={viewer} data={result} loading={checking} startHidden={!introDone} />
        {error && <p className="error small">{error}</p>}
        <div className="legend">
          <span><i style={{ background: hex(TONE.never.cable) }} />{TONE.never.label}</span>
          <span><i style={{ background: hex(TONE.avoid.cable) }} />{TONE.avoid.label}</span>
          <span><i style={{ background: hex(TONE.pair.cable) }} />{TONE.pair.label}</span>
          <span className="legend-sep" />
          <span><Icon name="pill" size={15} style={{ color: hex(NODE_COLOR.medication) }} />Medicine</span>
          <span><Icon name="food" size={15} style={{ color: hex(NODE_COLOR.food) }} />Food</span>
          <span><Icon name="shield" size={15} style={{ color: hex(NODE_COLOR.allergy) }} />Allergy</span>
          <span><Icon name="star" size={15} style={{ color: hex(NODE_COLOR.other) }} />Other substance</span>
        </div>
        {mineWithNoLinks.length > 0 && (
          <p className="muted small">
            No relationships found in the sources checked for: {mineWithNoLinks.map((n) => n.label).join(', ')}.
          </p>
        )}
        {result && <p className="disclaimer">{result.disclaimer}</p>}
      </div>

      <div className="profile-grid">
        <div className="panel card">
          <div className="panel-head">
            <h3>Your profile</h3>
            <div className="btn-row">
              <button className="chip" onClick={() => onProfileChange(demoAlex())}>Load demo patient</button>
              <button className="chip" onClick={() => onProfileChange(EMPTY_PROFILE)} disabled={total === 0}>Clear</button>
            </div>
          </div>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Add what you take, what you’re allergic to and foods you eat often. The tree above updates as you go.
          </p>
          {loggedIn ? (
            <div className="save-row">
              <label className="check" htmlFor="saveOptIn">
                <input type="checkbox" id="saveOptIn" checked={saveOptIn} onChange={(e) => setSaveOptIn(e.target.checked)} />
                <span className="box"><Icon name="check" /></span>
                Save this profile to my account
              </label>
              <button className="btn btn-neu" style={{ height: 40 }} disabled={!saveOptIn} onClick={save}>Save</button>
            </div>
          ) : (
            <p className="muted small">
              Guest mode: nothing is saved. <a href="#signin">Sign in</a> to keep your profile.
            </p>
          )}
          {status && <p className="small status" aria-live="polite">{status}</p>}
        </div>
        <ProfilePanel profile={profile} onChange={onProfileChange} />
      </div>

      {!introDone && (
        <PrescriptiveIntro
          getTarget={() => viewer.current?.centerPillRect() ?? null}
          onHandoff={(ms) => (ms ? viewer.current?.revealCenter(ms) : viewer.current?.revealAll())}
          onDone={() => {
            setIntroDone(true);
            setShowDisclaimer(true);
          }}
        />
      )}

      {showDisclaimer && (
        <div className="modal-backdrop" role="presentation" onKeyDown={(e) => e.key === 'Escape' && setShowDisclaimer(false)}>
          <div className="modal card" role="alertdialog" aria-modal="true" aria-labelledby="disc-title" aria-describedby="disc-text">
            <span className="icon-btn modal-icon"><Icon name="shield" /></span>
            <h2 id="disc-title">Before you explore</h2>
            <p id="disc-text">{DISCLAIMER}</p>
            <button ref={disclaimerBtn} className="btn btn-jelly" onClick={() => setShowDisclaimer(false)}>I understand</button>
          </div>
        </div>
      )}
    </section>
  );
}
