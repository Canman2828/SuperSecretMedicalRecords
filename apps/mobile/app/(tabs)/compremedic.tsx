import type { MedDocument } from '@medifyrx/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth/AuthContext';
import { captureFromCamera, captureFromLibrary } from '../../src/compremedic/capture';
import { originalSegments, plainSegments, spokenText, type Segment } from '../../src/compremedic/plainLanguage';
import { SPEEDS, useSpeech } from '../../src/compremedic/useSpeech';
import { useProfile } from '../../src/profile/ProfileContext';
import { Icon } from '../../src/ui/Icon';
import { Btn, Chip, Guard, IconBtn, Label, Muted, PageHead, Panel, SampleTag, Screen, useAccent } from '../../src/ui/kit';
import { ACC, C, F, R, SH } from '../../src/ui/theme';

// Mirrors apps/web/src/compremedic/CompremedicPage.tsx. On the phone, "Take photo" / "Choose photo"
// really reads the text (ML Kit, on-device). Signed-in users can save the photo + plain-language text
// to their account (cloud), and delete it anytime.

const DOC_TYPES = ['Consent form', 'Prescription label', 'Pill bottle', 'Contact lens box'] as const;
type DocType = (typeof DOC_TYPES)[number];

// The shared API client throws "<status> <statusText>: <body>".
function saveError(m: string): string {
  if (m.startsWith('401')) return 'Please sign in again to save documents.';
  if (m.startsWith('413')) return 'That photo is too large to save. Try taking it again.';
  if (m.startsWith('503')) return 'Saving is unavailable right now (the database is offline).';
  return 'Could not save that document. Please try again.';
}

export default function CompremedicScreen() {
  const { profile } = useProfile();
  const { loggedIn } = useAuth();
  const router = useRouter();
  const [docType, setDocType] = useState<DocType>('Prescription label');
  // Starts empty — the side-by-side stays blank until the user types or captures a document.
  const [text, setText] = useState('');
  const [captured, setCaptured] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ imageBase64: string; mimeType: string; uri: string } | null>(null);
  const [listened, setListened] = useState(false);
  const speech = useSpeech();

  const [docs, setDocs] = useState<MedDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MedDocument | null>(null);

  const knownMedications = useMemo(
    () => profile.medications.map((m) => m.normalizedName ?? m.enteredName),
    [profile.medications],
  );
  const original = useMemo(() => originalSegments(text, knownMedications), [text, knownMedications]);
  const plain = useMemo(() => plainSegments(text, knownMedications), [text, knownMedications]);
  const plainText = useMemo(() => spokenText(plain), [plain]);

  // Load the user's saved documents once signed in; clear them on sign-out.
  useEffect(() => {
    if (!loggedIn) {
      setDocs([]);
      return;
    }
    let alive = true;
    api
      .listDocuments()
      .then((r) => alive && setDocs(r.documents))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [loggedIn]);

  const pickType = (t: DocType) => setDocType(t);

  const capture = async (source: 'camera' | 'library') => {
    setCapturing(true);
    setCaptureNotice(null);
    try {
      const outcome = source === 'camera' ? await captureFromCamera() : await captureFromLibrary();
      if (outcome.status === 'canceled') return;
      if (outcome.status === 'denied') {
        setCaptureNotice(
          source === 'camera'
            ? 'Camera access is off. Turn it on in Settings to take a photo.'
            : 'Photo access is off. Turn it on in Settings to choose a photo.',
        );
        return;
      }
      if (outcome.status === 'error') {
        setCaptureNotice(outcome.message);
        return;
      }
      const { text: read, imageBase64, mimeType, uri } = outcome.capture;
      setPending({ imageBase64, mimeType, uri });
      setCaptured(true);
      setSaveNotice(null);
      if (read) setText(read);
      else setCaptureNotice("We couldn't find any text in that image. Type it in below — you can still save it.");
    } finally {
      setCapturing(false);
    }
  };

  const save = async () => {
    if (!pending || !plainText.trim()) return;
    setSaving(true);
    setSaveNotice(null);
    try {
      const doc = await api.uploadDocument({
        imageBase64: pending.imageBase64,
        mimeType: pending.mimeType,
        plainText,
        originalText: text,
        docType,
      });
      setDocs((d) => [doc, ...d]);
      setPending(null);
      setCaptured(false);
      setSaveNotice('Saved to your account.');
    } catch (e) {
      setSaveNotice(saveError((e as Error).message));
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string) => {
    const prev = docs;
    setDocs((d) => d.filter((x) => x.id !== id)); // optimistic
    api.deleteDocument(id).catch(() => {
      setDocs(prev);
      setSaveNotice('Could not delete that document. Please try again.');
    });
  };

  const confirmRemove = (doc: MedDocument) => {
    Alert.alert('Delete this document?', 'The photo and its text will be removed from your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(doc.id) },
    ]);
  };

  const hasText = text.trim().length > 0;
  const done = [hasText || captured, hasText, hasText, listened];
  const now = done.indexOf(false);

  return (
    <Screen accent={ACC.steel}>
      <PageHead icon="scan" goal="Comprehension" title="Compremedic">
        Photograph a consent form or a prescription label, or pick one from your photos. We place a plain-language
        version beside the original and read either one aloud. Doses, timing and warnings are never reworded.
      </PageHead>

      <Stepper done={done} now={now} />

      <Panel title="Add a document">
        <Drop
          onTakePhoto={() => capture('camera')}
          onChoosePhoto={() => capture('library')}
          capturing={capturing}
          captured={captured}
          notice={captureNotice}
        />

        <Label style={{ marginTop: 22 }}>What is it?</Label>
        <View style={styles.chips}>
          {DOC_TYPES.map((t) => (
            <Chip key={t} label={t} on={docType === t} onPress={() => pickType(t)} />
          ))}
        </View>

        <Label style={{ marginTop: 22 }}>Text on the document</Label>
        <TextInput
          style={styles.textbox}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setCaptured(false);
          }}
          multiline
          placeholder="Type or paste the text exactly as printed"
          placeholderTextColor={C.placeholder}
          accessibilityLabel="Text on the document"
        />
      </Panel>

      <Panel
        title="Side by side"
        right={captured ? <SampleTag>From your photo</SampleTag> : undefined}
      >
        <View style={{ gap: 26 }}>
          <View style={styles.pane}>
            <Label style={{ marginBottom: 0 }}>Original text</Label>
            <View style={styles.paneBox}>
              <Text style={[styles.paneText, styles.orig]}>
                <Segments segments={original} />
              </Text>
            </View>
            <Player
              label="Listen to original"
              playing={speech.playing === 'orig'}
              disabled={!hasText}
              onPlay={(rate) => {
                speech.toggle('orig', text, rate);
                setListened(true);
              }}
            />
          </View>
          <View style={styles.pane}>
            <Label style={{ marginBottom: 0 }}>In plain words</Label>
            <View style={styles.paneBox}>
              <Text style={styles.paneText}>
                <Segments segments={plain} />
              </Text>
            </View>
            <Player
              label="Listen to plain version"
              playing={speech.playing === 'plain'}
              disabled={!hasText}
              onPlay={(rate) => {
                speech.toggle('plain', plainText, rate);
                setListened(true);
              }}
            />
          </View>
        </View>
        <View style={{ marginTop: 26 }}>
          <Guard icon="lock" title="Protected details">
            Highlighted values are copied exactly from the original and never rewritten: dose, how often, how long and
            warnings. If anything looks different from your label, trust the label and ask your pharmacist.
          </Guard>
        </View>
      </Panel>

      <Panel
        title="Saved to your account"
        icon="upload"
        right={loggedIn ? <SampleTag>{docs.length} saved</SampleTag> : undefined}
      >
        {!loggedIn ? (
          <View style={{ gap: 18 }}>
            <Guard icon="lock" title="Sign in to save">
              Saving a photo and its plain-language text to the cloud needs an account. Your documents stay private to
              you, and you can delete them whenever you like.
            </Guard>
            <Btn label="Sign in" iconLeft="user" onPress={() => router.push('/signin')} />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <Muted small>
              Save this document&apos;s photo and plain-language text to your account. It&apos;s kept in the cloud so
              you can come back to it, and you can delete it anytime.
            </Muted>
            <Btn
              label={saving ? 'Saving…' : 'Save to cloud'}
              iconLeft="upload"
              onPress={save}
              disabled={saving || !pending || !plainText.trim()}
              full
            />
            {!pending && !saving ? <Muted small>Take or choose a photo above, then save it here.</Muted> : null}
            {saveNotice ? <Text style={styles.saveNotice}>{saveNotice}</Text> : null}

            {docs.length > 0 && (
              <View style={styles.savedList}>
                {docs.map((d) => (
                  <SavedRow key={d.id} doc={d} onOpen={() => setViewing(d)} onDelete={() => confirmRemove(d)} />
                ))}
              </View>
            )}
          </View>
        )}
      </Panel>

      <SavedDocModal
        doc={viewing}
        onClose={() => setViewing(null)}
        onDelete={() => {
          const v = viewing;
          setViewing(null);
          if (v) confirmRemove(v);
        }}
      />
    </Screen>
  );
}

// Full-screen view of a saved document: the whole photo plus its text, read aloud on demand.
// Works on any device signed in to the account (the photo + text come from the cloud).
function SavedDocModal({ doc, onClose, onDelete }: { doc: MedDocument | null; onClose: () => void; onDelete: () => void }) {
  const insets = useSafeAreaInsets();
  const speech = useSpeech();
  if (!doc) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.viewer}>
        <View style={[styles.viewerBar, { paddingTop: insets.top + 6 }]}>
          <Text style={styles.viewerTitle} numberOfLines={1}>{doc.docType ?? 'Document'}</Text>
          <IconBtn icon="x" label="Close" size={40} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={[styles.viewerBody, { paddingBottom: insets.bottom + 28 }]}>
          <Image
            source={{ uri: `data:${doc.mimeType};base64,${doc.imageBase64}` }}
            style={styles.viewerImage}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel="Saved document photo"
          />
          <Text style={styles.savedDate}>Saved {new Date(doc.createdAt).toLocaleString()}</Text>

          {doc.originalText ? (
            <View style={styles.viewerPane}>
              <Label style={{ marginBottom: 0 }}>Original text</Label>
              <View style={styles.paneBox}>
                <Text style={[styles.paneText, styles.orig]}>{doc.originalText}</Text>
              </View>
              <Player
                label="Listen to original"
                playing={speech.playing === 'v-orig'}
                disabled={!doc.originalText}
                onPlay={(rate) => speech.toggle('v-orig', doc.originalText ?? '', rate)}
              />
            </View>
          ) : null}

          <View style={styles.viewerPane}>
            <Label style={{ marginBottom: 0 }}>In plain words</Label>
            <View style={styles.paneBox}>
              <Text style={styles.paneText}>{doc.plainText}</Text>
            </View>
            <Player
              label="Listen to plain version"
              playing={speech.playing === 'v-plain'}
              disabled={!doc.plainText}
              onPlay={(rate) => speech.toggle('v-plain', doc.plainText, rate)}
            />
          </View>

          <Btn label="Delete document" iconLeft="trash" variant="neu" full onPress={onDelete} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function Stepper({ done, now }: { done: boolean[]; now: number }) {
  const a = useAccent();
  return (
    <View style={styles.stepper}>
      {['Capture', 'Read text', 'Simplify', 'Listen'].map((label, i) => (
        <View
          key={label}
          style={[styles.step, i === now && styles.stepNow]}
          accessibilityLabel={`Step ${i + 1}, ${label}${done[i] ? ', done' : ''}`}
        >
          <View style={[styles.stepN, done[i] && { backgroundColor: a.acc, boxShadow: SH.none }]}>
            {done[i] ? (
              <Icon name="check" size={14} color={a.deep} />
            ) : (
              <Text style={[styles.stepNText, i === now && { color: a.deep }]}>{i + 1}</Text>
            )}
          </View>
          <Text style={[styles.stepText, done[i] && { color: C.ink2 }, i === now && { color: a.deep }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function Drop({
  onTakePhoto,
  onChoosePhoto,
  capturing,
  captured,
  notice,
}: {
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  capturing: boolean;
  captured: boolean;
  notice: string | null;
}) {
  const a = useAccent();
  return (
    <View style={styles.drop}>
      <IconBtn icon="camera" label="" size={70} style={{ backgroundColor: a.acc }} color={a.deep} />
      <Text style={styles.dropTitle}>Photograph or choose your document</Text>
      <Muted small style={{ textAlign: 'center' }}>
        Paper forms, pill bottles, blister packs, contact lens boxes
      </Muted>
      <View style={styles.captureRow}>
        <Btn label="Take photo" iconLeft="camera" height={44} onPress={onTakePhoto} disabled={capturing} />
        <Btn label="Choose photo" iconLeft="image" variant="neu" height={44} onPress={onChoosePhoto} disabled={capturing} />
      </View>
      {capturing && <ActivityIndicator color={a.deep} />}
      {captured && !capturing ? (
        <Text style={[styles.fileName, { color: a.deep }]}>
          Read from your photo. Check it against the paper and fix anything the camera missed.
        </Text>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

function SavedRow({ doc, onOpen, onDelete }: { doc: MedDocument; onOpen: () => void; onDelete: () => void }) {
  return (
    <View style={styles.savedRow}>
      <Pressable
        style={styles.savedMain}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${doc.docType ?? 'document'}`}
      >
        <Image
          source={{ uri: `data:${doc.mimeType};base64,${doc.imageBase64}` }}
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.savedType}>{doc.docType ?? 'Document'}</Text>
          <Text style={styles.savedDate}>{new Date(doc.createdAt).toLocaleDateString()}</Text>
          <Text style={styles.savedText} numberOfLines={2}>
            {doc.plainText}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={C.ink3} />
      </Pressable>
      <IconBtn icon="trash" label="Delete document" onPress={onDelete} />
    </View>
  );
}

function Segments({ segments }: { segments: Segment[] }) {
  const a = useAccent();
  return (
    <>
      {segments.map((seg, i) =>
        seg.lock ? (
          <Text key={i}>
            <Text style={[styles.lock, { backgroundColor: a.tint, color: a.deep }]}>{` ${seg.text} `}</Text>
            {seg.meaning ? <Text style={[styles.meaning, { color: a.deep }]}> ({seg.meaning})</Text> : null}
          </Text>
        ) : seg.term ? (
          <Text key={i}>
            <Text style={[styles.term, { textDecorationColor: a.deep }]}>{seg.text}</Text>
            <Text style={[styles.meaning, { color: a.deep }]}> ({seg.meaning})</Text>
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        ),
      )}
    </>
  );
}

// Static bar heights for the waveform, same formula as the website.
const BARS = Array.from({ length: 30 }, (_, i) => 20 + 60 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.4)));

function Player({
  label,
  playing,
  disabled,
  onPlay,
}: {
  label: string;
  playing: boolean;
  disabled: boolean;
  onPlay: (rate: number) => void;
}) {
  const [si, setSi] = useState(1);
  const a = useAccent();
  return (
    <View style={styles.player}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Stop' : label}
        disabled={disabled}
        onPress={() => onPlay(SPEEDS[si])}
        style={({ pressed }) => [styles.play, pressed && { boxShadow: SH.inSm }, disabled && { opacity: 0.5 }]}
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} color={C.white} />
      </Pressable>
      <View style={styles.wave}>
        {BARS.map((h, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: `${playing ? Math.min(95, h + 15) : h}%`, backgroundColor: playing ? a.deep : a.acc },
            ]}
          />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reading speed ${SPEEDS[si]} times`}
        onPress={() => setSi((si + 1) % SPEEDS.length)}
        style={styles.speed}
      >
        <Text style={styles.speedText}>{SPEEDS[si]}×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderRadius: R.lg, backgroundColor: C.surface, boxShadow: SH.outLg },
  step: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: R.pill },
  stepNow: { backgroundColor: C.bg, boxShadow: SH.inSm },
  stepN: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, boxShadow: SH.outSm },
  stepNText: { fontFamily: F.head, fontSize: 13, color: C.ink3 },
  stepText: { fontFamily: F.head, fontSize: 14, color: C.ink3 },
  drop: { alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 28, paddingHorizontal: 20, borderRadius: R.lg, backgroundColor: C.bg, boxShadow: SH.in, minHeight: 250 },
  dropTitle: { fontFamily: F.head, fontSize: 17, color: C.ink },
  captureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  fileName: { fontFamily: F.bodyBold, fontSize: 14, textAlign: 'center' },
  notice: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.error, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  textbox: { minHeight: 150, fontFamily: F.body, fontSize: 15, lineHeight: 23, color: C.ink, paddingVertical: 16, paddingHorizontal: 20, borderRadius: R.lg, backgroundColor: C.bg, boxShadow: SH.in, textAlignVertical: 'top' },
  pane: { gap: 16 },
  paneBox: { borderRadius: R.lg, paddingVertical: 20, paddingHorizontal: 20, backgroundColor: C.white, boxShadow: SH.pane, minHeight: 160 },
  paneText: { fontFamily: F.body, fontSize: 17, lineHeight: 29, color: C.ink2 },
  orig: { fontFamily: F.mono, fontSize: 14, lineHeight: 24, color: C.ink3 },
  lock: { fontFamily: F.bodyBold, fontSize: 15 },
  meaning: { fontFamily: F.bodyItalic },
  term: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  saveNotice: { fontFamily: F.bodyBold, fontSize: 14, lineHeight: 20, color: C.ink2 },
  savedList: { gap: 12, marginTop: 4 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: R.lg, backgroundColor: C.bg, boxShadow: SH.in },
  savedMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 54, height: 54, borderRadius: 12, backgroundColor: C.surface },
  viewer: { flex: 1, backgroundColor: C.bg },
  viewerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  viewerTitle: { flex: 1, fontFamily: F.head, fontSize: 20, color: C.ink },
  viewerBody: { paddingHorizontal: 16, gap: 18 },
  viewerImage: { width: '100%', height: 420, borderRadius: R.lg, backgroundColor: C.surface },
  viewerPane: { gap: 12 },
  savedType: { fontFamily: F.head, fontSize: 15, color: C.ink },
  savedDate: { fontFamily: F.headBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: C.ink3 },
  savedText: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.ink3 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 12, borderRadius: R.pill, backgroundColor: C.surface, boxShadow: SH.out },
  play: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: C.dusk, boxShadow: SH.hover },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 34, overflow: 'hidden' },
  bar: { flex: 1, minWidth: 2, borderRadius: 3 },
  speed: { width: 52, height: 34, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, boxShadow: SH.outSm },
  speedText: { fontFamily: F.headBold, fontSize: 13, color: C.ink2 },
});
