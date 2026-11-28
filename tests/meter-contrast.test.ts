import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the damage meter colours (DESIGN §3.1, §10, T6.2 "meter text passes contrast").
 * It reads the real values from app/globals.css, so changing a colour there is checked here
 * without anyone updating a copy. Plain Node, no DOM.
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
const ON_METER = blockAfter(CSS, ".on-meter");

/** One custom property's value in a block, or null if the block does not set it. */
function rawValue(block: string, name: string): string | null {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(block);
  return match?.[1]?.replace(/\/\*.*?\*\//g, "").trim() ?? null;
}

/**
 * A colour as `#rrggbb`: dark mode overrides light, and one level of `var(--x)` is followed.
 * Light values are the base, because dark mode only redefines the properties that change.
 */
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

/** WCAG 2.x relative luminance. */
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

describe("contrast helper", () => {
  it("gives 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffc400", "#ffc400")).toBeCloseTo(1, 5);
  });
});

describe.each(["light", "dark"] as const)("damage meter colours, %s mode", (theme) => {
  const bg = colour("--meter-bg", theme);
  const fg = colour("--meter-fg", theme);

  it("digits, label and caption (yellow on the bar) pass 4.5:1", () => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("the See receipt button label (bar colour on yellow) passes 4.5:1", () => {
    // Same pair the other way round, so the same ratio; kept as its own case so a change that
    // gives the button different colours has to update this test.
    expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5);
  });

  it("the pressed button (bar colour on cream) passes 4.5:1", () => {
    expect(contrast(bg, colour("--receipt-paper", theme))).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring inside the .on-meter scope passes 3:1 on the bar", () => {
    expect(contrast(colour("--focus", theme, ON_METER), bg)).toBeGreaterThanOrEqual(3);
  });

  it("the focus ring is not the yellow of the button it surrounds", () => {
    expect(colour("--focus", theme, ON_METER)).not.toBe(fg);
  });

  it("makes ink and muted follow the meter digits, so shared controls stay readable", () => {
    expect(colour("--ink", theme, ON_METER)).toBe(fg);
    expect(colour("--muted", theme, ON_METER)).toBe(fg);
  });
});

describe("damage meter edge against the page", () => {
  it("the yellow top border (dark mode) passes 3:1 against the page", () => {
    expect(
      contrast(colour("--meter-fg", "dark"), colour("--paper", "dark")),
    ).toBeGreaterThanOrEqual(3);
  });

  it("the bar itself separates from the page in light mode", () => {
    expect(
      contrast(colour("--meter-bg", "light"), colour("--paper", "light")),
    ).toBeGreaterThanOrEqual(3);
  });
});
