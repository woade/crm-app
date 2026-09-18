import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AuthLayout() {
  const { session, initializing } = useAuth();

  if (initializing) return null;
  // Land on Leads, not Contacts. Contacts is a leftover hidden tab (href:
  // null in the tab layout), so signing in used to drop you on a screen that
  // isn't even in the tab bar.
  if (session) return <Redirect href="/(tabs)/leads" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
