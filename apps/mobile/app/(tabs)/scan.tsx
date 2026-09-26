import { newId, type Annotation } from '@medifyrx/shared';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../src/profile/ProfileContext';
import { ArPanels } from '../../src/scan/ArPanels';
import { ExplanationSheet } from '../../src/scan/ExplanationSheet';
import { HighlightLayer } from '../../src/scan/HighlightLayer';
import { useOcrLoop } from '../../src/scan/useOcrLoop';
import { Icon, Logo } from '../../src/ui/Icon';
import { Btn } from '../../src/ui/kit';
import { C, F, R, SH } from '../../src/ui/theme';

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

  const { annotations, lastText, docBox } = useOcrLoop({
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
        <View style={styles.portal}>
          <Logo size={72} />
        </View>
        <Text style={styles.title}>medify.Rx Lens</Text>
        <Text style={styles.body}>
          Point your camera at a prescription or form. Doses, warnings and medical terms are highlighted right on the
          page, and a tap explains them. Photos are read on your phone and deleted right away.
        </Text>
        <Btn label="Allow camera" iconLeft="camera" onPress={requestPermission} style={{ alignSelf: 'center' }} />
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

      <ArPanels
        annotations={annotations}
        docBox={docBox}
        viewSize={viewSize}
        insets={insets}
        frozen={paused}
        text={lastText}
        knownMedications={knownMedications}
        onSelect={setSelected}
      />

      <View style={[styles.hint, { top: insets.top + 8 }]} pointerEvents="none">
        <Text style={styles.hintText}>
          {paused
            ? 'Original and plain words, side by side'
            : annotations.length
              ? 'Tap a highlight to learn more'
              : 'Center the prescription or form and hold steady'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.pause, { bottom: 16 }, pressed && { transform: [{ scale: 0.97 }] }]}
        onPress={() => setPaused((p) => !p)}
      >
        <Icon name={paused ? 'play' : 'pause'} size={16} color={C.white} />
        <Text style={styles.pauseText}>{paused ? 'Resume' : 'Freeze & explain'}</Text>
      </Pressable>

      <ExplanationSheet
        annotation={selected}
        suggestedStrength={suggestedStrength}
        onClose={() => setSelected(null)}
        onAddToProfile={(name, strength) => {
          addMedication({ id: newId('med'), enteredName: name, strength, source: 'prescription-scan' });
          Alert.alert('Added to profile', `${name}${strength ? ` ${strength}` : ''} was added. Review it on the Prescriptive tab.`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16, backgroundColor: C.bg },
  portal: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, boxShadow: `${SH.outLg}, ${SH.in}`, marginBottom: 8 },
  title: { fontFamily: F.head, fontSize: 26, color: C.ink },
  body: { fontFamily: F.body, fontSize: 16, lineHeight: 24, textAlign: 'center', color: C.ink3, marginBottom: 6 },
  hint: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(239,239,242,0.9)', borderRadius: R.pill, paddingVertical: 8, paddingHorizontal: 16, boxShadow: '0 4px 14px rgba(0,0,0,0.18)' },
  hintText: { fontFamily: F.head, fontSize: 13, color: C.ink2 },
  pause: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.dusk, borderRadius: R.pill, paddingVertical: 13, paddingHorizontal: 22, boxShadow: '0 6px 18px rgba(0,0,0,0.28)' },
  pauseText: { fontFamily: F.head, fontSize: 15, color: C.white },
});
