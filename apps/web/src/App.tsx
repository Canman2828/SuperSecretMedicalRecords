import {
  newId,
  type InteractionCheckResponse,
  type Profile,
  type Relationship,
} from '@clearrx/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { api, getToken, setToken } from './api/client';
import { InteractionTree } from './graph/InteractionTree';
import { RelationshipDetails } from './graph/RelationshipDetails';
import { ProfilePanel } from './profile/ProfilePanel';

const EMPTY: Profile = { medications: [], allergies: [], foods: [] };

// Synthetic demo patient "Alex" from the design doc. Never use real patient data for judging.
const DEMO_ALEX: Profile = {
  medications: [
    { id: newId('med'), enteredName: 'Warfarin', normalizedName: 'Warfarin', rxCui: '11289', source: 'manual' },
    { id: newId('med'), enteredName: 'Aspirin', normalizedName: 'Aspirin', rxCui: '1191', source: 'manual' },
    { id: newId('med'), enteredName: 'Atorvastatin', normalizedName: 'Atorvastatin', rxCui: '83367', source: 'manual' },
  ],
  allergies: [{ id: newId('allergy'), substance: 'Penicillin', type: 'medication', reaction: 'Hives', source: 'user' }],
  foods: [{ id: newId('food'), name: 'Grapefruit', reason: 'regularly-consume' }],
};

export function App() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [result, setResult] = useState<InteractionCheckResponse | null>(null);
  const [selected, setSelected] = useState<Relationship | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));
  const [saveOptIn, setSaveOptIn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Load the saved profile only for logged-in users.
  useEffect(() => {
    if (!loggedIn) return;
    api.getProfile().then(setProfile).catch(() => setStatus('Could not load saved profile.'));
  }, [loggedIn]);

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
      setError((e as Error).message);
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

  const unconnectedMeds = result
    ? result.nodes.filter(
        (n) =>
          n.type === 'medication' &&
          !result.relationships.some((r) => r.sourceNodeId === n.id || r.targetNodeId === n.id),
      )
    : [];

  const total = profile.medications.length + profile.allergies.length + profile.foods.length;

  return (
    <div className="app">
      <header>
        <h1>ClearRx <span className="muted">Profile</span></h1>
        <AccountBar loggedIn={loggedIn} onAuth={(t) => { setToken(t); setLoggedIn(Boolean(t)); if (!t) setProfile(EMPTY); }} />
      </header>

      <main>
        <div className="left">
          <div className="row">
            <button className="link" onClick={() => setProfile(DEMO_ALEX)}>Load demo patient (Alex)</button>
            <button className="link" onClick={() => setProfile(EMPTY)}>Clear</button>
          </div>
          <ProfilePanel profile={profile} onChange={setProfile} />

          {loggedIn ? (
            <div className="save">
              <label>
                <input type="checkbox" checked={saveOptIn} onChange={(e) => setSaveOptIn(e.target.checked)} />
                Save this profile to my account
              </label>
              <button disabled={!saveOptIn} onClick={save}>Save</button>
            </div>
          ) : (
            <p className="muted small">Guest mode: nothing is saved. Log in to save your profile.</p>
          )}
          {status && <p className="muted small">{status}</p>}
        </div>

        <div className="right">
          <button className="primary" onClick={check} disabled={checking || total === 0}>
            {checking ? 'Checking…' : 'Check relationships'}
          </button>
          {error && <p className="error">{error}</p>}

          {result ? (
            <>
              <InteractionTree result={result} onSelectRelationship={setSelected} />
              {unconnectedMeds.length > 0 && (
                <p className="muted small">
                  No relationships found in the sources checked for: {unconnectedMeds.map((n) => n.label).join(', ')}.
                </p>
              )}
              <p className="disclaimer">{result.disclaimer}</p>
            </>
          ) : (
            <div className="empty">Add items to your profile, then check relationships to see the tree.</div>
          )}

          {selected && result && (
            <RelationshipDetails relationship={selected} nodes={result.nodes} onClose={() => setSelected(null)} />
          )}
        </div>
      </main>
    </div>
  );
}

function AccountBar({ loggedIn, onAuth }: { loggedIn: boolean; onAuth: (token: string | null) => void }) {
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState<string | null>(null);

  if (loggedIn) return <button className="link" onClick={() => onAuth(null)}>Log out</button>;
  if (!mode)
    return (
      <div className="row">
        <button className="link" onClick={() => setMode('login')}>Log in</button>
        <button className="link" onClick={() => setMode('register')}>Sign up</button>
      </div>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const { token } = mode === 'login' ? await api.login(form) : await api.register(form);
      onAuth(token);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <form className="row auth" onSubmit={submit}>
      {mode === 'register' && <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
      <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button type="submit">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      <button type="button" className="link" onClick={() => setMode(null)}>Cancel</button>
      {err && <span className="error small">{err}</span>}
    </form>
  );
}
