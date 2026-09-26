import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PROMISES = [
  { icon: '🔒', title: 'Numbers never reworded', text: 'Dose, timing and warnings are copied word for word.' },
  { icon: '🎚️', title: 'You set the depth', text: 'Start with the basics. Go further only when you choose to.' },
  { icon: '🛡️', title: 'Every link has a source', text: 'Interactions trace back to a real drug label you can open.' },
];

const FEATURES = [
  {
    route: '/scan' as const,
    emoji: '📷',
    goal: 'Comprehension',
    title: 'Scan',
    sub: 'Point, highlight, understand.',
    desc: 'Hold your camera over a label to highlight and explain medical terms live, right on the page.',
    color: '#0d9488',
  },
  {
    route: '/compremedic' as const,
    emoji: '🔊',
    goal: 'Comprehension',
    title: 'Compremedic',
    sub: 'Read it plainly. Hear it.',
    desc: 'A plain-language version beside the original text, with audio for both. Doses stay exactly as written.',
    color: '#0284c7',
  },
  {
    route: '/prescriptive' as const,
    emoji: '🌳',
    goal: 'Awareness',
    title: 'Prescriptive',
    sub: 'Your medicines, mapped.',
    desc: 'Add prescriptions, allergies and foods to see what to watch for — each link traced to its source.',
    color: '#be123c',
  },
  {
    route: '/medictionary' as const,
    emoji: '📖',
    goal: 'Conscious learning',
    title: 'Medictionary',
    sub: 'Answers sized to what you need.',
    desc: 'Look up medicines, dosage terms, or words you heard at an appointment — without the worst-case spiral.',
    color: '#7c3aed',
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Your calm companion for medical paperwork</Text>
        <Text style={styles.brand}>
          medify<Text style={styles.rx}>.Rx</Text>
        </Text>
        <Text style={styles.tag}>Read it, understand it, and ask about it at your own pace.</Text>
        <Text style={styles.lead}>
          Scan a consent form or a prescription label, see how your medicines and allergies connect, and learn medical
          terms without the spiral.
        </Text>
        <Pressable style={styles.cta} onPress={() => router.navigate('/scan')}>
          <Text style={styles.ctaText}>Start scanning →</Text>
        </Pressable>
        <View style={styles.note}>
          <View style={styles.dot} />
          <Text style={styles.noteText}>A learning tool, not a diagnosis</Text>
        </View>
      </View>

      <View style={styles.promises}>
        {PROMISES.map((p) => (
          <View key={p.title} style={styles.promise}>
            <Text style={styles.promiseIcon}>{p.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.promiseTitle}>{p.title}</Text>
              <Text style={styles.promiseText}>{p.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionEyebrow}>Four tools, one goal</Text>
      <Text style={styles.sectionTitle}>Understand your health</Text>

      <View style={styles.cards}>
        {FEATURES.map((f) => (
          <Pressable key={f.title} style={[styles.fcard, { borderTopColor: f.color }]} onPress={() => router.navigate(f.route)}>
            <View style={styles.fcardTop}>
              <Text style={styles.fcardEmoji}>{f.emoji}</Text>
              <Text style={styles.goal}>{f.goal}</Text>
            </View>
            <Text style={styles.fcardTitle}>{f.title}</Text>
            <Text style={styles.fcardSub}>{f.sub}</Text>
            <Text style={styles.fcardDesc}>{f.desc}</Text>
            <Text style={[styles.fcardFoot, { color: f.color }]}>Open {f.title} ↗</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  hero: { gap: 8, marginBottom: 8 },
  eyebrow: { fontSize: 13, fontWeight: '700', color: '#0d9488', textTransform: 'uppercase', letterSpacing: 0.5 },
  brand: { fontSize: 44, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  rx: { color: '#0d9488' },
  tag: { fontSize: 18, fontWeight: '600', color: '#334155' },
  lead: { fontSize: 15, color: '#475569', lineHeight: 22, marginTop: 4 },
  cta: { backgroundColor: '#0d9488', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0d9488' },
  noteText: { color: '#64748b', fontSize: 13 },
  promises: { gap: 10, marginTop: 20 },
  promise: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  promiseIcon: { fontSize: 22 },
  promiseTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  promiseText: { fontSize: 13, color: '#475569', marginTop: 2, lineHeight: 18 },
  sectionEyebrow: { fontSize: 13, fontWeight: '700', color: '#0d9488', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 28 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginTop: 4, marginBottom: 14 },
  cards: { gap: 14 },
  fcard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', borderTopWidth: 4, gap: 4 },
  fcardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fcardEmoji: { fontSize: 26 },
  goal: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 },
  fcardTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  fcardSub: { fontSize: 14, fontWeight: '600', color: '#334155' },
  fcardDesc: { fontSize: 14, color: '#64748b', lineHeight: 20, marginTop: 4 },
  fcardFoot: { fontSize: 14, fontWeight: '800', marginTop: 10 },
});
