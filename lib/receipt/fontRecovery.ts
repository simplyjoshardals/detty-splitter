/**
 * Brings a font back after its download failed (T9.2).
 *
 * A browser does not try a failed font again. Once a `FontFace` is in the `error` state it stays
 * there, so a second `document.fonts.load()` rejects at once with no request, even after the
 * network is back (checked in Chromium). The way out is a new `FontFace`: re-inserting the
 * `@font-face` rule that made the old one gives the browser one that downloads again.
 *
 * Plain TypeScript, no React. The browser objects it touches are passed in (`FontRecoveryEnv`),
 * so the tests use plain fakes.
 */

interface FaceLike {
  family: string;
  status: string;
}

interface RuleLike {
  cssText: string;
  /** Only a `CSSFontFaceRule` has it; that is how a font rule is told apart from the rest. */
  style?: { getPropertyValue: (name: string) => string };
}

interface SheetLike {
  cssRules: ArrayLike<RuleLike>;
  insertRule: (rule: string, index: number) => number;
  deleteRule: (index: number) => void;
}

export interface FontRecoveryEnv {
  /** `document.fonts` */
  faces: Iterable<FaceLike>;
  /** `document.styleSheets` */
  sheets: Iterable<SheetLike>;
}

/** A family name as a rule and a face write it: with or without quotes. */
function bareFamily(value: string): string {
  return value.replace(/["']/g, "").trim();
}

function browserEnv(): FontRecoveryEnv | null {
  if (typeof document === "undefined" || !document.fonts || !document.styleSheets) return null;
  return { faces: document.fonts, sheets: document.styleSheets };
}

/**
 * Re-creates the `@font-face` rules of every given family that has a face in the `error` state.
 * Families that are fine are left alone, so a healthy font is not downloaded again. Returns how
 * many rules were re-created. Never throws: a stylesheet that can't be read (another origin) or
 * edited is skipped, and the next `document.fonts.load()` then fails as before.
 */
export function reviveFailedFonts(
  families: ReadonlyArray<string>,
  env: FontRecoveryEnv | null = browserEnv(),
): number {
  if (env === null) return 0;
  const wanted = new Set(families.map(bareFamily));
  const broken = new Set<string>();
  for (const face of env.faces) {
    const family = bareFamily(face.family);
    if (face.status === "error" && wanted.has(family)) broken.add(family);
  }
  if (broken.size === 0) return 0;

  let revived = 0;
  for (const sheet of env.sheets) {
    let rules: ArrayLike<RuleLike>;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a stylesheet from another origin can't be read
    }
    // Backwards, so an index we have not visited yet never moves.
    for (let index = rules.length - 1; index >= 0; index--) {
      const rule = rules[index];
      if (rule === undefined || !rule.cssText.startsWith("@font-face")) continue;
      const family = bareFamily(rule.style?.getPropertyValue("font-family") ?? "");
      if (!broken.has(family)) continue;
      try {
        // Insert the copy first: if that throws, the original is still there.
        sheet.insertRule(rule.cssText, index);
        sheet.deleteRule(index + 1);
        revived += 1;
      } catch {
        // Leave this rule as it is.
      }
    }
  }
  return revived;
}