import { describe, expect, it } from "vitest";
import { MAX_LINK_LENGTH, encodeShare, type DecodeFailure } from "@/lib/share";
import { resolveInitialState } from "@/lib/share/load";
import { createInitialState, stateFromPreset } from "@/state/reducer";
import { GOLDEN, MAX_VALUES } from "./fixtures";

const FALLBACK = createInitialState();
const SAVED = stateFromPreset("baller", {
  currency: "GBP",
  rates: { ngnPerUsd: 1600, ngnPerGbp: 2100 },
});
const SNAPSHOT = encodeShare(SAVED);
const GOOD = encodeShare(GOLDEN);

/** The golden link with one top-level field replaced (0 version, 3 group, 6 to 10 buckets). */
function withField(index: number, value: string): string {
  const fields = GOOD.slice(1).split("-");
  fields[index] = value;
  return `#${fields.join("-")}`;
}

describe("precedence: hash, then snapshot, then default", () => {
  it("a valid link wins over a valid snapshot", () => {
    const result = resolveInitialState(encodeShare(MAX_VALUES), SNAPSHOT, FALLBACK);
    expect(result).toEqual({ source: "hash", state: MAX_VALUES, clamped: [], rejected: null });
  });

  it("no link: the snapshot is used", () => {
    const result = resolveInitialState("", SNAPSHOT, FALLBACK);
    expect(result).toEqual({ source: "storage", state: SAVED, clamped: [], rejected: null });
  });

  it("a bare # counts as no link", () => {
    expect(resolveInitialState("#", SNAPSHOT, FALLBACK).source).toBe("storage");
  });

  it("no link and no snapshot: the default, as the very object passed in, silently", () => {
    const result = resolveInitialState("", null, FALLBACK);
    expect(result.source).toBe("default");
    expect(result.state).toBe(FALLBACK);
    expect(result.rejected).toBeNull();
  });

  it("works from the hash alone when storage is unavailable (null)", () => {
    const result = resolveInitialState(GOOD, null, FALLBACK);
    expect(result.source).toBe("hash");
    expect(result.state).toEqual(GOLDEN);
  });

  it("a corrupt snapshot is ignored silently: the default, no notice", () => {
    for (const junk of ["", "#", "garbage", "#v9-x", "{\"a\":1}", "#v1-s-N-4"]) {
      const result = resolveInitialState("", junk, FALLBACK);
      expect(result.source).toBe("default");
      expect(result.state).toBe(FALLBACK);
      expect(result.rejected).toBeNull();
    }
  });

  it("a snapshot is decoded as strictly as a link", () => {
    const hostile = "#v1-<script>alert(1)</script>";
    expect(resolveInitialState("", hostile, FALLBACK).source).toBe("default");
  });
});

describe("a rejected link", () => {
  const cases: ReadonlyArray<[string, string, DecodeFailure]> = [
    ["wrong field count", "#v1", "bad_structure"],
    ["a future version", GOOD.replace("#v1-", "#v2-"), "bad_version"],
    ["a script tag", "#v1-<script>alert(1)</script>", "bad_chars"],
    ["over the length cap", `#${"v".repeat(MAX_LINK_LENGTH)}`, "too_long"],
    ["leading zeros", withField(6, "0150000.7.s.4"), "bad_value"],
    ["a wrong-case enum", withField(2, "n"), "bad_chars"],
  ];

  it.each(cases)("%s: default plus the notice code, even with a good snapshot", (_name, link, code) => {
    const result = resolveInitialState(link, SNAPSHOT, FALLBACK);
    expect(result.source).toBe("default");
    expect(result.state).toBe(FALLBACK);
    expect(result.clamped).toEqual([]);
    expect(result.rejected).toBe(code);
  });

  it("is the same with no snapshot", () => {
    expect(resolveInitialState("#v1", null, FALLBACK).rejected).toBe("bad_structure");
  });

  it("never throws on hostile input, in either argument", () => {
    const hostile = [
      "\u0000",
      "#😀",
      "#v1- -",
      "%3Cscript%3E",
      "#v1\n-s",
      `#${"9".repeat(5000)}`,
      "__proto__",
      "#constructor",
    ];
    for (const text of hostile) {
      expect(() => resolveInitialState(text, text, FALLBACK)).not.toThrow();
      const result = resolveInitialState(text, null, FALLBACK);
      expect(result.source).toBe("default");
      expect(result.rejected).not.toBeNull();
    }
  });
});

describe("clamped numbers load, and are reported", () => {
  it("a group size of 0 loads as 1 and is listed", () => {
    const result = resolveInitialState(withField(3, "0"), SNAPSHOT, FALLBACK);
    expect(result.source).toBe("hash");
    expect(result.state.groupSize).toBe(1);
    expect(result.clamped).toEqual(["groupSize"]);
    expect(result.rejected).toBeNull();
  });
});
