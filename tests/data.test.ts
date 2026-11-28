import { describe, expect, it, vi } from "vitest";
import { BUCKETS, BUCKET_ORDER } from "@/data/buckets";
import { TIERS } from "@/data/tiers";
import { calculate } from "@/lib/calc";
import type { PresetId } from "@/lib/types";

// The real presets: tests/setup.ts mocks them for the other tests.
const { PRESETS, PRESET_ORDER } =
  await vi.importActual<typeof import("@/data/presets")>("@/data/presets");

describe("presets land in the intended tiers (R1)", () => {
  it.each<[PresetId, number]>([
    ["budget", 1],
    ["soft", 3],
    ["baller", 5],
  ])("%s is in tier %i", (id, tierId) => {
    const preset = PRESETS[id];
    const [stay, events, tables, transport, food] = preset.buckets;
    const result = calculate(
      {
        currency: "NGN",
        groupSize: preset.groupSize,
        rates: { ngnPerUsd: 1500, ngnPerGbp: 2000 },
        buckets: [
          { id: "stay", ...stay },
          { id: "events", ...events },
          { id: "tables", ...tables },
          { id: "transport", ...transport },
          { id: "food", ...food },
        ],
      },
      TIERS,
    );
    expect(result.tier.id).toBe(tierId);
  });
});

describe("tiers", () => {
  it("has 5 tiers numbered 1 to 5, the first starting at 0", () => {
    expect(TIERS.map((t) => t.id)).toEqual([1, 2, 3, 4, 5]);
    expect(TIERS[0]?.minPerPersonNgn).toBe(0);
  });

  it("has strictly ascending whole-naira thresholds", () => {
    TIERS.forEach((tier, i) => {
      expect(Number.isInteger(tier.minPerPersonNgn)).toBe(true);
      const previous = TIERS[i - 1];
      if (previous) expect(tier.minPerPersonNgn).toBeGreaterThan(previous.minPerPersonNgn);
    });
  });

  it("has copy for every tier", () => {
    for (const tier of TIERS) {
      expect(tier.badge.length).toBeGreaterThan(0);
      expect(tier.tagline.length).toBeGreaterThan(0);
      expect(tier.balanceLine.startsWith("AVAIL BAL:")).toBe(true);
    }
  });
});

describe("buckets", () => {
  it("has a definition for each of the 5 buckets, keyed by its own id", () => {
    expect(BUCKET_ORDER).toEqual(["stay", "events", "tables", "transport", "food"]);
    for (const id of BUCKET_ORDER) {
      expect(BUCKETS[id].id).toBe(id);
      expect(BUCKETS[id].label.length).toBeGreaterThan(0);
      expect(BUCKETS[id].unitLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("presets stay inside the DATA_MODEL §2.2 ranges", () => {
  const ids: readonly PresetId[] = PRESET_ORDER;

  it("lists all 3 presets", () => {
    expect(ids).toEqual(["budget", "soft", "baller"]);
  });

  it.each(ids.map((id): [PresetId] => [id]))("%s", (id) => {
    const preset = PRESETS[id];
    expect(preset.id).toBe(id);
    expect(preset.buckets.length).toBe(5);
    expect(Number.isInteger(preset.groupSize)).toBe(true);
    expect(preset.groupSize).toBeGreaterThanOrEqual(1);
    expect(preset.groupSize).toBeLessThanOrEqual(100);

    for (const bucket of preset.buckets) {
      expect(Number.isInteger(bucket.unitPriceNgn)).toBe(true);
      expect(bucket.unitPriceNgn).toBeGreaterThanOrEqual(0);
      expect(bucket.unitPriceNgn).toBeLessThanOrEqual(50000000);
      expect(Number.isInteger(bucket.quantity)).toBe(true);
      expect(bucket.quantity).toBeGreaterThanOrEqual(0);
      expect(bucket.quantity).toBeLessThanOrEqual(999);
      expect(Number.isInteger(bucket.headcount)).toBe(true);
      expect(bucket.headcount).toBeGreaterThanOrEqual(1);
      expect(bucket.headcount).toBeLessThanOrEqual(100);
      expect(bucket.mode === "shared" || bucket.mode === "perPerson").toBe(true);
    }
  });
});
