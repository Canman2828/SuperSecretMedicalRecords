import {
  newId,
  type InteractionCheckResponse,
  type Profile,
  type Relationship,
  type RelationshipStatus,
} from '@medifyrx/shared';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { InteractionTree, STATUS_STYLE } from '../graph/InteractionTree';
import { RelationshipDetails } from '../graph/RelationshipDetails';
import { PageHead } from '../layout/Shell';
import { DOT, ProfilePanel } from '../profile/ProfilePanel';
import { Icon } from '../ui/Icon';

export const EMPTY_PROFILE: Profile = { medications: [], allergies: [], foods: [] };

// Synthetic demo patient "Alex" from the design doc. Never use real patient data for judging.
const demoAlex = (): Profile => ({
  medications: [
    { id: newId('med'), enteredName: 'Warfarin', normalizedName: 'Warfarin', rxCui: '11289', source: 'manual' },
    { id: newId('med'), enteredName: 'Aspirin', normalizedName: 'Aspirin', rxCui: '1191', source: 'manual' },
    { id: newId('med'), enteredName: 'Atorvastatin', normalizedName: 'Atorvastatin', rxCui: '83367', source: 'manual' },
  ],
  allergies: [{ id: newId('allergy'), substance: 'Penicillin', type: 'medication', reaction: 'Hives', source: 'user' }],
  foods: [{ id: newId('food'), name: 'Grapefruit', reason: 'regularly-consume' }],
});

type View = '2d' | '3d' | 'xr';
const COMING: Record<Exclude<View, '2d'>, { icon: 'cube' | 'vr'; title: string; text: string }> = {
  '3d': { icon: 'cube', title: '3D view', text: 'Orbit, zoom and tap any branch to see why it is there. Coming in the next build.' },
  xr: { icon: 'vr', title: 'WebXR view', text: 'Put on a headset and walk around your tree at room scale. Coming in the next build.' },
};

interface Props {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  loggedIn: boolean;
}

export function PrescriptivePage({ profile, onProfileChange, loggedIn }: Props) {
  const [result, setResult] = useState<InteractionCheckResponse | null>(null);
  const [selected, setSelected] = useState<Relationship | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOptIn, setSaveOptIn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [view, setView] = useState<View>('2d');

  // Results are for a specific profile; clear them when it changes.
  useEffect(() => {
    setResult(null);
    setSelected(null);
  }, [profile]);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setResult(
        await api.checkInteractions({
          medications: profile.medications.map(({ enteredName, normalizedName, rxCui }) => ({ enteredName, normalizedName, rxCui })),
          allergies: profile.allergies.map(({ substance, type }) => ({ substance, type })),
          foods: profile.foods.map(({ name }) => ({ name })),
        }),
      );
    } catch (e) {
      setError(`Could not check relationships. ${(e as Error).message}`);
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    try {
      await api.saveProfile(profile);
      setStatus('Profile saved to your account.');
    } catch (e) {
      setStatus(`Save failed: ${(e as Error).message}`);
    }
  };

  // Every profile item with no documented relationship. "Not found" is reported as exactly that, never as "safe".
  const unconnected = result
    ? result.nodes.filter(
        (n) =>
          n.type !== 'patient' &&
          !result.relationships.some((r) => r.sourceNodeId === n.id || r.targetNodeId === n.id),
      )
    : [];

  const total = profile.medications.length + profile.allergies.length + profile.foods.length;

  return (
    <section className="page acc-blush">
      <PageHead icon="tree" goal="Awareness" title="Prescriptive">
        Keep your medicines, allergies and foods in one profile, then see a tree of what to watch out for. Every link
        comes from a real drug label you can open.
      </PageHead>

      <div className="grid-side">
        <div className="stack">
          <div className="panel card">
            <div className="panel-head">
              <h3>Your profile</h3>
              <div className="btn-row">
                <button className="chip" onClick={() => onProfileChange(demoAlex())}>Load demo patient</button>
                <button className="chip" onClick={() => onProfileChange(EMPTY_PROFILE)} disabled={total === 0}>Clear</button>
              </div>
            </div>
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

        <div className="panel card tree-panel">
          <div className="panel-head">
            <h3>Your interaction tree</h3>
            <div className="seg" role="group" aria-label="View mode">
              <button aria-pressed={view === '2d'} onClick={() => setView('2d')}><Icon name="tree" size={15} />Tree</button>
              <button aria-pressed={view === '3d'} onClick={() => setView('3d')}><Icon name="cube" size={15} />3D</button>
              <button aria-pressed={view === 'xr'} onClick={() => setView('xr')}><Icon name="vr" size={15} />WebXR</button>
            </div>
          </div>

          <div className="check-row">
            <button className="btn btn-jelly" onClick={check} disabled={checking || total === 0}>
              {checking ? 'Checking…' : result ? 'Check again' : 'Check relationships'}
              <Icon name="arrow-right" />
            </button>
            {error && <p className="error small">{error}</p>}
          </div>

          <div className="tree-box">
            {result ? (
              <InteractionTree result={result} onSelectRelationship={setSelected} />
            ) : (
              <div className="tree-empty">
                <div>
                  <span className="icon-btn"><Icon name="tree" /></span>
                  <strong>{total === 0 ? 'Start with your profile' : 'Ready when you are'}</strong>
                  <p className="small muted">
                    {total === 0
                      ? 'Add a medicine, allergy or food on the left, or load the demo patient.'
                      : 'Check relationships to build your tree. Tap any colored link to see where it comes from.'}
                  </p>
                </div>
              </div>
            )}
            {selected && result && (
              <RelationshipDetails relationship={selected} nodes={result.nodes} onClose={() => setSelected(null)} />
            )}
            {view !== '2d' && (
              <div className="tree-overlay">
                <div>
                  <span className="icon-btn"><Icon name={COMING[view].icon} /></span>
                  <strong style={{ fontFamily: 'var(--f-head)', fontSize: 18 }}>{COMING[view].title}</strong>
                  <p className="small muted">{COMING[view].text}</p>
                  <button className="btn btn-neu" style={{ height: 40 }} onClick={() => setView('2d')}>Back to tree</button>
                </div>
              </div>
            )}
          </div>

          <div className="legend">
            <span><i style={{ background: DOT.medication }} />Medicine</span>
            <span><i style={{ background: DOT.allergy }} />Allergy</span>
            <span><i style={{ background: DOT.food }} />Food</span>
            {(Object.keys(STATUS_STYLE) as RelationshipStatus[]).map((k) => (
              <span key={k} style={{ color: STATUS_STYLE[k].color }}>
                <b aria-hidden="true">{STATUS_STYLE[k].icon}</b>{STATUS_STYLE[k].label}
              </span>
            ))}
          </div>

          {result && result.relationships.length === 0 && <p className="callout neu-in small">{result.disclaimer}</p>}
          {result && result.relationships.length > 0 && (
            <>
              {unconnected.length > 0 && (
                <p className="muted small">
                  No relationship was found in the sources checked for: {unconnected.map((n) => n.label).join(', ')}.
                </p>
              )}
              <p className="disclaimer">
                These links come from the sources checked, which are not complete. A missing link does not mean a
                combination is safe. Talk with a pharmacist or healthcare professional if you have questions.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
