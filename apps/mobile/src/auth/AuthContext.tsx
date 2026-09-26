import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import { EMPTY_PROFILE, useProfile } from '../profile/ProfileContext';
import { loadToken, setToken } from './tokenStore';

interface AuthCtx {
  loggedIn: boolean;
  signIn: (token: string, remember: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Mirrors the web App: sign in -> load the saved profile; sign out -> forget the token and clear the profile. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { setProfile } = useProfile();
  const [loggedIn, setLoggedIn] = useState(false);

  // A remembered token from a previous launch.
  useEffect(() => {
    loadToken().then((t) => setLoggedIn(Boolean(t)));
  }, []);

  // Load the saved profile only for signed-in users.
  useEffect(() => {
    if (!loggedIn) return;
    api.getProfile().then(setProfile).catch(() => {});
  }, [loggedIn, setProfile]);

  const value = useMemo<AuthCtx>(
    () => ({
      loggedIn,
      signIn: async (token, remember) => {
        await setToken(token, remember);
        setLoggedIn(true);
      },
      signOut: async () => {
        await setToken(null);
        setLoggedIn(false);
        setProfile(EMPTY_PROFILE);
      },
    }),
    [loggedIn, setProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
