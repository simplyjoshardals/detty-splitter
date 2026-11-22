"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { WarningIcon } from "@phosphor-icons/react";
import {
  applyDraftEdit,
  formatNumberInput,
  parseNumberInput,
  type NumberRange,
  type ParseResult,
} from "@/lib/input";

interface NumberFieldProps {
  /** Visible label, e.g. "Price per night". */
  label: string;
  /** Ids of other visible elements that join the label in the accessible name, so
   * several fields labelled "Price per day" can still be told apart by a screen reader. */
  labelledBy?: readonly string[];
  /** The saved number. The field shows this whenever it isn't being edited. */
  value: number;
  range: NumberRange;
  /** Non-editable prefix shown inside the box, e.g. "₦". */
  prefix?: string;
  /** Called with a parsed, clamped integer, only on blur or Enter. Never with NaN. */
  onCommit: (value: number) => void;
}

/**
 * What the last commit told the user. `forValue` is the saved number the hint was about:
 * when the saved number changes some other way (a preset switch), the hint goes away.
 */
type Hint =
  | { kind: "clamped"; bound: "min" | "max"; forValue: number }
  | { kind: "reverted"; reason: "empty" | "invalid"; forValue: number };

function hintFromResult(result: ParseResult): Hint | null {
  switch (result.status) {
    case "ok":
      return null;
    case "clamped":
      return { kind: "clamped", bound: result.bound, forValue: result.value };
    case "reverted":
      return { kind: "reverted", reason: result.reason, forValue: result.value };
  }
}

/** Hint copy from DESIGN §9. */
function hintText(hint: Hint, range: NumberRange, prefix: string): string {
  if (hint.kind === "clamped") {
    const limit = hint.bound === "max" ? range.max : range.min;
    const name = hint.bound === "max" ? "Max" : "Min";
    return `${name} is ${prefix}${formatNumberInput(limit)}, so we adjusted it.`;
  }
  return hint.reason === "empty"
    ? "Nothing there, so we kept your old number."
    : "That number no make sense. We kept your old one.";
}

/** Backspace and Delete arrive as the input event's `inputType`. */
function deletionOf(event: Event): "backward" | "forward" | null {
  if (!("inputType" in event)) return null;
  if (event.inputType === "deleteContentBackward") return "backward";
  if (event.inputType === "deleteContentForward") return "forward";
  return null;
}

/**
 * Number input with draft handling (DESIGN §5.2, DATA_MODEL §9.2).
 *
 * - The text being typed (the draft) lives here, never in AppState. While the field isn't
 *   focused the draft is null and the text comes straight from `value`, so an outside
 *   change (preset switch, reset) shows up with no syncing effect.
 * - While focused, digits are regrouped with commas as you type and the caret is put back
 *   after the digit it was after, so it never jumps.
 * - The number is committed on blur or Enter only, so a half-typed value like "1,5" can
 *   never reach AppState. Empty or invalid text reverts to the saved number with a hint.
 *   Too big or too small is clamped, with a hint (not an error).
 */
export function NumberField({
  label,
  labelledBy = [],
  value,
  range,
  prefix = "",
  onCommit,
}: NumberFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;

  const [draft, setDraft] = useState<string | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Where to put the caret after React writes the reformatted text.
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    const input = inputRef.current;
    if (caret === null || input === null) return;
    pendingCaret.current = null;
    if (document.activeElement === input) input.setSelectionRange(caret, caret);
  }, [draft]);

  const text = draft ?? formatNumberInput(value);
  const shownHint = hint !== null && hint.forValue === value ? hint : null;

  function commit(rawText: string): ParseResult {
    const result = parseNumberInput(rawText, range, value);
    if (result.value !== value) onCommit(result.value);
    setHint(hintFromResult(result));
    return result;
  }

  function handleFocus() {
    setHint(null);
    setDraft(formatNumberInput(value));
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const edit = applyDraftEdit(text, raw, caret, deletionOf(event.nativeEvent));
    pendingCaret.current = edit.caret;
    if (edit.text === text && raw !== edit.text) {
      // The edit changed nothing after reformatting (a second "0" at the start), so React
      // won't re-render. Put the text and caret back by hand.
      input.value = edit.text;
      input.setSelectionRange(edit.caret, edit.caret);
      pendingCaret.current = null;
    }
    setDraft(edit.text);
  }

  function handleBlur() {
    if (draft !== null) commit(draft);
    setDraft(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || draft === null) return;
    event.preventDefault();
    // Commit in place and keep focus, so keyboard users don't lose their spot.
    const result = commit(draft);
    setDraft(formatNumberInput(result.value));
  }

  const isError = shownHint?.kind === "reverted";

  return (
    <div>
      <label
        id={labelId}
        htmlFor={id}
        className="block text-[length:var(--t-xs)] text-muted"
      >
        {label}
      </label>
      <div
        className={`mt-1 flex h-12 items-stretch border-2 bg-surface focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-(--focus) ${
          isError ? "border-danger" : "border-border"
        }`}
      >
        {prefix !== "" && (
          <span className="flex items-center pl-3 font-mono text-[length:var(--t-base)] text-muted">
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-labelledby={[labelId, ...labelledBy].join(" ")}
          aria-describedby={shownHint ? hintId : undefined}
          value={text}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent px-3 text-right font-mono text-[length:var(--t-base)] text-ink outline-none"
        />
      </div>
      {/* Always in the page, so screen readers announce the hint when it appears. */}
      <div id={hintId} role="status">
        {shownHint && (
          <p
            className={`mt-1 flex items-start gap-1.5 text-[length:var(--t-xs)] ${
              isError ? "text-danger" : "text-ink"
            }`}
          >
            <WarningIcon size={16} weight="bold" aria-hidden="true" className="shrink-0" />
            <span>{hintText(shownHint, range, prefix)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
