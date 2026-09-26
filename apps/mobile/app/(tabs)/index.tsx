import { newId, type Annotation } from '@clearrx/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../src/profile/ProfileContext';
import { ExplanationSheet } from '../../src/scan/ExplanationSheet';
import { HighlightLayer } from '../../src/scan/HighlightLayer';
import { useOcrLoop } from '../../src/scan/useOcrLoop';

// Medication names to highlight. Profile meds are added automatically.
// Swap for an RxTerms lookup later (phase 6).
const DEMO_MEDICATIONS = ['amoxicillin', 'metoprolol', 'warfarin', 'aspirin', 'atorvastatin', 'lisinopril', 'metformin'];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<Annotation | null>(null);
  const insets = useSafeAreaInsets();
  const { profile, addMedication } = useProfile();

  // Only run the camera/OCR loop while this tab is on screen.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const knownMedications = useMemo(
    () => [...DEMO_MEDICATIONS, ...profile.medications.map((m) => m.normalizedName ?? m.enteredName)],
    [profile.medications],
  );

  const { annotations } = useOcrLoop({
    cameraRef,
    viewSize,
    knownMedications,
    enabled: focused && !paused && !selected && Boolean(permission?.granted),
  });

  // For "Add to profile": grab the dosing value printed closest to the tapped medication.
  const suggestedStrength = useMemo(() => {
    if (selected?.category !== 'medication') return undefined;
    const cy = selected.bbox.y + selected.bbox.height / 2;
    const candidates = annotations
      .filter((a) => a.category === 'critical' && /mg|mcg|ml|g\b|%|units?/i.test(a.sourceText))
      .map((a) => ({ a, d: Math.abs(a.bbox.y + a.bbox.height / 2 - cy) }))
      .sort((x, y) => x.d - y.d);
    return candidates[0] && candidates[0].d < selected.bbox.height * 3 ? candidates[0].a.sourceText : undefined;
  }, [selected, annotations]);

  if (!permission) return <View style={styles.center} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>ClearRx Lens</Text>
        <Text style={styles.body}>Point your camera at a prescription to highlight and explain medical terms.</Text>
        <Pressable style={styles.primary} onPress={requestPermission}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => setViewSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {focused && <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" animateShutter={false} />}

      <HighlightLayer annotations={annotations} onPress={setSelected} />

      <View style={[styles.hint, { top: insets.top + 8 }]} pointerEvents="none">
        <Text style={styles.hintText}>
          {annotations.length ? 'Tap a highlight to learn more' : 'Center the prescription and hold steady'}
        </Text>
      </View>

      <Pressable style={[styles.pause, { bottom: 16 }]} onPress={() => setPaused((p) => !p)}>
        <Text style={styles.pauseText}>{paused ? '▶ Resume' : '⏸ Freeze'}</Text>
      </Pressable>

      <ExplanationSheet
        annotation={selected}
        suggestedStrength={suggestedStrength}
        onClose={() => setSelected(null)}
        onAddToProfile={(name, strength) => {
          addMedication({ id: newId('med'), enteredName: name, strength, source: 'prescription-scan' });
          Alert.alert('Added to profile', `${name}${strength ? ` ${strength}` : ''} was added. Review it on the Profile tab.`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700' },
  body: { fontSize: 16, textAlign: 'center', color: '#475569' },
  primary: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 14 },
  hintText: { color: '#fff', fontWeight: '600' },
  pause: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 99, paddingVertical: 10, paddingHorizontal: 18 },
  pauseText: { color: '#fff', fontWeight: '700' },
});
