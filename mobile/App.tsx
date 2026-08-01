import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from './src/theme';
import { useBasket } from './src/store';
import { useAuth } from './src/authStore';
import LoginScreen from './src/screens/LoginScreen';
import GamesScreen from './src/screens/GamesScreen';
import BasketScreen from './src/screens/BasketScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.bg,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.accent,
  },
};

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={{ color, fontSize: 20 }}>{label}</Text>;
}

export default function App() {
  const count = useBasket((s) => s.legs.length);
  const token = useAuth((s) => s.token);
  const logout = useAuth((s) => s.logout);

  if (!token) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.surface },
            headerTitleStyle: { color: theme.colors.text, fontWeight: '700' },
            tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
            tabBarActiveTintColor: theme.colors.text,
            tabBarInactiveTintColor: theme.colors.textDim,
            headerRight: () => (
              <TouchableOpacity onPress={logout} style={{ paddingHorizontal: 16 }}>
                <Text style={{ color: theme.colors.textDim, fontWeight: '600' }}>Log out</Text>
              </TouchableOpacity>
            ),
          }}
        >
          <Tab.Screen
            name="Games"
            component={GamesScreen}
            options={{
              title: 'MLB Games',
              tabBarIcon: ({ color }) => <TabIcon label="⚾" color={color} />,
            }}
          />
          <Tab.Screen
            name="Basket"
            component={BasketScreen}
            options={{
              tabBarIcon: ({ color }) => <TabIcon label="🧺" color={color} />,
              tabBarBadge: count > 0 ? count : undefined,
            }}
          />
          <Tab.Screen
            name="Orders"
            component={OrdersScreen}
            options={{
              tabBarIcon: ({ color }) => <TabIcon label="🧾" color={color} />,
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarIcon: ({ color }) => <TabIcon label="⚙️" color={color} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
