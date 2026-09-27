import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { Footer, TopBar } from '../../src/layout/Shell';
import { Icon, Logo, type IconName } from '../../src/ui/Icon';
import { AccentProvider, Btn, Card, Eyebrow, IconBtn, Inset, Orb, Screen, useAccent } from '../../src/ui/kit';
import { ACC, C, F, R, SH, type Accent } from '../../src/ui/theme';

// Mirrors apps/web/src/home/HomePage.tsx: hero, three promises, then one card per tool.

const PROMISES: { icon: IconName; title: string; text: string; accent: Accent }[] = [
  { icon: 'lock', title: 'Numbers never reworded', text: 'Dose, timing, and warnings are copied word for word.', accent: ACC.steel },
  { icon: 'pace', title: 'You set the depth', text: 'Start with the basics. Go further only when you choose to.', accent: ACC.lav },
  { icon: 'shield', title: 'Every link has a source', text: 'Interactions trace back to a real drug label you can open.', accent: ACC.blush },
];

export default function HomeScreen() {
  const scroll = useRef<ScrollViewInstance>(null);
  const [featuresY, setFeaturesY] = useState(0);

  return (
    <Screen scrollRef={scroll}>
      <TopBar />

      {/* hero */}
      <View style={styles.heroCopy}>
        <Eyebrow dot={C.lavender}>Your calm companion for medical paperwork</Eyebrow>
        <Text style={styles.h1} accessibilityRole="header">
          medify<Text style={styles.rx}>.Rx</Text>
        </Text>
        <Text style={styles.tag}>Read it, understand it, and ask about it at your own pace.</Text>
        <Text style={styles.lead}>
          Scan a consent form or a prescription label, see how your medications and allergies connect, and learn medical
          terms without the spiral.
        </Text>
        <View style={styles.heroActions}>
          <Btn label="Explore" icon="arrow-down" height={56} onPress={() => scroll.current?.scrollTo({ y: featuresY - 16 })} />
          <View style={styles.note}>
            <View style={styles.pulseDot} />
            <Text style={styles.noteText}>A learning tool, not a diagnostic measurement</Text>
          </View>
        </View>
      </View>

      <Stage />

      {/* promises */}
      <View style={{ gap: 16 }}>
        {PROMISES.map((p) => (
          <AccentProvider key={p.title} accent={p.accent}>
            <Card style={styles.promise}>
              <IconBtn icon={p.icon} label="" filled />
              <View style={{ flex: 1 }}>
                <Text style={styles.promiseTitle}>{p.title}</Text>
                <Text style={styles.promiseText}>{p.text}</Text>
              </View>
            </Card>
          </AccentProvider>
        ))}
      </View>

      {/* features */}
      <View onLayout={(e) => setFeaturesY(e.nativeEvent.layout.y)} style={styles.sectionHead}>
        <Eyebrow dot={C.dusk}>Four tools, one goal</Eyebrow>
        <Text style={styles.h2} accessibilityRole="header">Improve understanding of your health</Text>
      </View>

      <FeatureCard
        accent={ACC.steel}
        icon="camera"
        goal="Comprehension"
        title="Scan"
        sub="Point, highlight, understand."
        desc="Hold your camera over a label. Doses, warnings, and medical terms light up right on the page, and a tap explains them."
        href="/scan"
      >
        <View style={styles.miniScan}>
          <Text style={styles.miniScanText}>Take <Text style={[styles.hl, { backgroundColor: '#dc262626', color: '#9f1c1c' }]}> 500 mg </Text> by mouth <Text style={[styles.hl, { backgroundColor: '#0284c726', color: '#035e8c' }]}> at bedtime </Text></Text>
        </View>
      </FeatureCard>

      <FeatureCard
        accent={ACC.steel}
        icon="scan"
        goal="Comprehension"
        title="Compremedic"
        sub="Snap it. Read it plainly. Hear it."
        desc="Bring the text from a consent form, bottle, or lens box. We set a plain-language version beside the original, with audio for both."
        href="/compremedic"
      >
        <View style={styles.miniCompare}>
          <View style={[styles.paper, styles.comparePaper]}>
            <Text style={styles.paperLabel}>Original</Text>
            <Text style={styles.paperText}>Take 1 cap PO TID × 10 days</Text>
          </View>
          <View style={[styles.paper, styles.comparePaper]}>
            <Text style={styles.paperLabel}>Plain</Text>
            <Text style={styles.paperText}>
              Swallow 1 capsule <Lock>3× a day</Lock> for <Lock>10 days</Lock>
            </Text>
          </View>
        </View>
      </FeatureCard>

      <FeatureCard
        accent={ACC.blush}
        icon="tree"
        goal="Awareness"
        title="Prescriptive"
        sub="Your medications, mapped."
        desc="Add your prescriptions, allergies, and foods to build a living tree of what doesn't mix with your situation, each link traced to its source."
        href="/prescriptive"
      >
        <MiniTree />
      </FeatureCard>

      <FeatureCard
        accent={ACC.lav}
        icon="book"
        goal="Conscious learning"
        title="Medictionary"
        sub="Answers sized to what you're ready for."
        desc="Look up medications, dosage terms, or words you heard at an appointment. Gentle guardrails keep you from worst-case spirals and endless rabbit holes."
        href="/medictionary"
      >
        <View style={[styles.paper, styles.miniSearch]}>
          <Icon name="search" size={16} color={C.ink3} />
          <Text style={styles.paperText}>What does “PRN” mean?</Text>
        </View>
        <View style={styles.miniSteps}>
          <View style={[styles.miniStep, { backgroundColor: ACC.lav.acc, boxShadow: SH.none }]} />
          <View style={styles.miniStep} />
          <View style={styles.miniStep} />
        </View>
      </FeatureCard>

      <Footer />
    </Screen>
  );
}

function FeatureCard(props: {
  accent: Accent;
  icon: IconName;
  goal: string;
  title: string;
  sub: string;
  desc: string;
  href: Href;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <AccentProvider accent={props.accent}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${props.title}`}
        onPress={() => router.navigate(props.href)}
        style={({ pressed }) => [
          styles.fcard,
          pressed && { boxShadow: `${SH.out}, 0 0 0 2px ${props.accent.acc}`, transform: [{ scale: 0.99 }] },
        ]}
      >
        <View style={styles.fcardTop}>
          <Orb icon={props.icon} />
          <View style={[styles.goal, { backgroundColor: props.accent.tint }]}>
            <Text style={[styles.goalText, { color: props.accent.deep }]}>{props.goal}</Text>
          </View>
        </View>
        <Text style={styles.fcardTitle}>{props.title}</Text>
        <Text style={[styles.fcardSub, { color: props.accent.deep }]}>{props.sub}</Text>
        <Text style={styles.fcardDesc}>{props.desc}</Text>
        <Inset style={styles.mini}>{props.children}</Inset>
        <View style={styles.fcardFoot}>
          <Text style={styles.fcardFootText}>Open {props.title}</Text>
          <IconBtn icon="arrow-ne" label="" />
        </View>
      </Pressable>
    </AccentProvider>
  );
}

function Lock({ children }: { children: ReactNode }) {
  const a = useAccent();
  return <Text style={[styles.lock, { backgroundColor: a.tint, color: a.deep }]}>{` ${children} `}</Text>;
}

/** The portal + floating captions beside the hero (the website renders a 3D scene in the portal). */
function Stage() {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [bob]);
  const up = { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] };
  const down = { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] };

  return (
    <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.portal}>
        <View style={styles.portalIn}>
          <Logo size={150} />
        </View>
      </View>
      <Animated.View style={[styles.stagePill, up]}>
        <View style={styles.stagePillIcon}><Icon name="lock" size={16} color={ACC.steel.deep} /></View>
        <Text style={styles.stagePillText}>Dosages stay exactly as written</Text>
      </Animated.View>
      <Animated.View style={[styles.stageCap, down]}>
        <Text style={styles.stageCapStrong}>500 mg · 3× daily</Text>
        <Text style={styles.stageCapText}>“Take one capsule three times a day.”</Text>
      </Animated.View>
    </View>
  );
}

/** Profile node branching to three items (web: .mini-tree SVG). */
function MiniTree() {
  const dot = (bg: string, big = false) => (
    <View style={{ width: big ? 24 : 18, height: big ? 24 : 18, borderRadius: 12, backgroundColor: bg, borderWidth: 2, borderColor: '#fff' }} />
  );
  return (
    <View style={styles.miniTree}>
      {dot(C.dusk, true)}
      <View style={styles.miniTrunk} />
      <View style={styles.miniLeaves}>
        <View style={styles.miniBar} />
        {[C.blush, C.steel, '#9A6A6F'].map((c) => (
          <View key={c} style={{ alignItems: 'center' }}>
            <View style={styles.miniTwig} />
            {dot(c)}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCopy: { gap: 18, marginTop: 12 },
  h1: { fontFamily: F.mark, fontSize: 80, lineHeight: 80, letterSpacing: -2, color: C.ink, paddingTop: 8 },
  rx: { fontFamily: F.markItalic, color: C.dusk },
  tag: { fontFamily: F.headMed, fontSize: 21, lineHeight: 27, color: C.ink2 },
  lead: { fontFamily: F.body, fontSize: 17, lineHeight: 26, color: C.ink3 },
  heroActions: { gap: 16, marginTop: 4 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulseDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.dusk },
  noteText: { fontFamily: F.body, fontSize: 14, color: C.ink3 },

  stage: { height: 340, justifyContent: 'center', alignItems: 'center' },
  portal: { width: 280, height: 280, borderRadius: 140, backgroundColor: C.surface, boxShadow: SH.outLg, alignItems: 'center', justifyContent: 'center' },
  portalIn: { width: 236, height: 236, borderRadius: 118, backgroundColor: C.bg, boxShadow: SH.in, alignItems: 'center', justifyContent: 'center' },
  stagePill: { position: 'absolute', left: 0, top: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 8, paddingRight: 16, borderRadius: R.pill, backgroundColor: C.surface, boxShadow: SH.outLg },
  stagePillIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.steel, alignItems: 'center', justifyContent: 'center' },
  stagePillText: { fontFamily: F.head, fontSize: 13, color: C.ink2 },
  stageCap: { position: 'absolute', right: 0, bottom: 12, gap: 2, paddingVertical: 12, paddingHorizontal: 18, borderRadius: R.md, backgroundColor: C.surface, boxShadow: SH.outLg },
  stageCapStrong: { fontFamily: F.head, fontSize: 14, color: C.ink },
  stageCapText: { fontFamily: F.body, fontSize: 13, color: C.ink3 },

  promise: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingLeft: 16, paddingRight: 20, borderRadius: R.lg },
  promiseTitle: { fontFamily: F.head, fontSize: 15, color: C.ink },
  promiseText: { fontFamily: F.body, fontSize: 14, lineHeight: 19, color: C.ink3 },

  sectionHead: { gap: 12, marginTop: 36 },
  h2: { fontFamily: F.head, fontSize: 32, lineHeight: 36, color: C.ink, letterSpacing: -0.3 },

  fcard: { gap: 14, padding: 24, borderRadius: R.xl, backgroundColor: C.surface, boxShadow: SH.outLg },
  fcardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  goal: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.pill },
  goalText: { fontFamily: F.headBold, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase' },
  fcardTitle: { fontFamily: F.head, fontSize: 28, color: C.ink, marginTop: 2 },
  fcardSub: { fontFamily: F.head, fontSize: 16, marginTop: -8 },
  fcardDesc: { fontFamily: F.body, fontSize: 16, lineHeight: 24, color: C.ink3 },
  mini: { padding: 14, minHeight: 118, gap: 10, justifyContent: 'center' },
  fcardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  fcardFootText: { fontFamily: F.head, fontSize: 14, color: C.ink2 },

  paper: { backgroundColor: C.white, borderRadius: 12, boxShadow: SH.paper, paddingVertical: 9, paddingHorizontal: 10 },
  paperLabel: { fontFamily: F.headBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: C.ink3, marginBottom: 4 },
  paperText: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.ink3 },
  miniCompare: { flexDirection: 'row', gap: 10 },
  comparePaper: { flex: 1, minWidth: 0 },
  lock: { fontFamily: F.bodyBold, borderRadius: 6, overflow: 'hidden' },
  miniScan: { backgroundColor: C.white, borderRadius: 12, boxShadow: SH.paper, padding: 14 },
  miniScanText: { fontFamily: F.mono, fontSize: 13, lineHeight: 24, color: C.ink2 },
  hl: { fontFamily: F.mono, fontWeight: '700' },
  miniSearch: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 14, borderRadius: R.pill },
  miniSteps: { flexDirection: 'row', gap: 6 },
  miniStep: { flex: 1, height: 8, borderRadius: 4, boxShadow: SH.inSm },
  miniTree: { alignItems: 'center' },
  miniTrunk: { width: 2, height: 16, backgroundColor: '#BFB2AC' },
  miniBar: { position: 'absolute', top: 0, left: 9, right: 9, height: 2, backgroundColor: '#BFB2AC' },
  miniLeaves: { flexDirection: 'row', justifyContent: 'space-between', width: '68%' },
  miniTwig: { width: 2, height: 16, backgroundColor: '#BFB2AC' },
});
