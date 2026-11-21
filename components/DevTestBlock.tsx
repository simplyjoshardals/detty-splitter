"use client";

/**
 * THROWAWAY (T1.2): checks fonts, tokens and icons in light and dark.
 * Delete this file and its use in app/page.tsx in T3.3.
 */
import {
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  BedIcon,
  BeerBottleIcon,
  BusIcon,
  CarIcon,
  ChampagneIcon,
  CheckIcon,
  ConfettiIcon,
  CopyIcon,
  CrownSimpleIcon,
  CurrencyDollarIcon,
  CurrencyGbpIcon,
  CurrencyNgnIcon,
  DoorOpenIcon,
  MinusIcon,
  PlusIcon,
  ReceiptIcon,
  TicketIcon,
  WarningIcon,
} from "@phosphor-icons/react";

// Every icon from DESIGN.md §2. All icons share one component type.
const ICONS: ReadonlyArray<readonly [string, typeof BedIcon]> = [
  ["BedIcon", BedIcon],
  ["TicketIcon", TicketIcon],
  ["ChampagneIcon", ChampagneIcon],
  ["CarIcon", CarIcon],
  ["BeerBottleIcon", BeerBottleIcon],
  ["BusIcon", BusIcon],
  ["ConfettiIcon", ConfettiIcon],
  ["CrownSimpleIcon", CrownSimpleIcon],
  ["CurrencyNgnIcon", CurrencyNgnIcon],
  ["CurrencyDollarIcon", CurrencyDollarIcon],
  ["CurrencyGbpIcon", CurrencyGbpIcon],
  ["ReceiptIcon", ReceiptIcon],
  ["CopyIcon", CopyIcon],
  ["CheckIcon", CheckIcon],
  ["ArrowDownIcon", ArrowDownIcon],
  ["ArrowCounterClockwiseIcon", ArrowCounterClockwiseIcon],
  ["DoorOpenIcon", DoorOpenIcon],
  ["PlusIcon", PlusIcon],
  ["MinusIcon", MinusIcon],
  ["WarningIcon", WarningIcon],
];

// Full class names written out so Tailwind can detect them.
const SWATCHES: ReadonlyArray<readonly [string, string]> = [
  ["paper", "bg-paper"],
  ["surface", "bg-surface"],
  ["ink", "bg-ink"],
  ["muted", "bg-muted"],
  ["border", "bg-border"],
  ["rule", "bg-rule"],
  ["danfo", "bg-danfo"],
  ["stamp", "bg-stamp"],
  ["danger", "bg-danger"],
  ["ok", "bg-ok"],
  ["meter-bg", "bg-meter-bg"],
  ["meter-fg", "bg-meter-fg"],
];

export function DevTestBlock() {
  return (
    <div className="flex flex-col gap-6">
      <header className="bg-danfo px-4 py-3 text-danfo-ink">
        <h1 className="font-display text-xl">T1.2 token test</h1>
      </header>

      <section aria-labelledby="fonts-heading" className="flex flex-col gap-2">
        <h2 id="fonts-heading" className="font-display text-lg">
          Fonts
        </h2>
        <p className="font-mono text-base">₦1,234,567.89 $ £ (Space Mono 400)</p>
        <p className="font-mono text-base font-bold">
          ₦1,234,567.89 $ £ (Space Mono 700)
        </p>
        <p className="text-sm text-muted">
          Check: the ₦ matches the digits in weight and style, not a fallback font.
        </p>
      </section>

      <section aria-labelledby="swatches-heading" className="flex flex-col gap-2">
        <h2 id="swatches-heading" className="font-display text-lg">
          Tokens
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {SWATCHES.map(([name, className]) => (
            <li key={name} className="flex flex-col gap-1 text-xs">
              <span className={`${className} block h-10 border-2 border-border`} />
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="icons-heading" className="flex flex-col gap-2">
        <h2 id="icons-heading" className="font-display text-lg">
          Icons (bold, 24px)
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ICONS.map(([name, Icon]) => (
            <li key={name} className="flex items-center gap-2 text-xs">
              <Icon size={24} weight="bold" aria-hidden="true" />
              {name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
