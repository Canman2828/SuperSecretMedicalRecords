import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Brand } from '../ui/Icon';
import { Btn, Card, Guard } from '../ui/kit';
import { C, F, R } from '../ui/theme';

/** Brand + account button (web: <Nav/>; the tools live in the tab bar). */
export function TopBar() {
  const { loggedIn, signOut } = useAuth();
  const router = useRouter();
  return (
    <Card style={styles.nav}>
      <Brand size={24} />
      {loggedIn ? (
        <Btn label="Sign out" variant="neu" height={42} onPress={signOut} />
      ) : (
        <Btn label="Sign in" variant="neu" height={42} onPress={() => router.push('/signin')} />
      )}
    </Card>
  );
}

/** Emergency notice + credits (web: <Footer/>). */
export function Footer() {
  return (
    <Card style={styles.foot}>
      <Brand size={22} />
      <Guard icon="siren" title="In an emergency, call 911" tone="alert">
        If you think you are having a medical emergency, call 911 or your local emergency number right away. medify.Rx
        is a learning and discovery tool. It does not give professional medical advice, diagnosis or treatment. Always
        ask your doctor, pharmacist or another qualified health professional about your health and your medicines.
      </Guard>
      <View style={styles.bottom}>
        <Text style={styles.bottomText}>© 2026 medify.Rx. Hackathon prototype using synthetic data only.</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 64, paddingLeft: 10, paddingRight: 10, borderRadius: R.pill },
  foot: { padding: 22, gap: 22 },
  bottom: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 },
  bottomText: { fontFamily: F.body, fontSize: 14, color: C.ink3 },
});
