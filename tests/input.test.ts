import { describe, expect, it } from "vitest";
import {
  RANGES,
  applyDraftEdit,
  caretAfterDigits,
  clampInteger,
  countDigitsBefore,
  formatNumberInput,
  groupDigits,
  isNumericDraft,
  parseNumberInput,
  type NumberRange,
  type ParseResult,
} from "@/lib/input";

const PRICE = RANGES.unitPriceNgn;
const LAST_GOOD = 150000;

function parsePrice(text: string): ParseResult {
  return parseNumberInput(text, PRICE, LAST_GOOD);
}

describe("RANGES (DATA_MODEL §2.2)", () => {
  it("matches the documented limits", () => {
    expect(RANGES.unitPriceNgn).toEqual({ min: 0, max: 50000000 });
    expect(RANGES.quantity).toEqual({ min: 0, max: 999 });
    expect(RANGES.headcount).toEqual({ min: 1, max: 100 });
    expect(RANGES.groupSize).toEqual({ min: 1, max: 100 });
  });
});

describe("parseNumberInput: the DATA_MODEL §9.2 examples", () => {
  it('parses "1,500,000"', () => {
    expect(parsePrice("1,500,000")).toEqual({ status: "ok", value: 1500000 });
  });

  it('parses "1 500 000"', () => {
    expect(parsePrice("1 500 000")).toEqual({ status: "ok", value: 1500000 });
  });

  it('reverts "" to the last good value, flagged as empty', () => {
    expect(parsePrice("")).toEqual({ status: "reverted", value: LAST_GOOD, reason: "empty" });
  });

  it('reverts "abc" to the last good value, flagged as invalid', () => {
    expect(parsePrice("abc")).toEqual({ status: "reverted", value: LAST_GOOD, reason: "invalid" });
  });
});

describe('parseNumberInput: "1,5" never gives NaN or a half value', () => {
  it("strips the comma like any other separator, so it is the whole number 15", () => {
    // Commas are thousands separators here (DATA_MODEL §2.2), never decimals.
    expect(parsePrice("1,5")).toEqual({ status: "ok", value: 15 });
  });

  it("rejects a decimal point instead of rounding or truncating", () => {
    expect(parsePrice("1.5")).toEqual({ status: "reverted", value: LAST_GOOD, reason: "invalid" });
    expect(parsePrice("1,5.")).toEqual({ status: "reverted", value: LAST_GOOD, reason: "invalid" });
  });
});

describe("parseNumberInput: separators and whitespace", () => {
  const OK_CASES: ReadonlyArray<[string, number]> = [
    ["0", 0],
    ["7", 7],
    ["1,000", 1000],
    ["1,00,0", 1000], // odd grouping is still just digits
    [",,150,000,,", 150000],
    ["  150000  ", 150000],
    ["150\u00A0000", 150000], // no-break space
    ["150\u202F000", 150000], // narrow no-break space
    ["150\u2009000", 150000], // thin space
    ["1\t500", 1500],
    ["007", 7], // leading zeros accepted
    ["000", 0],
    ["0,0,7", 7],
  ];

  it.each(OK_CASES)("parses %j as %s", (text, expected) => {
    expect(parsePrice(text)).toEqual({ status: "ok", value: expected });
  });

  const EMPTY_CASES: readonly string[] = ["", " ", "   ", ",", " , ", "\u00A0", "\n"];

  it.each(EMPTY_CASES)("treats %j as empty", (text) => {
    expect(parsePrice(text)).toEqual({ status: "reverted", value: LAST_GOOD, reason: "empty" });
  });
});

describe("parseNumberInput: invalid input reverts", () => {
  const INVALID_CASES: readonly string[] = [
    "abc",
    "12abc",
    "abc12",
    "-5",
    "-0",
    "+5",
    "1e9",
    "1E3",
    "0x10",
    "1.5",
    ".5",
    "1_000",
    "₦150,000", // a pasted currency symbol is not stripped: the user sees the hint
    "15%",
    "٣٤٥", // Arabic-Indic digits are not ASCII digits
    "１２３", // full-width digits
    "NaN",
    "Infinity",
    "1/2",
    "٫", // Arabic decimal separator
  ];

  it.each(INVALID_CASES)("reverts %j", (text) => {
    expect(parsePrice(text)).toEqual({ status: "reverted", value: LAST_GOOD, reason: "invalid" });
  });
});

describe("parseNumberInput: clamping", () => {
  it("accepts exactly the max and clamps one above it", () => {
    expect(parsePrice("50,000,000")).toEqual({ status: "ok", value: 50000000 });
    expect(parsePrice("50,000,001")).toEqual({ status: "clamped", value: 50000000, bound: "max" });
  });

  it("accepts exactly the min", () => {
    expect(parsePrice("0")).toEqual({ status: "ok", value: 0 });
  });

  it("clamps up to 1 for a field whose minimum is 1 (headcount and group size)", () => {
    expect(parseNumberInput("0", RANGES.headcount, 4)).toEqual({
      status: "clamped",
      value: 1,
      bound: "min",
    });
    expect(parseNumberInput("1", RANGES.headcount, 4)).toEqual({ status: "ok", value: 1 });
  });

  it("clamps quantity above 999 and headcount above 100", () => {
    expect(parseNumberInput("1000", RANGES.quantity, 7)).toEqual({
      status: "clamped",
      value: 999,
      bound: "max",
    });
    expect(parseNumberInput("101", RANGES.headcount, 4)).toEqual({
      status: "clamped",
      value: 100,
      bound: "max",
    });
  });

  it("clamps absurdly long digit strings without losing precision or throwing", () => {
    const long20 = "9".repeat(20);
    const long400 = "9".repeat(400);
    expect(parsePrice(long20)).toEqual({ status: "clamped", value: 50000000, bound: "max" });
    expect(parsePrice(long400)).toEqual({ status: "clamped", value: 50000000, bound: "max" });
    expect(parsePrice(`${"0".repeat(30)}150000`)).toEqual({ status: "ok", value: 150000 });
  });

  it("clamps a 15-digit value (the longest converted to a number) to max", () => {
    expect(parsePrice("999,999,999,999,999")).toEqual({
      status: "clamped",
      value: 50000000,
      bound: "max",
    });
  });

  it("reverts to whatever lastGood it was given, even 0", () => {
    expect(parseNumberInput("abc", PRICE, 0)).toEqual({
      status: "reverted",
      value: 0,
      reason: "invalid",
    });
  });
});

describe("parseNumberInput: the result is always safe to write", () => {
  const RANGE_LIST: readonly NumberRange[] = [
    RANGES.unitPriceNgn,
    RANGES.quantity,
    RANGES.headcount,
    RANGES.groupSize,
  ];
  const SAMPLES: readonly string[] = [
    "", " ", "abc", "1,5", "1.5", "-1", "1e9", "0", "00", "1", "99", "100", "101",
    "999", "1000", "50,000,000", "50,000,001", "9".repeat(40), "\u0000", "💸", "NaN",
    "1 2 3", "٣", "0.0", "1,,,,2", "   7   ",
  ];

  it("never returns NaN, a fraction, or a value outside the range", () => {
    for (const range of RANGE_LIST) {
      const lastGood = range.min;
      for (const text of SAMPLES) {
        const result = parseNumberInput(text, range, lastGood);
        expect(Number.isSafeInteger(result.value)).toBe(true);
        expect(result.value).toBeGreaterThanOrEqual(range.min);
        expect(result.value).toBeLessThanOrEqual(range.max);
        if (result.status === "reverted") expect(result.value).toBe(lastGood);
      }
    }
  });
});

describe("clampInteger (the reducer's second line of defence)", () => {
  it("passes in-range integers through and clamps the rest", () => {
    expect(clampInteger(150000, PRICE)).toBe(150000);
    expect(clampInteger(-1, PRICE)).toBe(0);
    expect(clampInteger(99999999999, PRICE)).toBe(50000000);
    expect(clampInteger(0, RANGES.headcount)).toBe(1);
  });

  it("returns null for anything that is not a safe integer", () => {
    expect(clampInteger(Number.NaN, PRICE)).toBeNull();
    expect(clampInteger(Number.POSITIVE_INFINITY, PRICE)).toBeNull();
    expect(clampInteger(Number.NEGATIVE_INFINITY, PRICE)).toBeNull();
    expect(clampInteger(1.5, PRICE)).toBeNull();
    expect(clampInteger(Number.MAX_SAFE_INTEGER + 1, PRICE)).toBeNull();
  });
});

describe("formatting helpers", () => {
  const GROUP_CASES: ReadonlyArray<[string, string]> = [
    ["", ""],
    ["0", "0"],
    ["12", "12"],
    ["123", "123"],
    ["1234", "1,234"],
    ["1500000", "1,500,000"],
    ["50000000", "50,000,000"],
  ];

  it.each(GROUP_CASES)("groupDigits(%j) is %j", (digits, expected) => {
    expect(groupDigits(digits)).toBe(expected);
  });

  it("formatNumberInput shows a saved number as input text", () => {
    expect(formatNumberInput(0)).toBe("0");
    expect(formatNumberInput(150000)).toBe("150,000");
    expect(formatNumberInput(50000000)).toBe("50,000,000");
  });

  it("isNumericDraft accepts only digits, commas and whitespace", () => {
    expect(isNumericDraft("")).toBe(true);
    expect(isNumericDraft("1,500 000")).toBe(true);
    expect(isNumericDraft("abc")).toBe(false);
    expect(isNumericDraft("12a")).toBe(false);
    expect(isNumericDraft("1.5")).toBe(false);
    expect(isNumericDraft("-1")).toBe(false);
  });

  it("countDigitsBefore and caretAfterDigits agree with each other", () => {
    expect(countDigitsBefore("1,500,000", 0)).toBe(0);
    expect(countDigitsBefore("1,500,000", 2)).toBe(1); // just after the first comma
    expect(countDigitsBefore("1,500,000", 9)).toBe(7);
    expect(caretAfterDigits("1,500,000", 0)).toBe(0);
    expect(caretAfterDigits("1,500,000", 1)).toBe(1); // before the comma
    expect(caretAfterDigits("1,500,000", 2)).toBe(3);
    expect(caretAfterDigits("1,500,000", 7)).toBe(9);
    expect(caretAfterDigits("1,500,000", 99)).toBe(9); // past the end clamps
  });
});

describe("applyDraftEdit: separators as you type, caret stays put", () => {
  it("adds a comma when the number reaches 4 digits, caret stays at the end", () => {
    // "150" then the user types "0" at the end.
    expect(applyDraftEdit("150", "1500", 4, null)).toEqual({ text: "1,500", caret: 5 });
  });

  it("builds 1,500,000 digit by digit", () => {
    let text = "";
    for (const digit of "1500000") {
      const raw = text + digit;
      text = applyDraftEdit(text, raw, raw.length, null).text;
    }
    expect(text).toBe("1,500,000");
  });

  it("keeps the caret after the same digit when typing in the middle", () => {
    // "1,500" with "2" typed after the comma (caret was 2, so is 3 after typing).
    expect(applyDraftEdit("1,500", "1,2500", 3, null)).toEqual({ text: "12,500", caret: 2 });
  });

  it("keeps the caret when typing at the very start", () => {
    expect(applyDraftEdit("500", "9500", 1, null)).toEqual({ text: "9,500", caret: 1 });
  });

  it("reformats a pasted number with spaces and puts the caret at the end", () => {
    expect(applyDraftEdit("", "1 500 000", 9, null)).toEqual({ text: "1,500,000", caret: 9 });
    expect(applyDraftEdit("", "1500000", 7, null)).toEqual({ text: "1,500,000", caret: 9 });
  });

  it("removes a comma when a delete brings the number under 4 digits", () => {
    expect(applyDraftEdit("1,500", "1,50", 4, "backward")).toEqual({ text: "150", caret: 3 });
  });

  it("drops leading zeros but keeps a lone zero", () => {
    expect(applyDraftEdit("0", "05", 2, null)).toEqual({ text: "5", caret: 1 });
    expect(applyDraftEdit("", "0", 1, null)).toEqual({ text: "0", caret: 1 });
    expect(applyDraftEdit("0", "00", 2, null)).toEqual({ text: "0", caret: 1 });
    expect(applyDraftEdit("", "007", 3, null)).toEqual({ text: "7", caret: 1 });
  });

  it("returns empty text and caret 0 when everything is deleted", () => {
    expect(applyDraftEdit("5", "", 0, "backward")).toEqual({ text: "", caret: 0 });
  });

  it("leaves non-numeric text exactly as typed so blur can revert it with a hint", () => {
    expect(applyDraftEdit("", "abc", 3, null)).toEqual({ text: "abc", caret: 3 });
    expect(applyDraftEdit("12", "12a", 3, null)).toEqual({ text: "12a", caret: 3 });
    expect(applyDraftEdit("", "1.5", 3, null)).toEqual({ text: "1.5", caret: 3 });
  });
});

describe("applyDraftEdit: deleting a comma deletes the neighbouring digit", () => {
  it("Backspace right after a comma removes the digit before it", () => {
    // "1,500" caret after the comma (2). Backspace removes the comma only: raw "1500", caret 1.
    expect(applyDraftEdit("1,500", "1500", 1, "backward")).toEqual({ text: "500", caret: 0 });
  });

  it("Backspace over a comma in a longer number keeps the caret in place", () => {
    // "1,234,567" caret after the second comma (6). Raw after removing it: "1,234567", caret 5.
    expect(applyDraftEdit("1,234,567", "1,234567", 5, "backward")).toEqual({
      text: "123,567",
      caret: 3,
    });
  });

  it("Delete right before a comma removes the digit after it", () => {
    // "1,500" caret before the comma (1). Delete removes the comma: raw "1500", caret 1.
    expect(applyDraftEdit("1,500", "1500", 1, "forward")).toEqual({ text: "100", caret: 1 });
  });

  it("deleting a normal digit is not mistaken for deleting a separator", () => {
    expect(applyDraftEdit("1,500", "1,50", 4, "backward")).toEqual({ text: "150", caret: 3 });
    expect(applyDraftEdit("1,500", "1,500".replace("5", ""), 2, "forward").text).toBe("100");
  });

  it("never gets stuck: repeated Backspace over commas always shortens the number", () => {
    // Simulate pressing Backspace repeatedly with the caret at the end of the text.
    let text = "1,500,000";
    let caret = text.length;
    let guard = 0;
    while (text !== "" && guard < 20) {
      guard += 1;
      const before = text;
      // Browser: remove the char before the caret.
      const raw = text.slice(0, caret - 1) + text.slice(caret);
      const edit = applyDraftEdit(before, raw, caret - 1, "backward");
      text = edit.text;
      caret = edit.caret;
      expect(text.length).toBeLessThan(before.length);
    }
    expect(text).toBe("");
  });

  it("ignores a separator delete when there is no digit to take (caret at the start)", () => {
    expect(applyDraftEdit("1,500", "1500", 0, "backward")).toEqual({ text: "1,500", caret: 0 });
  });
});
