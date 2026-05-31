import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import { LanguageProvider } from '../languageContext';

export default function RootLayout() {
  useEffect(() => {
    // iOS 上で App Tracking Transparency のダイアログを表示し、その結果に応じて AdMob を初期化する。
    // Apple のガイドライン 2.1 (Information Needed) で要求される動作。
    (async () => {
      let trackingAuthorized = false;
      if (Platform.OS === 'ios') {
        try {
          // まず現在の権限状態を確認 (initial: 0 / denied: 1 / authorized: 3 / restricted: 2)
          const { status: existingStatus } = await getTrackingPermissionsAsync();
          let status = existingStatus;
          if (existingStatus === 'undetermined') {
            // まだ未決定ならダイアログを出す
            const result = await requestTrackingPermissionsAsync();
            status = result.status;
          }
          trackingAuthorized = status === 'granted';
        } catch (e) {
          // ATT ダイアログ表示で失敗しても致命的ではないので継続
          console.warn('ATT permission request failed:', e);
        }
      }

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