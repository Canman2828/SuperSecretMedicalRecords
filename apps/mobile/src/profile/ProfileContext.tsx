import type { Allergy, Food, Medication, Profile } from '@medifyrx/shared';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// In-memory guest profile shared by the Scan and Profile tabs.
// Nothing is persisted unless the user logs in and explicitly saves (see api.saveProfile).

interface ProfileCtx {
  profile: Profile;
  addMedication: (m: Medication) => void;
  addAllergy: (a: Allergy) => void;
  addFood: (f: Food) => void;
  remove: (key: keyof Profile, id: string) => void;
  setProfile: (p: Profile) => void;
}

const Ctx = createContext<ProfileCtx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>({ medications: [], allergies: [], foods: [] });

  const value = useMemo<ProfileCtx>(
    () => ({
      profile,
      setProfile,
      addMedication: (m) => setProfile((p) => ({ ...p, medications: [...p.medications, m] })),
      addAllergy: (a) => setProfile((p) => ({ ...p, allergies: [...p.allergies, a] })),
      addFood: (f) => setProfile((p) => ({ ...p, foods: [...p.foods, f] })),
      remove: (key, id) =>
        setProfile((p) => ({ ...p, [key]: (p[key] as { id: string }[]).filter((x) => x.id !== id) })),
    }),
    [profile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
