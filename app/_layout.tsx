import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import { LanguageProvider } from '../languageContext';
import TrackingPrompt from '../components/tracking-prompt';
import { setPersonalizedAdsAllowed } from '../lib/adsConsent';

async function initAds() {
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
}

// アプリがフォアグラウンド (active) になるまで待つ。
// iOS は active でないと ATT ダイアログを表示しないため
// (以前の審査で「ダイアログが見つからない」と言われた原因)。
function waitUntilActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sub.remove();
        resolve();
      }
    });
  });
}

export default function RootLayout() {
  const [showPrompt, setShowPrompt] = useState(false);
  const adsStarted = useRef(false);

  const startAds = useCallback(async (granted: boolean) => {
    setPersonalizedAdsAllowed(granted);
    if (adsStarted.current) return;
    adsStarted.current = true;
    await initAds();
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'ios') {
        await startAds(false);
        return;
      }
      try {
        const { status } = await getTrackingPermissionsAsync();
        if (status === 'undetermined') {
          // 初回のみ: 説明画面 → iOS 標準ダイアログ の順に表示する
          await waitUntilActive();
          setShowPrompt(true);
          return;
        }
        await startAds(status === 'granted');
      } catch (e) {
        console.warn('ATT status check failed:', e);
        await startAds(false);
      }
    })();
  }, [startAds]);

  const handleContinue = useCallback(async () => {
    setShowPrompt(false);
    let granted = false;
    try {
      await waitUntilActive();
      // モーダルが閉じるアニメーションを待ってからダイアログを出す
      await new Promise((r) => setTimeout(r, 400));
      const { status } = await requestTrackingPermissionsAsync();
      granted = status === 'granted';
    } catch (e) {
      console.warn('ATT permission request failed:', e);
    }
    await startAds(granted);
  }, [startAds]);

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
      <TrackingPrompt visible={showPrompt} locale="ja" onContinue={handleContinue} />
    </LanguageProvider>
  );
}
