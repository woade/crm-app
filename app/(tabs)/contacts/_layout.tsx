import { Stack } from 'expo-router';

export default function ContactsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Contacts' }} />
      <Stack.Screen name="[id]" options={{ title: 'Contact' }} />
      <Stack.Screen name="new" options={{ title: 'New Contact', presentation: 'modal' }} />
    </Stack>
  );
}
