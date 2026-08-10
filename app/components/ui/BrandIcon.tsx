import { useState } from 'react';
import { classNames } from '~/utils/classNames';

interface BrandIconProps {
  slug: string;
  variant?: string;
  alt: string;
  className?: string;
  fallbackIconClass?: string;
  fallbackColorClass?: string;
}

/**
 * cdn.simpleicons.org is unreachable in offline/LAN-only/restricted-network conditions
 * (a real scenario for the Android build) and some ad blockers block it outright, which
 * otherwise leaves a blank broken-image box where a toolbar icon should be.
 *
 * The fallback is an icon-font glyph, unlike the <img> it replaces it inherits `color`
 * instead of carrying its own baked-in pixels — fallbackColorClass must give it a color
 * that survives any `text-*` override already sitting on the surrounding button.
 */
export function BrandIcon({
  slug,
  variant,
  alt,
  className,
  fallbackIconClass = 'i-ph:plug',
  fallbackColorClass = '!text-bolt-elements-textPrimary',
}: BrandIconProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={classNames(fallbackIconClass, fallbackColorClass, className)} title={alt} />;
  }

  return (
    <img
      className={className}
      crossOrigin="anonymous"
      src={`https://cdn.simpleicons.org/${slug}${variant ? `/${variant}` : ''}`}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
