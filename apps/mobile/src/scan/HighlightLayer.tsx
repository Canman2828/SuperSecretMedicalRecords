import { LOW_CONFIDENCE, type Annotation, type AnnotationCategory } from '@medifyrx/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '../ui/Icon';

// Color + icon, never color alone (accessibility). Icons are the design-system SVG set, not emoji.
export const CATEGORY_STYLE: Record<AnnotationCategory, { color: string; icon: IconName; label: string }> = {
  critical: { color: '#dc2626', icon: 'lock', label: 'Exact text' },
  warning: { color: '#ea580c', icon: 'alert', label: 'Warning' },
  medication: { color: '#736A86', icon: 'pill', label: 'Medication' },
  abbreviation: { color: '#2563eb', icon: 'type', label: 'Abbreviation' },
  jargon: { color: '#7c3aed', icon: 'help', label: 'Medical term' },
  consent: { color: '#475569', icon: 'file', label: 'Consent term' },
  signature: { color: '#db2777', icon: 'edit', label: 'Sign here' },
  timing: { color: '#0284c7', icon: 'pace', label: 'When' },
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
              <Icon name={s.icon} size={11} color="#fff" />
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
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
