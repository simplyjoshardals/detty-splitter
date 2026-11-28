import { afterEach, describe, expect, it, vi } from "vitest";
import { renderReceipt } from "@/lib/receipt/render";
import { SPECKLE_COUNT } from "@/lib/receipt/speckle";
import { buildReceiptView, type ReceiptView } from "@/lib/receipt/view";
import { GOLDEN, MAX_VALUES } from "./fixtures";

/**
 * jsdom has no canvas, so these tests stub the few browser APIs the renderer touches. They check
 * the order of events (fonts first, colours once), which families are used, and that every
 * failure comes back as a typed result. They cannot show what the pixels look like: that needs a
 * real browser (the exported PNG, checked on a phone).
 */

const VIEW = buildReceiptView(GOLDEN);

const CSS_VARS: Record<string, string> = {
  "--font-bungee": "'__Bungee_ab12', '__Bungee_Fallback_ab12'",
  "--font-space-mono": "'__Space_Mono_cd34', '__Space_Mono_Fallback_cd34'",
  "--font-naira": "'__naira_ef56'",
  "--receipt-paper": "#F4F1EA",
  "--receipt-ink": "#111111",
  "--receipt-muted": "#5C584F",
  "--receipt-stamp": "#C4271B",
  "--receipt-danfo": "#FFC400",
};

interface Setup {
  /** Everything that happened, in order. */
  events: string[];
  /** Every `ctx.font` value assigned. */
  fontsSet: string[];
  /** Every colour assigned to `fillStyle`. */
  fills: string[];
  /** Names of the CSS variables read. */
  varReads: string[];

  arcs: string[];

  drawImages: number;

  composites: string[];
}

interface Options {
  vars?: Record<string, string>;
  load?: (spec: string, sample: string) => Promise<unknown[]>;
  context?: "ok" | "missing";
  layerContext?: "ok" | "missing";
  blob?: "ok" | "null";
  failOnFillText?: boolean;
}

function stubBrowser(options: Options = {}): Setup {
  const setup: Setup = {
    events: [],
    fontsSet: [],
    fills: [],
    varReads: [],
    arcs: [],
    drawImages: 0,
    composites: [],
  };
  const vars = options.vars ?? CSS_VARS;
  const makeCtx = () => ({
    set font(value: string) {
      setup.fontsSet.push(value);
    },
    set fillStyle(value: string) {
      setup.fills.push(value);
    },
    set globalCompositeOperation(value: string) {
      setup.composites.push(value);
    },
    strokeStyle: "",
    lineWidth: 0,
    textAlign: "left",
    textBaseline: "alphabetic",
    measureText: (text: string) => ({ width: text.length * 20 }),
    fillRect: () => setup.events.push("draw"),
    fillText: () => {
      if (options.failOnFillText) throw new Error("boom");
      setup.events.push("draw");
    },
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    setLineDash: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    strokeRect: () => undefined,
    arc: (x: number, y: number, r: number) =>
      setup.arcs.push(`${x.toFixed(3)},${y.toFixed(3)},${r.toFixed(3)}`),
    fill: () => undefined,
    drawImage: () => {
      setup.drawImages += 1;
    },
  });
  let canvases = 0;
  const makeCanvas = () => {
    const ctx = makeCtx();
    const isLayer = canvases > 0;
    canvases += 1;
    return {
      width: 0,
      height: 0,
      getContext: () =>
        options.context === "missing" || (isLayer && options.layerContext === "missing")
          ? null
          : ctx,
      toBlob: (callback: (blob: Blob | null) => void) =>
        callback(options.blob === "null" ? null : new Blob(["png"], { type: "image/png" })),
    };
  };
  vi.stubGlobal("document", {
    documentElement: {},
    createElement: () => makeCanvas(),
    fonts: {
      load: (spec: string, sample: string) => {
        setup.events.push(`load ${spec}`);
        return options.load ? options.load(spec, sample) : Promise.resolve([{}]);
      },
      check: () => true,
    },
  });
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (name: string) => {
      setup.varReads.push(name);
      return ` ${vars[name] ?? ""} `;
    },
  }));
  return setup;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderReceipt: the happy path", () => {
  it("returns a PNG blob with diagnostics for every font", async () => {
    stubBrowser();
    const result = await renderReceipt(VIEW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.blob.type).toBe("image/png");
    expect(result.diagnostics.blobBytes).toBe(3);
    expect(result.diagnostics.fonts.map((f) => f.label)).toEqual([
      "Space Mono 400",
      "Space Mono 700",
      "Bungee 400",
      "Naira (₦)",
    ]);
  });

  it("loads every font before the first thing is drawn", async () => {
    const setup = stubBrowser();
    await renderReceipt(VIEW);
    const firstDraw = setup.events.indexOf("draw");
    const loads = setup.events.filter((e) => e.startsWith("load "));
    expect(loads).toHaveLength(4);
    expect(firstDraw).toBeGreaterThan(-1);
    expect(setup.events.lastIndexOf(loads[loads.length - 1] ?? "")).toBeLessThan(firstDraw);
  });

  it("loads by the first family only, never the next/font fallback face", async () => {
    const setup = stubBrowser();
    await renderReceipt(VIEW);
    const loads = setup.events.filter((e) => e.startsWith("load "));
    expect(loads.join("\n")).not.toContain("Fallback");
    expect(loads).toContain("load 400 40px '__Space_Mono_cd34'");
    expect(loads).toContain("load 700 40px '__Space_Mono_cd34'");
    expect(loads).toContain("load 400 40px '__Bungee_ab12'");
    expect(loads).toContain("load 400 40px '__naira_ef56'");
    expect(setup.fontsSet.join("\n")).not.toContain("Fallback");
  });

  it("loads the naira face with the ₦ sample, because its unicode-range only downloads for it", async () => {
    const samples: Record<string, string> = {};
    stubBrowser({
      load: (spec, sample) => {
        samples[spec] = sample;
        return Promise.resolve([{}]);
      },
    });
    await renderReceipt(VIEW);
    expect(samples["400 40px '__naira_ef56'"]).toBe("₦");
  });

  it("draws mono text with the naira face first, then Space Mono, then monospace", async () => {
    const setup = stubBrowser();
    await renderReceipt(VIEW);
    const mono = setup.fontsSet.filter((f) => f.includes("monospace"));
    expect(mono.length).toBeGreaterThan(0);
    for (const font of mono) {
      expect(font).toMatch(/px '__naira_ef56', '__Space_Mono_cd34', monospace$/);
    }
    expect(setup.fontsSet.some((f) => f.endsWith("px '__Bungee_ab12', sans-serif"))).toBe(true);
  });

  it("resolves each --receipt-* colour exactly once and paints with them", async () => {
    const setup = stubBrowser();
    await renderReceipt(VIEW);
    const receiptReads = setup.varReads.filter((name) => name.startsWith("--receipt-"));
    expect(receiptReads.sort()).toEqual([
      "--receipt-danfo",
      "--receipt-ink",
      "--receipt-muted",
      "--receipt-paper",
      "--receipt-stamp",
    ]);
    for (const color of ["#F4F1EA", "#111111", "#5C584F", "#C4271B", "#FFC400"]) {
      expect(setup.fills).toContain(color);
    }
  });

  it("renders the max-values receipt", async () => {
    stubBrowser();
    const view: ReceiptView = buildReceiptView(MAX_VALUES);
    const result = await renderReceipt(view);
    expect(result.ok).toBe(true);
  });
});

describe("renderReceipt: the ink-stamp texture", () => {
  it("erases the speckles on an offscreen layer, never on the receipt canvas", async () => {
    const setup = stubBrowser();
    await renderReceipt(VIEW);
    expect(setup.arcs).toHaveLength(SPECKLE_COUNT);
    expect(setup.composites).toEqual(["destination-out"]);
    expect(setup.drawImages).toBe(1);
  });

  it("draws the same speckles for the same view", async () => {
    const first = stubBrowser();
    await renderReceipt(VIEW);
    const again = stubBrowser();
    await renderReceipt(VIEW);
    expect(again.arcs).toEqual(first.arcs);
  });

  it("draws different speckles for a view with another auth code", async () => {
    const first = stubBrowser();
    await renderReceipt(VIEW);
    const other = stubBrowser();
    await renderReceipt({
      ...VIEW,
      authCode: VIEW.authCode === "00000001" ? "00000002" : "00000001",
    });
    expect(other.arcs).toHaveLength(SPECKLE_COUNT);
    expect(other.arcs).not.toEqual(first.arcs);
  });

  it("draws no speckles, and no offscreen layer, when texture is off", async () => {
    const setup = stubBrowser();
    const result = await renderReceipt(VIEW, { texture: false });
    expect(result.ok).toBe(true);
    expect(setup.arcs).toHaveLength(0);
    expect(setup.composites).toHaveLength(0);
    expect(setup.drawImages).toBe(0);
  });

  it("falls back to the flat stamp when the offscreen layer has no 2D context", async () => {
    const setup = stubBrowser({ layerContext: "missing" });
    const result = await renderReceipt(VIEW);
    expect(result.ok).toBe(true);
    expect(setup.arcs).toHaveLength(0);
    expect(setup.drawImages).toBe(0);
  });

  it("renders the max-values receipt with the texture on", async () => {
    stubBrowser();
    expect((await renderReceipt(buildReceiptView(MAX_VALUES))).ok).toBe(true);
  });
});

describe("renderReceipt: failures are typed results, never throws", () => {
  it("reports a missing font variable as a font failure", async () => {
    const { "--font-naira": _naira, ...rest } = CSS_VARS;
    void _naira;
    stubBrowser({ vars: rest });
    const result = await renderReceipt(VIEW);
    expect(result).toMatchObject({ ok: false, reason: "font" });
    if (result.ok) return;
    expect(result.message).toContain("--font-naira");
  });

  it("reports a missing --receipt-* colour as a draw failure", async () => {
    const { "--receipt-stamp": _stamp, ...rest } = CSS_VARS;
    void _stamp;
    stubBrowser({ vars: rest });
    expect(await renderReceipt(VIEW)).toMatchObject({ ok: false, reason: "draw" });
  });

  it("reports a rejected font load as a font failure that names the font", async () => {
    stubBrowser({
      load: (spec) =>
        spec.includes("naira") ? Promise.reject(new Error("NetworkError")) : Promise.resolve([{}]),
    });
    const result = await renderReceipt(VIEW);
    expect(result).toMatchObject({ ok: false, reason: "font" });
    if (result.ok) return;
    expect(result.message).toContain("Naira");
    expect(result.message).toContain("NetworkError");
    expect(result.fonts).toHaveLength(4);
  });

  it("reports a font that loads zero faces as a font failure", async () => {
    stubBrowser({ load: () => Promise.resolve([]) });
    const result = await renderReceipt(VIEW);
    expect(result).toMatchObject({ ok: false, reason: "font" });
    if (result.ok) return;
    expect(result.message).toContain("0 faces loaded");
  });

  it("reports a missing 2D context as a draw failure", async () => {
    stubBrowser({ context: "missing" });
    expect(await renderReceipt(VIEW)).toMatchObject({ ok: false, reason: "draw" });
  });

  it("reports an exception while drawing as a draw failure", async () => {
    stubBrowser({ failOnFillText: true });
    const result = await renderReceipt(VIEW);
    expect(result).toMatchObject({ ok: false, reason: "draw" });
    if (result.ok) return;
    expect(result.message).toContain("boom");
  });

  it("reports a null blob as a blob failure", async () => {
    stubBrowser({ blob: "null" });
    expect(await renderReceipt(VIEW)).toMatchObject({ ok: false, reason: "blob" });
  });

  it("reports a receipt that cannot fit as a draw failure, without painting", async () => {
    const setup = stubBrowser();
    const result = await renderReceipt({ ...VIEW, perPersonTotal: `₦${"9".repeat(80)}` });
    expect(result).toMatchObject({ ok: false, reason: "draw" });
    expect(setup.events).not.toContain("draw");
  });
});
