import { Tabs } from 'expo-router';
import { Icon, type IconName } from '../../src/ui/Icon';
import { C, F, SH } from '../../src/ui/theme';

// Same tools as the website's nav, plus the live camera Scan that only the phone can do.
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'scan', title: 'Scan', icon: 'camera' },
  { name: 'compremedic', title: 'Compremedic', icon: 'scan' },
  { name: 'prescriptive', title: 'Prescriptive', icon: 'tree' },
  { name: 'medictionary', title: 'Medictionary', icon: 'book' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.dusk,
        tabBarInactiveTintColor: C.ink3,
        tabBarLabelStyle: { fontFamily: F.head, fontSize: 10 },
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopWidth: 0,
          boxShadow: SH.outSm,
        },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => <Icon name={t.icon} size={size - 2} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
