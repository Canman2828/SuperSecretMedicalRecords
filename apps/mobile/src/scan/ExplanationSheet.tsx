import { LOW_CONFIDENCE, type Annotation } from '@medifyrx/shared';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { Icon } from '../ui/Icon';
import { Btn, Field } from '../ui/kit';
import { ACC, C, F, R, SH } from '../ui/theme';
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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!a) return;
    setExplanation(a.explanation);
    setNeedsVerification(false);
    setStrength(suggestedStrength ?? '');
    // Glossary miss -> ask the server (glossary first, AI last). Never for exact-text dosing spans.
    const fixedText = a.category === 'critical' || a.category === 'medication' || a.category === 'signature' || a.category === 'timing';
    if (!a.explanation && !fixedText) {
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
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal>
        <View style={styles.grab} />
        <Text style={[styles.category, { color: s.color }]}>
          {s.icon} {s.label}
        </Text>

        <Text style={styles.heading}>Original</Text>
        <View style={styles.original}>
          {a.immutable && <Icon name="lock" size={16} color={ACC.steel.deep} />}
          <Text style={styles.originalText} selectable>
            {a.sourceText}
          </Text>
        </View>

        {lowConfidence && <Text style={styles.warn}>Not confident — verify the printed text.</Text>}

        {a.category === 'critical' ? (
          <Text style={styles.body}>
            This is a dosing value. It's shown exactly as printed. Follow your label or ask your pharmacist.
          </Text>
        ) : a.category === 'signature' ? (
          <Text style={styles.body}>
            This is where you sign or fill something in. Read the whole form first, and ask any questions before you sign.
          </Text>
        ) : a.category === 'timing' ? (
          <Text style={styles.body}>
            This tells you when. It's shown exactly as printed. Check it against your label or ask your pharmacist.
          </Text>
        ) : a.category === 'medication' ? (
          <>
            <Text style={styles.heading}>Add to my profile</Text>
            <Field small placeholder="Strength (e.g. 500 mg)" value={strength} onChangeText={setStrength} accessibilityLabel="Strength" />
            <Btn
              label="Add to profile"
              iconLeft="plus"
              full
              onPress={() => {
                onAddToProfile(a.sourceText, strength.trim() || undefined);
                onClose();
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.heading}>What this means</Text>
            <Text style={styles.body}>{explanation ?? 'Looking this up…'}</Text>
            {needsVerification && <Text style={styles.warn}>Double-check this with your pharmacist.</Text>}
          </>
        )}

        <View style={styles.row}>
          <Btn label="Listen to original" iconLeft="volume" variant="neu" height={42} onPress={() => speak(a.sourceText)} />
          {explanation && <Btn label="Listen to explanation" iconLeft="volume" variant="neu" height={42} onPress={() => speak(explanation)} />}
        </View>

        <Text style={styles.disclaimer}>This explains terms only. It isn't medical advice.</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(39,42,59,0.28)' },
  sheet: { backgroundColor: C.surface, paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, gap: 10, boxShadow: SH.outLg },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 6 },
  category: { fontFamily: F.headBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' },
  heading: { fontFamily: F.headBold, fontSize: 11, letterSpacing: 1.3, color: C.ink3, textTransform: 'uppercase', marginTop: 6 },
  original: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, paddingVertical: 12, paddingHorizontal: 14, borderRadius: R.md, boxShadow: SH.pane },
  originalText: { flexShrink: 1, fontSize: 20, fontWeight: '600', fontFamily: F.mono, color: C.ink },
  body: { fontFamily: F.body, fontSize: 17, lineHeight: 25, color: C.ink2 },
  warn: { fontFamily: F.bodyBold, color: '#8A6A2E' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  disclaimer: { fontFamily: F.body, fontSize: 13, color: C.ink3, marginTop: 6 },
});
