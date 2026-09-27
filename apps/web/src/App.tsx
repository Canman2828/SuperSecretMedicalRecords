import type { Profile } from '@medifyrx/shared';
import { useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api/client';
import { SignInPage } from './auth/SignInPage';
import { CompremedicPage } from './compremedic/CompremedicPage';
import { HomePage } from './home/HomePage';
import { Footer, Nav } from './layout/Shell';
import { MedictionaryPage } from './medictionary/MedictionaryPage';
import { EMPTY_PROFILE, PrescriptivePage } from './prescriptive/PrescriptivePage';
import { navigate, useRoute } from './router';

export function App() {
  const page = useRoute();
  // Profile lives here so it survives moving between pages (and Compremedic can highlight its medications).
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));

  // Load the saved profile only for logged-in users.
  useEffect(() => {
    if (!loggedIn) return;
    api.getProfile().then(setProfile).catch(() => {});
  }, [loggedIn]);

  const knownMedications = useMemo(
    () => profile.medications.map((m) => m.normalizedName ?? m.enteredName),
    [profile.medications],
  );

  const signOut = () => {
    setToken(null);
    setLoggedIn(false);
    setProfile(EMPTY_PROFILE);
  };

  return (
    <div className="shell">
      <Nav page={page} loggedIn={loggedIn} onSignOut={signOut} />
      <main className="wrap">
        {page === 'home' && <HomePage />}
        {page === 'compremedic' && <CompremedicPage knownMedications={knownMedications} loggedIn={loggedIn} />}
        {page === 'prescriptive' && <PrescriptivePage profile={profile} onProfileChange={setProfile} loggedIn={loggedIn} />}
        {page === 'medictionary' && <MedictionaryPage profile={profile} />}
        {page === 'signin' && (
          <SignInPage
            onSignedIn={(token, remember) => {
              setToken(token, remember);
              setLoggedIn(true);
              navigate('prescriptive');
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
