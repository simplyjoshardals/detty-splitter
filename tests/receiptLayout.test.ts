import { describe, expect, it } from "vitest";
import { TIERS } from "@/data/tiers";
import {
  BAND_CLEARANCE,
  BOTTOM_BAND_TOP,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MIN_TEXT_PX,
  PAD_X,
  fitFontSize,
  layoutReceipt,
  wrapText,
  type DrawOp,
  type FontSpec,
  type Measure,
} from "@/lib/receipt/layout";
import { RECEIPT_COPY, buildReceiptView, type ReceiptView } from "@/lib/receipt/view";
import { GOLDEN, MAX_VALUES } from "./fixtures";
import type { AppState, CurrencyCode } from "@/lib/types";

/**
 * A deliberately wide stand-in for the canvas: every character is 65% of the font size in mono
 * (Space Mono is about 61%) and 85% in the display font, so a layout that fits here has room to
 * spare with the real fonts. It cannot tell us what the real glyphs look like.
 */
const WIDE: Measure = (text, font) =>
  [...text].length * font.size * (font.role === "display" ? 0.85 : 0.65);

const GOLDEN_VIEW = buildReceiptView(GOLDEN);

function inCurrency(state: AppState, currency: CurrencyCode): AppState {
  return { ...state, currency };
}

/** The view for the max-values case, in the given currency, wearing the given tier's copy. */
function maxView(currency: CurrencyCode, tierIndex: number): ReceiptView {
  const tier = TIERS[tierIndex];
  if (tier === undefined) throw new RangeError("no such tier");
  return {
    ...buildReceiptView(inCurrency(MAX_VALUES, currency)),
    badge: tier.badge,
    tagline: tier.tagline,
    balanceLine: tier.balanceLine,
  };
}

function layoutOrFail(view: ReceiptView, measure: Measure = WIDE): DrawOp[] {
  const result = layoutReceipt(view, measure);
  if (!result.ok) throw new Error(result.message);
  return result.ops;
}

type TextOp = Extract<DrawOp, { kind: "text" }>;
type StampOp = Extract<DrawOp, { kind: "stamp" }>;

function textOps(ops: DrawOp[]): TextOp[] {
  return ops.filter((op): op is TextOp => op.kind === "text");
}

function stampOps(ops: DrawOp[]): StampOp[] {
  return ops.filter((op): op is StampOp => op.kind === "stamp");
}

/** Left and right edge of a text operation, from its anchor and alignment. */
function extent(op: TextOp, measure: Measure): { left: number; right: number } {
  const width = measure(op.text, op.font);
  if (op.align === "left") return { left: op.x, right: op.x + width };
  if (op.align === "right") return { left: op.x - width, right: op.x };
  return { left: op.x - width / 2, right: op.x + width / 2 };
}

const font = (size: number): FontSpec => ({ role: "mono", weight: 700, size });

describe("fitFontSize", () => {
  it("keeps the start size when the text already fits", () => {
    expect(fitFontSize("123", "mono", 700, 1000, 92, WIDE)).toEqual({ size: 92, fits: true });
  });

  it("steps down 2px at a time to the largest size that fits", () => {
    // Ten characters: 60px is 390 wide, 58px is 377 wide.
    const result = fitFontSize("1234567890", "mono", 700, 380, 60, WIDE);
    expect(result).toEqual({ size: 58, fits: true });
    expect(WIDE("1234567890", font(result.size))).toBeLessThanOrEqual(380);
    expect(WIDE("1234567890", font(result.size + 2))).toBeGreaterThan(380);
  });

  it("stops at the 30px floor and says it does not fit", () => {
    expect(fitFontSize("1234567890", "mono", 700, 100, 60, WIDE)).toEqual({ size: MIN_TEXT_PX, fits: false });
  });

  it("reports a fit exactly at the floor", () => {
    expect(fitFontSize("1234567890", "mono", 700, 196, 60, WIDE)).toEqual({ size: MIN_TEXT_PX, fits: true });
  });
});

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("SOFT LIFE", font(30), 900, WIDE)).toEqual(["SOFT LIFE"]);
  });

  it("returns no lines for empty text", () => {
    expect(wrapText("   ", font(30), 900, WIDE)).toEqual([]);
  });

  it("balances the lines instead of leaving one word alone", () => {
    // Greedy wrapping would put WON'T. alone on the second line.
    const lines = wrapText(RECEIPT_COPY.customerCopy, font(30), 936, WIDE);
    expect(lines).toHaveLength(2);
    expect(lines.join(" ")).toBe(RECEIPT_COPY.customerCopy);
    expect((lines[1] ?? "").split(" ").length).toBeGreaterThan(1);
    for (const line of lines) expect(WIDE(line, font(30))).toBeLessThanOrEqual(936);
  });

  it("puts a word wider than the space on its own line", () => {
    expect(wrapText("AB SUPERCALIFRAGILISTIC CD", font(30), 100, WIDE)).toEqual([
      "AB",
      "SUPERCALIFRAGILISTIC",
      "CD",
    ]);
  });
});

describe("layoutReceipt: bands and content", () => {
  const ops = layoutOrFail(GOLDEN_VIEW);

  it("paints the paper, then the 140px safe margins around the danfo bands", () => {
    expect(ops[0]).toEqual({ kind: "rect", x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, color: "paper" });
    const top = ops[1];
    expect(top).toMatchObject({ kind: "rect", y: 140, color: "danfo" });
    const bottom = ops.find((op) => op.kind === "rect" && op.y === BOTTOM_BAND_TOP);
    expect(bottom).toMatchObject({ kind: "rect", color: "danfo" });
    if (bottom?.kind !== "rect") throw new Error("no bottom band");
    expect(bottom.y + bottom.height).toBe(CANVAS_HEIGHT - 140);
  });

  it("draws every string of the view exactly as formatted, and the fixed copy", () => {
    const drawn = new Set(textOps(ops).map((op) => op.text));
    const expected = [
      GOLDEN_VIEW.title.toUpperCase(),
      ...RECEIPT_COPY.posHeader,
      RECEIPT_COPY.status,
      ...GOLDEN_VIEW.lines.flatMap((line) => [line.label, line.formula, line.yourShare]),
      GOLDEN_VIEW.perPersonTotal,
      GOLDEN_VIEW.groupTotal,
      `GROUP (${GOLDEN_VIEW.groupSize})`,
      GOLDEN_VIEW.balanceLine,
      `AUTH: ${GOLDEN_VIEW.authCode}`,
      GOLDEN_VIEW.ratesNote,
      GOLDEN_VIEW.siteUrl,
    ];
    for (const text of expected) expect(drawn.has(text)).toBe(true);
    // The wrapped lines rebuild the original sentences.
    const copy = textOps(ops).filter((op) => RECEIPT_COPY.customerCopy.includes(op.text) && op.text.length > 20);
    expect(copy.map((op) => op.text).join(" ")).toBe(RECEIPT_COPY.customerCopy);
    expect(stampOps(ops).map((op) => op.lines.join(" "))).toEqual([GOLDEN_VIEW.badge]);
  });

  it("draws all five line amounts at one size, even when some labels are long", () => {
    for (const view of [GOLDEN_VIEW, maxView("NGN", 3), maxView("USD", 3)]) {
      const amounts = textOps(layoutOrFail(view)).filter((op) =>
        view.lines.some((line) => line.yourShare === op.text),
      );
      expect(amounts).toHaveLength(5);
      expect(new Set(amounts.map((op) => op.font.size)).size).toBe(1);
    }
  });

  it("uses spare height on a short receipt but never crosses the bottom band", () => {
    const result = layoutReceipt(GOLDEN_VIEW, WIDE);
    if (!result.ok) throw new Error(result.message);
    expect(result.lastBaseline + BAND_CLEARANCE).toBeLessThanOrEqual(result.bottomBandTop);
    // The spare height is spread out, so at most the rounding remainder of it is left over.
    expect(result.bottomBandTop - BAND_CLEARANCE - result.lastBaseline).toBeLessThan(120);
  });

  it("draws the ₦ in the amounts and formulas", () => {
    const naira = textOps(ops).filter((op) => op.text.includes("₦"));
    expect(naira.length).toBeGreaterThanOrEqual(12);
  });

  it("draws the flat stamp tilted -4 degrees, like the screen, in the stamp colour", () => {
    const [stamp] = stampOps(ops);
    expect(stamp?.angle).toBeCloseTo((-4 * Math.PI) / 180, 10);
    expect(stamp?.centerX).toBe(CANVAS_WIDTH / 2);
  });

  it("uses only the colour roles the tokens provide", () => {
    const roles = new Set(ops.map((op) => ("color" in op ? op.color : "stamp")));
    for (const role of roles) expect(["paper", "ink", "muted", "stamp", "danfo"]).toContain(role);
  });

  it("is deterministic: the same view and measurer give the same operations", () => {
    expect(layoutOrFail(GOLDEN_VIEW)).toEqual(ops);
  });
});

describe("layoutReceipt: the max-values case in every currency and tier", () => {
  const currencies: CurrencyCode[] = ["NGN", "USD", "GBP"];

  for (const currency of currencies) {
    for (let tierIndex = 0; tierIndex < TIERS.length; tierIndex++) {
      const label = `${currency}, tier ${tierIndex + 1}`;
      const view = maxView(currency, tierIndex);
      const result = layoutReceipt(view, WIDE);

      it(`${label}: fits, with no text under 30px`, () => {
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        for (const op of textOps(result.ops)) expect(op.font.size).toBeGreaterThanOrEqual(MIN_TEXT_PX);
        for (const stamp of stampOps(result.ops)) expect(stamp.font.size).toBeGreaterThanOrEqual(MIN_TEXT_PX);
      });

      it(`${label}: no digit is clipped and no label meets its amount`, () => {
        if (!result.ok) throw new Error(result.message);
        const texts = textOps(result.ops);
        for (const op of texts) {
          const { left, right } = extent(op, WIDE);
          expect(left).toBeGreaterThanOrEqual(PAD_X - 0.001);
          expect(right).toBeLessThanOrEqual(CANVAS_WIDTH - PAD_X + 0.001);
        }
        // Texts on one baseline (a label and its amount) keep a gap between them.
        for (const left of texts.filter((op) => op.align === "left")) {
          for (const right of texts.filter((op) => op.align === "right" && op.y === left.y)) {
            expect(extent(right, WIDE).left - extent(left, WIDE).right).toBeGreaterThanOrEqual(24 - 0.001);
          }
        }
      });

      it(`${label}: the stamp stays on the canvas and the content clears the bottom band`, () => {
        if (!result.ok) throw new Error(result.message);
        for (const stamp of stampOps(result.ops)) {
          const tilt = Math.abs(stamp.angle);
          const spanX = stamp.width * Math.cos(tilt) + stamp.height * Math.sin(tilt);
          expect(stamp.centerX - spanX / 2).toBeGreaterThanOrEqual(PAD_X / 2);
          expect(stamp.centerX + spanX / 2).toBeLessThanOrEqual(CANVAS_WIDTH - PAD_X / 2);
        }
        expect(result.lastBaseline + BAND_CLEARANCE).toBeLessThanOrEqual(result.bottomBandTop);
      });
    }
  }

  it("keeps the exact per-person and group totals in the text", () => {
    const view = maxView("NGN", 4);
    expect(view.perPersonTotal).toBe("₦249,750,000,000");
    expect(view.groupTotal).toBe("₦24,975,000,000,000");
    const drawn = textOps(layoutOrFail(view)).map((op) => op.text);
    expect(drawn).toContain("₦249,750,000,000");
    expect(drawn).toContain("₦24,975,000,000,000");
  });

  it("shrinks the per-person amount to fit but keeps the golden one at full size", () => {
    const sizeOf = (view: ReceiptView): number | undefined =>
      textOps(layoutOrFail(view)).find((op) => op.text === view.perPersonTotal)?.font.size;
    expect(sizeOf(GOLDEN_VIEW)).toBe(92);
    const shrunk = sizeOf(maxView("USD", 4));
    expect(shrunk).toBeLessThan(92);
    expect(shrunk).toBeGreaterThanOrEqual(MIN_TEXT_PX);
  });
});

describe("layoutReceipt: a long amount and failures", () => {
  it("drops an amount that cannot sit beside its label under the label, still right-aligned", () => {
    const longAmount = `₦${"9".repeat(24)}`;
    const view: ReceiptView = {
      ...GOLDEN_VIEW,
      lines: GOLDEN_VIEW.lines.map((line, i) => (i === 0 ? { ...line, yourShare: longAmount } : line)),
    };
    const texts = textOps(layoutOrFail(view));
    const label = texts.find((op) => op.text === GOLDEN_VIEW.lines[0]?.label);
    const amount = texts.find((op) => op.text === longAmount);
    const formula = texts.find((op) => op.text === GOLDEN_VIEW.lines[0]?.formula);
    expect(label && amount && formula).toBeTruthy();
    if (!label || !amount || !formula) return;
    expect(amount.align).toBe("right");
    expect(amount.y).toBeGreaterThan(label.y);
    expect(formula.y).toBeGreaterThan(amount.y);
  });

  it("returns a typed failure, not a clipped drawing, when an amount cannot fit at 30px", () => {
    const view: ReceiptView = { ...GOLDEN_VIEW, perPersonTotal: `₦${"9".repeat(80)}` };
    const result = layoutReceipt(view, WIDE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("wider than");
  });

  it("returns a typed failure when the content would run into the bottom band", () => {
    // A twelve-word badge wraps to six lines, which pushes the footer past the bottom band.
    const badge = Array.from({ length: 12 }, () => "PROFESSIONAL").join(" ");
    const result = layoutReceipt({ ...GOLDEN_VIEW, badge }, WIDE);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("bottom band");
  });
});
