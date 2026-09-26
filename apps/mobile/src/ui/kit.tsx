import { createContext, useContext, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableStateCallbackType,
  type ScrollViewInstance,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { ACC, C, F, GUTTER, R, SH, type Accent } from './theme';

// React Native versions of the web's design.css components (.card, .btn, .chip, .seg, .input …).

// React Native 0.88-rc types View's and Pressable's `style` props with mutually incompatible
// shapes (public ViewStyle allows web position: fixed/sticky and an array backgroundImage that
// the View prop rejects, and vice versa). So we type forwarded `style` props as what View accepts
// (VStyle) and coerce to Pressable's type (PStyle) with `sx` at the two Pressable boundaries.
type VStyle = ComponentProps<typeof View>['style'];
type PStyle = ComponentProps<typeof Pressable>['style'];
const sx = <T,>(value: unknown): T => value as T;

// ---------- accent (web: .acc-steel / .acc-blush / .acc-lav on the page) ----------

const AccentCtx = createContext<Accent>(ACC.lav);
export const useAccent = () => useContext(AccentCtx);
export const AccentProvider = ({ accent, children }: { accent: Accent; children: ReactNode }) => (
  <AccentCtx.Provider value={accent}>{children}</AccentCtx.Provider>
);

// ---------- layout ----------

/** Scrolling page on the neumorphic ground, padded for the notch. */
export function Screen({
  children,
  accent = ACC.lav,
  scrollRef,
  top = true,
}: {
  children: ReactNode;
  accent?: Accent;
  scrollRef?: Ref<ScrollViewInstance>;
  /** Pad for the status bar (tab screens have no header). */
  top?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <AccentProvider accent={accent}>
      <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={s.screen}
          contentContainerStyle={[s.content, { paddingTop: (top ? insets.top : 0) + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </AccentProvider>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: VStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** .panel.card with an optional .panel-head */
export function Panel({ title, icon, right, children, style }: { title?: string; icon?: IconName; right?: ReactNode; children?: ReactNode; style?: VStyle }) {
  return (
    <Card style={[s.panel, style]}>
      {(title || right) && (
        <View style={s.panelHead}>
          {title ? (
            <View style={s.panelTitleRow}>
              {icon && <Icon name={icon} size={20} color={C.ink} />}
              <Text style={s.panelTitle}>{title}</Text>
            </View>
          ) : <View />}
          {right}
        </View>
      )}
      {children}
    </Card>
  );
}

export function Inset({ children, style, radius = R.md }: { children: ReactNode; style?: VStyle; radius?: number }) {
  return <View style={[s.inset, { borderRadius: radius }, style]}>{children}</View>;
}

// ---------- type ----------

export function Eyebrow({ children, dot, style }: { children: ReactNode; dot?: string; style?: VStyle }) {
  const a = useAccent();
  return (
    <View style={[s.eyebrow, style]}>
      <View style={[s.eyebrowDot, { backgroundColor: dot ?? a.acc }]} />
      <Text style={s.eyebrowText}>{children}</Text>
    </View>
  );
}

export const Muted = ({ children, small, style }: { children: ReactNode; small?: boolean; style?: StyleProp<TextStyle> }) => (
  <Text style={[s.muted, small && s.small, style]}>{children}</Text>
);

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.fieldLabel, style]}>{children}</Text>;
}

/** Orb (rounded accent tile) + eyebrow + title + description, like the web's PageHead. */
export function PageHead({ icon, goal, title, children }: { icon: IconName; goal: string; title: string; children: ReactNode }) {
  return (
    <View style={s.pageHead}>
      <View style={s.pageHeadRow}>
        <Orb icon={icon} size={72} />
        <View style={{ flex: 1, gap: 6 }}>
          <Eyebrow>Goal · {goal}</Eyebrow>
          <Text style={s.h1} accessibilityRole="header">{title}</Text>
        </View>
      </View>
      <Text style={s.pageLead}>{children}</Text>
    </View>
  );
}

export function Orb({ icon, size = 68 }: { icon: IconName; size?: number }) {
  const a = useAccent();
  return (
    <View style={[s.orb, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: a.acc }]}>
      <Icon name={icon} size={size * 0.44} color={a.deep} />
    </View>
  );
}

// ---------- controls ----------

type BtnVariant = 'jelly' | 'neu' | 'ink';

export function Btn({
  label,
  icon,
  iconLeft,
  onPress,
  variant = 'jelly',
  disabled,
  height = 48,
  style,
  full,
}: {
  label: string;
  icon?: IconName;
  iconLeft?: IconName;
  onPress?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  height?: number;
  style?: VStyle;
  full?: boolean;
}) {
  const filled = variant !== 'neu';
  const fg = filled ? C.white : C.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={sx<PStyle>(({ pressed }: PressableStateCallbackType) => [
        s.btn,
        { height, paddingHorizontal: height < 44 ? 18 : 26 },
        filled ? s.btnFilled : s.btnNeu,
        pressed && { boxShadow: SH.inSm, transform: [{ translateY: 1 }], backgroundColor: filled ? C.duskHover : C.surface },
        full && { alignSelf: 'stretch' },
        disabled && s.disabled,
        style,
      ])}
    >
      {iconLeft && <Icon name={iconLeft} size={18} color={fg} />}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
      {icon && <Icon name={icon} size={18} color={fg} />}
    </Pressable>
  );
}

export function IconBtn({
  icon,
  label,
  onPress,
  size = 44,
  filled,
  style,
  color,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  size?: number;
  /** Accent-filled, no shadow (web: .promise .icon-btn, .guard .icon-btn …). */
  filled?: boolean;
  style?: VStyle;
  color?: string;
}) {
  const a = useAccent();
  const body = (
    <Icon name={icon} size={Math.round(size * 0.42)} color={color ?? (filled ? a.deep : C.ink2)} />
  );
  const base = [
    s.iconBtn,
    { width: size, height: size, borderRadius: size / 2 },
    filled && { backgroundColor: a.acc, boxShadow: SH.none },
    style,
  ];
  if (!onPress) return <View style={base} accessibilityElementsHidden importantForAccessibility="no">{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={sx<PStyle>(({ pressed }: PressableStateCallbackType) => [...base, pressed && { boxShadow: SH.inSm }])}
    >
      {body}
    </Pressable>
  );
}

export function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  const a = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.chip,
        (on || pressed) && { boxShadow: SH.inSm, backgroundColor: on ? a.tint : C.surface },
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.chipText, on && { color: a.deep }]}>{label}</Text>
    </Pressable>
  );
}

/** Segmented control (web: .seg) */
export function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { v: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const a = useAccent();
  return (
    <View style={s.seg} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <Pressable
            key={o.v}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.v)}
            style={[s.segBtn, on && s.segOn]}
          >
            {o.icon && <Icon name={o.icon} size={14} color={on ? a.deep : C.ink3} />}
            <Text style={[s.segText, on && { color: a.deep }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Sunken pill input (web: .input). Put an IconBtn in `right` for the inline add button. */
export function Field({ right, small, style, inputRef, ...props }: TextInputProps & { right?: ReactNode; small?: boolean; inputRef?: Ref<TextInputInstance> }) {
  const [focus, setFocus] = useState(false);
  const a = useAccent();
  return (
    <View style={[s.input, small && { height: 44 }, focus && { boxShadow: `${SH.in}, 0 0 0 2px ${a.acc}` }, style]}>
      <TextInput
        ref={inputRef}
        placeholderTextColor={C.placeholder}
        style={s.inputText}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        {...props}
      />
      {right}
    </View>
  );
}

/** Custom checkbox (web: .check) */
export function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={s.check}
      hitSlop={6}
    >
      <View style={[s.checkBox, value && { boxShadow: SH.inSm }]}>
        {value && <Icon name="check" size={14} color={C.ink2} />}
      </View>
      <Text style={s.checkText}>{label}</Text>
    </Pressable>
  );
}

export function SampleTag({ children }: { children: ReactNode }) {
  return (
    <View style={s.sampleTag}>
      <Text style={s.sampleTagText}>{children}</Text>
    </View>
  );
}

export function CountPill({ n }: { n: number }) {
  const a = useAccent();
  return (
    <View style={s.countPill}>
      <Text style={[s.countText, { color: a.deep }]}>{n}</Text>
    </View>
  );
}

/** Sunken note with an accent icon (web: .guard.neu-in, .alert). */
export function Guard({ icon, title, children, tone }: { icon: IconName; title: string; children: ReactNode; tone?: 'alert' }) {
  return (
    <View style={[s.guard, tone === 'alert' && { boxShadow: SH.inSm }]}>
      {tone === 'alert' ? (
        <IconBtn icon={icon} label="" filled style={{ backgroundColor: C.blush }} color={C.alertDeep} />
      ) : (
        <IconBtn icon={icon} label="" filled />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.guardTitle}>{title}</Text>
        <Text style={s.guardText}>{children}</Text>
      </View>
    </View>
  );
}

export function Callout({ children, style }: { children: ReactNode; style?: VStyle }) {
  return (
    <View style={[s.callout, style]}>
      <Text style={s.calloutText}>{children}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: GUTTER, paddingBottom: 48, gap: 24 },
  card: { backgroundColor: C.surface, borderRadius: R.xl, boxShadow: SH.outLg },
  panel: { padding: 20 },
  panelHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  panelTitle: { fontFamily: F.head, fontSize: 20, color: C.ink, letterSpacing: -0.2 },
  inset: { backgroundColor: C.bg, boxShadow: SH.in },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowDot: { width: 8, height: 8, borderRadius: 4 },
  eyebrowText: { fontFamily: F.headBold, fontSize: 12, letterSpacing: 1.9, textTransform: 'uppercase', color: C.ink3, flexShrink: 1 },
  muted: { fontFamily: F.body, fontSize: 16, lineHeight: 24, color: C.ink3 },
  small: { fontSize: 14, lineHeight: 21 },
  fieldLabel: { fontFamily: F.head, fontSize: 14, color: C.ink3, marginBottom: 8 },
  pageHead: { gap: 16, marginTop: 8 },
  pageHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  h1: { fontFamily: F.head, fontSize: 38, lineHeight: 42, color: C.ink, letterSpacing: -0.4 },
  pageLead: { fontFamily: F.body, fontSize: 17, lineHeight: 26, color: C.ink3 },
  orb: { alignItems: 'center', justifyContent: 'center', boxShadow: SH.outSm },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: R.pill, alignSelf: 'flex-start' },
  btnFilled: { backgroundColor: C.dusk, boxShadow: SH.hover },
  btnNeu: { backgroundColor: C.surface, boxShadow: SH.outSm },
  btnText: { fontFamily: F.head, fontSize: 15, letterSpacing: 0.3 },
  disabled: { opacity: 0.5 },
  iconBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, boxShadow: SH.outSm },
  chip: { flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 15, borderRadius: R.pill, backgroundColor: C.surface, boxShadow: SH.outSm },
  chipText: { fontFamily: F.head, fontSize: 13, color: C.ink2 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', padding: 5, gap: 4, borderRadius: R.pill, backgroundColor: C.bg, boxShadow: SH.inSm },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: R.pill },
  segOn: { backgroundColor: C.surface, boxShadow: SH.outSm },
  segText: { fontFamily: F.head, fontSize: 13, color: C.ink3 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, paddingLeft: 20, paddingRight: 7, borderRadius: R.pill, backgroundColor: C.bg, boxShadow: SH.in },
  inputText: { flex: 1, minWidth: 0, height: '100%', fontFamily: F.body, fontSize: 16, color: C.ink },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  checkBox: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, boxShadow: SH.outSm },
  checkText: { fontFamily: F.body, fontSize: 15, color: C.ink2, flexShrink: 1 },
  sampleTag: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: R.pill, backgroundColor: C.bg, boxShadow: SH.inSm },
  sampleTagText: { fontFamily: F.headBold, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: C.ink3 },
  countPill: { minWidth: 30, height: 30, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: R.pill, backgroundColor: C.bg, boxShadow: SH.inSm },
  countText: { fontFamily: F.headBold, fontSize: 13 },
  guard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 18, paddingHorizontal: 18, borderRadius: R.lg, backgroundColor: C.bg, boxShadow: SH.in },
  guardTitle: { fontFamily: F.head, fontSize: 16, color: C.ink },
  guardText: { fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.ink3 },
  callout: { borderRadius: R.md, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: C.bg, boxShadow: SH.in },
  calloutText: { fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.ink2 },
});
