// medify.Rx design system for React Native — a port of apps/web/src/design.css.
// Keep the two in sync: same palette, same neumorphic light/shade pairs, same type roles.

export const C = {
  white: '#F7F7F7',
  steel: '#C8CED6',
  blush: '#D4CAC5',
  dusk: '#736A86',
  duskHover: '#655D78',
  ink: '#272A3B',
  lavender: '#C9BFE0',
  bg: '#E9E9EC',
  surface: '#EFEFF2',
  ink2: '#474859',
  ink3: '#62626F',
  line: '#DADAE0',
  placeholder: '#8E8E9C',
  error: '#8A3F4A',
  alertDeep: '#7A3F3A',
} as const;

// Neumorphic light + shade (the --sd / --sl pair) and the box-shadow recipes built from them.
const SD = 'rgba(160,163,178,0.5)';
const SL = 'rgba(255,255,255,0.9)';
export const SH = {
  outLg: `14px 14px 30px ${SD}, -12px -12px 26px ${SL}`,
  out: `8px 8px 18px ${SD}, -8px -8px 18px ${SL}`,
  outSm: `4px 4px 10px ${SD}, -4px -4px 10px ${SL}`,
  hover: `6px 6px 14px ${SD}, -6px -6px 14px ${SL}`,
  paper: `3px 3px 8px ${SD}, -3px -3px 8px ${SL}`,
  pane: `4px 4px 12px ${SD}, -4px -4px 12px ${SL}`,
  in: `inset 5px 5px 11px ${SD}, inset -5px -5px 11px ${SL}`,
  inSm: `inset 3px 3px 6px ${SD}, inset -3px -3px 6px ${SL}`,
  none: 'none',
} as const;

export const R = { xl: 32, lg: 24, md: 16, pill: 999 } as const;

/** Font families, loaded in app/_layout.tsx. React Native picks weights by family name, not fontWeight. */
export const F = {
  mark: 'CormorantGaramond_500Medium',
  markSemi: 'CormorantGaramond_600SemiBold',
  markItalic: 'CormorantGaramond_500Medium_Italic',
  head: 'Quicksand_600SemiBold',
  headMed: 'Quicksand_500Medium',
  headBold: 'Quicksand_700Bold',
  body: 'Carlito_400Regular',
  bodyBold: 'Carlito_700Bold',
  bodyItalic: 'Carlito_400Regular_Italic',
  mono: 'Menlo',
} as const;

/** Per-tool accents, same as the web's .acc-steel / .acc-blush / .acc-lav. */
export interface Accent {
  acc: string;
  deep: string;
  tint: string;
}
export const ACC = {
  steel: { acc: C.steel, deep: '#56637A', tint: '#DFE3E9' },
  blush: { acc: C.blush, deep: '#7A605A', tint: '#EBE4E1' },
  lav: { acc: C.lavender, deep: '#665C82', tint: '#E4DFEF' },
} satisfies Record<string, Accent>;

/** Profile item colors (web: DOT in ProfilePanel.tsx). */
export const DOT = { medication: '#736A86', allergy: '#8E98AC', food: '#C9A99E' } as const;

/** 4px spacing grid: gutter 16, inside cards 20–26, between stacked cards 24–30. */
export const GUTTER = 16;
