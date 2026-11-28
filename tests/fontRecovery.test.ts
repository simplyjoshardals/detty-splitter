import { describe, expect, it, vi } from "vitest";
import { reviveFailedFonts, type FontRecoveryEnv } from "@/lib/receipt/fontRecovery";

type Env = FontRecoveryEnv;
type Sheet = Env["sheets"] extends Iterable<infer S> ? S : never;

/** A stylesheet of plain objects: font rules and one ordinary rule, with spies on the edits. */
function sheetOf(families: string[], options: { insertThrows?: boolean } = {}) {
  const rules = families.map((family) =>
    family === "plain"
      ? { cssText: ".card { color: red; }" }
      : {
          cssText: `@font-face { font-family: "${family}"; src: url(/${family}.woff2); }`,
          style: { getPropertyValue: () => `"${family}"` },
        },
  );
  const insertRule = vi.fn((text: string, index: number) => {
    if (options.insertThrows) throw new Error("SyntaxError");
    rules.splice(index, 0, {
      cssText: text,
      style: { getPropertyValue: () => text.match(/font-family: "([^"]+)"/)?.[1] ?? "" },
    });
    return index;
  });
  const deleteRule = vi.fn((index: number) => void rules.splice(index, 1));
  const sheet: Sheet = { cssRules: rules, insertRule, deleteRule };
  return { sheet, rules, insertRule, deleteRule };
}

const face = (family: string, status: string) => ({ family, status });

describe("reviveFailedFonts", () => {
  it("re-creates the font rule of a family whose face failed", () => {
    const { sheet, rules, insertRule, deleteRule } = sheetOf(["Bungee", "plain"]);
    const revived = reviveFailedFonts(["Bungee"], {
      faces: [face("Bungee", "error")],
      sheets: [sheet],
    });
    expect(revived).toBe(1);
    expect(insertRule).toHaveBeenCalledTimes(1);
    expect(insertRule).toHaveBeenCalledWith(expect.stringContaining('font-family: "Bungee"'), 0);
    expect(deleteRule).toHaveBeenCalledWith(1); // the old rule, now pushed down by the copy
    expect(rules.map((r) => r.cssText.slice(0, 10))).toEqual(["@font-face", ".card { co"]);
  });

  it("leaves a healthy family alone, so it is not downloaded again", () => {
    const { sheet, insertRule, deleteRule } = sheetOf(["Bungee", "SpaceMono"]);
    const revived = reviveFailedFonts(["Bungee", "SpaceMono"], {
      faces: [face("Bungee", "loaded"), face("SpaceMono", "unloaded")],
      sheets: [sheet],
    });
    expect(revived).toBe(0);
    expect(insertRule).not.toHaveBeenCalled();
    expect(deleteRule).not.toHaveBeenCalled();
  });

  it("only touches the failed family, and only the families it was asked about", () => {
    const { sheet, insertRule } = sheetOf(["Bungee", "SpaceMono", "Other"]);
    const revived = reviveFailedFonts(["Bungee", "SpaceMono"], {
      faces: [face("Bungee", "loaded"), face("SpaceMono", "error"), face("Other", "error")],
      sheets: [sheet],
    });
    expect(revived).toBe(1);
    expect(insertRule).toHaveBeenCalledWith(expect.stringContaining("SpaceMono"), 1);
  });

  it("re-creates every rule of a family (one per unicode-range subset)", () => {
    const { sheet, rules } = sheetOf(["Bungee", "Bungee", "plain"]);
    const revived = reviveFailedFonts(["Bungee"], {
      faces: [face("Bungee", "error")],
      sheets: [sheet],
    });
    expect(revived).toBe(2);
    expect(rules).toHaveLength(3);
  });

  it("matches a family written with or without quotes", () => {
    const { sheet } = sheetOf(["Bungee"]);
    expect(
      reviveFailedFonts(["'Bungee'"], { faces: [face('"Bungee"', "error")], sheets: [sheet] }),
    ).toBe(1);
  });

  it("skips a stylesheet it cannot read and still handles the others", () => {
    const unreadable: Sheet = {
      get cssRules(): never {
        throw new DOMException("cross-origin", "SecurityError");
      },
      insertRule: vi.fn(() => 0),
      deleteRule: vi.fn(),
    };
    const { sheet } = sheetOf(["Bungee"]);
    const revived = reviveFailedFonts(["Bungee"], {
      faces: [face("Bungee", "error")],
      sheets: [unreadable, sheet],
    });
    expect(revived).toBe(1);
  });

  it("keeps the original rule when the copy cannot be inserted, and never throws", () => {
    const { sheet, rules, deleteRule } = sheetOf(["Bungee"], { insertThrows: true });
    const revived = reviveFailedFonts(["Bungee"], {
      faces: [face("Bungee", "error")],
      sheets: [sheet],
    });
    expect(revived).toBe(0);
    expect(deleteRule).not.toHaveBeenCalled();
    expect(rules).toHaveLength(1);
  });

  it("does nothing without a browser", () => {
    expect(reviveFailedFonts(["Bungee"], null)).toBe(0);
  });
});
