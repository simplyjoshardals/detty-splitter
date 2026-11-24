/**
 * Seeded speckle positions for the ink-stamp texture (DESIGN.md §7.1, T7.3). Pure: numbers in,
 * numbers out, no canvas and no React, so "same input gives the same texture" is testable in Node.
 *
 * Coordinates are local to the stamp's own (unrotated) box: x runs 0..width, y runs 0..height
 * from its top-left corner. The renderer erases them on an offscreen layer the size of that box
 * and then draws the layer, rotated, onto the receipt.
 */

export interface Speckle {
  x: number;
  y: number;
  /** Radius in px. */
  r: number;
}

/** DESIGN §7.1: about 200 speckles, radius 1 to 4px. */
export const SPECKLE_COUNT = 200;
export const SPECKLE_MIN_R = 1;
export const SPECKLE_MAX_R = 4;

/**
 * mulberry32: a tiny seeded PRNG. Returns a function that yields floats in [0, 1). The seed is
 * coerced to an unsigned 32-bit integer, so any finite number works and the same seed always
 * gives the same sequence.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Turns the receipt's `authCode` (8 hex digits, the FNV-1a hash of tier, per-person total and
 * currency; see `view.ts`) into a texture seed. The code is the same for the same receipt, so the
 * texture is too. Anything that is not 1 to 8 hex digits gives seed 0 (a fixed texture) rather
 * than NaN, so a bad value can never make the renderer throw or the texture change between runs.
 */
export function seedFromAuthCode(authCode: string): number {
  if (!/^[0-9a-fA-F]{1,8}$/.test(authCode)) return 0;
  return parseInt(authCode, 16) >>> 0;
}

/**
 * The same `seed` and box size always give the same speckles, in the same order. Each speckle is
 * fully inside the box (its whole circle, not just its centre). A box too small to hold even the
 * smallest speckle gives an empty list rather than an error.
 */
export function makeSpeckles(
  seed: number,
  width: number,
  height: number,
  count: number = SPECKLE_COUNT,
): Speckle[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isInteger(count) || count <= 0) {
    return [];
  }
  const spanX = width - 2 * SPECKLE_MAX_R;
  const spanY = height - 2 * SPECKLE_MAX_R;
  if (spanX <= 0 || spanY <= 0) return [];

  const next = mulberry32(seed);
  const speckles: Speckle[] = [];
  for (let i = 0; i < count; i += 1) {
    // Always draw in the same order (r, x, y) so every speckle consumes three values.
    const r = SPECKLE_MIN_R + next() * (SPECKLE_MAX_R - SPECKLE_MIN_R);
    const x = SPECKLE_MAX_R + next() * spanX;
    const y = SPECKLE_MAX_R + next() * spanY;
    speckles.push({ x, y, r });
  }
  return speckles;
}
