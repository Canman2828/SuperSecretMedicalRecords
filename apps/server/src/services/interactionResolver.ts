import {
  NO_RESULT_DISCLAIMER,
  type InteractionCheckRequest,
  type InteractionCheckResponse,
  type ProfileNode,
  type Relationship,
} from '@clearrx/shared';
import { DEMO_RELATIONSHIPS, type DemoRelationship } from '../data/demoRelationships.js';

type Matchable = { id: string; names: string[]; rxCui?: string };

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

function matches(side: DemoRelationship['a'], item: Matchable) {
  if (item.rxCui && side.rxCuis.includes(item.rxCui)) return true;
  return item.names.some((n) => side.names.includes(n.toLowerCase().trim()));
}

/**
 * Builds the tree: patient -> each item, plus sourced edges between items.
 * The frontend never decides relationships; it just renders this.
 *
 * Right now this uses only the curated demo list (phase 5).
 * Phase 6: also scan openFDA label sections (services/openfda.ts) for mentions of the
 * other profile items and emit 'warning' edges with the matching sentence as sourceText.
 */
export async function resolveProfileRelationships(
  profile: InteractionCheckRequest,
): Promise<InteractionCheckResponse> {
  const checkedAt = new Date().toISOString();

  const meds: Matchable[] = profile.medications.map((m) => ({
    id: `med-${m.rxCui ?? slug(m.normalizedName ?? m.enteredName)}`,
    names: [m.enteredName, m.normalizedName].filter(Boolean) as string[],
    rxCui: m.rxCui,
  }));
  const foods: Matchable[] = profile.foods.map((f) => ({ id: `food-${slug(f.name)}`, names: [f.name] }));
  const allergies: Matchable[] = profile.allergies.map((a) => ({
    id: `allergy-${slug(a.substance)}`,
    names: [a.substance],
  }));

  const nodes: ProfileNode[] = [
    { id: 'patient', type: 'patient', label: 'My Profile' },
    ...profile.medications.map((m, i) => ({
      id: meds[i].id,
      type: 'medication' as const,
      label: m.normalizedName ?? m.enteredName,
      metadata: { rxCui: m.rxCui },
    })),
    ...profile.allergies.map((a, i) => ({ id: allergies[i].id, type: 'allergy' as const, label: a.substance })),
    ...profile.foods.map((f, i) => ({ id: foods[i].id, type: 'food' as const, label: f.name })),
  ];

  const relationships: Relationship[] = [];
  const seen = new Set<string>();

  for (const rel of DEMO_RELATIONSHIPS) {
    const targets = rel.bKind === 'medication' ? meds : rel.bKind === 'food' ? foods : allergies;
    for (const a of meds) {
      if (!matches(rel.a, a)) continue;
      for (const b of targets) {
        if (a.id === b.id || !matches(rel.b, b)) continue;
        const key = [a.id, b.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        relationships.push({
          id: `rel-${relationships.length + 1}`,
          sourceNodeId: a.id,
          targetNodeId: b.id,
          type: rel.type,
          status: rel.status,
          title: rel.title,
          explanation: rel.explanation,
          source: rel.source,
          sourceText: rel.sourceText,
          checkedAt,
        });
      }
    }
  }

  // Conservative exact-match allergy check (design doc §25): allergy "amoxicillin" + med "amoxicillin".
  for (const al of allergies) {
    for (const m of meds) {
      const key = [m.id, al.id].sort().join('|');
      if (seen.has(key)) continue;
      if (m.names.some((n) => n.toLowerCase() === al.names[0].toLowerCase())) {
        seen.add(key);
        relationships.push({
          id: `rel-${relationships.length + 1}`,
          sourceNodeId: m.id,
          targetNodeId: al.id,
          type: 'drug-allergy',
          status: 'possible-allergy-match',
          title: 'Possible allergy-related match',
          explanation: 'This medication has the same name as an allergy you entered.',
          source: { organization: 'Your profile' },
          checkedAt,
        });
      }
    }
  }

  return { nodes, relationships, disclaimer: NO_RESULT_DISCLAIMER };
}
