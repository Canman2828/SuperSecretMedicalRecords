import type { AnnotationCategory } from './types';

export interface GlossaryEntry {
  meaning: string;
  category: AnnotationCategory;
  /** true = part of a dosing instruction; always shown exactly as printed */
  immutable: boolean;
}

// Starter glossary. Keys are UPPERCASE with punctuation stripped.
// Grow this toward ~50 entries (design doc, phase 3) before reaching for the AI layer.
export const GLOSSARY: Record<string, GlossaryEntry> = {
  // Route
  PO: { meaning: 'by mouth', category: 'abbreviation', immutable: true },
  SL: { meaning: 'under the tongue', category: 'abbreviation', immutable: true },
  IV: { meaning: 'into a vein', category: 'abbreviation', immutable: true },
  IM: { meaning: 'into a muscle', category: 'abbreviation', immutable: true },
  SUBQ: { meaning: 'under the skin', category: 'abbreviation', immutable: true },
  SC: { meaning: 'under the skin', category: 'abbreviation', immutable: true },
  TOP: { meaning: 'on the skin', category: 'abbreviation', immutable: true },
  INH: { meaning: 'breathed in', category: 'abbreviation', immutable: true },

  // Frequency
  QD: { meaning: 'once a day', category: 'abbreviation', immutable: true },
  DAILY: { meaning: 'once a day', category: 'abbreviation', immutable: true },
  BID: { meaning: 'twice a day', category: 'abbreviation', immutable: true },
  TID: { meaning: 'three times a day', category: 'abbreviation', immutable: true },
  QID: { meaning: 'four times a day', category: 'abbreviation', immutable: true },
  QHS: { meaning: 'at bedtime', category: 'abbreviation', immutable: true },
  HS: { meaning: 'at bedtime', category: 'abbreviation', immutable: true },
  QAM: { meaning: 'every morning', category: 'abbreviation', immutable: true },
  QPM: { meaning: 'every evening', category: 'abbreviation', immutable: true },
  Q4H: { meaning: 'every 4 hours', category: 'abbreviation', immutable: true },
  Q6H: { meaning: 'every 6 hours', category: 'abbreviation', immutable: true },
  Q8H: { meaning: 'every 8 hours', category: 'abbreviation', immutable: true },
  Q12H: { meaning: 'every 12 hours', category: 'abbreviation', immutable: true },
  PRN: { meaning: 'as needed', category: 'abbreviation', immutable: true },
  AC: { meaning: 'before meals', category: 'abbreviation', immutable: true },
  PC: { meaning: 'after meals', category: 'abbreviation', immutable: true },
  STAT: { meaning: 'right away', category: 'abbreviation', immutable: true },

  // Form
  TAB: { meaning: 'tablet', category: 'abbreviation', immutable: true },
  CAP: { meaning: 'capsule', category: 'abbreviation', immutable: true },
  GTT: { meaning: 'drops', category: 'abbreviation', immutable: true },
  DISP: { meaning: 'amount dispensed by the pharmacy', category: 'abbreviation', immutable: true },
  SIG: { meaning: 'directions for use', category: 'abbreviation', immutable: false },
  RX: { meaning: 'prescription', category: 'abbreviation', immutable: false },

  // Jargon
  CONTRAINDICATED: {
    meaning: 'should not be used in the situation described',
    category: 'jargon',
    immutable: false,
  },
  CONTRAINDICATION: {
    meaning: 'a situation where this medicine should not be used',
    category: 'jargon',
    immutable: false,
  },
  ADVERSE: { meaning: 'harmful or unwanted', category: 'jargon', immutable: false },
  HYPERSENSITIVITY: { meaning: 'an allergic-type reaction', category: 'jargon', immutable: false },
  TITRATE: { meaning: 'slowly adjust the dose over time', category: 'jargon', immutable: false },
  TITRATION: { meaning: 'slowly adjusting the dose over time', category: 'jargon', immutable: false },
  HEPATIC: { meaning: 'related to the liver', category: 'jargon', immutable: false },
  RENAL: { meaning: 'related to the kidneys', category: 'jargon', immutable: false },
  ORAL: { meaning: 'by mouth', category: 'jargon', immutable: true },
  SUBCUTANEOUS: { meaning: 'under the skin', category: 'jargon', immutable: true },
  TOPICAL: { meaning: 'applied on the skin', category: 'jargon', immutable: true },

  // Consent
  CONSENT: { meaning: 'your agreement to a treatment', category: 'consent', immutable: false },
  AUTHORIZATION: { meaning: 'written permission', category: 'consent', immutable: false },
};

export function normalizeToken(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function lookupGlossary(raw: string): GlossaryEntry | undefined {
  return GLOSSARY[normalizeToken(raw)];
}
