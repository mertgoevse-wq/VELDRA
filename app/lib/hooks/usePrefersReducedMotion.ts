import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function supportsMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/**
 * Reactive prefers-reduced-motion check. Existing call sites (SplashScreen.tsx,
 * WelcomeHero.client.tsx) each read `window.matchMedia(...).matches` once on mount, which
 * misses a user toggling the OS setting live; this listens for changes too. Not applied
 * to those existing call sites here -- out of scope for the widgets this hook was written
 * for (see docs/ai-state's product-integration mandate, Phase 4); a systemic
 * consolidation belongs in the mandate's own later motion-system phase, not slipped in as
 * a side effect of unrelated widget work.
 *
 * Guards against `window.matchMedia` being unavailable (some embedded WebViews, jsdom by
 * default) rather than crashing the whole component -- reduced motion is an enhancement,
 * not something worth taking a component down over when it can't be determined.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => supportsMatchMedia() && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    if (!supportsMatchMedia()) {
      return undefined;
    }

    const mediaQuery = window.matchMedia(QUERY);
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}
