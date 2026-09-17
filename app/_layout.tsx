import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';

export {
  ErrorBoundary,
} from 'expo-router';

export default function RootLayout() {
  return (
    <AuthProvider>
      {/* Inside AuthProvider: it reads the session to work out whether the
          signed-in user is the owner or a rep on someone's team. */}
      <WorkspaceProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
