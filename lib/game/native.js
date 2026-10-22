/* Android app (Capacitor) integration. Everything here is a no-op in a normal browser,
   and the plugin code is only loaded inside the app. */
import { Capacitor } from '@capacitor/core';

// Google sign-in for the Android app (Google Cloud project "Pen Fight",
// id utility-vista-512422-c1, owner shilajamankiku@gmail.com):
//  - this is the "Pen Fight Web (Supabase)" web client id; it is also listed in
//    Supabase → Authentication → Providers → Google → Client IDs (after the old one),
//    which is what lets Supabase accept the ID token;
//  - the same project has the "Pen Fight Android" client (package com.penfight.game
//    + the signing key's SHA-1). A new signing key (release / Play) needs its SHA-1
//    added there too, or the account picker fails with a developer error.
export const GOOGLE_WEB_CLIENT_ID = '711101125715-8js2un52fkli2rrkaplj8tpvnjigphha.apps.googleusercontent.com';
// Website used for invite links when running inside the app (its own origin is https://localhost).
export const SITE_URL = 'https://desk-duel-bd.vercel.app';

export function isNative() {
  try { return Capacitor.isNativePlatform(); } catch (e) { return false; }
}

let haptics = null;
/* Short tap → light, medium → medium, long → heavy, like navigator.vibrate(ms). */
export function nativeHaptic(ms) {
  if (!haptics) return false;
  const { Haptics, ImpactStyle } = haptics;
  const style = ms < 15 ? ImpactStyle.Light : ms < 30 ? ImpactStyle.Medium : ImpactStyle.Heavy;
  Haptics.impact({ style }).catch(() => {});
  return true;
}

/* h = { back(): 'exit'|void, pause(), resume(), openUrl(url) } */
export async function initNative(h) {
  if (!isNative()) return;
  document.documentElement.classList.add('native-app');
  try {
    const [app, hap, bar, splash, awake] = await Promise.all([
      import('@capacitor/app'),
      import('@capacitor/haptics'),
      import('@capacitor/status-bar'),
      import('@capacitor/splash-screen'),
      import('@capacitor-community/keep-awake'),
    ]);
    haptics = hap;
    const { App } = app;
    try {
      await bar.StatusBar.setOverlaysWebView({ overlay: true });
      await bar.StatusBar.setStyle({ style: bar.Style.Dark });
    } catch (e) {}
    App.addListener('backButton', () => {
      let r;
      try { r = h.back(); } catch (e) {}
      if (r === 'exit') App.exitApp();
    });
    App.addListener('pause', () => { try { h.pause(); } catch (e) {} });
    App.addListener('resume', () => { try { h.resume(); } catch (e) {} });
    App.addListener('appUrlOpen', (e) => { try { h.openUrl(e.url); } catch (err) {} });
    awake.KeepAwake.keepAwake().catch(() => {});
    setTimeout(() => splash.SplashScreen.hide().catch(() => {}), 250);
  } catch (e) {
    console.warn('native init:', e);
  }
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let socialReady = null;
/* Google sign-in with the phone's own account picker (Google blocks its web sign-in
   page inside apps), then hand the ID token to Supabase. */
export async function nativeGoogleSignIn(sb) {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  if (!socialReady) socialReady = SocialLogin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
  await socialReady;
  // Supabase checks sha256(rawNonce) against the token's nonce claim.
  const rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('');
  const res = await SocialLogin.login({ provider: 'google', options: { nonce: await sha256Hex(rawNonce) } });
  const token = res && res.result && res.result.idToken;
  if (!token) throw new Error('Google did not return a sign-in token');
  const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token, nonce: rawNonce });
  if (error) throw error;
}
