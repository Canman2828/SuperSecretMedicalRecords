import type { RelationshipStatus, RelationshipType } from '@clearrx/shared';

// Layer 2 from the design doc: a SMALL, hand-verified set of relationships for the demo.
//
// TODO before judging: open each drug's label on DailyMed, confirm the relationship,
// then paste the exact label sentence into `sourceText` and the label link into `url`.
// Don't present this list as a comprehensive interaction checker.

export interface DemoRelationship {
  /** Match by ingredient name (lowercase) OR RxCUI. */
  a: { names: string[]; rxCuis: string[] };
  b: { names: string[]; rxCuis: string[] };
  bKind: 'medication' | 'food' | 'allergy';
  type: RelationshipType;
  status: RelationshipStatus;
  title: string;
  explanation: string;
  source: { organization: string; label?: string; url?: string };
  sourceText?: string;
}

const WARFARIN = { names: ['warfarin', 'coumadin', 'jantoven'], rxCuis: ['11289'] };
const ASPIRIN = { names: ['aspirin'], rxCuis: ['1191'] };
const ATORVASTATIN = { names: ['atorvastatin', 'lipitor'], rxCuis: ['83367'] };
const AMOXICILLIN = { names: ['amoxicillin'], rxCuis: ['723'] };

export const DEMO_RELATIONSHIPS: DemoRelationship[] = [
  {
    a: WARFARIN,
    b: ASPIRIN,
    bKind: 'medication',
    type: 'drug-drug',
    status: 'documented',
    title: 'Documented interaction',
    explanation:
      'The warfarin label lists aspirin among drugs that can increase the risk of bleeding when taken together.',
    source: { organization: 'FDA', label: 'Warfarin drug label', url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=warfarin' },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: ATORVASTATIN,
    b: { names: ['grapefruit', 'grapefruit juice'], rxCuis: [] },
    bKind: 'food',
    type: 'drug-food',
    status: 'warning',
    title: 'Label warning',
    explanation:
      'The atorvastatin label mentions that drinking large amounts of grapefruit juice can raise the amount of the drug in the body.',
    source: { organization: 'FDA', label: 'Atorvastatin drug label', url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=atorvastatin' },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: AMOXICILLIN,
    b: { names: ['penicillin', 'penicillins', 'amoxicillin'], rxCuis: [] },
    bKind: 'allergy',
    type: 'drug-allergy',
    status: 'possible-allergy-match',
    title: 'Possible allergy-related match',
    explanation:
      'Amoxicillin is a penicillin-type antibiotic, and its label lists a history of serious allergic reaction to penicillins as a reason not to use it.',
    source: { organization: 'FDA', label: 'Amoxicillin drug label', url: 'https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=amoxicillin' },
    sourceText: undefined, // TODO paste verified label text
  },
];
