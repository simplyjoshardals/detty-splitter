/**
 * Share-link codec, format v1 (DATA_MODEL.md §4). Pure functions: no React, no storage, no
 * DOM, so every rule is testable in plain Node.
 *
 * The link is hostile input. `decodeShare` never throws: it returns a typed result, and the
 * caller (T8.2) loads the default scenario on any `ok: false`. Structural problems reject the
 * whole link; out-of-range numbers are clamped and reported in `clamped`. `encodeShare`
 * rebuilds the string from the state it is given and never echoes anything read from a link.
 */
import { BUCKET_ORDER } from "@/data/buckets";
import { RANGES } from "@/lib/input";
import type { AppState, Bucket, BucketId, CurrencyCode, Mode, PresetId } from "@/lib/types";

/** A numeric field that was clamped on decode, so the UI can hint at it (UI_PLAN §1.1). */
export type FieldName =
  | "groupSize"
  | "ngnPerUsd"
  | "ngnPerGbp"
  | `${BucketId}.${"unitPriceNgn" | "quantity" | "headcount"}`;

export type DecodeFailure =
  "empty" | "too_long" | "bad_chars" | "bad_version" | "bad_structure" | "bad_value";

export type DecodeResult =
  { ok: true; state: AppState; clamped: FieldName[] } | { ok: false; code: DecodeFailure };

/** Longest accepted input, including the leading "#" (DATA_MODEL §4.4 step 2). */
export const MAX_LINK_LENGTH = 300;

const VERSION = "v1";
/** Version, preset, currency, group, two rates, five buckets. */
const FIELD_COUNT = 11;
/** Digits, the version letter, `b s f p`, `N U G`, "." and "-". Nothing else (§4.1). */
const DISALLOWED_CHARS = /[^0-9vbsfpNUG.-]/;
/** A canonical whole number: no sign, no leading zeros (a lone "0" is fine). */
const WHOLE_NUMBER = /^(?:0|[1-9][0-9]*)$/;

/**
 * Longest digit string read per field. Well above every legal value, so a hand-edited
 * number still clamps (₦99 billion has 11 digits) while an absurd one is rejected.
 */
const MAX_DIGITS = { price: 12, quantity: 6, headcount: 6, group: 6, rate: 10 } as const;

/** Rates travel as whole hundredths (rate × 100), so the link has no decimal point. */
const RATE_HUNDREDTHS = { min: RANGES.rate.min * 100, max: RANGES.rate.max * 100 } as const;

const PRESET_CODES = { budget: "b", soft: "s", baller: "f" } as const satisfies Record<
  PresetId,
  string
>;
const CURRENCY_CODES = { NGN: "N", USD: "U", GBP: "G" } as const satisfies Record<
  CurrencyCode,
  string
>;
const MODE_CODES = { shared: "s", perPerson: "p" } as const satisfies Record<Mode, string>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fromCode<T extends string>(table: Record<T, string>, code: string): T | null {
  for (const key of Object.keys(table) as T[]) {
    if (table[key] === code) return key;
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------------------

function toWhole(value: number, range: { readonly min: number; readonly max: number }): number {
  return Number.isFinite(value) ? clamp(Math.round(value), range.min, range.max) : range.min;
}

function encodeBucket(bucket: Bucket): string {
  return [
    toWhole(bucket.unitPriceNgn, RANGES.unitPriceNgn),
    toWhole(bucket.quantity, RANGES.quantity),
    MODE_CODES[bucket.mode],
    toWhole(bucket.headcount, RANGES.headcount),
  ].join(".");
}

/**
 * The share link for a state, with its leading "#" (§4.1). Numbers are clamped into their
 * ranges first, so the result always decodes. A valid state round-trips exactly.
 */
export function encodeShare(state: AppState): string {
  const fields = [
    VERSION,
    PRESET_CODES[state.presetId],
    CURRENCY_CODES[state.currency],
    toWhole(state.groupSize, RANGES.groupSize),
    toWhole(state.rates.ngnPerUsd * 100, RATE_HUNDREDTHS),
    toWhole(state.rates.ngnPerGbp * 100, RATE_HUNDREDTHS),
    ...state.buckets.map(encodeBucket),
  ];
  return `#${fields.join("-")}`;
}

// ---------------------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------------------

const fail = (code: DecodeFailure): DecodeResult => ({ ok: false, code });

/** A canonical whole number of at most `maxDigits` digits, clamped; null if malformed. */
function readClamped(
  text: string,
  maxDigits: number,
  range: { readonly min: number; readonly max: number },
  name: FieldName,
  clamped: FieldName[],
): number | null {
  if (text.length > maxDigits || !WHOLE_NUMBER.test(text)) return null;
  const value = Number(text); // at most 12 digits, so exact
  const result = clamp(value, range.min, range.max);
  if (result !== value) clamped.push(name);
  return result;
}

/** One bucket from its four dot-fields (the count was checked by the caller). */
function readBucket(id: BucketId, fields: readonly string[], clamped: FieldName[]): Bucket | null {
  const [price, quantity, modeCode, headcount] = fields;
  const { price: priceDigits, quantity: quantityDigits, headcount: headcountDigits } = MAX_DIGITS;
  const unitPriceNgn = readClamped(
    price,
    priceDigits,
    RANGES.unitPriceNgn,
    `${id}.unitPriceNgn`,
    clamped,
  );
  const qty = readClamped(quantity, quantityDigits, RANGES.quantity, `${id}.quantity`, clamped);
  const people = readClamped(
    headcount,
    headcountDigits,
    RANGES.headcount,
    `${id}.headcount`,
    clamped,
  );
  const mode = fromCode(MODE_CODES, modeCode);
  if (unitPriceNgn === null || qty === null || people === null || mode === null) return null;
  return { id, unitPriceNgn, quantity: qty, mode, headcount: people };
}

/**
 * Reads a share link, with or without its leading "#". Never throws. Checks in this order:
 * empty, length, character allow-list, version, field counts (all structure before any
 * value), then enums and numbers. The link is never decoded as a URL or injected as HTML.
 */
export function decodeShare(input: string): DecodeResult {
  if (input === "" || input === "#") return fail("empty");
  if (input.length > MAX_LINK_LENGTH) return fail("too_long");
  const body = input.startsWith("#") ? input.slice(1) : input;
  if (DISALLOWED_CHARS.test(body)) return fail("bad_chars");

  const parts = body.split("-");
  if (parts[0] !== VERSION) return fail("bad_version");
  if (parts.length !== FIELD_COUNT) return fail("bad_structure");
  const [, presetCode, currencyCode, groupText, usdText, gbpText, ...bucketTexts] = parts;
  const bucketFields = bucketTexts.map((text) => text.split("."));
  if (bucketFields.some((fields) => fields.length !== 4)) return fail("bad_structure");

  const presetId = fromCode(PRESET_CODES, presetCode);
  const currency = fromCode(CURRENCY_CODES, currencyCode);
  if (presetId === null || currency === null) return fail("bad_value");

  const clamped: FieldName[] = [];
  const groupSize = readClamped(
    groupText,
    MAX_DIGITS.group,
    RANGES.groupSize,
    "groupSize",
    clamped,
  );
  const usd = readClamped(usdText, MAX_DIGITS.rate, RATE_HUNDREDTHS, "ngnPerUsd", clamped);
  const gbp = readClamped(gbpText, MAX_DIGITS.rate, RATE_HUNDREDTHS, "ngnPerGbp", clamped);
  const [stay, events, tables, transport, food] = BUCKET_ORDER.map((id, i) =>
    readBucket(id, bucketFields[i], clamped),
  );
  if (groupSize === null || usd === null || gbp === null) return fail("bad_value");
  if (!stay || !events || !tables || !transport || !food) return fail("bad_value");

  return {
    ok: true,
    clamped,
    state: {
      presetId,
      currency,
      groupSize,
      rates: { ngnPerUsd: usd / 100, ngnPerGbp: gbp / 100 },
      buckets: [stay, events, tables, transport, food],
    },
  };
}
