import { useEffect, useState } from 'react';

const SESSION_KEY = 'veldra-splash-shown';
const VISIBLE_MS = 1200;
const FADE_MS = 320;

/**
 * A brief web-rendered splash shown once per browser/app session, timed to pick up right as
 * Capacitor's native splash (capacitor.config.ts, launchShowDuration: 1000ms) fades away --
 * unlike the native splash, this can show real animated text (mark, wordmark, copyright)
 * instead of a single static image. sessionStorage (not a render-time flag) keeps it from
 * replaying on every client-side route change within the same app open.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      return undefined;
    }

    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(true);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const visibleDuration = prefersReducedMotion ? 500 : VISIBLE_MS;

    const fadeTimer = window.setTimeout(() => setFadingOut(true), visibleDuration);
    const hideTimer = window.setTimeout(() => setVisible(false), visibleDuration + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-max flex flex-col items-center justify-center gap-4 bg-[#0B3146] transition-opacity ease-out"
      style={{
        opacity: fadingOut ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      <div className="veldra-splash-mark relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent-400/25 blur-xl" />
        <img src="/veldra-mark-dark.png" alt="" className="relative h-12 w-auto" />
      </div>
      <div
        className="veldra-splash-wordmark text-xl font-bold tracking-wide text-white"
        style={{ fontFamily: 'var(--veldra-font-brand)' }}
      >
        VELDRA
      </div>
      <div className="veldra-splash-copyright text-xs text-white/50">© 2026 Mert Gövse</div>
    </div>
  );
}
