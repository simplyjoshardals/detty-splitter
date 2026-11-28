/**
 * Presets (DATA_MODEL.md §3.1).
 *
 * Round estimates from public Lagos prices for December 2026 (R1, 28 Nov 2026): short-let
 * nightly rates, concert tickets, club and concert tables, car hire with a driver, and meals.
 * They are estimates, not quotes, so keep the "estimates, tap any number to edit" label visible.
 */
import type { Bucket, PresetId } from "@/lib/types";

export type BucketValues = Omit<Bucket, "id">;

export interface Preset {
  id: PresetId;
  label: string;
  blurb: string;
  groupSize: number;
  /** Exactly 5, in BUCKET_ORDER order: stay, events, tables, transport, food. */
  buckets: [BucketValues, BucketValues, BucketValues, BucketValues, BucketValues];
}

/** Default scenario on first load (A11). */
export const DEFAULT_PRESET_ID: PresetId = "soft";

/** Display order for the preset picker. */
export const PRESET_ORDER: readonly PresetId[] = ["budget", "soft", "baller"];

export const PRESETS: Record<PresetId, Preset> = {
  budget: {
    id: "budget",
    label: "Outside on a Budget",
    blurb: "Jollof, gist and a few good nights out.",
    groupSize: 4,
    buckets: [
      { unitPriceNgn: 90000, quantity: 7, mode: "shared", headcount: 4 },
      { unitPriceNgn: 40000, quantity: 2, mode: "perPerson", headcount: 4 },
      { unitPriceNgn: 300000, quantity: 1, mode: "shared", headcount: 4 },
      { unitPriceNgn: 40000, quantity: 7, mode: "shared", headcount: 4 },
      { unitPriceNgn: 10000, quantity: 7, mode: "perPerson", headcount: 4 },
    ],
  },
  soft: {
    id: "soft",
    label: "Soft Life Standard",
    blurb: "A nice place, the right events, no wahala.",
    groupSize: 4,
    buckets: [
      { unitPriceNgn: 200000, quantity: 7, mode: "shared", headcount: 4 },
      { unitPriceNgn: 100000, quantity: 3, mode: "perPerson", headcount: 4 },
      { unitPriceNgn: 1000000, quantity: 2, mode: "shared", headcount: 4 },
      { unitPriceNgn: 120000, quantity: 7, mode: "shared", headcount: 4 },
      { unitPriceNgn: 40000, quantity: 7, mode: "perPerson", headcount: 4 },
    ],
  },
  baller: {
    id: "baller",
    label: "Full IJGB / Baller Mode",
    blurb: "Tables, SUVs and no looking at prices.",
    groupSize: 4,
    buckets: [
      { unitPriceNgn: 450000, quantity: 7, mode: "shared", headcount: 4 },
      { unitPriceNgn: 300000, quantity: 4, mode: "perPerson", headcount: 4 },
      { unitPriceNgn: 3000000, quantity: 3, mode: "shared", headcount: 4 },
      { unitPriceNgn: 300000, quantity: 7, mode: "shared", headcount: 4 },
      { unitPriceNgn: 150000, quantity: 7, mode: "perPerson", headcount: 4 },
    ],
  },
};
