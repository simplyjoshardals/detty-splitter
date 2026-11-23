import { CurrencyControl } from "./CurrencyControl";

/**
 * Danfo band header (DESIGN §4): wordmark and currency control on yellow, black stripe underneath.
 * A server component; only CurrencyControl is client code. The band is an `.on-danfo` scope
 * (globals.css), so the control keeps the same colours in light and dark.
 *
 * Below 560px the control stacks under the wordmark (the pair needs about 420px). From 560px
 * they share one row, the same breakpoint as the group total row.
 */
export function Header() {
  return (
    <header>
      <div className="on-danfo bg-danfo text-danfo-ink">
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-4 min-[560px]:flex-row min-[560px]:items-end min-[560px]:justify-between">
          {/* pb-3 centres the 20px wordmark on the 44px segments beside it (24px spare, 12 each side). */}
          <h1 className="font-display text-[length:var(--t-lg)] leading-none min-[560px]:pb-3">
            DETTY DEC 2026
          </h1>
          <div className="min-[560px]:w-60 min-[560px]:shrink-0">
            <CurrencyControl />
          </div>
        </div>
      </div>
      <div className="h-[var(--stripe)] bg-danfo-ink" aria-hidden="true" />
    </header>
  );
}
