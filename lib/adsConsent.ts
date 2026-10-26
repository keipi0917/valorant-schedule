import { useSyncExternalStore } from 'react';

// 広告のパーソナライズ可否 (App Tracking Transparency の結果) を
// アプリ全体で共有するための小さなストア。
// 許可されるまでは非パーソナライズ広告のみをリクエストする。
let personalizedAllowed = false;
const listeners = new Set<() => void>();

export function setPersonalizedAdsAllowed(allowed: boolean) {
  if (personalizedAllowed === allowed) return;
  personalizedAllowed = allowed;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePersonalizedAdsAllowed() {
  return useSyncExternalStore(subscribe, () => personalizedAllowed, () => false);
}

// BannerAd の requestOptions。ATT で許可された場合のみパーソナライズ広告。
export function useAdRequestOptions() {
  const allowed = usePersonalizedAdsAllowed();
  return { requestNonPersonalizedAdsOnly: !allowed };
}
