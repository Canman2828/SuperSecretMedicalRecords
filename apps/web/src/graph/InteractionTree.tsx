import type { InteractionCheckResponse, ProfileNode, Relationship, RelationshipStatus } from '@medifyrx/shared';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import { useMemo } from 'react';

// Color is never the only signal: every status also gets an icon + text label.
export const STATUS_STYLE: Record<RelationshipStatus, { icon: string; label: string; color: string }> = {
  documented: { icon: '⚠', label: 'Documented interaction', color: '#9A5B4F' },
  warning: { icon: '!', label: 'Label warning', color: '#8A6A2E' },
  contraindication: { icon: '⊘', label: 'Contraindication', color: '#8A3F4A' },
  'possible-allergy-match': { icon: '△', label: 'Possible allergy match', color: '#665C82' },
};

const TYPE_ICON: Record<ProfileNode['type'], string> = {
  patient: '👤',
  medication: '💊',
  allergy: '⚠',
  food: '🍊',
};

const COLUMN_ORDER: ProfileNode['type'][] = ['medication', 'allergy', 'food'];

function layout(nodes: ProfileNode[]): Node[] {
  const items = COLUMN_ORDER.flatMap((t) => nodes.filter((n) => n.type === t));
  const gap = 190;
  const width = Math.max(items.length - 1, 0) * gap;

  return [
    ...nodes
      .filter((n) => n.type === 'patient')
      .map((n) => ({
        id: n.id,
        position: { x: width / 2, y: 0 },
        data: { label: `${TYPE_ICON.patient} ${n.label}` },
        className: 'node node-patient',
      })),
    ...items.map((n, i) => ({
      id: n.id,
      position: { x: i * gap, y: 170 },
      data: { label: `${TYPE_ICON[n.type]} ${n.label}` },
      className: `node node-${n.type}`,
    })),
  ];
}

interface Props {
  result: InteractionCheckResponse;
  onSelectRelationship: (r: Relationship) => void;
}

export function InteractionTree({ result, onSelectRelationship }: Props) {
  const { nodes, edges } = useMemo(() => {
    const treeEdges: Edge[] = result.nodes
      .filter((n) => n.type !== 'patient')
      .map((n) => ({
        id: `tree-${n.id}`,
        source: 'patient',
        target: n.id,
        style: { stroke: '#C9BFB9', strokeWidth: 2 },
        selectable: false,
      }));

    const relEdges: Edge[] = result.relationships.map((r) => {
      const s = STATUS_STYLE[r.status];
      return {
        id: r.id,
        source: r.sourceNodeId,
        target: r.targetNodeId,
        type: 'smoothstep',
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

    return { nodes: layout(result.nodes), edges: [...treeEdges, ...relEdges] };
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
