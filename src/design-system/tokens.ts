/**
 * VELDRA Design System — Token Definitions
 *
 * This module exports the design token vocabulary used by the VELDRA skin system.
 * CSS custom properties are the runtime mechanism; this file provides TypeScript
 * types and constants for programmatic access (e.g. generating skin previews,
 * validating token completeness, or building tooling around the token system).
 *
 * The actual CSS declarations live in app/styles/variables.scss.
 * This file mirrors those declarations as a typed API.
 */

export const RADIUS_SCALE = ['xs', 'sm', 'md', 'lg', 'xl', 'full'] as const;
export type RadiusScale = (typeof RADIUS_SCALE)[number];

export const SHADOW_SCALE = ['none', 'sm', 'md', 'lg'] as const;
export type ShadowScale = (typeof SHADOW_SCALE)[number];

export const MOTION_SCALE = ['fast', 'base', 'slow', 'theme'] as const;
export type MotionScale = (typeof MOTION_SCALE)[number];

export const DEPTH_SCALE = ['1', '2', '3', '4'] as const;
export type DepthScale = (typeof DEPTH_SCALE)[number];

export interface SkinStructuralTokens {
  radius: Record<RadiusScale, string>;
  shadow: Record<ShadowScale, string>;
  borderWidth: string;
  borderWidthThick: string;
  backdropBlur: string;
  backdropSaturate: string;
  surfaceBg: string;
  motionEase: string;
  motion: Record<MotionScale, string>;
}

export interface SkinColorTokens {
  bgDepth: Record<DepthScale, string>;
  borderColor: string;
  borderColorActive: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
}

export interface VeldraDesignTokens {
  structural: SkinStructuralTokens;
  colors: SkinColorTokens;
}

export const CSS_VAR_PREFIX = '--veldra-' as const;
export const BOLT_VAR_PREFIX = '--bolt-elements-' as const;

export function getCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getSkinToken(token: string): string {
  return getCssVar(`${CSS_VAR_PREFIX}${token}`);
}
