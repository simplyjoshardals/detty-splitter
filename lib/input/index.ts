/**
 * Numeric text input (DATA_MODEL.md §2.2 and §9.2, UI_PLAN.md §1.2 and §2.4).
 * Pure functions, no React, so every rule is testable without a DOM.
 *
 * Two jobs:
 * 1. `parseNumberInput` turns what the user typed into a safe, clamped integer, or
 *    reverts to the last good value. It never returns NaN, a fraction or a half value.
 * 2. The draft helpers reformat text as the user types (thousands separators) and work
 *    out where the caret should go, so the caret doesn't jump when commas appear.
 *
 * Whole numbers by default. A range with `decimals` (the exchange rates, T5.2) also takes a
 * decimal point: commas stay thousands separators and "." is the only decimal mark.
 */

export interface NumberRange {
  min: number;
  max: number;
  /** Digits allowed after the decimal point. Omitted or 0 means whole numbers only. */
  decimals?: number;
  /**
   * What a number outside min..max does. "clamp" (the default) snaps it to the nearest
   * bound; "revert" throws it away and keeps the last good value, because a typo like 15
   * for 1,500 would otherwise turn into a plausible-looking 50 (rates, T5.2).
   */
  onOutOfRange?: "clamp" | "revert";
}

/** Valid ranges from DATA_MODEL.md §2.2. The reducer and every field use these. */
export const RANGES = {
  unitPriceNgn: { min: 0, max: 50000000 },
  quantity: { min: 0, max: 999 },
  headcount: { min: 1, max: 100 },
  groupSize: { min: 1, max: 100 },
  /** Exchange rates, naira per 1 unit of foreign currency (DATA_MODEL §2.2). */
  rate: { min: 50, max: 100000, decimals: 2, onOutOfRange: "revert" },
} as const satisfies Record<string, NumberRange>;

/**
 * Result of parsing one input. A union, not three booleans (UI_PLAN §1.2 had
 * `{ value, clamped, reverted }`), so impossible combinations can't exist and the UI
 * can pick the right hint: which bound was hit, or why the input was thrown away.
 * `reverted` reasons: "empty" and "invalid" (not a number), "decimals" (more digits after
 * the point than the range allows) and "range" (outside the range, for `onOutOfRange: "revert"`).
 */
export type RevertReason = "empty" | "invalid" | "decimals" | "range";

export type ParseResult =
  | { status: "ok"; value: number }
  | { status: "clamped"; value: number; bound: "min" | "max" }
  | { status: "reverted"; value: number; reason: RevertReason };

/**
 * Longest digit string that is still exactly representable as a JS number.
 * Anything longer is far above every max in RANGES, so it clamps to max without
 * ever being converted to a (lossy) number.
 */
const MAX_EXACT_DIGITS = 15;

/**
 * Parses what the user typed.
 * - Commas and any whitespace (spaces, NBSP U+00A0, narrow NBSP U+202F, thin space
 *   U+2009, from keyboards or pasted text) are stripped first.
 * - What is left must be ASCII digits only, plus one "." when the range has `decimals`.
 *   Signs, exponents ("1e9"), letters and currency symbols are invalid, and so is a "." in a
 *   whole-number range ("1.5"). Nothing is silently rounded: more digits after the point than
 *   `decimals` reverts with reason "decimals".
 * - Empty (or whitespace only) and invalid input revert to `lastGood`.
 * - Out-of-range numbers clamp to the range, or revert to `lastGood` with reason "range"
 *   when the range says `onOutOfRange: "revert"`.
 * - Leading zeros are accepted ("007" is 7).
 * - The value is worked out in whole hundredths (or whatever `decimals` scales to), so
 *   "1,500.55" is exactly 1500.55.
 */
export function parseNumberInput(
  text: string,
  range: NumberRange,
  lastGood: number,
): ParseResult {
  const decimals = range.decimals ?? 0;
  const cleaned = text.replace(/[,\s]/g, "");
  if (cleaned === "") return { status: "reverted", value: lastGood, reason: "empty" };
  // No `u` flag: \d is ASCII 0-9 only, so other scripts' digits are invalid.
  const shape = decimals > 0 ? /^(?:\d+\.?\d*|\.\d+)$/ : /^\d+$/;
  if (!shape.test(cleaned)) {
    return { status: "reverted", value: lastGood, reason: "invalid" };
  }

  const [wholeText = "", fractionText = ""] = cleaned.split(".");
  if (fractionText.length > decimals) {
    return { status: "reverted", value: lastGood, reason: "decimals" };
  }

  const outside = (bound: "min" | "max"): ParseResult =>
    range.onOutOfRange === "revert"
      ? { status: "reverted", value: lastGood, reason: "range" }
      : { status: "clamped", value: range[bound], bound };

  const digits = wholeText.replace(/^0+(?=\d)/, "");
  if (digits.length > MAX_EXACT_DIGITS) return outside("max");

  const scale = 10 ** decimals;
  const scaled = Number(digits || "0") * scale + Number(fractionText.padEnd(decimals, "0") || "0");
  if (scaled > Math.round(range.max * scale)) return outside("max");
  if (scaled < Math.round(range.min * scale)) return outside("min");
  return { status: "ok", value: scaled / scale };
}

/**
 * Clamps a number that is already parsed (the reducer's second line of defence,
 * DATA_MODEL §2.2). Returns null for anything that isn't a safe integer (NaN, Infinity,
 * 1.5), so a bad value is ignored instead of being written to state.
 */
export function clampInteger(value: number, range: NumberRange): number | null {
  if (!Number.isSafeInteger(value)) return null;
  return Math.min(range.max, Math.max(range.min, value));
}

/**
 * `clampInteger` for a range with `decimals` (the rates). Always clamps, whatever the range's
 * `onOutOfRange` says: that setting is about typed text, and the reducer must never hold a
 * value outside the range. Returns null for NaN, Infinity and anything with more decimals than
 * the range allows (1500.555), so a bad value is ignored instead of being written to state.
 */
export function clampDecimal(value: number, range: NumberRange): number | null {
  if (!Number.isFinite(value)) return null;
  if (value >= range.max) return range.max;
  if (value <= range.min) return range.min;
  const scale = 10 ** (range.decimals ?? 0);
  const scaled = Math.round(value * scale);
  // 1500.55 * 100 is 150055.00000000003 in floating point, so allow a tiny error.
  if (Math.abs(scaled - value * scale) > 1e-6) return null;
  return scaled / scale;
}

/** Inserts a comma between every group of three digits: "1500000" -> "1,500,000". */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** A saved number as input text: 1500000 -> "1,500,000", 1500.5 -> "1,500.5". */
export function formatNumberInput(value: number): string {
  const [whole = "", fraction] = String(value).split(".");
  return fraction === undefined ? groupDigits(whole) : `${groupDigits(whole)}.${fraction}`;
}

/**
 * True when the text holds only digits, commas and whitespace (the live-formatted kind),
 * plus one "." followed by digits when `decimals` is above 0.
 */
export function isNumericDraft(text: string, decimals = 0): boolean {
  return decimals > 0 ? /^[\d,\s]*(?:\.\d*)?$/.test(text) : /^[\d,\s]*$/.test(text);
}

/** How many characters matching `counted` sit before `end` (a caret position) in `text`. */
function countBefore(text: string, end: number, counted: RegExp): number {
  return [...text.slice(0, end)].filter((ch) => counted.test(ch)).length;
}

/** The caret position right after the `count`-th character of `text` matching `counted`. */
function caretAfter(text: string, count: number, counted: RegExp): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (counted.test(text.charAt(i))) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return text.length;
}

/** How many digits sit before `end` (a caret position) in `text`. */
export function countDigitsBefore(text: string, end: number): number {
  return countBefore(text, end, /\d/);
}

/** The caret position that sits right after the `count`-th digit of `text` (0 = start). */
export function caretAfterDigits(text: string, count: number): number {
  return caretAfter(text, count, /\d/);
}

export interface DraftEdit {
  text: string;
  caret: number;
}

/**
 * Reformats the field text after each edit and works out where the caret goes.
 *
 * - Text that isn't purely digits and separators (a pasted "abc") is left exactly as
 *   typed, so the user can see it before blur reverts it with a hint.
 * - Otherwise the digits are regrouped with commas and leading zeros dropped, and the
 *   caret is put back after the same number of digits it followed before, so adding a
 *   comma never makes it jump.
 * - Deleting a comma changes nothing after regrouping, which would leave the caret
 *   stuck. So when an edit removed only a separator, the neighbouring digit goes
 *   instead: the one before the caret for Backspace, the one after it for Delete.
 * - With `decimals` above 0, one "." is allowed and kept as typed ("1,500." stays "1,500."),
 *   only the part before it is regrouped, and the caret counts the "." like a digit, so
 *   typing it never jumps the caret back across it. Digits after the point are not cut
 *   off here: too many is reported on blur, like any other bad number.
 *
 * `deletion` comes from the input event's `inputType` (deleteContentBackward and
 * deleteContentForward); pass null for any other edit.
 */
export function applyDraftEdit(
  previousText: string,
  rawText: string,
  rawCaret: number,
  deletion: "backward" | "forward" | null,
  decimals = 0,
): DraftEdit {
  if (!isNumericDraft(rawText, decimals)) return { text: rawText, caret: rawCaret };

  // What the caret is counted in: digits, and the decimal point when there is one.
  const counted = decimals > 0 ? /[\d.]/ : /\d/;
  const meaningful = (text: string) => [...text].filter((ch) => counted.test(ch)).join("");

  let kept = meaningful(rawText);
  let keptBeforeCaret = countBefore(rawText, rawCaret, counted);

  const removedOnlySeparator =
    deletion !== null &&
    isNumericDraft(previousText, decimals) &&
    rawText.length === previousText.length - 1 &&
    kept === meaningful(previousText);

  if (removedOnlySeparator) {
    // Index (0-based) of the character to drop.
    const target = deletion === "backward" ? keptBeforeCaret - 1 : keptBeforeCaret;
    if (target >= 0 && target < kept.length) {
      kept = kept.slice(0, target) + kept.slice(target + 1);
      keptBeforeCaret = target;
    }
  }

  const dot = kept.indexOf(".");
  const whole = dot === -1 ? kept : kept.slice(0, dot);
  const fraction = dot === -1 ? "" : kept.slice(dot);

  // Drop leading zeros ("05" -> "5") but keep a lone "0". The caret count shrinks with them.
  const stripped = whole.replace(/^0+(?=\d)/, "");
  keptBeforeCaret = Math.max(0, keptBeforeCaret - (whole.length - stripped.length));

  const text = groupDigits(stripped) + fraction;
  return { text, caret: caretAfter(text, keptBeforeCaret, counted) };
}
