export * from './types';
export * from './glossary';
export * from './criticalParser';
export * from './api';

export const NO_RESULT_DISCLAIMER =
  'No relationships were found in the sources checked. This does not mean the combination is safe. Talk with a pharmacist or healthcare professional if you have questions.';

export function newId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
