import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RATES, SITE_URL } from "@/config";
import { PRESET_ORDER } from "@/data/presets";
import { MAX_LINK_LENGTH, decodeShare, encodeShare, type DecodeFailure } from "@/lib/share";
import type { AppState } from "@/lib/types";
import { createInitialState, stateFromPreset } from "@/state/reducer";
import { GOLDEN, MAX_VALUES, mapBuckets } from "./fixtures";

/** The illustrative link from DATA_MODEL §4.1: USD, rates ₦1,500 and ₦1,900 (made up). */
const EXAMPLE =
  "#v1-s-U-4-150000-190000-150000.7.s.4-100000.3.p.4-800000.2.s.4-60000.7.s.4-40000.7.p.4";
const EXAMPLE_STATE: AppState = {
  ...GOLDEN,
  currency: "USD",
  rates: { ngnPerUsd: 1500, ngnPerGbp: 1900 },
};

/**
 * The example link with its fields changed by `change`. Indexes: 0 version, 1 preset,
 * 2 currency, 3 group, 4 usd rate, 5 gbp rate, 6 to 10 the buckets.
 */
function linkWith(change: (fields: string[]) => void): string {
  const fields = EXAMPLE.slice(1).split("-");
  change(fields);
  return `#${fields.join("-")}`;
}

function decodeOk(hash: string) {
  const result = decodeShare(hash);
  if (!result.ok) throw new Error(`expected ok, got ${result.code}`);
  return result;
}

afterEach(() => vi.unstubAllGlobals());

describe("the example link", () => {
  it("decodes to the worked example in USD, with or without the leading #", () => {
    expect(decodeShare(EXAMPLE)).toEqual({ ok: true, state: EXAMPLE_STATE, clamped: [] });
    expect(decodeShare(EXAMPLE.slice(1))).toEqual({ ok: true, state: EXAMPLE_STATE, clamped: [] });
  });

  it("is what the encoder writes for that state", () => {
    expect(encodeShare(EXAMPLE_STATE)).toBe(EXAMPLE);
  });
});

// DATA_MODEL §9.1. Every one of these must be rejected without throwing; the caller then
// loads the default scenario (T8.2). The code is asserted too, so each path is covered.
const REJECTED: [string, string, DecodeFailure][] = [
  ["1 empty", "", "empty"],
  ["1 hash only", "#", "empty"],
  ["2 version only", "#v1", "bad_structure"],
  ["3 wrong version", linkWith((f) => (f[0] = "v2")), "bad_version"],
  ["3 future version", linkWith((f) => (f[0] = "v10")), "bad_version"],
  ["4 one bucket removed", linkWith((f) => f.pop()), "bad_structure"],
  ["5 extra 12th field", linkWith((f) => f.push("1.1.s.1")), "bad_structure"],
  ["6 bucket with 3 fields", linkWith((f) => (f[6] = "150000.7.s")), "bad_structure"],
  ["6 bucket with 5 fields", linkWith((f) => (f[6] = "150000.7.s.4.1")), "bad_structure"],
  ["7 negative price (the minus splits a field)", linkWith((f) => (f[6] = "-100000.7.s.4")), "bad_structure"],
  ["8 exponent price", linkWith((f) => (f[6] = "1e9.7.s.4")), "bad_chars"],
  ["8 decimal price (adds a dot-field)", linkWith((f) => (f[6] = "1.5.7.s.4")), "bad_structure"],
  ["9 20-digit price", linkWith((f) => (f[6] = "99999999999999999999.7.s.4")), "bad_value"],
  ["13 mode x", linkWith((f) => (f[6] = "150000.7.x.4")), "bad_chars"],
  ["13 currency X", linkWith((f) => (f[2] = "X")), "bad_chars"],
  ["13 preset z", linkWith((f) => (f[1] = "z")), "bad_chars"],
  ["14 script tag", "#v1-<script>alert(1)</script>", "bad_chars"],
  ["14 percent-encoded script tag", "#v1-%3Cscript%3E", "bad_chars"],
  ["15 5,000 characters", `#v1-${"1".repeat(4996)}`, "too_long"],
  ["16 leading zeros", linkWith((f) => (f[6] = "0150000.7.s.4")), "bad_value"],
  ["17 trailing space", `${EXAMPLE} `, "bad_chars"],
  ["17 newline", `${EXAMPLE}\n`, "bad_chars"],
  ["17 space inside a field", linkWith((f) => (f[4] = "1500 00")), "bad_chars"],
  ["17 emoji", linkWith((f) => (f[1] = "🎉")), "bad_chars"],
  ["17 accented letter", linkWith((f) => (f[2] = "É")), "bad_chars"],
  ["19 preset case swapped", linkWith((f) => (f[1] = "S")), "bad_chars"],
  ["19 currency case swapped", linkWith((f) => (f[2] = "u")), "bad_chars"],
  ["19 mode case swapped", linkWith((f) => (f[6] = "150000.7.P.4")), "bad_chars"],
  ["19 version case swapped", `#V${EXAMPLE.slice(2)}`, "bad_chars"],
  // Allowed characters in the wrong place: the only way to reach bad_value for an enum.
  ["preset code from the wrong table", linkWith((f) => (f[1] = "p")), "bad_value"],
  ["currency code from the wrong table", linkWith((f) => (f[2] = "s")), "bad_value"],
  ["mode code from the wrong table", linkWith((f) => (f[6] = "150000.7.b.4")), "bad_value"],
  ["empty number", linkWith((f) => (f[3] = "")), "bad_value"],
  ["empty bucket field", linkWith((f) => (f[7] = "100000..p.4")), "bad_value"],
  ["leading zero on the group", linkWith((f) => (f[3] = "04")), "bad_value"],
  ["13-digit price", linkWith((f) => (f[6] = "1000000000000.7.s.4")), "bad_value"],
  ["eleven fields of junk letters", "#a-b-c-d-e-f-g-h-i-j-k", "bad_chars"],
];

describe("DATA_MODEL §9.1: malformed and hostile links", () => {
  it.each(REJECTED)("case %s is rejected", (_name, hash, code) => {
    expect(decodeShare(hash)).toEqual({ ok: false, code });
  });

  it("18: every truncation of a valid link is rejected", () => {
    const accepted = Array.from({ length: EXAMPLE.length - 1 }, (_, i) => EXAMPLE.slice(0, i + 1))
      .filter((cut) => decodeShare(cut).ok);
    expect(accepted).toEqual([]);
  });

  it("20: works from the hash alone when localStorage is blocked", () => {
    vi.stubGlobal(
      "localStorage",
      new Proxy({}, { get: () => { throw new Error("blocked"); } }),
    );
    expect(decodeShare(EXAMPLE).ok).toBe(true);
    expect(decodeShare("#v1").ok).toBe(false);
  });

  it("the length cap counts the leading # and is checked before the characters", () => {
    expect(decodeShare("#".padEnd(MAX_LINK_LENGTH, "v")).ok).toBe(false);
    expect(decodeShare("#".padEnd(MAX_LINK_LENGTH + 1, "é"))).toEqual({ ok: false, code: "too_long" });
  });
});

describe("clamping (out-of-range numbers load, and are reported)", () => {
  it("10: headcount 0 becomes 1", () => {
    const result = decodeOk(linkWith((f) => (f[6] = "150000.7.s.0")));
    expect(result.state.buckets[0].headcount).toBe(1);
    expect(result.clamped).toEqual(["stay.headcount"]);
  });

  it("11: group size 0 becomes 1 and 1000 becomes 100", () => {
    const low = decodeOk(linkWith((f) => (f[3] = "0")));
    const high = decodeOk(linkWith((f) => (f[3] = "1000")));
    expect([low.state.groupSize, high.state.groupSize]).toEqual([1, 100]);
    expect(low.clamped).toEqual(["groupSize"]);
    expect(high.clamped).toEqual(["groupSize"]);
  });

  it("12: rate 0 becomes the minimum, never zero; a huge rate becomes the maximum", () => {
    const result = decodeOk(linkWith((f) => { f[4] = "0"; f[5] = "99999999"; }));
    expect(result.state.rates).toEqual({ ngnPerUsd: 50, ngnPerGbp: 100000 });
    expect(result.clamped).toEqual(["ngnPerUsd", "ngnPerGbp"]);
  });

  it("a hand-edited ₦99 billion price becomes the maximum; a quantity of 5000 becomes 999", () => {
    const result = decodeOk(linkWith((f) => (f[6] = "99000000000.5000.s.4")));
    expect(result.state.buckets[0]).toMatchObject({ unitPriceNgn: 50000000, quantity: 999 });
    expect(result.clamped).toEqual(["stay.unitPriceNgn", "stay.quantity"]);
  });

  it("lists clamped fields in link order", () => {
    const result = decodeOk(
      linkWith((f) => { f[3] = "0"; f[4] = "0"; f[10] = "99000000000.1000.p.0"; }),
    );
    expect(result.clamped).toEqual([
      "groupSize",
      "ngnPerUsd",
      "food.unitPriceNgn",
      "food.quantity",
      "food.headcount",
    ]);
  });

  it("clamps up to 12 digits and rejects 13", () => {
    expect(decodeOk(linkWith((f) => (f[6] = "999999999999.7.s.4"))).state.buckets[0].unitPriceNgn).toBe(50000000);
    expect(decodeShare(linkWith((f) => (f[6] = "9999999999999.7.s.4")))).toEqual({ ok: false, code: "bad_value" });
  });
});

describe("encode and round trip", () => {
  const WORST: AppState = {
    ...mapBuckets(MAX_VALUES, (b) => ({ ...b, headcount: 100 })),
    rates: { ngnPerUsd: 100000, ngnPerGbp: 100000 },
  };
  const preset = (id: (typeof PRESET_ORDER)[number]) =>
    stateFromPreset(id, { currency: "NGN", rates: DEFAULT_RATES });

  const STATES: [string, AppState][] = [
    ["the default scenario", createInitialState()],
    ...PRESET_ORDER.map((id): [string, AppState] => [`the ${id} preset`, preset(id)]),
    ["the golden example in GBP", { ...GOLDEN, currency: "GBP" }],
    ["the max-values fixture", MAX_VALUES],
    ["the worst case", WORST],
    [
      "rates with two decimals",
      { ...GOLDEN, currency: "USD", rates: { ngnPerUsd: 1500.55, ngnPerGbp: 1999.99 } },
    ],
  ];

  it.each(STATES)("decode(encode(state)) equals state for %s", (_name, state) => {
    expect(decodeShare(encodeShare(state))).toEqual({ ok: true, state, clamped: [] });
  });

  it("keeps the worst-case link short: about 130 characters, under 200 with the site URL", () => {
    const link = encodeShare(WORST);
    expect(link.length).toBeLessThan(130);
    expect(`${SITE_URL}/${link}`.length).toBeLessThan(200);
  });

  it("only ever uses the allowed characters", () => {
    expect(encodeShare(WORST)).toMatch(/^#[0-9vbsfpNUG.-]+$/);
  });

  it("never writes a link the decoder rejects, even from an out-of-range state", () => {
    const wild: AppState = {
      ...mapBuckets(GOLDEN, (b) => ({ ...b, unitPriceNgn: -5, quantity: 1.6, headcount: 0 })),
      groupSize: 1000,
      rates: { ngnPerUsd: Number.NaN, ngnPerGbp: 1 },
    };
    const result = decodeOk(encodeShare(wild));
    expect(result.clamped).toEqual([]);
    expect(result.state.groupSize).toBe(100);
    expect(result.state.rates).toEqual({ ngnPerUsd: 50, ngnPerGbp: 50 });
    expect(result.state.buckets[0]).toMatchObject({ unitPriceNgn: 0, quantity: 2, headcount: 1 });
  });
});

describe("never throws", () => {
  it("survives random and mutated input, and whatever it accepts re-encodes cleanly", () => {
    const alphabet = "0123456789vbsfpNUG.-#%<> é\n";
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const pick = (): string => alphabet[Math.floor(next() * alphabet.length)];

    const inputs: string[] = [];
    for (let i = 0; i < 3000; i++) {
      inputs.push(Array.from({ length: Math.floor(next() * 60) }, pick).join(""));
      const at = Math.floor(next() * EXAMPLE.length);
      inputs.push(EXAMPLE.slice(0, at) + pick() + EXAMPLE.slice(at + 1));
    }

    for (const input of inputs) {
      const result = decodeShare(input);
      if (result.ok) {
        expect(decodeShare(encodeShare(result.state))).toEqual({
          ok: true,
          state: result.state,
          clamped: [],
        });
      }
    }
  });
});
