import { Stack } from 'expo-router';
// ↓ ここを「../」に変更します！
import { LanguageProvider } from '../languageContext';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="[id]" options={{ headerShown: false, presentation: 'card' }} />
      </Stack>
    </LanguageProvider>
  );
}