/** Danfo band header (DESIGN §4): wordmark on yellow, black stripe underneath. */
export function Header() {
  return (
    <header>
      <div className="bg-danfo text-danfo-ink">
        <div className="mx-auto flex w-full max-w-[560px] items-center px-4 py-4">
          <h1 className="font-display text-[length:var(--t-lg)] leading-none">
            DETTY DEC 2026
          </h1>
        </div>
      </div>
      <div className="h-[var(--stripe)] bg-ink" aria-hidden="true" />
    </header>
  );
}
