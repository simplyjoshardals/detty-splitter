"use client";

import {
  BedIcon,
  BeerBottleIcon,
  CarIcon,
  ChampagneIcon,
  TicketIcon,
  UserIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { BUCKETS } from "@/data/buckets";
import type { LineResult } from "@/lib/calc";
import { RANGES, type NumberRange } from "@/lib/input";
import { formatAmount } from "@/lib/money";
import type { Bucket, BucketId, CurrencyCode, Mode } from "@/lib/types";
import { useAppState } from "@/state/AppStateProvider";
import type { BucketNumberField } from "@/state/reducer";
import { HintMessage } from "./HintMessage";
import { LineItem } from "./LineItem";
import { NumberField } from "./NumberField";
import { hintText, useRowHint } from "./numberHint";
import { SegmentedControl, type SegmentOption } from "./SegmentedControl";
import { Stepper } from "./Stepper";

// All icons share one component type.
const BUCKET_ICONS: Record<BucketId, typeof BedIcon> = {
  stay: BedIcon,
  events: TicketIcon,
  tables: ChampagneIcon,
  transport: CarIcon,
  food: BeerBottleIcon,
};

const MODE_OPTIONS: readonly SegmentOption<Mode>[] = [
  { value: "shared", label: "Shared", icon: UsersThreeIcon },
  { value: "perPerson", label: "Per person", icon: UserIcon },
];

/** Range and display prefix per field, for the hint copy ("Max is ₦50,000,000 ..."). */
const FIELD_HINT_FORMAT: Record<BucketNumberField, { range: NumberRange; prefix: string }> = {
  unitPriceNgn: { range: RANGES.unitPriceNgn, prefix: "₦" },
  quantity: { range: RANGES.quantity, prefix: "" },
  headcount: { range: RANGES.headcount, prefix: "" },
};

/** The sum for this line, in naira until the currency toggle exists (T5.1 converts it). */
function describeLine(bucket: Bucket, lineTotalNgn: number): string {
  if (bucket.mode === "perPerson") return "Each person pays this";
  return `${formatAmount(lineTotalNgn, "NGN")} total ÷ ${bucket.headcount}`;
}

interface BucketLineProps {
  bucket: Bucket;
  line: LineResult;
  currency: CurrencyCode;
}

/** One bucket's editable line: price, quantity, mode and, when shared, headcount. */
export function BucketLine({ bucket, line, currency }: BucketLineProps) {
  const { dispatch } = useAppState();
  const definition = BUCKETS[bucket.id];
  const headingId = `line-${bucket.id}-heading`;
  const hintId = `line-${bucket.id}-hint`;
  const hints = useRowHint<BucketNumberField>({
    unitPriceNgn: bucket.unitPriceNgn,
    quantity: bucket.quantity,
    headcount: bucket.headcount,
  });
  const format = hints.active === null ? null : FIELD_HINT_FORMAT[hints.active.field];

  function setNumber(field: BucketNumberField) {
    return (value: number) =>
      dispatch({ type: "setBucketNumber", bucketId: bucket.id, field, value });
  }

  return (
    <LineItem
      label={definition.label}
      headingId={headingId}
      icon={BUCKET_ICONS[bucket.id]}
      amount={formatAmount(line.shareMinor, currency)}
      formula={describeLine(bucket, line.lineTotalNgn)}
      hintId={hintId}
      hint={
        hints.active !== null && format !== null ? (
          <HintMessage
            hint={hints.active.hint}
            text={hintText(hints.active.hint, format.range, format.prefix)}
          />
        ) : null
      }
      priceField={
        <NumberField
          label={`Price ${definition.unitLabel}`}
          labelledBy={[headingId]}
          prefix="₦"
          range={RANGES.unitPriceNgn}
          value={bucket.unitPriceNgn}
          onCommit={setNumber("unitPriceNgn")}
          hintId={hintId}
          {...hints.forField("unitPriceNgn")}
        />
      }
      quantityField={
        <Stepper
          label={definition.quantityLabel}
          labelledBy={[headingId]}
          range={RANGES.quantity}
          value={bucket.quantity}
          onCommit={setNumber("quantity")}
          hintId={hintId}
          {...hints.forField("quantity")}
        />
      }
      modeField={
        <SegmentedControl
          label="Cost split"
          labelledBy={[headingId]}
          options={MODE_OPTIONS}
          value={bucket.mode}
          onChange={(mode) => dispatch({ type: "setBucketMode", bucketId: bucket.id, mode })}
        />
      }
      headcountField={
        bucket.mode === "shared" ? (
          <Stepper
            label="Split between"
            labelledBy={[headingId]}
            range={RANGES.headcount}
            value={bucket.headcount}
            suffix={bucket.headcount === 1 ? "person" : "people"}
            onCommit={setNumber("headcount")}
            hintId={hintId}
            {...hints.forField("headcount")}
          />
        ) : null
      }
    />
  );
}
