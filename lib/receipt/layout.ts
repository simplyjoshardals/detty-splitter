import { seedFromAuthCode } from "./speckle";
/**
 * Canvas receipt layout (DESIGN.md §7, T7.2). Pure: a `ReceiptView` and a text measurer go in,
 * a flat list of draw operations comes out. No DOM and no canvas, so a Node test can check
 * clipping, text size and vertical fit with a fake measurer. `render.ts` is the thin shell that
 * supplies the real `measureText` and paints the operations.
 *
 * The layout does no maths: every amount is drawn exactly as `buildReceiptView` formatted it.
 */
import { RECEIPT_COPY, type ReceiptView } from "./view";

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
/** Essential text is never smaller than this (DESIGN §7). */
export const MIN_TEXT_PX = 30;

export type FontRole = "display" | "mono";
export type FontWeight = 400 | 700;
export interface FontSpec {
  role: FontRole;
  weight: FontWeight;
  size: number;
}
/** Colour roles, resolved once from the `--receipt-*` tokens by the renderer. */
export type ColorRole = "paper" | "ink" | "muted" | "stamp" | "danfo";
/** Width in px of `text` drawn in `font`. */
export type Measure = (text: string, font: FontSpec) => number;

export type DrawOp =
  | { kind: "rect"; x: number; y: number; width: number; height: number; color: ColorRole }
  | { kind: "rule"; y: number; color: ColorRole; lineWidth: number; dash: readonly number[] }
  | {
      kind: "text";
      text: string;
      x: number;
      y: number;
      font: FontSpec;
      color: ColorRole;
      align: "left" | "center" | "right";
      baseline: "alphabetic" | "middle";
    }
  | {
      kind: "stamp";
      centerX: number;
      centerY: number;
      width: number;
      height: number;
      /** Radians, negative is anticlockwise. */
      angle: number;
      lines: readonly string[];
      font: FontSpec;
      lineHeight: number;

      seed: number;
    };

export type LayoutResult =
  | {
      ok: true;
      ops: DrawOp[];
      /** Baseline of the lowest text above the bottom band. */
      lastBaseline: number;
      bottomBandTop: number;
    }
  | { ok: false; message: string };

export const PAD_X = 72;
export const CONTENT_W = CANVAS_WIDTH - PAD_X * 2;
const CENTER_X = CANVAS_WIDTH / 2;
/** Story/reel safe margin, top and bottom (DESIGN §7). */
export const MARGIN_Y = 140;
const TOP_BAND_H = 120;
const STRIPE_H = 12;
const BOTTOM_BAND_H = 100;
export const BOTTOM_BAND_TOP = CANVAS_HEIGHT - MARGIN_Y - BOTTOM_BAND_H;
/** Space kept between the last baseline and the bottom band. */
export const BAND_CLEARANCE = 24;
/** Minimum space between a label and its amount on one row. */
const AMOUNT_GAP = 24;
/** Same as the on-screen stamp (-4 degrees), so the PNG shows what the user saw. */
const STAMP_ANGLE = (-4 * Math.PI) / 180;
const STAMP_PAD_X = 36;
const STAMP_PAD_Y = 28;
const STAMP_LINE_H = 52;
const STAMP_BADGE_PX = 44;
/** Most spare height added at each of the four spots that take it (see `layoutReceipt`). */
const MAX_EXTRA = 28;
/** Spare height that is never handed out, so the last line does not sit right on the band. */
const BREATHING_ROOM = 32;
const STAMP_MAX_TEXT_W = 820;

// Vertical steps, in px, between one baseline and the next. DESIGN §7 does not fix these; they
// are sized so the worst case (two-line badge, two-line tagline, two-line customer copy) clears
// the bottom band.
const GAP = {
  header: 44,
  headerLine: 38,
  afterHeader: 24,
  rowLabel: 48,
  rowFormula: 32,
  rowStacked: 44,
  afterRows: 24,
  perPerson: 48,
  perPersonAmount: 80,
  group: 60,
  status: 54,
  beforeStamp: 20,
  tagline: 38,
  balance: 46,
  footerLine: 42,
  footerWrap: 38,
} as const;

/**
 * Largest size, stepping down 2px from `startSize`, at which `text` fits `maxWidth`. At the
 * `MIN_TEXT_PX` floor it stops shrinking and reports `fits: false` so the caller can decide.
 */
export function fitFontSize(
  text: string,
  role: FontRole,
  weight: FontWeight,
  maxWidth: number,
  startSize: number,
  measure: Measure,
): { size: number; fits: boolean } {
  for (let size = startSize; size > MIN_TEXT_PX; size -= 2) {
    if (measure(text, { role, weight, size }) <= maxWidth) return { size, fits: true };
  }
  const floor: FontSpec = { role, weight, size: MIN_TEXT_PX };
  return { size: MIN_TEXT_PX, fits: measure(text, floor) <= maxWidth };
}

function greedyWrap(words: readonly string[], maxWidth: number, font: FontSpec, measure: Measure): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (current !== "" && measure(candidate, font) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/**
 * Word-wraps `text` to `maxWidth`, then balances the lines (the canvas version of the screen's
 * `text-balance`) so a wrapped line never ends with one word alone. A word wider than `maxWidth`
 * stays on its own line; the caller checks the widths.
 */
export function wrapText(text: string, font: FontSpec, maxWidth: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter((word) => word !== "");
  const lines = greedyWrap(words, maxWidth, font, measure);
  if (lines.length < 2) return lines;
  // Narrowest width that still wraps to the same number of lines.
  let low = 0;
  let high = maxWidth;
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    if (greedyWrap(words, mid, font, measure).length === lines.length) high = mid;
    else low = mid;
  }
  return greedyWrap(words, high, font, measure);
}

/**
 * Lays out the whole receipt. Returns `ok: false` with a message when something cannot fit
 * (a text wider than its space at the 30px floor, or content running into the bottom band),
 * never a clipped drawing. The gaps are sized for the worst case, so a receipt with a short
 * badge and tagline would end with a dead band above the URL: when there is spare height, it
 * is laid out a second time with a little extra at four spots (below the lines, above the
 * stamp, above the tagline, above the balance line).
 */
export function layoutReceipt(view: ReceiptView, measure: Measure): LayoutResult {
  const first = build(view, measure, 0);
  if (!first.ok) return first;
  const spare = BOTTOM_BAND_TOP - BAND_CLEARANCE - first.lastBaseline;
  const extra = Math.min(MAX_EXTRA, Math.floor((spare - BREATHING_ROOM) / 4));
  return extra > 0 ? build(view, measure, extra) : first;
}

function build(view: ReceiptView, measure: Measure, extra: number): LayoutResult {
  const ops: DrawOp[] = [];
  const problems: string[] = [];

  const mono = (weight: FontWeight, size: number): FontSpec => ({ role: "mono", weight, size });
  const ensureFits = (text: string, font: FontSpec, maxWidth: number): void => {
    if (measure(text, font) > maxWidth) {
      problems.push(`"${text}" is wider than ${maxWidth}px at ${font.size}px`);
    }
  };
  const text = (
    value: string,
    x: number,
    y: number,
    font: FontSpec,
    color: ColorRole,
    align: "left" | "center" | "right",
    baseline: "alphabetic" | "middle" = "alphabetic",
  ): void => {
    ops.push({ kind: "text", text: value, x, y, font, color, align, baseline });
  };
  const centered = (value: string, y: number, font: FontSpec, color: ColorRole): void => {
    ensureFits(value, font, CONTENT_W);
    text(value, CENTER_X, y, font, color, "center");
  };
  const rule = (y: number, color: ColorRole, dash: readonly number[]): void => {
    ops.push({ kind: "rule", y, color, lineWidth: 3, dash });
  };

  /** A label on the left and an amount on the right; a long amount drops under its label. */
  const labelAndAmount = (
    label: string,
    labelFont: FontSpec,
    amount: string,
    amountStart: number,
    y: number,
  ): number => {
    ensureFits(label, labelFont, CONTENT_W);
    text(label, PAD_X, y, labelFont, "ink", "left");
    const room = CONTENT_W - measure(label, labelFont) - AMOUNT_GAP;
    const beside = fitFontSize(amount, "mono", 700, room, amountStart, measure);
    if (beside.fits) {
      text(amount, CANVAS_WIDTH - PAD_X, y, mono(700, beside.size), "ink", "right");
      return y;
    }
    const below = fitFontSize(amount, "mono", 700, CONTENT_W, amountStart, measure);
    if (!below.fits) problems.push(`"${amount}" is wider than ${CONTENT_W}px at ${MIN_TEXT_PX}px`);
    const belowY = y + GAP.rowStacked;
    text(amount, CANVAS_WIDTH - PAD_X, belowY, mono(700, below.size), "ink", "right");
    return belowY;
  };

  ops.push({ kind: "rect", x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT, color: "paper" });

  // Top danfo band and stripe.
  let y = MARGIN_Y;
  ops.push({ kind: "rect", x: 0, y, width: CANVAS_WIDTH, height: TOP_BAND_H, color: "danfo" });
  const title = view.title.toUpperCase();
  const titleFit = fitFontSize(title, "display", 400, CONTENT_W, 64, measure);
  if (!titleFit.fits) problems.push(`"${title}" is wider than ${CONTENT_W}px at ${MIN_TEXT_PX}px`);
  text(
    title,
    CENTER_X,
    y + TOP_BAND_H / 2,
    { role: "display", weight: 400, size: titleFit.size },
    "ink",
    "center",
    "middle",
  );
  y += TOP_BAND_H;
  ops.push({ kind: "rect", x: 0, y, width: CANVAS_WIDTH, height: STRIPE_H, color: "ink" });
  y += STRIPE_H;

  // POS header.
  RECEIPT_COPY.posHeader.forEach((line, i) => {
    y += i === 0 ? GAP.header : GAP.headerLine;
    centered(line, y, i === 0 ? mono(700, 38) : mono(400, 32), "ink");
  });
  y += GAP.afterHeader;
  rule(y, "muted", [14, 10]);

  // Line items: label, formula and your share. All the amounts share one size (the smallest that
  // lets every row fit), so the right-hand column does not look ragged.
  const labelFont = mono(400, 34);
  const fitted = view.lines.map((line) =>
    fitFontSize(line.yourShare, "mono", 700, CONTENT_W - measure(line.label, labelFont) - AMOUNT_GAP, 40, measure),
  );
  const lineSize = Math.min(40, ...fitted.filter((f) => f.fits).map((f) => f.size));
  for (const line of view.lines) {
    y += GAP.rowLabel;
    y = labelAndAmount(line.label, labelFont, line.yourShare, lineSize, y);
    y += GAP.rowFormula;
    ensureFits(line.formula, mono(400, MIN_TEXT_PX), CONTENT_W);
    text(line.formula, PAD_X, y, mono(400, MIN_TEXT_PX), "muted", "left");
  }

  // Double rule.
  y += GAP.afterRows + extra;
  rule(y, "ink", []);
  rule(y + 8, "ink", []);
  y += 8;

  // Totals: the per-person amount shrinks to fit the width, never below the floor.
  y += GAP.perPerson;
  text("PER PERSON", PAD_X, y, mono(700, 34), "ink", "left");
  const perPerson = fitFontSize(view.perPersonTotal, "mono", 700, CONTENT_W, 92, measure);
  if (!perPerson.fits) problems.push(`"${view.perPersonTotal}" is wider than ${CONTENT_W}px at ${MIN_TEXT_PX}px`);
  // The step scales with the size, so a large amount never crowds its label.
  y += Math.max(GAP.perPersonAmount, Math.round(perPerson.size * 0.72) + 28);
  text(view.perPersonTotal, CANVAS_WIDTH - PAD_X, y, mono(700, perPerson.size), "ink", "right");
  y += GAP.group;
  y = labelAndAmount(`GROUP (${view.groupSize})`, mono(700, 34), view.groupTotal, 44, y);

  y += GAP.status;
  centered(RECEIPT_COPY.status, y, mono(700, 34), "ink");

  // Ink stamp: badge in a double border, rotated, tagline beneath. The speckle texture is T7.3,
  // which can wrap the "stamp" operation; this one is the flat version.
  const badgeFont: FontSpec = { role: "display", weight: 400, size: STAMP_BADGE_PX };
  const badgeLines = wrapText(view.badge, badgeFont, STAMP_MAX_TEXT_W, measure);
  badgeLines.forEach((line) => ensureFits(line, badgeFont, STAMP_MAX_TEXT_W));
  const textWidth = Math.max(0, ...badgeLines.map((line) => measure(line, badgeFont)));
  const boxWidth = textWidth + STAMP_PAD_X * 2;
  const boxHeight = badgeLines.length * STAMP_LINE_H + STAMP_PAD_Y * 2;
  // How far the rotated corners stick out above and below the unrotated box.
  const tilt = Math.ceil((boxWidth / 2) * Math.sin(-STAMP_ANGLE) - (boxHeight / 2) * (1 - Math.cos(STAMP_ANGLE)));
  const boxTop = y + GAP.beforeStamp + extra + tilt;
  ops.push({
    kind: "stamp",
    centerX: CENTER_X,
    centerY: boxTop + boxHeight / 2,
    width: boxWidth,
    height: boxHeight,
    angle: STAMP_ANGLE,
    lines: badgeLines,
    font: badgeFont,
    lineHeight: STAMP_LINE_H,
    seed: seedFromAuthCode(view.authCode),
  });
  y = boxTop + boxHeight + tilt;

  const taglineFont = mono(400, MIN_TEXT_PX);
  const taglineLines = wrapText(view.tagline, taglineFont, CONTENT_W, measure);
  taglineLines.forEach((line, i) => {
    y += GAP.tagline + (i === 0 ? extra : 0);
    centered(line, y, taglineFont, "muted");
  });

  // Balance line and footer lines.
  y += GAP.balance + extra;
  centered(view.balanceLine, y, mono(700, MIN_TEXT_PX), "ink");
  y += GAP.footerLine;
  centered(`AUTH: ${view.authCode}`, y, mono(400, MIN_TEXT_PX), "muted");
  const copyLines = wrapText(RECEIPT_COPY.customerCopy, mono(400, MIN_TEXT_PX), CONTENT_W, measure);
  copyLines.forEach((line, i) => {
    y += i === 0 ? GAP.footerLine : GAP.footerWrap;
    centered(line, y, mono(400, MIN_TEXT_PX), "muted");
  });
  y += GAP.footerLine;
  centered(view.ratesNote, y, mono(400, MIN_TEXT_PX), "muted");
  const lastBaseline = y;
  if (lastBaseline + BAND_CLEARANCE > BOTTOM_BAND_TOP) {
    problems.push(`content ends at ${lastBaseline}px, past the bottom band at ${BOTTOM_BAND_TOP}px`);
  }

  // Bottom danfo band: the site URL watermark, above the bottom safe margin.
  ops.push({ kind: "rect", x: 0, y: BOTTOM_BAND_TOP, width: CANVAS_WIDTH, height: BOTTOM_BAND_H, color: "danfo" });
  const urlFit = fitFontSize(view.siteUrl, "mono", 700, CONTENT_W, 34, measure);
  if (!urlFit.fits) problems.push(`"${view.siteUrl}" is wider than ${CONTENT_W}px at ${MIN_TEXT_PX}px`);
  text(view.siteUrl, CENTER_X, BOTTOM_BAND_TOP + BOTTOM_BAND_H / 2, mono(700, urlFit.size), "ink", "center", "middle");

  if (problems.length > 0) return { ok: false, message: problems.join("; ") };
  return { ok: true, ops, lastBaseline, bottomBandTop: BOTTOM_BAND_TOP };
}
