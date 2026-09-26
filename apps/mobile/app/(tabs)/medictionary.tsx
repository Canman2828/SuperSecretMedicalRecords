import type { ChatMessage } from '@medifyrx/shared';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/api';
import { useProfile } from '../../src/profile/ProfileContext';
import { F } from '../../src/ui/theme';

const GREETING =
  "Hi, I'm the medify.Rx assistant. Ask me what a medication is for or what something on your label means. " +
  "I can't give medical advice or change doses. In an emergency, call 911.";

export default function MedictionaryScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const controller = new AbortController();
    const question: ChatMessage = { role: 'user', text: 'What can Medify help me do?' };
    let reply = '';
    let chunks = 0;
    api.chat({ messages: [question] }, chunk => {
      chunks += 1;
      reply += chunk;
      setMessages([question, { role: 'assistant', text: reply }]);
    }, controller.signal).then(text => {
      setMessages([question, { role: 'assistant', text }]);
      console.log('MEDIFY_NATIVE_CHAT_TEST', JSON.stringify({ chunks, length: text.length, success: true }));
    }).catch(error => {
      if (!controller.signal.aborted) {
        setError(String(error));
        console.log('MEDIFY_NATIVE_CHAT_TEST', JSON.stringify({ success: false, error: String(error) }));
      }
    });
    return () => controller.abort();
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || requestRef.current) return;

    const controller = new AbortController();
    requestRef.current = controller;
    // The API accepts at most 40 messages. Keep complete user/assistant pairs.
    const history: ChatMessage[] = [...messages.slice(-38), { role: 'user', text }];
    const setReply = (reply: string) => {
      if (!controller.signal.aborted) setMessages([...history, { role: 'assistant', text: reply }]);
    };
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60_000);

    setSending(true);
    setInput('');
    setError(null);
    setReply('');
    try {
      let streamed = '';
      const reply = await api.chat(
        {
          messages: history,
          profile: {
            medications: profile.medications.map(({ enteredName, normalizedName, strength, frequency }) => ({
              enteredName, normalizedName, strength, frequency,
            })),
            allergies: profile.allergies.map(({ substance }) => ({ substance })),
          },
        },
        (chunk) => setReply((streamed += chunk)),
        controller.signal,
      );
      setReply(reply);
    } catch (err) {
      if (controller.signal.aborted && !timedOut) return;
      // Restore the question so a failed or interrupted reply can be retried.
      setMessages(messages);
      setInput(text);
      setError(timedOut
        ? 'The assistant took too long to respond. Please try again.'
        : err instanceof TypeError
          ? "Couldn't reach the assistant. Check your connection and try again."
          : err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      clearTimeout(timeout);
      requestRef.current = null;
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 44}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text style={styles.eyebrow}>Conscious learning</Text>
        <Text style={styles.heading}>Medictionary</Text>
        <Text style={styles.subtitle}>
          Ask about a medicine, a dosage term or a word you heard at an appointment, and get a short, plain-language answer.
        </Text>

        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Medify?</Text>
            <Text style={styles.badge}>AI answers, please verify</Text>
          </View>
          <ScrollView
            ref={logRef}
            style={styles.log}
            contentContainerStyle={styles.messages}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => logRef.current?.scrollToEnd({ animated: true })}
            accessibilityLabel="Conversation"
          >
            <Text style={[styles.message, styles.assistant]}>{GREETING}</Text>
            {messages.map((message, index) => (
              <Text key={index} style={[styles.message, message.role === 'user' ? styles.user : styles.assistant]}>
                {message.text || 'Thinking…'}
              </Text>
            ))}
          </ScrollView>

          {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="e.g. What is atorvastatin for?"
              placeholderTextColor="#62626f"
              accessibilityLabel="Message"
              maxLength={2000}
              multiline
              editable={!sending}
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={send}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sending ? 'Waiting for reply' : 'Send message'}
              disabled={sending || !input.trim()}
              onPress={send}
              style={[styles.send, (sending || !input.trim()) && styles.disabled]}
            >
              {sending ? <ActivityIndicator color="#474859" /> : <Text style={styles.sendText}>Send</Text>}
            </Pressable>
          </View>
          <Text style={styles.footer}>
            General information only, not medical advice. Ask your pharmacist or prescriber before changing how you take any medication.
            {'\n'}Emergency: 911 · Poison Control: 1-800-222-1222.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#e9e9ec' },
  content: { padding: 20, paddingBottom: 28, gap: 10 },
  eyebrow: { fontFamily: F.headBold, color: '#665c82', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  heading: { fontFamily: F.head, fontSize: 32, color: '#272a3b' },
  subtitle: { fontFamily: F.body, fontSize: 16, lineHeight: 24, color: '#62626f', marginBottom: 12 },
  panel: { backgroundColor: '#efeff2', borderRadius: 24, padding: 16, gap: 16, boxShadow: '5px 5px 16px rgba(160,163,178,0.35)' },
  panelHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelTitle: { fontFamily: F.head, fontSize: 22, color: '#272a3b' },
  badge: { fontFamily: F.headBold, fontSize: 11, color: '#665c82', backgroundColor: '#e4dfef', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  log: { maxHeight: 340, backgroundColor: '#e9e9ec', borderRadius: 16 },
  messages: { padding: 12, gap: 12 },
  message: { fontFamily: F.body, fontSize: 16, lineHeight: 24, padding: 12, borderRadius: 16, maxWidth: '92%' },
  assistant: { alignSelf: 'flex-start', backgroundColor: '#f7f7f7', color: '#474859' },
  user: { alignSelf: 'flex-end', backgroundColor: '#e4dfef', color: '#665c82' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { fontFamily: F.body, flex: 1, minHeight: 52, maxHeight: 120, backgroundColor: '#e9e9ec', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, color: '#272a3b', fontSize: 16 },
  send: { minWidth: 64, minHeight: 52, borderRadius: 16, backgroundColor: '#c9bfe0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  sendText: { fontFamily: F.headBold, color: '#474859', fontSize: 15 },
  disabled: { opacity: 0.5 },
  error: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: '#b91c1c' },
  footer: { fontFamily: F.body, fontSize: 12, lineHeight: 18, color: '#62626f' },
});
