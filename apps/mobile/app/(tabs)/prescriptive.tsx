import { newId, type InteractionCheckResponse, type Profile, type Relationship, type RelationshipStatus } from '@medifyrx/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth/AuthContext';
import { InteractionTree } from '../../src/prescriptive/InteractionTree';
import { ProfilePanel } from '../../src/prescriptive/ProfilePanel';
import { RelationshipSheet } from '../../src/prescriptive/RelationshipSheet';
import { STATUS_STYLE } from '../../src/prescriptive/status';
import { EMPTY_PROFILE, useProfile } from '../../src/profile/ProfileContext';
import { Icon } from '../../src/ui/Icon';
import { Btn, Callout, Check, Chip, IconBtn, Muted, PageHead, Panel, Screen, Seg } from '../../src/ui/kit';
import { ACC, C, DOT, F, R, SH } from '../../src/ui/theme';

// Mirrors apps/web/src/prescriptive/PrescriptivePage.tsx: profile editor, opt-in save, interaction tree.

// Synthetic demo patient "Alex" from the design doc. Never use real patient data for judging.
const demoAlex = (): Profile => ({
  medications: [
    { id: newId('med'), enteredName: 'Warfarin', normalizedName: 'Warfarin', rxCui: '11289', source: 'manual' },
    { id: newId('med'), enteredName: 'Aspirin', normalizedName: 'Aspirin', rxCui: '1191', source: 'manual' },
    { id: newId('med'), enteredName: 'Atorvastatin', normalizedName: 'Atorvastatin', rxCui: '83367', source: 'manual' },
  ],
  allergies: [{ id: newId('allergy'), substance: 'Penicillin', type: 'medication', reaction: 'Hives', source: 'user' }],
  foods: [{ id: newId('food'), name: 'Grapefruit', reason: 'regularly-consume' }],
});

type View_ = 'tree' | 'list' | '3d';

export default function PrescriptiveScreen() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const { loggedIn } = useAuth();
  const [result, setResult] = useState<InteractionCheckResponse | null>(null);
  const [selected, setSelected] = useState<Relationship | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOptIn, setSaveOptIn] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [view, setView] = useState<View_>('tree');

  // Results are for a specific profile; clear them when it changes.
  useEffect(() => {
    setResult(null);
    setSelected(null);
  }, [profile]);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setResult(
        await api.checkInteractions({
          medications: profile.medications.map(({ enteredName, normalizedName, rxCui }) => ({ enteredName, normalizedName, rxCui })),
          allergies: profile.allergies.map(({ substance, type }) => ({ substance, type })),
          foods: profile.foods.map(({ name }) => ({ name })),
        }),
      );
    } catch (e) {
      setError(`Could not check relationships. Is EXPO_PUBLIC_API_URL set to your computer's IP? ${(e as Error).message}`);
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    try {
      await api.saveProfile(profile);
      setStatus('Profile saved to your account.');
    } catch (e) {
      setStatus(`Save failed: ${(e as Error).message}`);
    }
  };

  // Every profile item with no documented relationship. "Not found" is reported as exactly that, never as "safe".
  const unconnected = result
    ? result.nodes.filter(
        (n) => n.type !== 'patient' && !result.relationships.some((r) => r.sourceNodeId === n.id || r.targetNodeId === n.id),
      )
    : [];
  const total = profile.medications.length + profile.allergies.length + profile.foods.length;

  return (
    <Screen accent={ACC.blush}>
      <PageHead icon="tree" goal="Awareness" title="Prescriptive">
        Keep your medicines, allergies and foods in one profile, then see a tree of what to watch out for. Every link
        comes from a real drug label you can open.
      </PageHead>

      <Panel
        title="Your profile"
        right={
          <View style={styles.btnRow}>
            <Chip label="Load demo patient" onPress={() => setProfile(demoAlex())} />
            <Chip label="Clear" onPress={() => setProfile(EMPTY_PROFILE)} disabled={total === 0} />
          </View>
        }
      >
        {loggedIn ? (
          <View style={styles.saveRow}>
            <Check label="Save this profile to my account" value={saveOptIn} onChange={setSaveOptIn} />
            <Btn label="Save" variant="neu" height={40} disabled={!saveOptIn} onPress={save} />
          </View>
        ) : (
          <Muted small>
            Guest mode: nothing is saved.{' '}
            <Text style={styles.link} onPress={() => router.push('/signin')} accessibilityRole="link">Sign in</Text> to keep your profile.
          </Muted>
        )}
        {status && <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text>}
      </Panel>

      <ProfilePanel />

      <Panel
        title="Your interaction tree"
        right={
          <Seg
            label="View mode"
            value={view}
            onChange={setView}
            options={[
              { v: 'tree', label: 'Tree', icon: 'tree' },
              { v: 'list', label: 'List', icon: 'menu' },
              { v: '3d', label: '3D', icon: 'cube' },
            ]}
          />
        }
      >
        <View style={{ gap: 16 }}>
          <Btn
            label={checking ? 'Checking…' : result ? 'Check again' : 'Check relationships'}
            icon="arrow-right"
            onPress={check}
            disabled={checking || total === 0}
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.treeBox}>
            {view === '3d' ? (
              <Empty
                icon="cube"
                title="3D view"
                text="Orbit, zoom and tap any branch to see why it is there. Coming in the next build."
                action={<Btn label="Back to tree" variant="neu" height={40} onPress={() => setView('tree')} style={{ alignSelf: 'center' }} />}
              />
            ) : !result ? (
              <Empty
                icon="tree"
                title={total === 0 ? 'Start with your profile' : 'Ready when you are'}
                text={
                  total === 0
                    ? 'Add a medicine, allergy or food above, or load the demo patient.'
                    : 'Check relationships to build your tree. Tap any colored badge to see where it comes from.'
                }
              />
            ) : view === 'tree' ? (
              <InteractionTree result={result} onSelectRelationship={setSelected} />
            ) : (
              <RelationshipList result={result} onSelect={setSelected} />
            )}
          </View>

          <Legend />

          {result && result.relationships.length === 0 && <Callout>{result.disclaimer}</Callout>}
          {result && result.relationships.length > 0 && (
            <>
              {unconnected.length > 0 && (
                <Muted small>No relationship was found in the sources checked for: {unconnected.map((n) => n.label).join(', ')}.</Muted>
              )}
              <View style={styles.disclaimer}>
                <Muted small>
                  These links come from the sources checked, which are not complete. A missing link does not mean a
                  combination is safe. Talk with a pharmacist or healthcare professional if you have questions.
                </Muted>
              </View>
            </>
          )}
        </View>
      </Panel>

      <RelationshipSheet relationship={selected} nodes={result?.nodes ?? []} onClose={() => setSelected(null)} />
    </Screen>
  );
}

function Empty({ icon, title, text, action }: { icon: 'tree' | 'cube'; title: string; text: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <IconBtn icon={icon} label="" filled />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Muted small style={{ textAlign: 'center' }}>{text}</Muted>
      {action}
    </View>
  );
}

/** The same relationships as cards: easier to read on a small screen. */
function RelationshipList({ result, onSelect }: { result: InteractionCheckResponse; onSelect: (r: Relationship) => void }) {
  const label = (id: string) => result.nodes.find((n) => n.id === id)?.label ?? id;
  if (!result.relationships.length) {
    return <Empty icon="tree" title="No links found" text="No relationships were found in the sources checked." />;
  }
  return (
    <View style={{ padding: 12, gap: 12 }}>
      {result.relationships.map((r) => {
        const s = STATUS_STYLE[r.status];
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            accessibilityLabel={`${s.label}: ${r.title}. Show details.`}
            onPress={() => onSelect(r)}
            style={({ pressed }) => [styles.rel, pressed && { boxShadow: SH.inSm }]}
          >
            <View style={[styles.relIcon, { borderColor: s.color }]}>
              <Text style={{ color: s.color, fontWeight: '800' }}>{s.icon}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.relStatus, { color: s.color }]}>{s.label}</Text>
              <Text style={styles.relTitle}>{r.title}</Text>
              <Text style={styles.relPair}>{label(r.sourceNodeId)} ↕ {label(r.targetNodeId)}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={C.ink3} />
          </Pressable>
        );
      })}
    </View>
  );
}

function Legend() {
  return (
    <View style={styles.legend}>
      {([['Medicine', DOT.medication], ['Allergy', DOT.allergy], ['Food', DOT.food]] as const).map(([l, c]) => (
        <View key={l} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: c }]} />
          <Text style={styles.legendText}>{l}</Text>
        </View>
      ))}
      {(Object.keys(STATUS_STYLE) as RelationshipStatus[]).map((k) => (
        <View key={k} style={styles.legendItem}>
          <Text style={[styles.legendText, { color: STATUS_STYLE[k].color, fontWeight: '700' }]}>{STATUS_STYLE[k].icon}</Text>
          <Text style={[styles.legendText, { color: STATUS_STYLE[k].color }]}>{STATUS_STYLE[k].label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  saveRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  link: { fontFamily: F.bodyBold, color: C.dusk, textDecorationLine: 'underline' },
  status: { fontFamily: F.body, fontSize: 14, color: ACC.blush.deep, marginTop: 10 },
  error: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.error },
  treeBox: { borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.bg, boxShadow: SH.in, minHeight: 260 },
  empty: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyTitle: { fontFamily: F.head, fontSize: 18, color: C.ink },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontFamily: F.body, fontSize: 14, color: C.ink3 },
  disclaimer: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14 },
  rel: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.md, backgroundColor: C.white, boxShadow: SH.outSm },
  relIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  relStatus: { fontFamily: F.headBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  relTitle: { fontFamily: F.head, fontSize: 15, color: C.ink },
  relPair: { fontFamily: F.body, fontSize: 13, color: C.ink3 },
});
