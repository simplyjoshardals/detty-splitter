"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  applyDraftEdit,
  formatNumberInput,
  parseNumberInput,
  type NumberRange,
  type ParseResult,
} from "@/lib/input";
import { hintFromResult, type FieldHintProps } from "./numberHint";

interface NumberFieldProps extends FieldHintProps {
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
  /** Id of the row's hint slot. `aria-describedby` points at it while `hint` is set. The row
   * renders the hint (see `useRowHint`), so a hint never moves this field's neighbours. */
  hintId: string;
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
 * - The hint is owned and drawn by the row (DESIGN §4); this field only reports it.
 */
export function NumberField({
  label,
  labelledBy = [],
  value,
  range,
  prefix = "",
  onCommit,
  hint,
  onHintChange,
  hintId,
}: NumberFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;

  const [draft, setDraft] = useState<string | null>(null);
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

  function commit(rawText: string): ParseResult {
    const result = parseNumberInput(rawText, range, value);
    if (result.value !== value) onCommit(result.value);
    onHintChange(hintFromResult(result));
    return result;
  }

  function handleFocus() {
    onHintChange(null);
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

  const isError = hint?.kind === "reverted";

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
        // mt-2 (8px) clears the 3px focus ring plus its 2px offset above the box.
        className={`mt-2 flex h-12 items-stretch border-2 bg-surface focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-(--focus) ${
          isError ? "border-danger" : "border-border"
        }`}
      >
        {prefix !== "" && (
          <span className="flex items-center pl-3 font-mono text-[length:var(--t-base)] font-bold text-ink">
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
          aria-describedby={hint ? hintId : undefined}
          value={text}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent px-3 text-right font-mono text-[length:var(--t-base)] text-ink outline-none"
        />
      </div>
    </div>
  );
}
