import {
  newId,
  type InteractionCheckResponse,
  type Profile,
  type Relationship,
  type RelationshipStatus,
} from '@medifyrx/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { useProfile } from '../../src/profile/ProfileContext';

// Same status vocabulary/colors as the website's interaction tree.
const STATUS_STYLE: Record<RelationshipStatus, { icon: string; label: string; color: string }> = {
  documented: { icon: '⚠', label: 'Documented interaction', color: '#9A5B4F' },
  warning: { icon: '!', label: 'Label warning', color: '#8A6A2E' },
  contraindication: { icon: '⊘', label: 'Contraindication', color: '#8A3F4A' },
  'possible-allergy-match': { icon: '△', label: 'Possible allergy match', color: '#665C82' },
};

// Synthetic demo patient "Alex" (mirrors the website). Never real patient data.
const demoAlex = (): Profile => ({
  medications: [
    { id: newId('med'), enteredName: 'Warfarin', normalizedName: 'Warfarin', rxCui: '11289', source: 'manual' },
    { id: newId('med'), enteredName: 'Aspirin', normalizedName: 'Aspirin', rxCui: '1191', source: 'manual' },
    { id: newId('med'), enteredName: 'Atorvastatin', normalizedName: 'Atorvastatin', rxCui: '83367', source: 'manual' },
  ],
  allergies: [{ id: newId('allergy'), substance: 'Penicillin', type: 'medication', reaction: 'Hives', source: 'user' }],
  foods: [{ id: newId('food'), name: 'Grapefruit', reason: 'regularly-consume' }],
});

export default function PrescriptiveScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useProfile();
  const [result, setResult] = useState<InteractionCheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const total = profile.medications.length + profile.allergies.length + profile.foods.length;

  // Results are for a specific profile; clear them when it changes.
  useEffect(() => {
    setResult(null);
    setExpanded(null);
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

  const nodeLabel = (id: string) => result?.nodes.find((n) => n.id === id)?.label ?? id;
  const unconnected = result
    ? result.nodes.filter(
        (n) =>
          n.type === 'medication' &&
          !result.relationships.some((r) => r.sourceNodeId === n.id || r.targetNodeId === n.id),
      )
    : [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <Text style={styles.h1}>Prescriptive</Text>
      <Text style={styles.sub}>
        Keep your medicines, allergies and foods in one profile, then check what to watch for. Every link comes from a
        real drug label you can open.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your profile</Text>
        <View style={styles.summaryRow}>
          <Summary label="Medicines" items={profile.medications.map((m) => m.normalizedName ?? m.enteredName)} />
          <Summary label="Allergies" items={profile.allergies.map((a) => a.substance)} />
          <Summary label="Foods" items={profile.foods.map((f) => f.name)} />
        </View>
        <View style={styles.btnRow}>
          <Pressable style={styles.secondary} onPress={() => setProfile(demoAlex())}>
            <Text style={styles.secondaryText}>Load demo patient</Text>
          </Pressable>
          <Pressable
            style={[styles.secondary, total === 0 && styles.disabled]}
            disabled={total === 0}
            onPress={() => setProfile({ medications: [], allergies: [], foods: [] })}
          >
            <Text style={styles.secondaryText}>Clear</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Add medicines and allergies on the My Profile tab, or load the demo patient.</Text>
      </View>

      <Pressable style={[styles.primary, (checking || total === 0) && styles.disabled]} disabled={checking || total === 0} onPress={check}>
        <Text style={styles.primaryText}>{checking ? 'Checking…' : result ? 'Check again' : 'Check relationships'}</Text>
      </Pressable>
      {checking && <ActivityIndicator style={{ marginTop: 16 }} color="#0d9488" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {result && (
        <View style={{ marginTop: 20, gap: 12 }}>
          {result.relationships.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No relationships were found in the sources checked.</Text>
            </View>
          ) : (
            result.relationships.map((r) => {
              const s = STATUS_STYLE[r.status];
              const open = expanded === r.id;
              return (
                <Pressable key={r.id} style={[styles.relCard, { borderLeftColor: s.color }]} onPress={() => setExpanded(open ? null : r.id)}>
                  <View style={styles.relHead}>
                    <Text style={[styles.relIcon, { color: s.color }]}>{s.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.relStatus, { color: s.color }]}>{s.label}</Text>
                      <Text style={styles.relTitle}>{r.title}</Text>
                      <Text style={styles.relPair}>
                        {nodeLabel(r.sourceNodeId)} ↔ {nodeLabel(r.targetNodeId)}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
                  </View>

                  {open && (
                    <View style={styles.relBody}>
                      <Text style={styles.relSection}>What was found</Text>
                      <Text style={styles.relText}>{r.explanation ?? 'See the source below.'}</Text>
                      {r.sourceText ? (
                        <>
                          <Text style={styles.relSection}>From the source</Text>
                          <Text style={styles.quote}>{r.sourceText}</Text>
                        </>
                      ) : null}
                      <Text style={styles.relSection}>Source</Text>
                      <Text style={styles.relText}>
                        {r.source.label ?? r.source.organization}
                        {r.source.url ? (
                          <Text style={styles.link} onPress={() => Linking.openURL(r.source.url!)}>
                            {'  ·  View source label'}
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={styles.callout}>Talk with a pharmacist or healthcare professional if you have questions.</Text>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}

          {unconnected.length > 0 && (
            <Text style={styles.note}>
              No relationships found in the sources checked for: {unconnected.map((n) => n.label).join(', ')}.
            </Text>
          )}
          <Text style={styles.disclaimer}>{result.disclaimer}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Summary({ label, items }: { label: string; items: string[] }) {
  return (
    <View style={styles.summaryCol}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryCount}>{items.length}</Text>
      {items.length > 0 && <Text style={styles.summaryItems} numberOfLines={3}>{items.join(', ')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  h1: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 15, color: '#475569', lineHeight: 21, marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCol: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 10 },
  summaryLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  summaryCount: { fontSize: 22, fontWeight: '800', color: '#0d9488' },
  summaryItems: { fontSize: 11, color: '#64748b', marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  secondaryText: { color: '#334155', fontWeight: '700' },
  hint: { fontSize: 12, color: '#94a3b8' },
  primary: { backgroundColor: '#0d9488', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.5 },
  error: { color: '#b91c1c', marginTop: 14, fontSize: 14 },
  emptyCard: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 16 },
  emptyText: { color: '#475569', fontSize: 14 },
  relCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 5 },
  relHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  relIcon: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  relStatus: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  relTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  relPair: { fontSize: 13, color: '#64748b', marginTop: 2 },
  chevron: { fontSize: 16, color: '#94a3b8' },
  relBody: { marginTop: 12, gap: 4, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  relSection: { fontSize: 12, fontWeight: '800', color: '#334155', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  relText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  quote: { fontSize: 14, color: '#475569', fontStyle: 'italic', borderLeftWidth: 3, borderLeftColor: '#cbd5e1', paddingLeft: 10, lineHeight: 20 },
  link: { color: '#0d9488', fontWeight: '700' },
  callout: { fontSize: 13, color: '#475569', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 10, marginTop: 10 },
  note: { fontSize: 13, color: '#64748b', marginTop: 4 },
  disclaimer: { fontSize: 12, color: '#94a3b8', lineHeight: 18, marginTop: 8 },
});
