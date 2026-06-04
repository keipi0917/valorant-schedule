import { useEffect } from 'react';
import { Stack } from 'expo-router';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import { LanguageProvider } from '../languageContext';

export default function RootLayout() {
  useEffect(() => {
    // AdMob はトラッキングなし (non-personalized only) で初期化する。
    // ユーザのトラッキング許可は要求しない方針。
    (async () => {
      try {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.T,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        await mobileAds().initialize();
      } catch (e) {
        console.warn('AdMob initialization failed:', e);
      }
    })();
  }, []);

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