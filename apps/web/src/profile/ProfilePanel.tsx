import { newId, type AllergyType, type FoodReason, type Medication, type Profile } from '@clearrx/shared';
import { useState, type FormEvent } from 'react';
import { MedicationSearch } from './MedicationSearch';

interface Props {
  profile: Profile;
  onChange: (p: Profile) => void;
}

export function ProfilePanel({ profile, onChange }: Props) {
  const [pending, setPending] = useState<Medication | null>(null);
  const [allergy, setAllergy] = useState({ substance: '', type: 'medication' as AllergyType, reaction: '' });
  const [food, setFood] = useState({ name: '', reason: 'regularly-consume' as FoodReason });

  const addMedication = (e: FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    onChange({ ...profile, medications: [...profile.medications, pending] });
    setPending(null);
  };

  const addAllergy = (e: FormEvent) => {
    e.preventDefault();
    if (!allergy.substance.trim()) return;
    onChange({
      ...profile,
      allergies: [
        ...profile.allergies,
        {
          id: newId('allergy'),
          substance: allergy.substance.trim(),
          type: allergy.type,
          reaction: allergy.reaction.trim() || undefined,
          source: 'user',
        },
      ],
    });
    setAllergy({ substance: '', type: 'medication', reaction: '' });
  };

  const addFood = (e: FormEvent) => {
    e.preventDefault();
    if (!food.name.trim()) return;
    onChange({ ...profile, foods: [...profile.foods, { id: newId('food'), name: food.name.trim(), reason: food.reason }] });
    setFood({ name: '', reason: 'regularly-consume' });
  };

  const remove = (key: keyof Profile, id: string) =>
    onChange({ ...profile, [key]: (profile[key] as { id: string }[]).filter((x) => x.id !== id) });

  return (
    <div className="panel">
      <section>
        <h2>Medications <span className="count">{profile.medications.length}</span></h2>
        <ul className="items">
          {profile.medications.map((m) => (
            <li key={m.id}>
              <span>
                💊 <strong>{m.normalizedName ?? m.enteredName}</strong>
                {m.strength && <> · {m.strength}</>}
                {m.frequency && <> · {m.frequency}</>}
                {m.source === 'prescription-scan' && <span className="tag">scanned</span>}
              </span>
              <button className="link" onClick={() => remove('medications', m.id)} aria-label={`Remove ${m.enteredName}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        {pending ? (
          <form className="stack" onSubmit={addMedication}>
            <div className="muted">
              {pending.normalizedName ?? pending.enteredName}
              {pending.rxCui ? ` · RxCUI ${pending.rxCui}` : ' · not matched in RxNorm'}
            </div>
            <input placeholder="Strength (e.g. 50 mg)" value={pending.strength ?? ''} onChange={(e) => setPending({ ...pending, strength: e.target.value || undefined })} />
            <input placeholder="Frequency (e.g. twice daily)" value={pending.frequency ?? ''} onChange={(e) => setPending({ ...pending, frequency: e.target.value || undefined })} />
            <input placeholder="Route (e.g. oral)" value={pending.route ?? ''} onChange={(e) => setPending({ ...pending, route: e.target.value || undefined })} />
            <div className="row">
              <button type="submit">Add medication</button>
              <button type="button" className="link" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <MedicationSearch
            onSelect={(d) =>
              setPending({
                id: newId('med'),
                enteredName: d.name,
                normalizedName: d.rxCui ? d.name : undefined,
                rxCui: d.rxCui,
                source: 'manual',
              })
            }
          />
        )}
      </section>

      <section>
        <h2>Allergies <span className="count">{profile.allergies.length}</span></h2>
        <ul className="items">
          {profile.allergies.map((a) => (
            <li key={a.id}>
              <span>⚠ <strong>{a.substance}</strong>{a.reaction && <> — {a.reaction}</>}</span>
              <button className="link" onClick={() => remove('allergies', a.id)}>Remove</button>
            </li>
          ))}
        </ul>
        <form className="stack" onSubmit={addAllergy}>
          <input placeholder="Allergy / substance" value={allergy.substance} onChange={(e) => setAllergy({ ...allergy, substance: e.target.value })} />
          <select value={allergy.type} onChange={(e) => setAllergy({ ...allergy, type: e.target.value as AllergyType })}>
            <option value="medication">Medication</option>
            <option value="food">Food</option>
            <option value="other">Other</option>
          </select>
          <input placeholder="Reaction (optional)" value={allergy.reaction} onChange={(e) => setAllergy({ ...allergy, reaction: e.target.value })} />
          <button type="submit">Add allergy</button>
        </form>
      </section>

      <section>
        <h2>Foods / substances <span className="count">{profile.foods.length}</span></h2>
        <ul className="items">
          {profile.foods.map((f) => (
            <li key={f.id}>
              <span>🍊 <strong>{f.name}</strong></span>
              <button className="link" onClick={() => remove('foods', f.id)}>Remove</button>
            </li>
          ))}
        </ul>
        <form className="stack" onSubmit={addFood}>
          <input placeholder="Food (e.g. Grapefruit)" value={food.name} onChange={(e) => setFood({ ...food, name: e.target.value })} />
          <select value={food.reason} onChange={(e) => setFood({ ...food, reason: e.target.value as FoodReason })}>
            <option value="regularly-consume">Regularly consume</option>
            <option value="allergy">Allergy</option>
            <option value="dietary-restriction">Dietary restriction</option>
          </select>
          <button type="submit">Add food</button>
        </form>
      </section>
    </div>
  );
}
