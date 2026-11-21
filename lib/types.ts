/** Shared shapes from DATA_MODEL.md §2.1. Types only, no runtime code. */

export type BucketId = "stay" | "events" | "tables" | "transport" | "food";
export type Mode = "shared" | "perPerson";
export type CurrencyCode = "NGN" | "USD" | "GBP";
export type PresetId = "budget" | "soft" | "baller";

export interface Bucket {
  id: BucketId;
  /** Whole naira, price of ONE unit. */
  unitPriceNgn: number;
  /** Number of units (nights, events, table nights, days). */
  quantity: number;
  mode: Mode;
  /** People sharing this item. Ignored when mode is "perPerson". */
  headcount: number;
}

export interface Rates {
  ngnPerUsd: number;
  ngnPerGbp: number;
}

export interface AppState {
  presetId: PresetId;
  /** Display only. */
  currency: CurrencyCode;
  groupSize: number;
  rates: Rates;
  /** Fixed order: stay, events, tables, transport, food. */
  buckets: [Bucket, Bucket, Bucket, Bucket, Bucket];
}
