import { newId, type InteractionCheckResponse } from '@medifyrx/shared';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../src/api';
import { useProfile } from '../../src/profile/ProfileContext';

// Mobile keeps this simple: list + add + relationship cards.
// The full visual interaction tree lives on the website.

const STATUS = {
  documented: { icon: '⚠', color: '#c2410c' },
  warning: { icon: '!', color: '#b45309' },
  contraindication: { icon: '⊘', color: '#b91c1c' },
  'possible-allergy-match': { icon: '△', color: '#7c3aed' },
  complementary: { icon: '✓', color: '#3E7A57' },
} as const;

export default function ProfileScreen() {
  const { profile, addAllergy, addFood, remove } = useProfile();
  const [allergyText, setAllergyText] = useState('');
  const [foodText, setFoodText] = useState('');
  const [result, setResult] = useState<InteractionCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
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
      setError(`Couldn't reach the server. Is EXPO_PUBLIC_API_URL set to your computer's IP?\n${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const label = (id: string) => result?.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Section title={`Medications (${profile.medications.length})`}>
        {profile.medications.length === 0 && <Text style={styles.muted}>Scan a prescription and tap a medication to add it.</Text>}
        {profile.medications.map((m) => (
          <Item key={m.id} text={`💊 ${m.normalizedName ?? m.enteredName}${m.strength ? ` · ${m.strength}` : ''}`} onRemove={() => remove('medications', m.id)} />
        ))}
      </Section>

      <Section title={`Allergies (${profile.allergies.length})`}>
        {profile.allergies.map((a) => (
          <Item key={a.id} text={`⚠ ${a.substance}`} onRemove={() => remove('allergies', a.id)} />
        ))}
        <AddRow
          placeholder="Add allergy (e.g. Penicillin)"
          value={allergyText}
          onChange={setAllergyText}
          onAdd={() => {
            if (!allergyText.trim()) return;
            addAllergy({ id: newId('allergy'), substance: allergyText.trim(), type: 'medication', source: 'user' });
            setAllergyText('');
          }}
        />
      </Section>

      <Section title={`Foods (${profile.foods.length})`}>
        {profile.foods.map((f) => (
          <Item key={f.id} text={`🍊 ${f.name}`} onRemove={() => remove('foods', f.id)} />
        ))}
        <AddRow
          placeholder="Add food (e.g. Grapefruit)"
          value={foodText}
          onChange={setFoodText}
          onAdd={() => {
            if (!foodText.trim()) return;
            addFood({ id: newId('food'), name: foodText.trim(), reason: 'regularly-consume' });
            setFoodText('');
          }}
        />
      </Section>

      <Pressable style={styles.primary} onPress={check} disabled={loading}>
        <Text style={styles.primaryText}>{loading ? 'Checking…' : 'Check relationships'}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}

      {result && (
        <View style={{ gap: 10 }}>
          {result.relationships.map((r) => (
            <View key={r.id} style={[styles.card, { borderLeftColor: STATUS[r.status].color }]}>
              <Text style={[styles.cardTitle, { color: STATUS[r.status].color }]}>
                {STATUS[r.status].icon} {r.title}
              </Text>
              <Text style={styles.bold}>
                {label(r.sourceNodeId)} ↕ {label(r.targetNodeId)}
              </Text>
              {r.explanation && <Text>{r.explanation}</Text>}
              <Text style={styles.muted}>Source: {r.source.label ?? r.source.organization}</Text>
            </View>
          ))}
          <Text style={styles.muted}>{result.disclaimer}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Item({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <View style={styles.item}>
      <Text style={{ flex: 1 }}>{text}</Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={styles.link}>Remove</Text>
      </Pressable>
    </View>
  );
}

function AddRow(props: { placeholder: string; value: string; onChange: (s: string) => void; onAdd: () => void }) {
  return (
    <View style={styles.addRow}>
      <TextInput style={styles.input} placeholder={props.placeholder} value={props.value} onChangeText={props.onChange} onSubmitEditing={props.onAdd} />
      <Pressable style={styles.addButton} onPress={props.onAdd}>
        <Text style={styles.primaryText}>Add</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e2e8f0' },
  link: { color: '#0d9488', fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  input: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 },
  addButton: { backgroundColor: '#0d9488', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  primary: { backgroundColor: '#0d9488', borderRadius: 10, padding: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 4, borderLeftWidth: 4 },
  cardTitle: { fontWeight: '700' },
  bold: { fontWeight: '600' },
  muted: { color: '#64748b', fontSize: 13 },
});
