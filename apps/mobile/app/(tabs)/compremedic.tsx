import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../src/profile/ProfileContext';
import { originalSegments, plainSegments, spokenText, type Segment } from '../../src/compremedic/plainLanguage';

const DOC_TYPES = ['Prescription label', 'Pill bottle', 'Consent form', 'Contact lens box'] as const;
type DocType = (typeof DOC_TYPES)[number];

// Synthetic sample text only (mirrors the website).
const SAMPLES: Record<DocType, string> = {
  'Prescription label':
    'AMOXICILLIN 500 MG CAPSULES. TAKE 1 CAPSULE PO 3 TIMES DAILY FOR 10 DAYS. COMPLETE FULL COURSE OF THERAPY. MAY CAUSE GI UPSET; MAY TAKE WITH FOOD. DISCONTINUE AND CONTACT PRESCRIBER IF RASH OR URTICARIA OCCURS.',
  'Pill bottle':
    'IBUPROFEN 200 MG TABLETS. TAKE 1 TABLET PO Q6H PRN FOR PAIN. DO NOT EXCEED 6 TABLETS IN 24 HOURS. TAKE WITH FOOD. AVOID ALCOHOL.',
  'Consent form':
    'I give my CONSENT for the procedure described above. I understand that ADVERSE reactions, including HYPERSENSITIVITY, may occur. This AUTHORIZATION remains in effect until I revoke it in writing.',
  'Contact lens box':
    'DAILY DISPOSABLE CONTACT LENSES. REPLACE EVERY 1 DAY. DO NOT SLEEP IN LENSES. DO NOT RINSE WITH WATER. REMOVE AND CONSULT YOUR EYE CARE PROFESSIONAL IF IRRITATION OCCURS.',
};

const SPEEDS = [0.75, 1, 1.25];

export default function CompremedicScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [docType, setDocType] = useState<DocType>('Prescription label');
  const [text, setText] = useState(SAMPLES['Prescription label']);
  const [playing, setPlaying] = useState<'orig' | 'plain' | null>(null);
  const [speed, setSpeed] = useState(1);

  const knownMedications = useMemo(
    () => profile.medications.map((m) => m.normalizedName ?? m.enteredName),
    [profile.medications],
  );
  const isSample = Object.values(SAMPLES).includes(text);
  const original = useMemo(() => originalSegments(text, knownMedications), [text, knownMedications]);
  const plain = useMemo(() => plainSegments(text, knownMedications), [text, knownMedications]);
  const hasText = text.trim().length > 0;

  const pickType = (t: DocType) => {
    setDocType(t);
    if (isSample) setText(SAMPLES[t]); // never overwrite text the user typed
  };

  const toggle = (which: 'orig' | 'plain', toSpeak: string) => {
    Speech.stop();
    if (playing === which) {
      setPlaying(null);
      return;
    }
    setPlaying(which);
    Speech.speak(toSpeak, { rate: speed, onDone: () => setPlaying(null), onStopped: () => setPlaying(null) });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <Text style={styles.h1}>Compremedic</Text>
      <Text style={styles.sub}>
        Paste the text from a label or form. We show a plain-language version beside the original and can read either
        aloud. Doses, timing and warnings are never reworded.
      </Text>

      <Text style={styles.label}>What is it?</Text>
      <View style={styles.chips}>
        {DOC_TYPES.map((t) => (
          <Pressable key={t} style={[styles.chip, docType === t && styles.chipOn]} onPress={() => pickType(t)}>
            <Text style={[styles.chipText, docType === t && styles.chipTextOn]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Text on the document</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Type or paste the text exactly as printed"
        placeholderTextColor="#94a3b8"
      />

      <View style={styles.speedRow}>
        <Text style={styles.speedLabel}>Reading speed</Text>
        <Pressable style={styles.speedBtn} onPress={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>
          <Text style={styles.speedBtnText}>{speed}×</Text>
        </Pressable>
      </View>

      <View style={styles.pane}>
        <Text style={styles.paneLabel}>Original text</Text>
        <Text style={styles.paneBody}>
          <SegmentText segments={original} />
        </Text>
        <Pressable
          style={[styles.play, !hasText && styles.playDisabled]}
          disabled={!hasText}
          onPress={() => toggle('orig', text)}
        >
          <Text style={styles.playText}>{playing === 'orig' ? '⏸ Stop' : '🔊 Listen to original'}</Text>
        </Pressable>
      </View>

      <View style={styles.pane}>
        <Text style={styles.paneLabel}>In plain words</Text>
        <Text style={styles.paneBody}>
          <SegmentText segments={plain} />
        </Text>
        <Pressable
          style={[styles.play, !hasText && styles.playDisabled]}
          disabled={!hasText}
          onPress={() => toggle('plain', spokenText(plain))}
        >
          <Text style={styles.playText}>{playing === 'plain' ? '⏸ Stop' : '🔊 Listen to plain version'}</Text>
        </Pressable>
      </View>

      <View style={styles.guard}>
        <Text style={styles.guardTitle}>🔒 Protected details</Text>
        <Text style={styles.guardText}>
          Highlighted values are copied exactly from the original and never rewritten: dose, how often, how long and
          warnings. If anything looks different from your label, trust the label and ask your pharmacist.
        </Text>
      </View>
    </ScrollView>
  );
}

function SegmentText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.lock ? (
          <Text key={i}>
            <Text style={styles.lock}>{s.text}</Text>
            {s.meaning ? <Text style={styles.meaning}> ({s.meaning})</Text> : null}
          </Text>
        ) : s.term ? (
          <Text key={i}>
            <Text style={styles.term}>{s.text}</Text>
            <Text style={styles.meaning}> ({s.meaning})</Text>
          </Text>
        ) : (
          <Text key={i}>{s.text}</Text>
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, gap: 6 },
  h1: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  sub: { fontSize: 15, color: '#475569', lineHeight: 21, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 99, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: '#fff' },
  input: { minHeight: 110, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, fontSize: 15, color: '#0f172a', backgroundColor: '#fff', textAlignVertical: 'top' },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  speedLabel: { color: '#64748b', fontSize: 13 },
  speedBtn: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#fff' },
  speedBtnText: { fontWeight: '700', color: '#0d9488' },
  pane: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  paneLabel: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  paneBody: { fontSize: 16, lineHeight: 26, color: '#0f172a' },
  lock: { backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '700' },
  term: { color: '#0d9488', fontWeight: '700', textDecorationLine: 'underline' },
  meaning: { color: '#0d9488', fontStyle: 'italic' },
  play: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  playDisabled: { opacity: 0.5 },
  playText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  guard: { flexDirection: 'column', gap: 6, backgroundColor: '#f1f5f9', borderRadius: 14, padding: 16, marginTop: 18 },
  guardTitle: { fontWeight: '800', color: '#0f172a', fontSize: 15 },
  guardText: { color: '#475569', fontSize: 13, lineHeight: 19 },
});
