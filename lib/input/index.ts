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
 * Integers only for now. Rates need 2 decimals (T5.2): add a `decimals` option to
 * `NumberRange` then, without changing existing callers.
 */

export interface NumberRange {
  min: number;
  max: number;
}

/** Valid ranges from DATA_MODEL.md §2.2. The reducer and every field use these. */
export const RANGES = {
  unitPriceNgn: { min: 0, max: 50000000 },
  quantity: { min: 0, max: 999 },
  headcount: { min: 1, max: 100 },
  groupSize: { min: 1, max: 100 },
} as const satisfies Record<string, NumberRange>;

/**
 * Result of parsing one input. A union, not three booleans (UI_PLAN §1.2 had
 * `{ value, clamped, reverted }`), so impossible combinations can't exist and the UI
 * can pick the right hint: which bound was hit, or why the input was thrown away.
 */
export type ParseResult =
  | { status: "ok"; value: number }
  | { status: "clamped"; value: number; bound: "min" | "max" }
  | { status: "reverted"; value: number; reason: "empty" | "invalid" };

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
 * - What is left must be ASCII digits only. Signs, decimals ("1.5"), exponents ("1e9"),
 *   letters and currency symbols are invalid. Nothing is silently rounded.
 * - Empty (or whitespace only) and invalid input revert to `lastGood`.
 * - Out-of-range numbers clamp to the range.
 * - Leading zeros are accepted ("007" is 7).
 */
export function parseNumberInput(
  text: string,
  range: NumberRange,
  lastGood: number,
): ParseResult {
  const cleaned = text.replace(/[,\s]/g, "");
  if (cleaned === "") return { status: "reverted", value: lastGood, reason: "empty" };
  // No `u` flag: \d is ASCII 0-9 only, so other scripts' digits are invalid.
  if (!/^\d+$/.test(cleaned)) {
    return { status: "reverted", value: lastGood, reason: "invalid" };
  }

  const digits = cleaned.replace(/^0+(?=\d)/, "");
  if (digits.length > MAX_EXACT_DIGITS) {
    return { status: "clamped", value: range.max, bound: "max" };
  }

  const value = Number(digits);
  if (value > range.max) return { status: "clamped", value: range.max, bound: "max" };
  if (value < range.min) return { status: "clamped", value: range.min, bound: "min" };
  return { status: "ok", value };
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

/** Inserts a comma between every group of three digits: "1500000" -> "1,500,000". */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** A saved number as input text: 1500000 -> "1,500,000". */
export function formatNumberInput(value: number): string {
  return groupDigits(String(value));
}

/** True when the text holds only digits, commas and whitespace (the live-formatted kind). */
export function isNumericDraft(text: string): boolean {
  return /^[\d,\s]*$/.test(text);
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}

/** How many digits sit before `end` (a caret position) in `text`. */
export function countDigitsBefore(text: string, end: number): number {
  return digitsOf(text.slice(0, end)).length;
}

/** The caret position that sits right after the `count`-th digit of `text` (0 = start). */
export function caretAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text.charAt(i))) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return text.length;
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
 *
 * `deletion` comes from the input event's `inputType` (deleteContentBackward and
 * deleteContentForward); pass null for any other edit.
 */
export function applyDraftEdit(
  previousText: string,
  rawText: string,
  rawCaret: number,
  deletion: "backward" | "forward" | null,
): DraftEdit {
  if (!isNumericDraft(rawText)) return { text: rawText, caret: rawCaret };

  let digits = digitsOf(rawText);
  let digitsBeforeCaret = countDigitsBefore(rawText, rawCaret);

  const removedOnlySeparator =
    deletion !== null &&
    isNumericDraft(previousText) &&
    rawText.length === previousText.length - 1 &&
    digits === digitsOf(previousText);

  if (removedOnlySeparator) {
    // Index (0-based) of the digit to drop.
    const target = deletion === "backward" ? digitsBeforeCaret - 1 : digitsBeforeCaret;
    if (target >= 0 && target < digits.length) {
      digits = digits.slice(0, target) + digits.slice(target + 1);
      digitsBeforeCaret = target;
    }
  }

  // Drop leading zeros ("05" -> "5") but keep a lone "0". The caret count shrinks with them.
  const stripped = digits.replace(/^0+(?=\d)/, "");
  digitsBeforeCaret = Math.max(0, digitsBeforeCaret - (digits.length - stripped.length));

  const text = groupDigits(stripped);
  return { text, caret: caretAfterDigits(text, digitsBeforeCaret) };
}
