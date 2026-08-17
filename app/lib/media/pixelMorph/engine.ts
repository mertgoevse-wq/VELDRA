import { sampleText } from './textSampler';
import type { SampledPoint } from './textSampler';
import type { PixelMorphPreset } from './presets';

type Phase = 'hold' | 'dissolve' | 'pool' | 'reform';

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  poolX: number;
  poolY: number;
  startX: number;
  startY: number;
  alpha: number;

  /**
   * Assigned once at particle creation; drives per-particle wobble phase deterministically
   *  from elapsed time (Math.sin), not from a fresh random draw every frame.
   */
  seed: number;
}

export interface PixelMorphEngineOptions {
  preset: PixelMorphPreset;
  maxParticles: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;

/**
 * Fraction of the dissolve's total duration a particle's own progress can be delayed by,
 * derived from its seed (see `_phase === 'dissolve'` in update()). Delaying only the *start*
 * (every particle's local progress is rescaled to still reach 1 exactly when the shared `t`
 * reaches 1) turns the dissolve into an organic staggered wave instead of one rigid mass,
 * without risking a positional snap when the phase hands off to 'pool'.
 */
const DISSOLVE_STAGGER = 0.35;

/** Alpha particles fade toward during dissolve/pool, then climb back from during reform. */
const FADE_ALPHA_FLOOR = 0.2;

/**
 * Deterministic, canvas-agnostic particle simulation for a text-to-text pixel-dissolve
 * transition (see the mandate's "VELDRA PREMIUM PIXEL-MORPH GREETING" spec: text -> dissolve ->
 * shallow pool -> reform into next text). Owns no DOM/canvas element itself -- a caller
 * (PixelMorphText.tsx) drives `update(dtMs)` from its own requestAnimationFrame loop and calls
 * `render(ctx, color)` to paint, so pausing (reduced motion, backgrounded tab, low-end fallback)
 * is entirely the caller's decision, not baked in here.
 *
 * The particle pool is allocated once per text change and reused across the dissolve/pool/
 * reform phases of that transition (no per-frame allocation) -- see docs/ai-state/DECISIONS.md
 * for why this shape was chosen over a naive "spawn N particles per frame" approach.
 */
export class PixelMorphEngine {
  private _particles: Particle[] = [];
  private _phase: Phase = 'hold';
  private _phaseElapsedMs = 0;
  private _currentText = '';
  private _pendingText: string | null = null;
  private _pendingPoints: SampledPoint[] | null = null;
  private _canvasWidth = 0;
  private _canvasHeight = 0;
  private readonly _preset: PixelMorphPreset;
  private readonly _maxParticles: number;

  constructor(options: PixelMorphEngineOptions) {
    this._preset = options.preset;
    this._maxParticles = options.maxParticles;
  }

  /** Must be called (with the canvas's own CSS pixel size, not device pixels) before setText. */
  resize(width: number, height: number): void {
    this._canvasWidth = width;
    this._canvasHeight = height;
  }

  get isTransitioning(): boolean {
    return this._phase !== 'hold';
  }

  get text(): string {
    return this._currentText;
  }

  /**
   * Sets the displayed text. Thin wrapper around `setSourcePoints()` -- samples the text into
   * points up front, then delegates, using the text itself as the dedup key. Kept as a separate
   * method (rather than inlining sampleText() at every call site) so PixelMorphText.tsx's public
   * API surface -- the only thing callers outside this module see -- never has to change.
   */
  setText(text: string): void {
    const points = sampleText(text, this._canvasWidth, this._canvasHeight, {
      font: this._preset.font,
      maxPoints: this._maxParticles,
    });

    this.setSourcePoints(points, text);
  }

  /**
   * Generic entry point for starting/updating a transition to a new set of target points,
   * identified by an opaque `key` used only for the same redundant-call dedup `setText()` has
   * always had. `setText()` above is the text-sampled special case; a future image/logo source
   * (see textSampler.ts's doc comment) can call this directly with its own `SampledPoint[]`
   * without any further engine changes. The very first call renders instantly (nothing to
   * dissolve from yet). A call during 'hold' starts a real transition; a call that arrives
   * mid-transition just replaces the pending target instead of stacking a second transition on
   * top of the first.
   */
  setSourcePoints(points: SampledPoint[], key: string): void {
    if (key === this._currentText || key === this._pendingText) {
      return;
    }

    if (this._particles.length === 0) {
      this._currentText = key;
      this._seedParticlesFromPoints(points);

      return;
    }

    this._pendingText = key;
    this._pendingPoints = points;

    if (this._phase === 'hold') {
      this._phase = 'dissolve';
      this._phaseElapsedMs = 0;
    }
  }

  private _seedParticlesFromPoints(points: SampledPoint[]): void {
    this._particles = points.map((point, index) => ({
      x: point.x,
      y: point.y,
      targetX: point.x,
      targetY: point.y,
      poolX: point.x,
      poolY: this._canvasHeight * this._preset.poolLine,
      startX: point.x,
      startY: point.y,
      alpha: 1,
      seed: index * 12.9898,
    }));
  }

  update(dtMs: number): void {
    if (this._particles.length === 0) {
      return;
    }

    this._phaseElapsedMs += dtMs;

    if (this._phase === 'hold') {
      /*
       * Subtle ornamental movement around each glyph's resting position while text is on
       * screen (most of the ~11s cycle) -- the same wobble shape 'pool' uses below, reusing
       * each particle's seed, just at a much smaller amplitude (`holdJitter` vs `poolJitter`)
       * so it reads as texture, not motion.
       */
      for (const particle of this._particles) {
        const wobble = Math.sin(this._phaseElapsedMs / 220 + particle.seed) * this._preset.holdJitter;
        particle.x = particle.startX + wobble;
        particle.y = particle.startY + Math.abs(wobble) * 0.4;
      }

      return;
    }

    if (this._phase === 'dissolve') {
      const t = Math.min(1, this._phaseElapsedMs / this._preset.dissolveMs);

      /*
       * Stagger each particle's effective progress by a small, deterministic offset derived
       * from its seed so ~480 particles read as an organic per-pixel dissolve rather than one
       * rigid mass moving in lockstep. Rescaling (t - offset) / (1 - offset) means every
       * particle still reaches eased=1 exactly when t=1, so there's no positional snap when
       * the phase hands off to 'pool'.
       */
      for (const particle of this._particles) {
        const offset = Math.abs(Math.sin(particle.seed)) * DISSOLVE_STAGGER;
        const localT = Math.min(1, Math.max(0, (t - offset) / (1 - offset)));
        const eased = easeInCubic(localT);

        particle.x = particle.startX + (particle.poolX - particle.startX) * eased;
        particle.y = particle.startY + (particle.poolY - particle.startY) * eased;
        particle.alpha = 1 - eased * (1 - FADE_ALPHA_FLOOR);
      }

      if (t >= 1) {
        this._phase = 'pool';
        this._phaseElapsedMs = 0;
      }

      return;
    }

    if (this._phase === 'pool') {
      for (const particle of this._particles) {
        const wobble = Math.sin(this._phaseElapsedMs / 220 + particle.seed) * this._preset.poolJitter;
        particle.x = particle.poolX + wobble;
        particle.y = particle.poolY + Math.abs(wobble) * 0.4;
      }

      if (this._phaseElapsedMs >= this._preset.poolMs) {
        this._beginReform();
      }

      return;
    }

    if (this._phase === 'reform') {
      const t = Math.min(1, this._phaseElapsedMs / this._preset.reformMs);
      const eased = easeOutCubic(t);

      for (const particle of this._particles) {
        particle.x = particle.poolX + (particle.targetX - particle.poolX) * eased;
        particle.y = particle.poolY + (particle.targetY - particle.poolY) * eased;

        // Climbs back from the same FADE_ALPHA_FLOOR dissolve/pool left it at -- no alpha snap.
        particle.alpha = FADE_ALPHA_FLOOR + eased * (1 - FADE_ALPHA_FLOOR);
      }

      if (t >= 1) {
        this._phase = 'hold';
        this._phaseElapsedMs = 0;
        this._currentText = this._pendingText ?? this._currentText;
        this._pendingText = null;
        this._pendingPoints = null;

        for (const particle of this._particles) {
          particle.startX = particle.x;
          particle.startY = particle.y;
        }
      }
    }
  }

  private _beginReform(): void {
    const points = this._pendingPoints;

    if (!this._pendingText || !points || points.length === 0) {
      /*
       * Nothing to reform into (no pending target, or one whose points sampled to nothing --
       * e.g. an empty next line) -- stay in the pool state rather than reforming into a blank
       * target; the next real setText()/setSourcePoints() call will resume the transition.
       */
      return;
    }

    for (let i = 0; i < this._particles.length; i++) {
      const point = points[i % points.length];
      this._particles[i].targetX = point.x;
      this._particles[i].targetY = point.y;
    }

    this._phase = 'reform';
    this._phaseElapsedMs = 0;
  }

  render(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.clearRect(0, 0, this._canvasWidth, this._canvasHeight);

    if (this._particles.length === 0) {
      return;
    }

    ctx.fillStyle = color;

    const size = this._preset.particleSize;

    for (const particle of this._particles) {
      ctx.globalAlpha = particle.alpha;
      ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    }

    ctx.globalAlpha = 1;
  }
}
