import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the receipt's colours and the stamp's motion (DESIGN §3.1, §8, T6.3). Like
 * meter-contrast, it reads the real rules from app/globals.css, so a change there is checked
 * without anyone updating a copy. jsdom has no layout or media queries, so this is where "static
 * under reduced motion" is verified in code. Plain Node, no DOM.
 */
const CSS = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** The text between the braces that follow `marker`, nested braces included. */
function blockAfter(source: string, marker: string): string {
  const at = source.indexOf(marker);
  if (at === -1) throw new Error(`globals.css has no "${marker}"`);
  const open = source.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unclosed block after "${marker}"`);
}

const LIGHT = blockAfter(CSS, ":root");
const DARK = blockAfter(blockAfter(CSS, "@media (prefers-color-scheme: dark)"), ":root");
const ON_RECEIPT = blockAfter(CSS, ".on-receipt");

function rawValue(block: string, name: string): string | null {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(block);
  return match?.[1]?.replace(/\/\*.*?\*\//g, "").trim() ?? null;
}

/** A colour as `#rrggbb`: scope over dark over light, and one level of `var(--x)` is followed. */
function colour(name: string, theme: "light" | "dark", scope?: string): string {
  const layers = [scope, theme === "dark" ? DARK : null, LIGHT].filter(
    (block): block is string => typeof block === "string",
  );
  const find = (property: string): string => {
    for (const block of layers) {
      const value = rawValue(block, property);
      if (value !== null) return value;
    }
    throw new Error(`${property} is not defined for ${theme}`);
  };
  let value = find(name);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  if (reference?.[1] !== undefined) value = find(reference[1]);
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`${name} is "${value}", not a #rrggbb colour`);
  return value;
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe.each(["light", "dark"] as const)("receipt colours, %s mode", (theme) => {
  const paper = colour("--receipt-paper", theme);

  it("ink, muted text and the stamp inside the receipt scope pass 4.5:1 on the paper", () => {
    expect(contrast(colour("--ink", theme, ON_RECEIPT), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour("--muted", theme, ON_RECEIPT), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour("--stamp", theme, ON_RECEIPT), paper)).toBeGreaterThanOrEqual(4.5);
  });

  it("black text on the danfo bands passes 4.5:1", () => {
    expect(contrast(colour("--danfo-ink", theme), colour("--danfo", theme))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("gives the same colours in both themes: the paper is a physical object", () => {
    for (const name of ["--ink", "--muted", "--stamp", "--rule"]) {
      expect(colour(name, theme, ON_RECEIPT)).toBe(colour(name, "light", ON_RECEIPT));
    }
  });

  it("leaves the focus ring alone: it is drawn outside the paper, on the page", () => {
    expect(rawValue(ON_RECEIPT, "--focus")).toBeNull();
  });
});

describe("why the scope exists", () => {
  it("the dark-mode stamp and muted text would fail on cream without it", () => {
    const paper = colour("--receipt-paper", "dark");
    expect(contrast(colour("--stamp", "dark"), paper)).toBeLessThan(4.5);
    expect(contrast(colour("--muted", "dark"), paper)).toBeLessThan(4.5);
  });
});

describe("stamp thump", () => {
  const MOTION = blockAfter(CSS, "@media (prefers-reduced-motion: no-preference)");

  it("is defined inside the no-preference media query", () => {
    expect(MOTION).toContain(".stamp-thump");
    expect(MOTION).toMatch(/animation:\s*stamp-thump/);
  });

  it("is not defined anywhere else, so reduced motion gets a static stamp", () => {
    const outside = CSS.replace(MOTION, "");
    expect(outside).not.toMatch(/animation:\s*stamp-thump/);
    expect(outside).not.toMatch(/\.stamp-thump\s*\{/);
  });

  it("scales from 1.15 to 1 with an opacity lift, in 180ms, with the individual scale property", () => {
    const keyframes = blockAfter(CSS, "@keyframes stamp-thump");
    expect(keyframes).toMatch(/scale:\s*1\.15/);
    expect(keyframes).toMatch(/scale:\s*1;/);
    expect(keyframes).toContain("opacity");
    // `transform` would replace the stamp's own rotate; `scale` composes with it.
    expect(keyframes).not.toContain("transform");
    expect(MOTION).toContain("var(--dur-base)");
    expect(rawValue(LIGHT, "--dur-base")).toBe("180ms");
  });
});
