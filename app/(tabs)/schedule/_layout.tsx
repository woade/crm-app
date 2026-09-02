import { Stack } from 'expo-router';

export default function ScheduleLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Schedule' }} />
      <Stack.Screen name="new" options={{ title: 'Schedule a Call', presentation: 'modal' }} />
    </Stack>
  );
}
