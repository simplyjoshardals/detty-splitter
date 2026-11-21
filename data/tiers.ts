/**
 * Receipt tiers (DATA_MODEL.md §3.2). Draft copy from REQUIREMENTS.md §7; refine freely.
 * Thresholds are placeholders to tune after price research (O1). A tier is chosen from
 * the exact per-person naira total, never from the display currency.
 */
export interface Tier {
  id: 1 | 2 | 3 | 4 | 5;
  /** Inclusive lower bound, per person, in whole naira. */
  minPerPersonNgn: number;
  badge: string;
  tagline: string;
  /** The "AVAIL BAL" joke line on the receipt. */
  balanceLine: string;
}

export const TIERS: readonly Tier[] = [
  {
    id: 1,
    minPerPersonNgn: 0,
    badge: "Certified Sapa Survivor",
    tagline: "Outside on a budget. Jollof and gist dey carry me.",
    balanceLine: "AVAIL BAL: ₦0.00 (SAPA LOADING)",
  },
  {
    id: 2,
    minPerPersonNgn: 300000,
    badge: "Budget Boss",
    tagline: "I go enter every party. I no go enter debt.",
    balanceLine: "AVAIL BAL: STILL BREATHING",
  },
  {
    id: 3,
    minPerPersonNgn: 750000,
    badge: "Soft Life Certified",
    tagline: "Soft life no be luck, na planning.",
    balanceLine: "AVAIL BAL: STABLE. DON’T CHECK.",
  },
  {
    id: 4,
    minPerPersonNgn: 1500000,
    badge: "Detty December Professional",
    tagline: "Table don reserve. Account balance? Private.",
    balanceLine: "AVAIL BAL: CLASSIFIED",
  },
  {
    id: 5,
    minPerPersonNgn: 3000000,
    badge: "IJGB Final Boss",
    tagline: "Dollar dey talk. Lagos dey listen.",
    balanceLine: "AVAIL BAL: IN DOLLARS, OGA.",
  },
];
