import { LOW_CONFIDENCE, type Annotation } from '@medifyrx/shared';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { CATEGORY_STYLE } from './HighlightLayer';

interface Props {
  annotation: Annotation | null;
  /** Nearby dosing text (e.g. "500 mg") to prefill when adding a scanned medication. */
  suggestedStrength?: string;
  onAddToProfile: (name: string, strength?: string) => void;
  onClose: () => void;
}

function speak(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'en-US' });
}

export function ExplanationSheet({ annotation: a, suggestedStrength, onAddToProfile, onClose }: Props) {
  const [explanation, setExplanation] = useState<string | undefined>();
  const [needsVerification, setNeedsVerification] = useState(false);
  const [strength, setStrength] = useState('');

  useEffect(() => {
    if (!a) return;
    setExplanation(a.explanation);
    setNeedsVerification(false);
    setStrength(suggestedStrength ?? '');
    // Glossary miss -> ask the server (glossary first, AI last). Never for exact-text dosing spans.
    if (!a.explanation && a.category !== 'critical' && a.category !== 'medication') {
      api
        .explain({ term: a.sourceText })
        .then((r) => {
          setExplanation(r.simpleDefinition);
          setNeedsVerification(r.needsVerification);
        })
        .catch(() => setExplanation(undefined));
    }
  }, [a, suggestedStrength]);

  if (!a) return null;
  const s = CATEGORY_STYLE[a.category];
  const lowConfidence = a.confidence < LOW_CONFIDENCE;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={[styles.category, { color: s.color }]}>
          {s.icon} {s.label}
        </Text>

        <Text style={styles.heading}>Original</Text>
        <View style={styles.original}>
          {a.immutable && <Text style={styles.lock}>🔒</Text>}
          <Text style={styles.originalText} selectable>
            {a.sourceText}
          </Text>
        </View>

        {lowConfidence && <Text style={styles.warn}>Not confident — verify the printed text.</Text>}

        {a.category === 'critical' ? (
          <Text style={styles.body}>
            This is a dosing value. It's shown exactly as printed. Follow your label or ask your pharmacist.
          </Text>
        ) : a.category === 'medication' ? (
          <>
            <Text style={styles.heading}>Add to my profile</Text>
            <TextInput
              style={styles.input}
              placeholder="Strength (e.g. 500 mg)"
              value={strength}
              onChangeText={setStrength}
            />
            <Pressable
              style={styles.primary}
              onPress={() => {
                onAddToProfile(a.sourceText, strength.trim() || undefined);
                onClose();
              }}
            >
              <Text style={styles.primaryText}>Add to profile</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.heading}>What this means</Text>
            <Text style={styles.body}>{explanation ?? 'Looking this up…'}</Text>
            {needsVerification && <Text style={styles.warn}>Double-check this with your pharmacist.</Text>}
          </>
        )}

        <View style={styles.row}>
          <Pressable style={styles.button} onPress={() => speak(a.sourceText)}>
            <Text>🔊 Listen to original</Text>
          </Pressable>
          {explanation && (
            <Pressable style={styles.button} onPress={() => speak(explanation)}>
              <Text>🔊 Listen to explanation</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.disclaimer}>This explains terms only. It isn't medical advice.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', padding: 20, paddingBottom: 36, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 8 },
  category: { fontWeight: '700', fontSize: 13, textTransform: 'uppercase' },
  heading: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginTop: 8 },
  original: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8 },
  lock: { fontSize: 16 },
  originalText: { fontSize: 20, fontWeight: '600', fontFamily: 'Menlo' },
  body: { fontSize: 17, lineHeight: 24 },
  warn: { color: '#b45309', fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 16 },
  primary: { backgroundColor: '#0d9488', borderRadius: 8, padding: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  disclaimer: { fontSize: 12, color: '#64748b', marginTop: 8 },
});
