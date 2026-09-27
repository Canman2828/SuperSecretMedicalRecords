import type { DrugSearchResult } from '@medifyrx/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { Field, IconBtn, Label } from '../ui/kit';
import { C, F, R, SH } from '../ui/theme';

interface Props {
  onSelect: (drug: DrugSearchResult | { name: string; rxCui?: undefined }) => void;
}

/** RxNorm-backed autocomplete so the same drug always gets the same RxCUI (web: MedicationSearch.tsx). */
export function MedicationSearch({ onSelect }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults((await api.searchDrugs(q)).results);
      } catch {
        setError('Search unavailable. You can still add it as typed.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (d: DrugSearchResult | { name: string }) => {
    onSelect(d);
    setQ('');
    setResults([]);
  };
  const submit = () => {
    if (q.trim()) pick(results[0] ?? { name: q.trim() });
  };

  return (
    <View>
      <Label>Add a medication</Label>
      <Field
        placeholder="e.g. Lopressor"
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityLabel="Add a medication"
        right={<IconBtn icon="plus" label="Add medication" size={36} onPress={submit} />}
      />
      {(results.length > 0 || loading || error || q.trim().length >= 2) && (
        <View style={styles.results}>
          {loading && <Text style={styles.note}>Searching RxNorm…</Text>}
          {error && <Text style={styles.note}>{error}</Text>}
          {results.map((r) => (
            <Pressable key={r.rxCui} accessibilityRole="button" onPress={() => pick(r)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <Text style={styles.itemText}>
                {r.name} <Text style={styles.cui}>RxCUI {r.rxCui}</Text>
              </Text>
            </Pressable>
          ))}
          {!loading && q.trim().length >= 2 && (
            <Pressable accessibilityRole="button" onPress={() => pick({ name: q.trim() })} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <Text style={[styles.itemText, { color: C.ink3 }]}>Add “{q.trim()}” as typed</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { marginTop: 10, padding: 6, gap: 2, borderRadius: R.md, backgroundColor: C.white, boxShadow: SH.outSm },
  note: { fontFamily: F.body, fontSize: 14, color: C.ink3, paddingVertical: 6, paddingHorizontal: 10 },
  item: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  pressed: { backgroundColor: '#E4DFEF' },
  itemText: { fontFamily: F.body, fontSize: 15, color: C.ink },
  cui: { fontSize: 13, color: C.ink3 },
});
