import type { BucketId } from "@/lib/types";

export interface BucketDefinition {
  id: BucketId;
  label: string;
  unitLabel: string;
}

/** The fixed order of the five buckets everywhere: state, share link, receipt. */
export const BUCKET_ORDER: readonly BucketId[] = [
  "stay",
  "events",
  "tables",
  "transport",
  "food",
];

export const BUCKETS: Record<BucketId, BucketDefinition> = {
  stay: { id: "stay", label: "Short-lets / Accommodation", unitLabel: "per night" },
  events: { id: "events", label: "Concerts & Raves", unitLabel: "per event" },
  tables: { id: "tables", label: "Club Tables", unitLabel: "per table night" },
  transport: { id: "transport", label: "Transport / SUV / Security", unitLabel: "per day" },
  food: { id: "food", label: "Daily Food & Drinks", unitLabel: "per day" },
};
