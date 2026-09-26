import type { InteractionCheckResponse, ProfileNode, Relationship, RelationshipStatus } from '@medifyrx/shared';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { useMemo } from 'react';

// Color is never the only signal: every status also gets an icon + text label.
export const STATUS_STYLE: Record<RelationshipStatus, { icon: string; label: string; color: string }> = {
  documented: { icon: '⚠', label: 'Documented interaction', color: '#9A5B4F' },
  warning: { icon: '!', label: 'Label warning', color: '#8A6A2E' },
  contraindication: { icon: '⊘', label: 'Contraindication found', color: '#8A3F4A' },
  'possible-allergy-match': { icon: '△', label: 'Possible allergy-related concern', color: '#665C82' },
};

const TYPE_ICON: Record<ProfileNode['type'], string> = {
  patient: '👤',
  medication: '💊',
  allergy: '⚠',
  food: '🍊',
};

// The profile branches into one category per column, with that category's items stacked beneath it:
//   My Profile → Medications / Allergies / Foods → each item.
const CATEGORIES: { type: Exclude<ProfileNode['type'], 'patient'>; label: string }[] = [
  { type: 'medication', label: 'Medications' },
  { type: 'allergy', label: 'Allergies' },
  { type: 'food', label: 'Foods' },
];
const COL_GAP = 240;
const ROW_GAP = 110;
const categoryId = (type: string) => `category-${type}`;

function layout(nodes: ProfileNode[]): { nodes: Node[]; edges: Edge[] } {
  const patient = nodes.find((n) => n.type === 'patient');
  const out: Node[] = [];
  const edges: Edge[] = [];
  const branch = (source: string, target: string): Edge => ({
    id: `tree-${target}`,
    source,
    target,
    type: 'smoothstep',
    style: { stroke: '#C9BFB9', strokeWidth: 2 },
    selectable: false,
  });

  if (patient) {
    out.push({
      id: patient.id,
      position: { x: COL_GAP, y: 0 },
      data: { label: `${TYPE_ICON.patient} ${patient.label}` },
      className: 'node node-patient',
    });
  }

  CATEGORIES.forEach(({ type, label }, col) => {
    const items = nodes.filter((n) => n.type === type);
    const x = col * COL_GAP;
    out.push({
      id: categoryId(type),
      position: { x, y: 130 },
      data: { label: items.length ? label : `${label} (none added)` },
      className: `node node-category node-category-${type}`,
      selectable: false,
    });
    if (patient) edges.push(branch(patient.id, categoryId(type)));

    items.forEach((n, row) => {
      out.push({
        id: n.id,
        position: { x, y: 260 + row * ROW_GAP },
        data: { label: `${TYPE_ICON[n.type]} ${n.label}` },
        className: `node node-${n.type}`,
      });
      edges.push(branch(categoryId(type), n.id));
    });
  });

  return { nodes: out, edges };
}

interface Props {
  result: InteractionCheckResponse;
  onSelectRelationship: (r: Relationship) => void;
}

export function InteractionTree({ result, onSelectRelationship }: Props) {
  const { nodes, edges } = useMemo(() => {
    const tree = layout(result.nodes);

    const typeOf = new Map(result.nodes.map((n) => [n.id, n.type]));
    const relEdges: Edge[] = result.relationships.map((r) => {
      const s = STATUS_STYLE[r.status];
      // Links within a column step straight down; links across columns curve so they don't run through other items.
      const sameColumn = typeOf.get(r.sourceNodeId) === typeOf.get(r.targetNodeId);
      return {
        id: r.id,
        source: r.sourceNodeId,
        target: r.targetNodeId,
        type: sameColumn ? 'smoothstep' : 'default',
        animated: true,
        label: `${s.icon} ${s.label}`,
        labelStyle: { fill: s.color, fontWeight: 600 },
        labelBgStyle: { fill: '#F7F7F7' },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 8,
        style: { stroke: s.color, strokeWidth: 2.5, cursor: 'pointer' },
        markerEnd: { type: MarkerType.ArrowClosed, color: s.color },
        data: { relationship: r },
      };
    });

    return { nodes: tree.nodes, edges: [...tree.edges, ...relEdges] };
  }, [result]);

  return (
    <div className="tree">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable
        onEdgeClick={(_, edge) => {
          const r = (edge.data as { relationship?: Relationship } | undefined)?.relationship;
          if (r) onSelectRelationship(r);
        }}
      >
        <Background color="#D2D2DA" gap={22} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
