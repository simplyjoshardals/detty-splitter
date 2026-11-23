import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FONT = new URL("../app/fonts/naira.woff2", import.meta.url);
const LICENCE = new URL("../app/fonts/OFL-SpaceGrotesk.txt", import.meta.url);

describe("the ₦ font file (app/fonts/naira.woff2)", () => {
  it("is a woff2 file, as small as a one-glyph subset", () => {
    expect(readFileSync(FONT).subarray(0, 4).toString("latin1")).toBe("wOF2");
    // The whole of Space Grotesk is about 130 KB. Anything near that means the subset was lost.
    expect(statSync(FONT).size).toBeLessThan(8 * 1024);
  });

  it("ships with the licence its font came from (SIL OFL 1.1 asks for it)", () => {
    const text = readFileSync(LICENCE, "utf8");
    expect(text).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(text).toContain("Space Grotesk Project Authors");
  });
});
