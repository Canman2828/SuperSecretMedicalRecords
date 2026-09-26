import { Carlito_400Regular, Carlito_400Regular_Italic, Carlito_700Bold } from '@expo-google-fonts/carlito';
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import { Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { AuthProvider } from '../src/auth/AuthContext';
import { ProfileProvider } from '../src/profile/ProfileContext';
import { C } from '../src/ui/theme';

export default function RootLayout() {
  // Same type stack as the website: Cormorant Garamond (wordmark), Quicksand (headings), Carlito (body).
  const [loaded, fontError] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    Carlito_400Regular,
    Carlito_400Regular_Italic,
    Carlito_700Bold,
    ...Feather.font,
    ...MaterialCommunityIcons.font,
  });

  // Hold on the ground color until fonts are in, so nothing flashes in the system font.
  if (!loaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <ProfileProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="signin" options={{ presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </ProfileProvider>
  );
}
