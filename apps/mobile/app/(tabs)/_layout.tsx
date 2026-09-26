import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0d9488' }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Scan', headerShown: false, tabBarIcon: () => <Text>📷</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'My Profile', tabBarIcon: () => <Text>💊</Text> }}
      />
    </Tabs>
  );
}
