import { describe, expect, it, vi } from 'vitest';
import { PixelMorphEngine } from './engine';
import type { PixelMorphPreset } from './presets';

/*
 * sampleText() rasterizes to a real <canvas> 2D context, which jsdom (this project's test
 * environment) does not implement -- getContext('2d') returns null there, so the engine would
 * never see any particles at all if it called the real implementation. The engine's own
 * responsibility is the phase state machine and per-particle physics, not text rasterization
 * (that's textSampler.ts's contract) -- mocking it here tests the engine in isolation the same
 * way engine.ts's own doc comment describes it: "canvas-agnostic," independent of any real
 * rasterizer.
 */
vi.mock('./textSampler', () => ({
  sampleText: vi.fn((text: string) => {
    if (!text) {
      return [];
    }

    // Deterministic, text-dependent points so different texts produce different targets.
    return Array.from({ length: 6 }, (_, i) => ({ x: i * 10 + text.length, y: i * 5 }));
  }),
}));

const FAST_PRESET: PixelMorphPreset = {
  id: 'test',
  font: '16px sans-serif',
  particleSize: 2,
  poolLine: 0.5,
  poolJitter: 1,
  dissolveMs: 100,
  poolMs: 50,
  reformMs: 100,
};

function makeEngine() {
  const engine = new PixelMorphEngine({ preset: FAST_PRESET, maxParticles: 50 });
  engine.resize(200, 100);

  return engine;
}

describe('PixelMorphEngine', () => {
  it('renders the first text instantly with no transition', () => {
    const engine = makeEngine();
    engine.setText('Hello');

    expect(engine.text).toBe('Hello');
    expect(engine.isTransitioning).toBe(false);
  });

  it('starts a real dissolve transition on a second, different text', () => {
    const engine = makeEngine();
    engine.setText('Hello');
    engine.setText('World');

    // Still showing the old text until the transition completes -- reform doesn't happen instantly.
    expect(engine.text).toBe('Hello');
    expect(engine.isTransitioning).toBe(true);
  });

  it('ignores a redundant setText call for the text already showing', () => {
    const engine = makeEngine();
    engine.setText('Hello');
    engine.setText('Hello');

    expect(engine.isTransitioning).toBe(false);
  });

  it('walks dissolve -> pool -> reform -> hold and lands on the new text', () => {
    const engine = makeEngine();
    engine.setText('Hello');
    engine.setText('World');

    // Drive through dissolve (100ms).
    engine.update(120);
    expect(engine.isTransitioning).toBe(true);

    // Drive through pool (50ms) -- this is also where reform's targets get computed.
    engine.update(60);
    expect(engine.isTransitioning).toBe(true);

    // Drive through reform (100ms).
    engine.update(120);

    expect(engine.text).toBe('World');
    expect(engine.isTransitioning).toBe(false);
  });

  it('a later setText during an in-flight transition replaces the pending target, not stacks a second transition', () => {
    const engine = makeEngine();
    engine.setText('Hello');
    engine.setText('World');
    engine.update(10); // now mid-dissolve
    engine.setText('Again'); // supersedes 'World' before it ever showed

    /*
     * update() only carries a phase to completion per call (matching real RAF usage, where dt
     * is always small relative to phase duration) -- crossing dissolve -> pool -> reform -> hold
     * takes several calls, same as driving real animation frames would.
     */
    for (let i = 0; i < 20 && engine.isTransitioning; i++) {
      engine.update(200);
    }

    expect(engine.text).toBe('Again');
    expect(engine.isTransitioning).toBe(false);
  });

  it('does nothing on update() before any text has been set', () => {
    const engine = makeEngine();

    expect(() => engine.update(16)).not.toThrow();
    expect(engine.text).toBe('');
    expect(engine.isTransitioning).toBe(false);
  });
});
