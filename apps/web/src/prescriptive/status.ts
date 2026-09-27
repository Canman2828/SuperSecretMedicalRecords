import type { ProfileNodeType, RelationshipStatus } from '@medifyrx/shared';

export type Tone = 'never' | 'avoid' | 'pair';

/** The three cable colors: red = never combine, yellow = avoid / caution, green = good to pair. */
export const TONE: Record<Tone, { label: string; cable: number; text: string; tint: string }> = {
  never: { label: 'Never combine', cable: 0xe0455b, text: '#A3293B', tint: '#F6DDE0' },
  avoid: { label: 'Avoid / use caution', cable: 0xf0b429, text: '#86610B', tint: '#F8EBCB' },
  pair: { label: 'Good to pair (ask your doctor)', cable: 0x3fb56f, text: '#2F7A4D', tint: '#DCEFE3' },
};

// Color is never the only signal: every status also gets a symbol and a text label.
export const STATUS_STYLE: Record<RelationshipStatus, { tone: Tone; icon: string; label: string }> = {
  contraindication: { tone: 'never', icon: '⊘', label: 'Contraindication: never combine' },
  'possible-allergy-match': { tone: 'never', icon: '⊘', label: 'Allergy match: never combine' },
  documented: { tone: 'avoid', icon: '⚠', label: 'Documented interaction: avoid' },
  warning: { tone: 'avoid', icon: '⚠', label: 'Label warning: use caution' },
  complementary: { tone: 'pair', icon: '✓', label: 'Often paired: ask your doctor' },
};

/** Orb colors per node kind (site palette, a little brighter so they glow). */
export const NODE_COLOR: Record<ProfileNodeType, number> = {
  patient: 0x7a6fa0,
  medication: 0x8c7fc0,
  allergy: 0x7f93b5,
  food: 0xd49a82,
  other: 0xc9a44c,
};

export const NODE_CAPTION: Record<ProfileNodeType, [mine: string, related: string]> = {
  patient: ['Your profile', 'Your profile'],
  medication: ['Your medication', 'Medication'],
  allergy: ['Your allergy', 'Allergy'],
  food: ['Your food', 'Food'],
  other: ['Your item', 'Substance'],
};
