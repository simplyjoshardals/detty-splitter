import type { BucketId } from "@/lib/types";

export interface BucketDefinition {
  id: BucketId;
  label: string;
  unitLabel: string;
  /** The quantity's name, as the stepper label: "Nights", "Events", "Table nights", "Days". */
  quantityLabel: string;
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
  stay: { id: "stay", label: "Short-lets / Accommodation", unitLabel: "per night", quantityLabel: "Nights" },
  events: { id: "events", label: "Concerts & Raves", unitLabel: "per event", quantityLabel: "Events" },
  tables: { id: "tables", label: "Club Tables", unitLabel: "per table night", quantityLabel: "Table nights" },
  transport: { id: "transport", label: "Transport / SUV / Security", unitLabel: "per day", quantityLabel: "Days" },
  food: { id: "food", label: "Daily Food & Drinks", unitLabel: "per day", quantityLabel: "Days" },
};
