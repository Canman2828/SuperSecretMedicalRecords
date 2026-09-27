import { newId, type AllergyType, type FoodReason, type Medication } from '@medifyrx/shared';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfile } from '../profile/ProfileContext';
import { Icon, type IconName } from '../ui/Icon';
import { Btn, CountPill, Field, IconBtn, Label, Panel, Seg, useAccent } from '../ui/kit';
import { C, DOT, F, R, SH } from '../ui/theme';
import { MedicationSearch } from './MedicationSearch';

// Mirrors apps/web/src/profile/ProfilePanel.tsx: medications (RxNorm search + dose), allergies, foods.

const ALLERGY_TYPES: { v: AllergyType; label: string }[] = [
  { v: 'medication', label: 'Medication' },
  { v: 'food', label: 'Food' },
  { v: 'other', label: 'Other' },
];
export const FOOD_REASONS: { v: FoodReason; label: string }[] = [
  { v: 'regularly-consume', label: 'I eat it often' },
  { v: 'allergy', label: 'Allergy' },
  { v: 'dietary-restriction', label: 'Restriction' },
];

export function ProfilePanel() {
  const { profile, addMedication, addAllergy, addFood, remove } = useProfile();
  const [pending, setPending] = useState<Medication | null>(null);
  const [allergy, setAllergy] = useState({ substance: '', type: 'medication' as AllergyType, reaction: '' });
  const [food, setFood] = useState({ name: '', reason: 'regularly-consume' as FoodReason });

  const saveMedication = () => {
    if (!pending) return;
    addMedication(pending);
    setPending(null);
  };

  const saveAllergy = () => {
    if (!allergy.substance.trim()) return;
    addAllergy({
      id: newId('allergy'),
      substance: allergy.substance.trim(),
      type: allergy.type,
      reaction: allergy.reaction.trim() || undefined,
      source: 'user',
    });
    setAllergy({ substance: '', type: 'medication', reaction: '' });
  };

  const saveFood = () => {
    if (!food.name.trim()) return;
    addFood({ id: newId('food'), name: food.name.trim(), reason: food.reason });
    setFood({ name: '', reason: 'regularly-consume' });
  };

  return (
    <>
      <Section icon="pill" title="Medications" count={profile.medications.length}>
        {pending ? (
          <View style={styles.pending}>
            <View style={styles.pendingName}>
              <Text style={styles.pendingTitle}>{pending.normalizedName ?? pending.enteredName}</Text>
              <Text style={styles.pendingSub}>{pending.rxCui ? `RxCUI ${pending.rxCui}` : 'Not matched in RxNorm'}</Text>
            </View>
            <SmallField placeholder="Strength (e.g. 50 mg)" value={pending.strength} onChange={(v) => setPending({ ...pending, strength: v })} />
            <SmallField placeholder="How often (e.g. twice daily)" value={pending.frequency} onChange={(v) => setPending({ ...pending, frequency: v })} />
            <SmallField placeholder="Route (e.g. by mouth)" value={pending.route} onChange={(v) => setPending({ ...pending, route: v })} />
            <View style={styles.btnRow}>
              <Btn label="Add medication" onPress={saveMedication} />
              <Btn label="Cancel" variant="neu" onPress={() => setPending(null)} />
            </View>
          </View>
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
        <Label>Add an allergy</Label>
        <Field
          placeholder="e.g. Penicillin, peanuts, latex"
          value={allergy.substance}
          onChangeText={(substance) => setAllergy({ ...allergy, substance })}
          onSubmitEditing={saveAllergy}
          returnKeyType="done"
          autoCorrect={false}
          accessibilityLabel="Add an allergy"
          right={<IconBtn icon="plus" label="Add allergy" size={36} onPress={saveAllergy} />}
        />
        <View style={styles.subFields}>
          <Seg label="Allergy type" options={ALLERGY_TYPES} value={allergy.type} onChange={(type) => setAllergy({ ...allergy, type })} />
          <SmallField placeholder="Reaction (optional)" value={allergy.reaction} onChange={(v) => setAllergy({ ...allergy, reaction: v ?? '' })} />
        </View>
        <List>
          {profile.allergies.map((a) => (
            <Row key={a.id} color={DOT.allergy} title={a.substance} detail={a.reaction ?? `${a.type} allergy`} onRemove={() => remove('allergies', a.id)} />
          ))}
        </List>
      </Section>

      <Section icon="leaf" title="Foods and substances" count={profile.foods.length}>
        <Label>Add a food</Label>
        <Field
          placeholder="e.g. Grapefruit"
          value={food.name}
          onChangeText={(name) => setFood({ ...food, name })}
          onSubmitEditing={saveFood}
          returnKeyType="done"
          autoCorrect={false}
          accessibilityLabel="Add a food"
          right={<IconBtn icon="plus" label="Add food" size={36} onPress={saveFood} />}
        />
        <View style={styles.subFields}>
          <Seg label="Why it matters" options={FOOD_REASONS} value={food.reason} onChange={(reason) => setFood({ ...food, reason })} />
        </View>
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
    <Panel title={title} icon={icon} right={<CountPill n={count} />}>
      {children}
    </Panel>
  );
}

function List({ children }: { children: ReactNode[] }) {
  return children.length ? <View style={styles.list}>{children}</View> : null;
}

function Row({ color, title, detail, tag, onRemove }: { color: string; title: string; detail?: string; tag?: string; onRemove: () => void }) {
  const a = useAccent();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {tag && (
            <View style={[styles.rowTag, { backgroundColor: a.tint }]}>
              <Text style={[styles.rowTagText, { color: a.deep }]}>{tag}</Text>
            </View>
          )}
        </View>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} onPress={onRemove} hitSlop={8} style={({ pressed }) => [styles.x, pressed && { boxShadow: SH.inSm }]}>
        <Icon name="x" size={16} color={C.ink3} />
      </Pressable>
    </View>
  );
}

function SmallField({ placeholder, value, onChange }: { placeholder: string; value?: string; onChange: (v: string | undefined) => void }) {
  return (
    <Field small placeholder={placeholder} accessibilityLabel={placeholder} value={value ?? ''} onChangeText={(v) => onChange(v || undefined)} style={{ alignSelf: 'stretch' }} />
  );
}

const styles = StyleSheet.create({
  pending: { gap: 10 },
  pendingName: { paddingLeft: 6 },
  pendingTitle: { fontFamily: F.head, fontSize: 17, color: C.ink },
  pendingSub: { fontFamily: F.body, fontSize: 13, color: C.ink3 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  subFields: { gap: 12, marginTop: 12, alignItems: 'flex-start' },
  list: { gap: 12, marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 14, paddingRight: 10, borderRadius: R.md, backgroundColor: C.white, boxShadow: SH.outSm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontFamily: F.head, fontSize: 15, color: C.ink },
  rowDetail: { fontFamily: F.body, fontSize: 13, color: C.ink3 },
  rowTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill },
  rowTagText: { fontFamily: F.headBold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  x: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
