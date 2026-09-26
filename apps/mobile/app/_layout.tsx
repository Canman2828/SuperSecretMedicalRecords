import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ProfileProvider } from '../src/profile/ProfileContext';

export default function RootLayout() {
  return (
    <ProfileProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ProfileProvider>
  );
}
