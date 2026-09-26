import {
  NO_RESULT_DISCLAIMER,
  type InteractionCheckRequest,
  type InteractionCheckResponse,
  type ProfileNode,
  type Relationship,
} from '@medifyrx/shared';
import { DEMO_RELATIONSHIPS, type DemoRelationship } from '../data/demoRelationships.js';
import { foodsToAvoid, matchesFood } from './labelFoods.js';

type Matchable = { id: string; names: string[]; rxCui?: string };

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

function matches(side: DemoRelationship['a'], item: Matchable) {
  if (item.rxCui && side.rxCuis.includes(item.rxCui)) return true;
  return item.names.some((n) => side.names.includes(n.toLowerCase().trim()));
}

/**
 * Builds the tree: patient -> each item, plus sourced edges between items.
 * With `includeRelated`, rules whose other side isn't in the profile add a `related` node
 * (e.g. warfarin -> "Ibuprofen & other NSAIDs") so the web tree can show what to avoid or pair.
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
  const relatedIds = new Set<string>();

  const addEdge = (rel: DemoRelationship, aId: string, bId: string) => {
    const key = [aId, bId].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    relationships.push({
      id: `rel-${relationships.length + 1}`,
      sourceNodeId: aId,
      targetNodeId: bId,
      type: rel.type,
      status: rel.status,
      title: rel.title,
      explanation: rel.explanation,
      source: rel.source,
      sourceText: rel.sourceText,
      checkedAt,
    });
  };

  for (const rel of DEMO_RELATIONSHIPS) {
    const sources = rel.aKind === 'allergy' ? allergies : meds;
    // "Other" substances (alcohol, salt substitutes, vitamins) are usually entered as foods.
    const targets = rel.bKind === 'medication' ? meds : rel.bKind === 'allergy' ? allergies : foods;
    for (const a of sources) {
      if (!matches(rel.a, a)) continue;
      const inProfile = targets.filter((b) => a.id !== b.id && matches(rel.b, b));
      for (const b of inProfile) addEdge(rel, a.id, b.id);

      // Web tree: also show what to avoid / pair even though it isn't in the profile.
      if (!inProfile.length && profile.includeRelated && rel.bKind !== 'allergy' && rel.bLabel) {
        const id = `related-${rel.bKind}-${slug(rel.bLabel)}`;
        if (!relatedIds.has(id)) {
          relatedIds.add(id);
          nodes.push({ id, type: rel.bKind, label: rel.bLabel, related: true });
        }
        addEdge(rel, a.id, id);
      }
    }
  }

  // Web tree: foods and drinks each medication's FDA label says to avoid (see labelFoods.ts).
  // Curated rules above win for any pair they already cover. Lookups are cached per medication.
  if (profile.includeRelated) {
    const found = await Promise.all(
      profile.medications.map((m, i) =>
        foodsToAvoid({ name: m.normalizedName ?? m.enteredName, rxCui: m.rxCui })
          .catch(() => [])
          .then((hits) => ({ med: meds[i], display: m.normalizedName ?? m.enteredName, hits })),
      ),
    );
    for (const { med, display, hits } of found) {
      for (const hit of hits) {
        // Connect to the user's own food node if they entered it, otherwise add a related node.
        const own = foods.find((f) => f.names.some((n) => matchesFood(hit, n)));
        let targetId = own?.id;
        if (!targetId) {
          targetId = `related-${hit.kind}-${slug(hit.label)}`;
          if (!relatedIds.has(targetId)) {
            relatedIds.add(targetId);
            nodes.push({ id: targetId, type: hit.kind, label: hit.label, related: true });
          }
        }
        // The label's own "avoid" sentence is the strongest source: it replaces a hand-written food rule.
        const key = [med.id, targetId].sort().join('|');
        if (seen.has(key)) {
          const i = relationships.findIndex((r) => [r.sourceNodeId, r.targetNodeId].sort().join('|') === key);
          if (i >= 0 && relationships[i].type === 'drug-food') {
            relationships.splice(i, 1);
            seen.delete(key);
          }
        }
        addEdge(
          {
            a: { names: [], rxCuis: [] },
            b: { names: [], rxCuis: [] },
            bKind: hit.kind,
            type: 'drug-food',
            status: 'contraindication',
            title: 'The label says to avoid this',
            explanation: `The ${display} drug label tells people taking it to avoid ${hit.label.toLowerCase()}. Here is the exact sentence:`,
            source: { organization: 'FDA', label: `${display} drug label (via openFDA)`, url: hit.sourceUrl },
            sourceText: hit.sentence,
          },
          med.id,
          targetId,
        );
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
