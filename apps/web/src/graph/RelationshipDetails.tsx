import type { ProfileNode, Relationship } from '@medifyrx/shared';
import { Icon } from '../ui/Icon';
import { STATUS_STYLE } from './InteractionTree';

interface Props {
  relationship: Relationship;
  nodes: ProfileNode[];
  onClose: () => void;
}

export function RelationshipDetails({ relationship: r, nodes, onClose }: Props) {
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  const s = STATUS_STYLE[r.status];

  return (
    <aside className="details card" role="dialog" aria-label="Relationship details">
      <button className="icon-btn close" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
      <h3 style={{ color: s.color }}>
        {s.icon} {r.title}
      </h3>
      <p className="pair">
        <strong>{label(r.sourceNodeId)}</strong> ↕ <strong>{label(r.targetNodeId)}</strong>
      </p>

      <h4>What was found</h4>
      <p>{r.explanation ?? 'See the source below.'}</p>

      {r.sourceText && (
        <>
          <h4>From the source</h4>
          <blockquote>{r.sourceText}</blockquote>
        </>
      )}

      <h4>Source</h4>
      <p>
        {r.source.label ?? r.source.organization}
        {r.source.url && (
          <>
            {' · '}
            <a href={r.source.url} target="_blank" rel="noreferrer">View source label</a>
          </>
        )}
      </p>
      <p className="muted small">Checked {new Date(r.checkedAt).toLocaleString()}</p>

      <p className="callout neu-in">
        Talk with a pharmacist or healthcare professional if you have questions about this.
      </p>
    </aside>
  );
}
