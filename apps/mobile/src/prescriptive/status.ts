import type { ProfileNode, RelationshipStatus } from '@medifyrx/shared';
import type { IconName } from '../ui/Icon';

// Same vocabulary and colors as the website's tree (apps/web/src/graph/InteractionTree.tsx).
// Color is never the only signal: every status also gets a symbol and a text label.
// U+FE0E keeps iOS from turning the symbols into emoji.
export const STATUS_STYLE: Record<RelationshipStatus, { icon: string; label: string; color: string }> = {
  documented: { icon: '⚠︎', label: 'Documented interaction', color: '#9A5B4F' },
  warning: { icon: '!', label: 'Label warning', color: '#8A6A2E' },
  contraindication: { icon: '⊘︎', label: 'Contraindication found', color: '#8A3F4A' },
  'possible-allergy-match': { icon: '△︎', label: 'Possible allergy-related concern', color: '#665C82' },
};

export const TYPE_ICON: Record<ProfileNode['type'], IconName> = {
  patient: 'user',
  medication: 'pill',
  allergy: 'shield',
  food: 'leaf',
};
