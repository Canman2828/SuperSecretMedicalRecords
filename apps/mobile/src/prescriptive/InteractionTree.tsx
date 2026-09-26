import type { InteractionCheckResponse, ProfileNode, Relationship } from '@medifyrx/shared';
import { useMemo, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { C, DOT, F, SH } from '../ui/theme';
import { STATUS_STYLE, TYPE_ICON } from './status';

// View's accepted style type. See the note in ../ui/kit.tsx: RN 0.88-rc's public ViewStyle is
// wider than the View style prop, so annotating forwarded styles as ViewStyle doesn't typecheck.
type VStyle = ComponentProps<typeof View>['style'];

// The website draws this with React Flow. Same tree, laid out by hand for a phone:
//   My Profile -> Medications / Allergies / Foods (one column each) -> each item,
// with every documented relationship drawn as a colored link and a tappable status badge.

const CATEGORIES: { type: Exclude<ProfileNode['type'], 'patient'>; label: string }[] = [
  { type: 'medication', label: 'Medications' },
  { type: 'allergy', label: 'Allergies' },
  { type: 'food', label: 'Foods' },
];

const PATIENT_TOP = 14;
const PATIENT_H = 38;
const BAR_Y = 76;
const CAT_TOP = 96;
const ITEM_TOP = 140;
const NODE_H = 48;
const ROW = 66;
const BADGE = 24;
const BRANCH = '#C9BFB9';

interface Props {
  result: InteractionCheckResponse;
  onSelectRelationship: (r: Relationship) => void;
}

interface Placed {
  node: ProfileNode;
  col: number;
  cx: number;
  cy: number;
}

/** A straight line from (x1, y1) to (x2, y2): a thin View, rotated. */
function line(x1: number, y1: number, x2: number, y2: number, color: string, width = 2): VStyle {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return {
    position: 'absolute',
    left: (x1 + x2) / 2 - len / 2,
    top: (y1 + y2) / 2 - width / 2,
    width: len,
    height: width,
    backgroundColor: color,
    borderRadius: width,
    transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
  };
}

export function InteractionTree({ result, onSelectRelationship }: Props) {
  const [w, setW] = useState(0);

  const layout = useMemo(() => {
    if (!w) return null;
    const colW = w / 3;
    const nodeW = colW - 16;
    const placed = new Map<string, Placed>();
    const columns = CATEGORIES.map(({ type, label }, col) => {
      const cx = colW * (col + 0.5);
      const items = result.nodes.filter((n) => n.type === type);
      items.forEach((node, row) => placed.set(node.id, { node, col, cx, cy: ITEM_TOP + row * ROW + NODE_H / 2 }));
      return { type, label, cx, items };
    });
    const rows = Math.max(1, ...columns.map((c) => c.items.length));
    const height = ITEM_TOP + rows * ROW + 8;

    // Relationship links. Same-column links bend out into the gutter on the right of the column.
    const perColumn = [0, 0, 0];
    const links = result.relationships.flatMap((r) => {
      const a = placed.get(r.sourceNodeId);
      const b = placed.get(r.targetNodeId);
      if (!a || !b) return [];
      const color = STATUS_STYLE[r.status].color;
      if (a.col === b.col) {
        const k = perColumn[a.col]++;
        const gx = a.cx + nodeW / 2 + 3 + (k % 3) * 2;
        const edge = a.cx + nodeW / 2 - 2;
        return [{
          r,
          color,
          segments: [line(edge, a.cy, gx, a.cy, color, 2.5), line(gx, a.cy, gx, b.cy, color, 2.5), line(gx, b.cy, edge, b.cy, color, 2.5)],
          badge: { x: gx, y: (a.cy + b.cy) / 2 },
        }];
      }
      const [l, rt] = a.cx < b.cx ? [a, b] : [b, a];
      const x1 = l.cx + nodeW / 2 - 4;
      const x2 = rt.cx - nodeW / 2 + 4;
      return [{ r, color, segments: [line(x1, l.cy, x2, rt.cy, color, 2.5)], badge: { x: (x1 + x2) / 2, y: (l.cy + rt.cy) / 2 } }];
    });

    return { colW, nodeW, columns, height, links };
  }, [w, result]);

  const patient = result.nodes.find((n) => n.type === 'patient');

  return (
    <View
      style={[styles.tree, layout && { height: layout.height }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityLabel="Interaction tree"
    >
      {layout && (
        <>
          {/* tree branches */}
          <View style={line(w / 2, PATIENT_TOP + PATIENT_H, w / 2, BAR_Y, BRANCH)} />
          <View style={line(layout.columns[0].cx, BAR_Y, layout.columns[2].cx, BAR_Y, BRANCH)} />
          {layout.columns.map((c) => (
            <View key={`b-${c.type}`}>
              <View style={line(c.cx, BAR_Y, c.cx, CAT_TOP, BRANCH)} />
              {c.items.length > 0 && <View style={line(c.cx, CAT_TOP + 22, c.cx, ITEM_TOP + (c.items.length - 1) * ROW + NODE_H / 2, BRANCH)} />}
            </View>
          ))}

          {/* relationship links, under the nodes */}
          {layout.links.map((l) => l.segments.map((seg, i) => <View key={`${l.r.id}-${i}`} style={seg} />))}

          {patient && (
            <View style={[styles.patient, { left: w / 2 - Math.min(170, w * 0.5) / 2, width: Math.min(170, w * 0.5) }]}>
              <Icon name="user" size={14} color={C.white} />
              <Text style={styles.patientText} numberOfLines={1}>{patient.label}</Text>
            </View>
          )}

          {layout.columns.map((c) => (
            <View key={c.type}>
              <Text style={[styles.category, { left: c.cx - layout.colW / 2, width: layout.colW }]} numberOfLines={1}>
                {c.items.length ? c.label : `${c.label} (none)`}
              </Text>
              {c.items.map((n, row) => (
                <View
                  key={n.id}
                  style={[
                    styles.node,
                    nodeTone[c.type],
                    { left: c.cx - layout.nodeW / 2, top: ITEM_TOP + row * ROW, width: layout.nodeW },
                  ]}
                >
                  <Icon name={TYPE_ICON[n.type]} size={13} color={DOT[c.type]} />
                  <Text style={styles.nodeText} numberOfLines={2}>{n.label}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* status badges, on top so they're always tappable */}
          {layout.links.map((l) => {
            const s = STATUS_STYLE[l.r.status];
            return (
              <Pressable
                key={`badge-${l.r.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${s.label}: ${l.r.title}. Show where this comes from.`}
                hitSlop={10}
                onPress={() => onSelectRelationship(l.r)}
                style={({ pressed }) => [
                  styles.badge,
                  { left: l.badge.x - BADGE / 2, top: l.badge.y - BADGE / 2, borderColor: l.color },
                  pressed && { transform: [{ scale: 1.15 }] },
                ]}
              >
                <Text style={[styles.badgeText, { color: l.color }]}>{s.icon}</Text>
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

const nodeTone: Record<(typeof CATEGORIES)[number]['type'], VStyle> = {
  medication: { backgroundColor: '#ECEDF3', borderColor: DOT.medication },
  allergy: { backgroundColor: '#EEF0F4', borderColor: DOT.allergy },
  food: { backgroundColor: '#F4ECEA', borderColor: DOT.food },
};

const styles = StyleSheet.create({
  tree: { position: 'relative', minHeight: 220 },
  patient: {
    position: 'absolute', top: PATIENT_TOP, height: PATIENT_H, borderRadius: 999, backgroundColor: C.dusk,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, boxShadow: SH.outSm,
  },
  patientText: { fontFamily: F.head, fontSize: 13, color: C.white, flexShrink: 1 },
  category: {
    position: 'absolute', top: CAT_TOP, textAlign: 'center', fontFamily: F.headBold, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: C.ink3, backgroundColor: C.bg, paddingVertical: 3,
  },
  node: {
    position: 'absolute', height: NODE_H, borderRadius: 16, borderWidth: 2, flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 8, boxShadow: '4px 6px 12px rgba(160,163,178,0.5)',
  },
  nodeText: { flex: 1, fontFamily: F.head, fontSize: 12, lineHeight: 15, color: C.ink },
  badge: {
    position: 'absolute', width: BADGE, height: BADGE, borderRadius: BADGE / 2, borderWidth: 2, backgroundColor: C.white,
    alignItems: 'center', justifyContent: 'center', boxShadow: SH.outSm,
  },
  badgeText: { fontSize: 12, fontWeight: '800', lineHeight: 14 },
});
