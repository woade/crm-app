import { Stack } from 'expo-router';

export default function DealsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Deals' }} />
      <Stack.Screen name="[id]" options={{ title: 'Deal' }} />
      <Stack.Screen name="new" options={{ title: 'New Deal', presentation: 'modal' }} />
    </Stack>
  );
}
