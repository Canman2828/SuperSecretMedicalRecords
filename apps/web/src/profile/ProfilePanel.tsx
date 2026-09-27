import { newId, type AllergyType, type FoodReason, type Medication, type Profile } from '@medifyrx/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '../ui/Icon';
import { MedicationSearch } from './MedicationSearch';

interface Props {
  profile: Profile;
  onChange: (p: Profile) => void;
}

export const DOT = { medication: '#736A86', allergy: '#8E98AC', food: '#C9A99E' } as const;

const ALLERGY_TYPES: { v: AllergyType; label: string }[] = [
  { v: 'medication', label: 'Medication' },
  { v: 'food', label: 'Food' },
  { v: 'other', label: 'Other' },
];
const FOOD_REASONS: { v: FoodReason; label: string }[] = [
  { v: 'regularly-consume', label: 'I eat it often' },
  { v: 'allergy', label: 'Allergy' },
  { v: 'dietary-restriction', label: 'Restriction' },
];

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
    <>
      <Section icon="pill" title="Medications" count={profile.medications.length}>
        {pending ? (
          <form className="pending" onSubmit={addMedication}>
            <div className="pending-name">
              <b>{pending.normalizedName ?? pending.enteredName}</b>
              <small className="muted">{pending.rxCui ? `RxCUI ${pending.rxCui}` : 'Not matched in RxNorm'}</small>
            </div>
            <Field placeholder="Strength (e.g. 50 mg)" value={pending.strength} onChange={(v) => setPending({ ...pending, strength: v })} />
            <Field placeholder="How often (e.g. twice daily)" value={pending.frequency} onChange={(v) => setPending({ ...pending, frequency: v })} />
            <Field placeholder="Route (e.g. by mouth)" value={pending.route} onChange={(v) => setPending({ ...pending, route: v })} />
            <div className="btn-row">
              <button className="btn btn-jelly" type="submit">Add medication</button>
              <button className="btn btn-neu" type="button" onClick={() => setPending(null)}>Cancel</button>
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
        <List>
          {profile.medications.map((m) => (
            <Row
              key={m.id}
              color={DOT.medication}
              title={m.normalizedName ?? m.enteredName}
              detail={[m.strength, m.frequency, m.route].filter(Boolean).join(' · ') || 'Dose not set'}
              tag={m.source === 'prescription-scan' ? 'scanned' : undefined}
              onRemove={() => remove('medications', m.id)}
            />
          ))}
        </List>
      </Section>

      <Section icon="shield" title="Allergies" count={profile.allergies.length}>
        <form onSubmit={addAllergy}>
          <label className="field-label" htmlFor="algIn">Add an allergy</label>
          <div className="input">
            <input id="algIn" placeholder="e.g. Penicillin, peanuts, latex" autoComplete="off" value={allergy.substance} onChange={(e) => setAllergy({ ...allergy, substance: e.target.value })} />
            <button className="icon-btn" aria-label="Add allergy"><Icon name="plus" /></button>
          </div>
          <div className="sub-fields">
            <Seg label="Allergy type" options={ALLERGY_TYPES} value={allergy.type} onChange={(type) => setAllergy({ ...allergy, type })} />
            <Field placeholder="Reaction (optional)" value={allergy.reaction} onChange={(v) => setAllergy({ ...allergy, reaction: v ?? '' })} />
          </div>
        </form>
        <List>
          {profile.allergies.map((a) => (
            <Row key={a.id} color={DOT.allergy} title={a.substance} detail={a.reaction ?? `${a.type} allergy`} onRemove={() => remove('allergies', a.id)} />
          ))}
        </List>
      </Section>

      <Section icon="leaf" title="Foods and substances" count={profile.foods.length}>
        <form onSubmit={addFood}>
          <label className="field-label" htmlFor="foodIn">Add a food</label>
          <div className="input">
            <input id="foodIn" placeholder="e.g. Grapefruit" autoComplete="off" value={food.name} onChange={(e) => setFood({ ...food, name: e.target.value })} />
            <button className="icon-btn" aria-label="Add food"><Icon name="plus" /></button>
          </div>
          <div className="sub-fields">
            <Seg label="Why it matters" options={FOOD_REASONS} value={food.reason} onChange={(reason) => setFood({ ...food, reason })} />
          </div>
        </form>
        <List>
          {profile.foods.map((f) => (
            <Row key={f.id} color={DOT.food} title={f.name} detail={FOOD_REASONS.find((r) => r.v === f.reason)?.label} onRemove={() => remove('foods', f.id)} />
          ))}
        </List>
      </Section>
    </>
  );
}

function Section({ icon, title, count, children }: { icon: IconName; title: string; count: number; children: ReactNode }) {
  return (
    <div className="panel card">
      <div className="panel-head">
        <h3><Icon name={icon} size={20} />{title}</h3>
        <span className="count-pill">{count}</span>
      </div>
      {children}
    </div>
  );
}

function List({ children }: { children: ReactNode[] }) {
  return children.length ? <div className="list">{children}</div> : null;
}

function Row({ color, title, detail, tag, onRemove }: { color: string; title: string; detail?: string; tag?: string; onRemove: () => void }) {
  return (
    <div className="row">
      <span className="dot" style={{ background: color }} />
      <div>
        <b>{title}</b>
        {tag && <span className="row-tag">{tag}</span>}
        {detail && <small>{detail}</small>}
      </div>
      <button className="x" type="button" aria-label={`Remove ${title}`} onClick={onRemove}><Icon name="x" size={16} /></button>
    </div>
  );
}

function Field({ placeholder, value, onChange }: { placeholder: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="input input-sm">
      <input placeholder={placeholder} aria-label={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
    </div>
  );
}

function Seg<T extends string>({ label, options, value, onChange }: { label: string; options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}
