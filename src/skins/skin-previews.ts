/**
 * Skin Preview Metadata
 *
 * Provides visual description data for each skin to render preview thumbnails
 * in the skin picker. Uses representative CSS values so the picker can show
 * a miniature visual example of each skin without applying it globally.
 */

import type { Skin } from '~/lib/stores/skin';

export interface SkinPreview {
  id: Skin;
  label: string;
  description: string;
  previewTokens: {
    radius: string;
    shadow: string;
    blur: string;
    borderWidth: string;
    surfaceBg: string;
    borderColor: string;
  };
}

export const SKIN_PREVIEWS: SkinPreview[] = [
  {
    id: 'veldra',
    label: 'VELDRA',
    description: 'Soft, calm, premium default',
    previewTokens: {
      radius: '12px',
      shadow: '0 4px 12px rgba(0,0,0,0.08)',
      blur: '0px',
      borderWidth: '1px',
      surfaceBg: 'rgba(22,22,22,1)',
      borderColor: 'rgba(255,255,255,0.1)',
    },
  },
  {
    id: 'glass',
    label: 'Glass',
    description: 'Frosted translucent panels',
    previewTokens: {
      radius: '14px',
      shadow: '0 8px 24px rgba(0,0,0,0.4)',
      blur: '16px',
      borderWidth: '1px',
      surfaceBg: 'rgba(24,26,36,0.55)',
      borderColor: 'rgba(255,255,255,0.1)',
    },
  },
  {
    id: 'liquidglass',
    label: 'Liquid Glass',
    description: 'Luminous high-blur glass',
    previewTokens: {
      radius: '20px',
      shadow: '0 12px 32px rgba(0,0,0,0.45)',
      blur: '28px',
      borderWidth: '1px',
      surfaceBg: 'rgba(18,20,30,0.45)',
      borderColor: 'rgba(255,255,255,0.16)',
    },
  },
  {
    id: 'spatial',
    label: 'Spatial',
    description: 'Layered depth with soft shadows',
    previewTokens: {
      radius: '16px',
      shadow: '0 10px 28px rgba(0,0,0,0.35)',
      blur: '10px',
      borderWidth: '1px',
      surfaceBg: 'rgba(22,24,33,0.82)',
      borderColor: 'rgba(255,255,255,0.1)',
    },
  },
  {
    id: 'neomorphism',
    label: 'Neo',
    description: 'Soft extruded dual-tone surfaces',
    previewTokens: {
      radius: '20px',
      shadow: '3px 3px 6px rgba(0,0,0,0.45), -3px -3px 6px rgba(58,62,74,0.4)',
      blur: '0px',
      borderWidth: '0px',
      surfaceBg: 'rgba(42,45,56,1)',
      borderColor: 'transparent',
    },
  },
  {
    id: 'claymorphism',
    label: 'Clay',
    description: 'Pillowy puffy rounded surfaces',
    previewTokens: {
      radius: '24px',
      shadow: '0 10px 22px rgba(0,0,0,0.4), inset 0 3px 4px rgba(255,255,255,0.07)',
      blur: '0px',
      borderWidth: '0px',
      surfaceBg: 'rgba(43,42,61,1)',
      borderColor: 'transparent',
    },
  },
  {
    id: 'skeuomorphism',
    label: 'Skeuo',
    description: 'Warm tactile raised surfaces',
    previewTokens: {
      radius: '8px',
      shadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
      blur: '0px',
      borderWidth: '1px',
      surfaceBg: 'rgba(30,28,36,1)',
      borderColor: 'rgba(80,70,50,0.35)',
    },
  },
  {
    id: 'minimalism',
    label: 'Minimal',
    description: 'Flat, quiet, restrained',
    previewTokens: {
      radius: '6px',
      shadow: 'none',
      blur: '0px',
      borderWidth: '1px',
      surfaceBg: 'rgba(20,20,20,1)',
      borderColor: 'rgba(255,255,255,0.08)',
    },
  },
  {
    id: 'maximalism',
    label: 'Maximal',
    description: 'Bold, saturated, expressive',
    previewTokens: {
      radius: '20px',
      shadow: '0 8px 20px rgba(99,102,241,0.3)',
      blur: '0px',
      borderWidth: '2px',
      surfaceBg: 'rgba(22,22,30,1)',
      borderColor: 'rgba(99,102,241,0.5)',
    },
  },
  {
    id: 'brutalism',
    label: 'Brutal',
    description: 'Raw, square, hard offset shadow',
    previewTokens: {
      radius: '0px',
      shadow: '4px 4px 0 rgba(255,255,255,0.15)',
      blur: '0px',
      borderWidth: '2px',
      surfaceBg: 'rgba(16,16,16,1)',
      borderColor: 'rgba(255,255,255,0.2)',
    },
  },
  {
    id: 'obsidian',
    label: 'Obsidian',
    description: 'Deep near-black palette',
    previewTokens: {
      radius: '12px',
      shadow: '0 4px 12px rgba(0,0,0,0.3)',
      blur: '0px',
      borderWidth: '1px',
      surfaceBg: 'rgba(13,15,22,1)',
      borderColor: 'rgba(255,255,255,0.08)',
    },
  },
];
