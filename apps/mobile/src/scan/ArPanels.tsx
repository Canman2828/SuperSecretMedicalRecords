import type { Annotation, AnnotationCategory, BBox } from '@medifyrx/shared';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { api } from '../api';
import { originalSegments, plainSegments, spokenText, type Segment } from '../compremedic/plainLanguage';
import { CATEGORY_STYLE } from './HighlightLayer';

// Floating "liquid glass" panels anchored beside the scanned paper (AR-Resume style).
// Live: a Key details panel (sign here / when / dosage). Frozen: the original and the
// plain-words version side by side, each with text-to-speech.

const GAP = 10;
const KEY_WIDTH = 196;
const SIDE_MIN = 150; // narrowest panel worth flanking the paper with
const SIDE_MAX = 280;

// "Signature -> when -> dosage": the order the whiteboard asks for.
const KEY_ORDER: AnnotationCategory[] = ['signature', 'timing', 'critical'];
const KEY_TITLES: Partial<Record<AnnotationCategory, string>> = {
  signature: 'Sign here',
  timing: 'When',
  critical: 'Dosage',
};
const PER_GROUP = 3;

const LANGUAGES = [
  { label: 'English', name: 'plain English', voice: 'en-US' },
  { label: 'Español', name: 'Spanish', voice: 'es-US' },
  { label: '中文', name: 'Simplified Chinese', voice: 'zh-CN' },
  { label: 'Tiếng Việt', name: 'Vietnamese', voice: 'vi-VN' },
  { label: 'Tagalog', name: 'Tagalog', voice: 'fil-PH' },
];

interface Props {
  annotations: Annotation[];
  docBox: BBox | null;
  viewSize: { width: number; height: number };
  insets: { top: number; bottom: number };
  frozen: boolean;
  /** Everything OCR read on the last pass. */
  text: string;
  knownMedications: string[];
  onSelect: (a: Annotation) => void;
}

export function ArPanels(props: Props) {
  if (!props.viewSize.width) return null;
  return props.frozen ? <SideBySide {...props} /> : <KeyDetails {...props} />;
}

/** Usable screen area: below the hint pill, above the Freeze button. */
function screenArea(viewSize: Props['viewSize'], insets: Props['insets']) {
  return { left: 8, right: viewSize.width - 8, top: insets.top + 48, bottom: viewSize.height - 76 };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------- Live: key details ----------

function KeyDetails({ annotations, docBox, viewSize, insets, onSelect }: Props) {
  const groups = useMemo(
    () =>
      KEY_ORDER.map((category) => {
        const seen = new Set<string>();
        const items = annotations.filter((a) => {
          if (a.category !== category || seen.has(a.normalizedText ?? a.sourceText)) return false;
          seen.add(a.normalizedText ?? a.sourceText);
          return true;
        });
        return { category, items: items.slice(0, PER_GROUP) };
      }).filter((g) => g.items.length),
    [annotations],
  );

  if (!docBox || !groups.length) return null;
  const area = screenArea(viewSize, insets);
  const top = clamp(docBox.y, area.top, area.bottom - 120);
  const rightX = docBox.x + docBox.width + GAP;
  const leftX = docBox.x - GAP - KEY_WIDTH;

  // Beside the paper if there's room, else above/below it, else docked at the bottom.
  let place: ViewStyle;
  if (rightX + KEY_WIDTH <= area.right) {
    place = { left: rightX, top, width: KEY_WIDTH, maxHeight: area.bottom - top };
  } else if (leftX >= area.left) {
    place = { left: leftX, top, width: KEY_WIDTH, maxHeight: area.bottom - top };
  } else if (area.bottom - (docBox.y + docBox.height + GAP) >= 90) {
    const y = docBox.y + docBox.height + GAP;
    place = { left: area.left, right: viewSize.width - area.right, top: y, maxHeight: area.bottom - y };
  } else if (docBox.y - GAP - area.top >= 90) {
    place = { left: area.left, right: viewSize.width - area.right, bottom: viewSize.height - (docBox.y - GAP), maxHeight: docBox.y - GAP - area.top };
  } else {
    place = { left: area.left, right: viewSize.width - area.right, bottom: viewSize.height - area.bottom, maxHeight: 150 };
  }

  return (
    <View style={[styles.glass, place]}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.title}>Key details</Text>
        {groups.map(({ category, items }) => {
          const s = CATEGORY_STYLE[category];
          return (
            <View key={category} style={styles.group}>
              <Text style={[styles.groupTitle, { color: s.color }]}>
                {s.icon} {KEY_TITLES[category]}
              </Text>
              {items.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => onSelect(a)}
                  accessibilityRole="button"
                  accessibilityLabel={`${KEY_TITLES[category]}: ${a.sourceText}`}
                  style={[styles.item, { borderColor: s.color }]}
                >
                  <Text style={styles.itemText} numberOfLines={2}>
                    {a.sourceText}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------- Frozen: original | plain words ----------

type Plain = { segments: Segment[]; source: 'ai' | 'glossary'; loading: boolean };

function SideBySide({ docBox, viewSize, insets, text, knownMedications }: Props) {
  const [lang, setLang] = useState(0);
  const [playing, setPlaying] = useState<'orig' | 'plain' | null>(null);
  const clean = useMemo(() => text.replace(/\s+/g, ' ').trim(), [text]);
  const original = useMemo(() => originalSegments(clean, knownMedications), [clean, knownMedications]);
  const glossaryPlain = useMemo(() => plainSegments(clean, knownMedications), [clean, knownMedications]);
  const [plain, setPlain] = useState<Plain>({ segments: glossaryPlain, source: 'glossary', loading: false });
  const language = LANGUAGES[lang];

  // AI rewrite; the glossary-only version shows until it arrives, and stays if AI is unavailable.
  useEffect(() => {
    if (!clean) return;
    let live = true;
    setPlain({ segments: glossaryPlain, source: 'glossary', loading: true });
    api
      .translate({ text: clean, language: language.name, knownMedications })
      .then((r) => {
        if (!live) return;
        setPlain(
          r.source === 'ai'
            ? { segments: r.segments, source: 'ai', loading: false }
            : { segments: glossaryPlain, source: 'glossary', loading: false },
        );
      })
      .catch(() => live && setPlain({ segments: glossaryPlain, source: 'glossary', loading: false }));
    return () => {
      live = false;
    };
  }, [clean, glossaryPlain, language.name, knownMedications]);

  useEffect(() => () => void Speech.stop(), []);

  const toggle = (which: 'orig' | 'plain') => {
    Speech.stop();
    if (playing === which) return setPlaying(null);
    setPlaying(which);
    const done = () => setPlaying(null);
    Speech.speak(which === 'orig' ? clean : spokenText(plain.segments), {
      language: which === 'orig' || plain.source === 'glossary' ? 'en-US' : language.voice,
      onDone: done,
      onStopped: done,
    });
  };

  if (!clean) return null;

  const area = screenArea(viewSize, insets);
  const roomLeft = docBox ? docBox.x - GAP - area.left : 0;
  const roomRight = docBox ? area.right - (docBox.x + docBox.width + GAP) : 0;
  const flank = docBox && roomLeft >= SIDE_MIN && roomRight >= SIDE_MIN;

  const note =
    plain.loading ? 'Rewriting…'
    : plain.source === 'ai' ? '🔒 values copied exactly'
    : lang === 0 ? 'Glossary version'
    : 'Translation unavailable, showing English';

  const origPanel = (
    <Pane title="Original" onPlay={() => toggle('orig')} playing={playing === 'orig'}>
      <SegmentText segments={original} />
    </Pane>
  );
  const plainPanel = (
    <Pane
      title="Plain words"
      note={note}
      onPlay={() => toggle('plain')}
      playing={playing === 'plain'}
      action={
        <Pressable style={styles.lang} onPress={() => setLang((l) => (l + 1) % LANGUAGES.length)}>
          <Text style={styles.langText}>🌐 {language.label}</Text>
        </Pressable>
      }
    >
      <SegmentText segments={plain.segments} />
    </Pane>
  );

  if (flank && docBox) {
    // AR-Resume layout: one panel on each side of the paper.
    const top = clamp(docBox.y, area.top, area.bottom - 160);
    return (
      <>
        <View style={[styles.glass, { top, left: area.left + roomLeft - Math.min(roomLeft, SIDE_MAX), width: Math.min(roomLeft, SIDE_MAX), maxHeight: area.bottom - top }]}>
          {origPanel}
        </View>
        <View style={[styles.glass, { top, left: docBox.x + docBox.width + GAP, width: Math.min(roomRight, SIDE_MAX), maxHeight: area.bottom - top }]}>
          {plainPanel}
        </View>
      </>
    );
  }

  // Paper fills the screen (typical in portrait): dock the pair side by side at the bottom.
  const height = Math.min(viewSize.height * 0.45, area.bottom - area.top);
  return (
    <View style={[styles.dock, { left: area.left, right: viewSize.width - area.right, bottom: viewSize.height - area.bottom, height }]}>
      <View style={[styles.glass, styles.dockPane]}>{origPanel}</View>
      <View style={[styles.glass, styles.dockPane]}>{plainPanel}</View>
    </View>
  );
}

function Pane({
  title,
  note,
  action,
  playing,
  onPlay,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  playing: boolean;
  onPlay: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.pane}>
      <View style={styles.paneHead}>
        <Text style={styles.title}>{title}</Text>
        {action}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <ScrollView style={styles.paneScroll}>
        <Text style={styles.body}>{children}</Text>
      </ScrollView>
      <Pressable style={styles.play} onPress={onPlay} accessibilityRole="button">
        <Text style={styles.playText}>{playing ? '⏸ Stop' : '🔊 Listen'}</Text>
      </Pressable>
    </View>
  );
}

function SegmentText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.lock ? (
          <Text key={i}>
            <Text style={styles.lock}>{s.text}</Text>
            {s.meaning ? <Text style={styles.meaning}> ({s.meaning})</Text> : null}
          </Text>
        ) : s.term ? (
          <Text key={i}>
            <Text style={styles.term}>{s.text}</Text>
            <Text style={styles.meaning}> ({s.meaning})</Text>
          </Text>
        ) : (
          <Text key={i}>{s.text}</Text>
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Liquid glass: translucent white, bright hairline border, soft shadow.
  glass: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1.5,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pad: { padding: 12, gap: 8 },
  title: { fontSize: 12, fontWeight: '800', color: '#1f2937', textTransform: 'uppercase', letterSpacing: 0.5 },
  group: { gap: 4 },
  groupTitle: { fontSize: 12, fontWeight: '700' },
  item: { borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 3 },
  itemText: { fontSize: 14, fontWeight: '600', color: '#111827', fontFamily: 'Menlo' },
  dock: { position: 'absolute', flexDirection: 'row', gap: 8 },
  dockPane: { position: 'relative', flex: 1 },
  pane: { padding: 12, gap: 6, flexShrink: 1 },
  paneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  paneScroll: { flexShrink: 1 },
  note: { fontSize: 11, color: '#6b7280' },
  body: { fontSize: 14, lineHeight: 21, color: '#111827' },
  lock: { backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '700' },
  term: { color: '#0d9488', fontWeight: '700', textDecorationLine: 'underline' },
  meaning: { color: '#0d9488', fontStyle: 'italic' },
  lang: { borderRadius: 99, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: 'rgba(13,148,136,0.12)' },
  langText: { fontSize: 11, fontWeight: '700', color: '#0d9488' },
  play: { backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  playText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
