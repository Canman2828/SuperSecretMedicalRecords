import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0d9488', tabBarLabelStyle: { fontSize: 10 } }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', headerShown: false, tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: 'Scan', headerShown: false, tabBarIcon: () => <Text>📷</Text> }}
      />
      <Tabs.Screen
        name="compremedic"
        options={{ title: 'Compremedic', tabBarIcon: () => <Text>🔊</Text> }}
      />
      <Tabs.Screen
        name="medictionary"
        options={{ title: 'Medictionary', tabBarIcon: () => <Text>📖</Text> }}
      />
      <Tabs.Screen
        name="prescriptive"
        options={{ title: 'Prescriptive', tabBarIcon: () => <Text>🌳</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: () => <Text>💊</Text> }}
      />
    </Tabs>
  );
}
