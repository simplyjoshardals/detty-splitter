import { describe, expect, it } from "vitest";
import {
  SPECKLE_COUNT,
  SPECKLE_MAX_R,
  SPECKLE_MIN_R,
  makeSpeckles,
  mulberry32,
  seedFromAuthCode,
} from "@/lib/receipt/speckle";

describe("mulberry32", () => {
  it("gives the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 20; i += 1) expect(a()).toBe(b());
  });

  it("gives a different sequence for a different seed", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("stays in [0, 1)", () => {
    const next = mulberry32(0xdeadbeef);
    for (let i = 0; i < 1000; i += 1) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("treats the seed as an unsigned 32-bit integer", () => {
    expect(mulberry32(-1)()).toBe(mulberry32(0xffffffff)());
    expect(mulberry32(2 ** 32 + 7)()).toBe(mulberry32(7)());
  });
});

describe("seedFromAuthCode", () => {
  it("reads the 8-digit hex code as a number", () => {
    expect(seedFromAuthCode("D1E6E16D")).toBe(0xd1e6e16d);
    expect(seedFromAuthCode("13458EA4")).toBe(0x13458ea4);
    expect(seedFromAuthCode("FFFFFFFF")).toBe(4294967295);
  });

  it("is case-insensitive", () => {
    expect(seedFromAuthCode("d1e6e16d")).toBe(seedFromAuthCode("D1E6E16D"));
  });

  it("gives seed 0 for anything that is not 1 to 8 hex digits, never NaN", () => {
    for (const bad of ["", "XYZ", "D1E6E16DD", "0x12", " 12", "12 ", "-1", "1.5"]) {
      expect(seedFromAuthCode(bad)).toBe(0);
    }
  });
});

describe("makeSpeckles", () => {
  const W = 480;
  const H = 120;

  it("gives the same speckles for the same seed and box (same input, same texture)", () => {
    expect(makeSpeckles(0xd1e6e16d, W, H)).toEqual(makeSpeckles(0xd1e6e16d, W, H));
  });

  it("gives different speckles for different seeds", () => {
    expect(makeSpeckles(0xd1e6e16d, W, H)).not.toEqual(makeSpeckles(0x13458ea4, W, H));
  });

  it("gives about 200 speckles by default, and honours an explicit count", () => {
    expect(SPECKLE_COUNT).toBe(200);
    expect(makeSpeckles(1, W, H)).toHaveLength(SPECKLE_COUNT);
    expect(makeSpeckles(1, W, H, 5)).toHaveLength(5);
  });

  it("keeps every radius between 1 and 4px", () => {
    for (const s of makeSpeckles(99, W, H)) {
      expect(s.r).toBeGreaterThanOrEqual(SPECKLE_MIN_R);
      expect(s.r).toBeLessThanOrEqual(SPECKLE_MAX_R);
    }
  });

  it("keeps every whole speckle inside the box", () => {
    for (const seed of [0, 1, 0xd1e6e16d, 0xffffffff]) {
      for (const s of makeSpeckles(seed, W, H)) {
        expect(s.x - s.r).toBeGreaterThanOrEqual(0);
        expect(s.x + s.r).toBeLessThanOrEqual(W);
        expect(s.y - s.r).toBeGreaterThanOrEqual(0);
        expect(s.y + s.r).toBeLessThanOrEqual(H);
      }
    }
  });

  it("spreads over the box instead of clumping in one corner", () => {
    const speckles = makeSpeckles(7, W, H);
    expect(speckles.some((s) => s.x < W / 4)).toBe(true);
    expect(speckles.some((s) => s.x > (3 * W) / 4)).toBe(true);
    expect(speckles.some((s) => s.y < H / 4)).toBe(true);
    expect(speckles.some((s) => s.y > (3 * H) / 4)).toBe(true);
  });

  it("a wider box changes only x, because the draw order is fixed", () => {
    // Same seed, same draw order: the unit positions are the same, so a wider box moves x only.
    const narrow = makeSpeckles(5, 300, H);
    const wide = makeSpeckles(5, 600, H);
    expect(wide.map((s) => s.r)).toEqual(narrow.map((s) => s.r));
    expect(wide.map((s) => s.y)).toEqual(narrow.map((s) => s.y));
  });

  it("returns an empty list, not an error, for a box too small or an unusable input", () => {
    expect(makeSpeckles(1, 2 * SPECKLE_MAX_R, H)).toEqual([]);
    expect(makeSpeckles(1, W, 0)).toEqual([]);
    expect(makeSpeckles(1, -10, H)).toEqual([]);
    expect(makeSpeckles(1, Number.NaN, H)).toEqual([]);
    expect(makeSpeckles(1, W, Number.POSITIVE_INFINITY)).toEqual([]);
    expect(makeSpeckles(1, W, H, 0)).toEqual([]);
    expect(makeSpeckles(1, W, H, 2.5)).toEqual([]);
  });

  it("is stable: a change to the algorithm has to update this on purpose", () => {
    const speckles = makeSpeckles(0xd1e6e16d, W, H);
    expect(speckles[0]?.x).toBeCloseTo(180.5357, 3);
    expect(speckles[0]?.y).toBeCloseTo(8.7044, 3);
    expect(speckles[0]?.r).toBeCloseTo(3.7447, 3);
    expect(speckles[199]?.x).toBeCloseTo(222.5499, 3);
    expect(speckles[199]?.y).toBeCloseTo(63.804, 3);
    expect(speckles[199]?.r).toBeCloseTo(1.2966, 3);
  });
});
