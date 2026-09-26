import type { ExplainResponse } from '@medifyrx/shared';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api';

const CATEGORIES = ['Dosage terms', 'Medicines', 'Symptoms', 'Tests and procedures', 'Words I heard'] as const;
type Category = (typeof CATEGORIES)[number];

// A few common terms as one-tap starting points.
const QUICK_TERMS = ['PRN', 'PO', 'BID', 'contraindicated', 'titration', 'adverse reaction'];

const SOURCE_LABEL: Record<ExplainResponse['source'], string> = {
  glossary: 'From the medify glossary',
  ai: 'AI explanation — please verify',
  none: 'No trusted explanation found',
};

export default function MedictionaryScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<Category>('Dosage terms');
  const [answer, setAnswer] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (termArg?: string) => {
    const term = (termArg ?? q).trim();
    if (!term) return;
    if (termArg) setQ(termArg);
    setLoading(true);
    setError(null);
    try {
      setAnswer(await api.explain({ term: term.slice(0, 100), context: category }));
    } catch (err) {
      setError(`Could not reach the dictionary. ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <Text style={styles.h1}>Medictionary</Text>
      <Text style={styles.sub}>
        Ask about a medicine, a dosage term, or a word you heard at an appointment. Answers stay short and plain.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="A word or term, e.g. PRN"
          placeholderTextColor="#94a3b8"
          maxLength={100}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => ask()}
        />
        <Pressable style={[styles.askBtn, loading && styles.askBtnDisabled]} disabled={loading} onPress={() => ask()}>
          <Text style={styles.askBtnText}>{loading ? '…' : 'Ask'}</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipOn]} onPress={() => setCategory(c)}>
            <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.quickLabel}>Common terms</Text>
      <View style={styles.chips}>
        {QUICK_TERMS.map((t) => (
          <Pressable key={t} style={styles.quickChip} onPress={() => ask(t)}>
            <Text style={styles.quickChipText}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 24 }} color="#0d9488" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {answer && !loading && (
        <View style={styles.answer}>
          <View style={styles.answerHead}>
            <Text style={styles.answerTerm}>{answer.term}</Text>
            <View style={[styles.tag, answer.source === 'ai' && styles.tagAi, answer.source === 'none' && styles.tagNone]}>
              <Text style={styles.tagText}>{SOURCE_LABEL[answer.source]}</Text>
            </View>
          </View>
          <Text style={styles.answerBody}>{answer.simpleDefinition}</Text>
          {answer.needsVerification && (
            <Text style={styles.verify}>Please check this with a pharmacist or healthcare professional.</Text>
          )}
        </View>
      )}

      <Text style={styles.footer}>
        Answers are for understanding only. Your pharmacist or doctor can tell you how anything applies to you.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, gap: 6 },
  h1: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 15, color: '#475569', lineHeight: 21, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 10 },
  search: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff', color: '#0f172a' },
  askBtn: { backgroundColor: '#0d9488', borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  askBtnDisabled: { opacity: 0.6 },
  askBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 99, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  quickLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 18 },
  quickChip: { borderWidth: 1, borderColor: '#99f6e4', borderRadius: 99, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: '#f0fdfa' },
  quickChipText: { color: '#0f766e', fontWeight: '600', fontSize: 13 },
  error: { color: '#b91c1c', marginTop: 18, fontSize: 14 },
  answer: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
  answerHead: { gap: 8 },
  answerTerm: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  tag: { alignSelf: 'flex-start', backgroundColor: '#f0fdfa', borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 },
  tagAi: { backgroundColor: '#fef3c7' },
  tagNone: { backgroundColor: '#f1f5f9' },
  tagText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  answerBody: { fontSize: 17, lineHeight: 25, color: '#0f172a' },
  verify: { fontSize: 13, color: '#92400e', fontStyle: 'italic' },
  footer: { fontSize: 12, color: '#94a3b8', marginTop: 24, lineHeight: 18 },
});
