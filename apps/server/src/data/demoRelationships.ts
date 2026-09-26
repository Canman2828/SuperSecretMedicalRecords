import type { RelationshipStatus, RelationshipType } from '@medifyrx/shared';

// Layer 2 from the design doc: a SMALL, hand-verified set of relationships for the demo.
//
// TODO before judging: open each drug's label on DailyMed, confirm the relationship,
// then paste the exact label sentence into `sourceText` and the label link into `url`.
// Don't present this list as a comprehensive interaction checker.

type Side = { names: string[]; rxCuis: string[] };

export interface DemoRelationship {
  /** Match by ingredient name (lowercase) OR RxCUI. */
  a: Side;
  /** What `a` is matched against in the profile. Default: medication. */
  aKind?: 'medication' | 'allergy';
  b: Side;
  bKind: 'medication' | 'food' | 'allergy' | 'other';
  /** Name to show for `b` when it isn't in the profile (web "related items" view). */
  bLabel?: string;
  type: RelationshipType;
  status: RelationshipStatus;
  title: string;
  explanation: string;
  source: { organization: string; label?: string; url?: string };
  sourceText?: string;
}

const dailymed = (q: string) => `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${q}`;

const WARFARIN = { names: ['warfarin', 'coumadin', 'jantoven'], rxCuis: ['11289'] };
const ASPIRIN = { names: ['aspirin'], rxCuis: ['1191'] };
const ATORVASTATIN = { names: ['atorvastatin', 'lipitor'], rxCuis: ['83367'] };
const AMOXICILLIN = { names: ['amoxicillin'], rxCuis: ['723'] };
const METFORMIN = { names: ['metformin', 'glucophage'], rxCuis: ['6809'] };
const LISINOPRIL = { names: ['lisinopril', 'zestril', 'prinivil'], rxCuis: ['29046'] };
const SILDENAFIL = { names: ['sildenafil', 'viagra', 'revatio'], rxCuis: ['136411'] };
const ISONIAZID = { names: ['isoniazid'], rxCuis: ['6038'] };
const PENICILLIN_ALLERGY = { names: ['penicillin', 'penicillins'], rxCuis: [] };

export const DEMO_RELATIONSHIPS: DemoRelationship[] = [
  {
    a: WARFARIN,
    b: ASPIRIN,
    bKind: 'medication',
    bLabel: 'Aspirin',
    type: 'drug-drug',
    status: 'documented',
    title: 'Documented interaction',
    explanation:
      'The warfarin label lists aspirin among drugs that can increase the risk of bleeding when taken together.',
    source: { organization: 'FDA', label: 'Warfarin drug label', url: dailymed('warfarin') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: WARFARIN,
    b: { names: ['ibuprofen', 'naproxen', 'nsaid', 'nsaids', 'advil', 'motrin', 'aleve'], rxCuis: ['5640', '7258'] },
    bKind: 'medication',
    bLabel: 'Ibuprofen & other NSAIDs',
    type: 'drug-drug',
    status: 'documented',
    title: 'Documented interaction',
    explanation:
      'The warfarin label lists NSAID pain relievers (like ibuprofen and naproxen) among drugs that can increase the risk of bleeding.',
    source: { organization: 'FDA', label: 'Warfarin drug label', url: dailymed('warfarin') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: WARFARIN,
    b: { names: ['leafy greens', 'spinach', 'kale', 'vitamin k', 'broccoli'], rxCuis: [] },
    bKind: 'food',
    bLabel: 'Vitamin K–rich greens',
    type: 'drug-food',
    status: 'warning',
    title: 'Label warning',
    explanation:
      'The warfarin label says big changes in how much vitamin K you eat (for example leafy greens) can change how well warfarin works. It advises keeping your diet steady rather than cutting these foods out.',
    source: { organization: 'FDA', label: 'Warfarin drug label', url: dailymed('warfarin') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: ATORVASTATIN,
    b: { names: ['grapefruit', 'grapefruit juice'], rxCuis: [] },
    bKind: 'food',
    bLabel: 'Grapefruit',
    type: 'drug-food',
    status: 'warning',
    title: 'Label warning',
    explanation:
      'The atorvastatin label mentions that drinking large amounts of grapefruit juice can raise the amount of the drug in the body.',
    source: { organization: 'FDA', label: 'Atorvastatin drug label', url: dailymed('atorvastatin') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: AMOXICILLIN,
    b: PENICILLIN_ALLERGY,
    bKind: 'allergy',
    type: 'drug-allergy',
    status: 'possible-allergy-match',
    title: 'Possible allergy-related match',
    explanation:
      'Amoxicillin is a penicillin-type antibiotic, and its label lists a history of serious allergic reaction to penicillins as a reason not to use it.',
    source: { organization: 'FDA', label: 'Amoxicillin drug label', url: dailymed('amoxicillin') },
    sourceText: undefined, // TODO paste verified label text
  },
  // Allergy-driven: medicines to avoid when the profile lists a penicillin allergy.
  {
    a: PENICILLIN_ALLERGY,
    aKind: 'allergy',
    b: AMOXICILLIN,
    bKind: 'medication',
    bLabel: 'Amoxicillin',
    type: 'drug-allergy',
    status: 'possible-allergy-match',
    title: 'Possible allergy-related match',
    explanation:
      'Amoxicillin is a penicillin-type antibiotic. Its label says not to use it if you have had a serious allergic reaction to penicillins.',
    source: { organization: 'FDA', label: 'Amoxicillin drug label', url: dailymed('amoxicillin') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: PENICILLIN_ALLERGY,
    aKind: 'allergy',
    b: { names: ['ampicillin'], rxCuis: ['733'] },
    bKind: 'medication',
    bLabel: 'Ampicillin',
    type: 'drug-allergy',
    status: 'possible-allergy-match',
    title: 'Possible allergy-related match',
    explanation:
      'Ampicillin is a penicillin-type antibiotic. Its label says not to use it if you have had an allergic reaction to penicillins.',
    source: { organization: 'FDA', label: 'Ampicillin drug label', url: dailymed('ampicillin') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: LISINOPRIL,
    b: { names: ['potassium salt substitute', 'salt substitute', 'potassium chloride', 'nosalt', 'lo salt'], rxCuis: [] },
    bKind: 'other',
    bLabel: 'Potassium salt substitutes',
    type: 'drug-food',
    status: 'warning',
    title: 'Label warning',
    explanation:
      'The lisinopril label warns that potassium-containing salt substitutes can raise potassium in your blood when used with lisinopril.',
    source: { organization: 'FDA', label: 'Lisinopril drug label', url: dailymed('lisinopril') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: METFORMIN,
    b: { names: ['alcohol', 'beer', 'wine', 'liquor'], rxCuis: [] },
    bKind: 'other',
    bLabel: 'Alcohol',
    type: 'drug-food',
    status: 'warning',
    title: 'Label warning',
    explanation:
      'The metformin label warns against drinking a lot of alcohol, because it raises the risk of a rare but serious side effect called lactic acidosis.',
    source: { organization: 'FDA', label: 'Metformin drug label', url: dailymed('metformin') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: METFORMIN,
    b: { names: ['vitamin b12', 'b12', 'cyanocobalamin'], rxCuis: [] },
    bKind: 'other',
    bLabel: 'Vitamin B12',
    type: 'drug-supplement',
    status: 'complementary',
    title: 'Often paired',
    explanation:
      'The metformin label says it can lower vitamin B12 levels over time and advises checking them. Ask your doctor whether a B12 supplement or regular testing is right for you.',
    source: { organization: 'FDA', label: 'Metformin drug label', url: dailymed('metformin') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: ISONIAZID,
    b: { names: ['vitamin b6', 'b6', 'pyridoxine'], rxCuis: [] },
    bKind: 'other',
    bLabel: 'Vitamin B6',
    type: 'drug-supplement',
    status: 'complementary',
    title: 'Often paired',
    explanation:
      'The isoniazid label recommends vitamin B6 (pyridoxine) for some people to help prevent nerve problems. Ask your doctor whether it is right for you.',
    source: { organization: 'FDA', label: 'Isoniazid drug label', url: dailymed('isoniazid') },
    sourceText: undefined, // TODO paste verified label text
  },
  {
    a: SILDENAFIL,
    b: { names: ['nitroglycerin', 'isosorbide', 'nitrates', 'isosorbide mononitrate', 'isosorbide dinitrate'], rxCuis: ['4917'] },
    bKind: 'medication',
    bLabel: 'Nitrates (e.g. nitroglycerin)',
    type: 'contraindication',
    status: 'contraindication',
    title: 'Contraindication',
    explanation:
      'The sildenafil label says it must not be used with nitrate medicines, because together they can cause a dangerous drop in blood pressure.',
    source: { organization: 'FDA', label: 'Sildenafil drug label', url: dailymed('sildenafil') },
    sourceText: undefined, // TODO paste verified label text
  },
];
