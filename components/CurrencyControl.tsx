"use client";

import { CurrencyDollarIcon, CurrencyGbpIcon, CurrencyNgnIcon } from "@phosphor-icons/react";
import { CURRENCY_CODES } from "@/lib/money";
import type { CurrencyCode } from "@/lib/types";
import { useAppState } from "@/state/AppStateProvider";
import { SegmentedControl, type SegmentOption } from "./SegmentedControl";

// A Record, so adding a currency to CurrencyCode is a compile error until it has an icon here.
const ICONS: Record<CurrencyCode, SegmentOption<CurrencyCode>["icon"]> = {
  NGN: CurrencyNgnIcon,
  USD: CurrencyDollarIcon,
  GBP: CurrencyGbpIcon,
};

const CURRENCY_OPTIONS: readonly SegmentOption<CurrencyCode>[] = CURRENCY_CODES.map((code) => ({
  value: code,
  label: code,
  icon: ICONS[code],
}));

/**
 * Display currency (DESIGN §5.5). Display only: every amount on the page is converted from
 * the stored naira, and the tier never changes. T6.1 moves this into the header band.
 */
export function CurrencyControl() {
  const { state, dispatch } = useAppState();
  return (
    <SegmentedControl
      label="Currency"
      // The price fields never change currency, so say so while the amounts around them do.
      note={state.currency === "NGN" ? undefined : "Prices stay in ₦"}
      options={CURRENCY_OPTIONS}
      value={state.currency}
      onChange={(currency) => dispatch({ type: "setCurrency", currency })}
    />
  );
}
