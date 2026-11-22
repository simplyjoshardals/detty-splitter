/** Estimates note (DESIGN §5.15). "Tap any number to edit." joins it when editing exists (T4.1). */
export function Footer() {
  return (
    <footer className="border-t-2 border-dashed border-rule">
      <p className="mx-auto w-full max-w-[560px] px-4 py-6 text-[length:var(--t-xs)] text-muted">
        Estimates only, not quotes.
      </p>
    </footer>
  );
}
