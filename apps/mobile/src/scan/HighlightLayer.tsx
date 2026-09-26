import { LOW_CONFIDENCE, type Annotation, type AnnotationCategory } from '@medifyrx/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Color + icon, never color alone (accessibility).
export const CATEGORY_STYLE: Record<AnnotationCategory, { color: string; icon: string; label: string }> = {
  critical: { color: '#dc2626', icon: '🔒', label: 'Exact text' },
  warning: { color: '#ea580c', icon: '⚠', label: 'Warning' },
  medication: { color: '#736A86', icon: 'Rx', label: 'Medication' },
  abbreviation: { color: '#2563eb', icon: 'Ab', label: 'Abbreviation' },
  jargon: { color: '#7c3aed', icon: '?', label: 'Medical term' },
  consent: { color: '#475569', icon: '§', label: 'Consent term' },
  signature: { color: '#db2777', icon: '✍', label: 'Sign here' },
  timing: { color: '#0284c7', icon: '🕒', label: 'When' },
};

interface Props {
  annotations: Annotation[];
  onPress: (a: Annotation) => void;
}

export function HighlightLayer({ annotations, onPress }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {annotations.map((a) => {
        const s = CATEGORY_STYLE[a.category];
        const pad = 3;
        return (
          <Pressable
            key={a.id}
            onPress={() => onPress(a)}
            accessibilityRole="button"
            accessibilityLabel={`${s.label}: ${a.sourceText}`}
            hitSlop={8}
            style={[
              styles.box,
              {
                left: a.bbox.x - pad,
                top: a.bbox.y - pad,
                width: a.bbox.width + pad * 2,
                height: a.bbox.height + pad * 2,
                borderColor: s.color,
                backgroundColor: `${s.color}33`,
                borderStyle: a.confidence < LOW_CONFIDENCE ? 'dashed' : 'solid',
              },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: s.color }]}>
              <Text style={styles.badgeText}>{s.icon}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderWidth: 2, borderRadius: 4 },
  badge: {
    position: 'absolute',
    top: -10,
    left: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
