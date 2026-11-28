"use client";

import { useId, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { parseNumberInput, type NumberRange } from "@/lib/input";
import { hintFromResult, type FieldHintProps } from "./numberHint";

interface StepperProps extends FieldHintProps {
  /** Visible label, e.g. "Nights" or "Split between". */
  label: string;
  /** Ids of other visible elements that join the label in every accessible name, so the
   * same stepper in two buckets can still be told apart by a screen reader. */
  labelledBy?: readonly string[];
  /** The saved number. */
  value: number;
  range: NumberRange;
  /** Small text after the buttons, e.g. "people". Decoration: the label already says it. */
  suffix?: string;
  /** Called with a whole number inside `range`, never NaN. */
  onCommit: (value: number) => void;
  /** Id of the row's hint slot. `aria-describedby` points at it while `hint` is set. The row
   * renders the hint (see `useRowHint`), so a hint never moves the buttons around it. */
  hintId: string;
}

const BUTTON_CLASS =
  "relative flex size-11 shrink-0 items-center justify-center border-2 border-border bg-surface text-ink " +
  "focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) " +
  "active:bg-danfo active:text-danfo-ink " +
  "aria-disabled:cursor-not-allowed aria-disabled:text-ink/50 aria-disabled:active:bg-surface aria-disabled:active:text-ink/50";

/**
 * Minus, value, plus (DESIGN §5.6). The value is a real input that commits like
 * NumberField: on blur or Enter, with the same hints for empty, invalid or out-of-range text.
 *
 * - A button at its bound is `aria-disabled`, not `disabled`, so keyboard focus stays on
 *   it instead of dropping to the page.
 * - ArrowUp and ArrowDown in the box step by one.
 * - A step commits at once, since it is a deliberate action rather than half-typed text.
 * - The hint is owned and drawn by the row (DESIGN §4); this stepper only reports it.
 */
export function Stepper({
  label,
  labelledBy = [],
  value,
  range,
  suffix,
  onCommit,
  hint,
  onHintChange,
  hintId,
}: StepperProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const decreaseId = `${id}-decrease`;
  const increaseId = `${id}-increase`;

  const [draft, setDraft] = useState<string | null>(null);

  const text = draft ?? String(value);
  const isError = hint?.kind === "reverted";

  function commit(rawText: string) {
    const result = parseNumberInput(rawText, range, value);
    if (result.value !== value) onCommit(result.value);
    onHintChange(hintFromResult(result));
    return result;
  }

  function step(delta: 1 | -1) {
    // If something is half typed, step from what it would commit to.
    const base = draft === null ? value : parseNumberInput(draft, range, value).value;
    const next = base + delta;
    if (next < range.min || next > range.max) return;
    if (next !== value) onCommit(next);
    onHintChange(null);
    if (draft !== null) setDraft(String(next));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.currentTarget.value);
  }

  function handleBlur() {
    if (draft !== null) commit(draft);
    setDraft(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      step(event.key === "ArrowUp" ? 1 : -1);
    } else if (event.key === "Enter" && draft !== null) {
      event.preventDefault();
      const result = commit(draft);
      setDraft(String(result.value));
    }
  }

  const names = [labelId, ...labelledBy].join(" ");

  return (
    <div>
      <span id={labelId} className="block text-[length:var(--t-xs)] text-muted">
        {label}
      </span>
      <div className="mt-2.5 flex items-center">
        <button
          type="button"
          id={decreaseId}
          aria-label="Decrease"
          aria-labelledby={`${decreaseId} ${names}`}
          aria-disabled={value <= range.min}
          onClick={() => step(-1)}
          className={BUTTON_CLASS}
        >
          <MinusIcon size={20} weight="bold" aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-labelledby={names}
          aria-describedby={hint ? hintId : undefined}
          value={text}
          onFocus={() => {
            onHintChange(null);
            setDraft(String(value));
          }}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`relative h-11 w-14 min-w-0 border-y-2 bg-surface px-1 text-center font-mono text-[length:var(--t-base)] text-ink focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus) ${
            isError ? "border-danger" : "border-border"
          }`}
        />
        <button
          type="button"
          id={increaseId}
          aria-label="Increase"
          aria-labelledby={`${increaseId} ${names}`}
          aria-disabled={value >= range.max}
          onClick={() => step(1)}
          className={BUTTON_CLASS}
        >
          <PlusIcon size={20} weight="bold" aria-hidden="true" />
        </button>
        {suffix !== undefined && (
          <span aria-hidden="true" className="ml-3 text-[length:var(--t-sm)] text-muted">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
