import type { ProfileNode, Relationship } from '@medifyrx/shared';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../ui/Icon';
import { Callout, IconBtn } from '../ui/kit';
import { C, F, R, SH } from '../ui/theme';
import { STATUS_STYLE } from './status';

interface Props {
  relationship: Relationship | null;
  nodes: ProfileNode[];
  onClose: () => void;
}

/** Why a link is in the tree and where it comes from (web: RelationshipDetails.tsx), as a bottom sheet. */
export function RelationshipSheet({ relationship: r, nodes, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!r) return null;
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  const s = STATUS_STYLE[r.status];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal>
        <View style={styles.grab} />
        <ScrollView contentContainerStyle={{ gap: 6 }}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: s.color }]}>
              {s.icon} {r.title}
            </Text>
            <IconBtn icon="x" label="Close" size={34} onPress={onClose} />
          </View>
          <Text style={[styles.status, { color: s.color }]}>{s.label}</Text>
          <Text style={styles.pair}>
            <Text style={styles.strong}>{label(r.sourceNodeId)}</Text> ↕ <Text style={styles.strong}>{label(r.targetNodeId)}</Text>
          </Text>

          <Text style={styles.h4}>Why this is shown</Text>
          <Text style={styles.body}>{r.explanation ?? 'See the source below.'}</Text>

          {r.sourceText ? (
            <>
              <Text style={styles.h4}>From the source</Text>
              <View style={styles.quote}>
                <Text style={styles.quoteText}>{r.sourceText}</Text>
              </View>
            </>
          ) : null}

          <Text style={styles.h4}>Where this comes from</Text>
          <Text style={styles.body}>{r.source.label ?? r.source.organization}</Text>
          {r.source.url && (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(r.source.url!)} style={styles.link}>
              <Text style={styles.linkText}>View source label</Text>
              <Icon name="external-link" size={14} color={C.dusk} />
            </Pressable>
          )}
          <Text style={styles.checked}>Checked {new Date(r.checkedAt).toLocaleString()}</Text>

          <Callout style={{ marginTop: 10 }}>Talk with a pharmacist or healthcare professional if you have questions about this.</Callout>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(39,42,59,0.28)' },
  sheet: { maxHeight: '80%', backgroundColor: C.surface, paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, boxShadow: SH.outLg },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: F.head, fontSize: 19, lineHeight: 24 },
  status: { fontFamily: F.headBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  pair: { fontFamily: F.body, fontSize: 15, color: C.ink2, marginTop: 4 },
  strong: { fontFamily: F.bodyBold, color: C.ink },
  h4: { marginTop: 12, fontFamily: F.headBold, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: C.ink3 },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.ink2 },
  quote: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: C.white, boxShadow: SH.inSm },
  quoteText: { fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.ink2 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  linkText: { fontFamily: F.head, fontSize: 15, color: C.dusk, textDecorationLine: 'underline' },
  checked: { fontFamily: F.body, fontSize: 13, color: C.ink3 },
});
