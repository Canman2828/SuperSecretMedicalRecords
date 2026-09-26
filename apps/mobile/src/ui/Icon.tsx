import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { C, F, SH } from './theme';

// Same icon names as the web's SVG sprite (apps/web/index.html), drawn with Feather's 2px line icons.
// The few Feather doesn't have come from Material Community Icons.
const FEATHER = {
  'arrow-down': 'arrow-down',
  'arrow-right': 'arrow-right',
  'arrow-left': 'arrow-left',
  'arrow-ne': 'arrow-up-right',
  scan: 'maximize',
  tree: 'share-2',
  book: 'book-open',
  camera: 'camera',
  image: 'image',
  trash: 'trash-2',
  upload: 'upload',
  lock: 'lock',
  play: 'play',
  pause: 'pause',
  shield: 'shield',
  plus: 'plus',
  x: 'x',
  check: 'check',
  menu: 'menu',
  cube: 'box',
  pace: 'clock',
  siren: 'alert-octagon',
  search: 'search',
  volume: 'volume-2',
  key: 'key',
  mail: 'mail',
  home: 'home',
  user: 'user',
  'log-out': 'log-out',
  send: 'send',
  'chevron-down': 'chevron-down',
  'chevron-right': 'chevron-right',
  'external-link': 'external-link',
  'refresh': 'refresh-cw',
} as const;
const MCI = { pill: 'pill', leaf: 'food-apple-outline', vr: 'virtual-reality' } as const;

export type IconName = keyof typeof FEATHER | keyof typeof MCI;

export function Icon({ name, size = 20, color = C.ink2 }: { name: IconName; size?: number; color?: string }) {
  if (name in MCI) return <MaterialCommunityIcons name={MCI[name as keyof typeof MCI]} size={size + 2} color={color} />;
  return <Feather name={FEATHER[name as keyof typeof FEATHER]} size={size} color={color} />;
}

/** The caduceus mark, rasterized from the web sprite's #logo symbol. */
export function Logo({ size = 30, color = C.dusk }: { size?: number; color?: string }) {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={{ width: size, height: size * (466 / 512), tintColor: color }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Badge + "medify.Rx" wordmark (web: <Brand/>). */
export function Brand({ size = 27 }: { size?: number }) {
  const badge = Math.round(size * 1.7);
  return (
    <View style={styles.brand} accessibilityRole="header" accessibilityLabel="medify.Rx">
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}>
        <Logo size={badge * 0.65} />
      </View>
      <Text style={[styles.name, { fontSize: size }]}>
        medify<Text style={styles.rx}>.Rx</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, boxShadow: SH.outSm },
  name: { fontFamily: F.markSemi, color: C.ink, lineHeight: undefined },
  rx: { color: C.dusk },
});
