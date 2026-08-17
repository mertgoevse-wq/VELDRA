import type { ProjectIdentity } from '~/lib/identity/project';

/**
 * Foundation types for VELDRA's media/asset system. This is a type-level contract only --
 * there is deliberately no new IndexedDB object store or save/load call site added alongside
 * it yet. The one real, concrete producer today (ImageStudioTab.tsx's handleSaveAsset) still
 * writes generated images straight into the project file tree via workbenchStore.createFile(),
 * discarding all of GeneratedImage/ImageJobMetadata's provenance in the process -- these types
 * exist so that a future persistence layer has a real shape to target instead of inventing
 * field names ad hoc, not because anything reads/writes them yet. Adding storage plumbing with
 * no caller would be exactly the "speculative infrastructure" this codebase's own conventions
 * (see app/lib/storage/types.ts's honest "nothing has migrated onto this yet" header) warn
 * against -- see docs/ai-state/DECISIONS.md for the reasoning trail.
 *
 * Field names deliberately echo app/lib/modules/image/types.ts's GeneratedImage/
 * ImageJobMetadata (mimeType, width/height, prompt, modelId, createdAt, cost) rather than
 * reinventing a parallel vocabulary for the same concepts.
 */

export type AssetKind = 'source' | 'generated';

export type AssetMediaType = 'image' | 'icon' | 'animation' | 'pdf' | 'audio' | 'video' | 'other';

/**
 * Where an asset came from. Mirrors the `provenance: string` precedent already established in
 * app/lib/orchestrator/registries.ts (a different, unrelated registry) rather than inventing a
 * second shape for the same idea.
 */
export interface AssetProvenance {
  source: 'user-upload' | 'ai-generated' | 'imported-url' | 'template-seed';
  provider?: string;
  modelId?: string;
  prompt?: string;
  sourceUrl?: string;
}

/**
 * One durable asset record. `projectId` is optional and deliberately NOT required the way
 * StorageProvider's methods require a ProjectIdentity for every call -- a reusable animation
 * preset (see AnimationPreset below) is explicitly meant to outlive and be shared across
 * projects, so a global/unscoped asset must be representable, not forced into a fake project.
 */
export interface Asset {
  id: string;
  kind: AssetKind;
  mediaType: AssetMediaType;
  mimeType: string;

  /** Undefined = global/reusable, not tied to one project (e.g. a shared animation preset). */
  projectId: ProjectIdentity['id'] | undefined;
  width?: number;
  height?: number;
  sizeBytes: number;
  provenance: AssetProvenance;
  createdAt: string;

  /** Base64-encoded bytes, same convention app/lib/modules/image/assets.ts already uses. */
  dataBase64: string;
}

/**
 * A single named frame within an animation sequence -- the metadata half of "animation
 * sequence/frame metadata" from the mandate. Deliberately does not embed pixel data itself;
 * a frame either references an Asset (for a bitmap-sequence animation) or is procedurally
 * generated at render time (as PixelMorphEngine's text-sampled frames are) -- see
 * app/lib/media/pixelMorph/engine.ts for the first real, working animation preset built on
 * this concept.
 */
export interface AnimationFrame {
  index: number;
  durationMs: number;
  assetId?: Asset['id'];
}

/**
 * A reusable, named animation configuration -- global by default (no projectId field at all,
 * not merely an optional one), matching the mandate's explicit requirement that presets not be
 * pinned to a single project the way project-scoped assets are.
 */
export interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  frames: AnimationFrame[];
  loop: boolean;
}
