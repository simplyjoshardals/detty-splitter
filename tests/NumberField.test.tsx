// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HintMessage } from "@/components/HintMessage";
import { NumberField } from "@/components/NumberField";
import { hintText, useRowHint } from "@/components/numberHint";
import { RANGES, type NumberRange } from "@/lib/input";

afterEach(cleanup);

interface HarnessProps {
  initial?: number;
  range?: NumberRange;
  prefix?: string;
  label?: string;
  onCommit?: (value: number) => void;
}

/**
 * Holds the saved number the way AppState would, reports every commit, and plays the row:
 * it owns the hint and draws it in one status slot, as BucketLine does.
 */
function Harness({
  initial = 150000,
  range = RANGES.unitPriceNgn,
  prefix = "₦",
  label = "Price per night",
  onCommit,
}: HarnessProps) {
  const [value, setValue] = useState(initial);
  const hints = useRowHint({ field: value });
  return (
    <>
      <NumberField
        label={label}
        prefix={prefix}
        range={range}
        value={value}
        onCommit={(next) => {
          onCommit?.(next);
          setValue(next);
        }}
        hintId="row-hint"
        {...hints.forField("field")}
      />
      <div id="row-hint" role="status">
        {hints.active !== null && (
          <HintMessage hint={hints.active.hint} field="Field" text={hintText(hints.active.hint, range, prefix)} />
        )}
      </div>
      <button type="button" onClick={() => setValue(777)}>
        Outside change
      </button>
    </>
  );
}

function setup(props: HarnessProps = {}) {
  const onCommit = vi.fn<(value: number) => void>();
  const user = userEvent.setup();
  render(<Harness {...props} onCommit={onCommit} />);
  const input = screen.getByRole("textbox", { name: props.label ?? "Price per night" });
  if (!(input instanceof HTMLInputElement)) throw new Error("expected an <input>");
  return { user, input, onCommit };
}

/** Focuses the field and replaces its text, the way a person selects all and types. */
async function replaceText(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, text: string) {
  await user.click(input);
  await user.clear(input);
  if (text !== "") await user.type(input, text);
}

describe("NumberField: the box", () => {
  it("is a labelled numeric text input showing the saved number with separators", () => {
    const { input } = setup();
    expect(input.value).toBe("150,000");
    expect(input.type).toBe("text");
    expect(input.inputMode).toBe("numeric");
    expect(input.getAttribute("autocomplete")).toBe("off");
  });

  it("shows the prefix as plain text beside the input", () => {
    setup();
    expect(screen.getByText("₦")).toBeTruthy();
  });

  it("shows an outside change to the saved number at once, with no hint", async () => {
    const { user, input } = setup();
    await user.click(screen.getByRole("button", { name: "Outside change" }));
    expect(input.value).toBe("777");
    expect(screen.queryByText(/we kept|we adjusted|no make sense/i)).toBeNull();
  });
});

describe("NumberField: typing", () => {
  it("adds separators as you type", async () => {
    const { user, input } = setup();
    await replaceText(user, input, "1500000");
    expect(input.value).toBe("1,500,000");
  });

  it("writes nothing to the app while typing, so a half value never gets out", async () => {
    const { user, input, onCommit } = setup();
    await replaceText(user, input, "1,5");
    expect(input.value).toBe("15");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits "1,5" as 15 on blur (a comma is a separator here, not a decimal point)', async () => {
    const { user, input, onCommit } = setup();
    await replaceText(user, input, "1,5");
    await user.tab();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(15);
    expect(input.value).toBe("15");
  });

  it("accepts a pasted number with spaces", async () => {
    const { user, input, onCommit } = setup();
    await user.click(input);
    await user.clear(input);
    await user.paste("1 500 000");
    expect(input.value).toBe("1,500,000");
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(1500000);
  });

  it("drops leading zeros", async () => {
    const { user, input } = setup();
    await replaceText(user, input, "007");
    expect(input.value).toBe("7");
  });

  it("does not commit when the text matches the saved number", async () => {
    const { user, input, onCommit } = setup();
    await user.click(input);
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("150,000");
  });
});

describe("NumberField: commit with Enter", () => {
  it("commits, tidies the text and keeps focus", async () => {
    const { user, input, onCommit } = setup();
    await replaceText(user, input, "2000");
    await user.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledWith(2000);
    expect(input.value).toBe("2,000");
    expect(document.activeElement).toBe(input);
  });
});

describe("NumberField: the caret", () => {
  it("stays after the digit you typed when a comma appears", async () => {
    const { user, input } = setup({ initial: 999 });
    await user.type(input, "1", { initialSelectionStart: 0, initialSelectionEnd: 0 });
    expect(input.value).toBe("1,999");
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(1);
  });

  it("stays put when typing in the middle of a grouped number", async () => {
    const { user, input } = setup({ initial: 1000000 });
    // "1,000,000" with the caret after "1,0"
    await user.type(input, "5", { initialSelectionStart: 3, initialSelectionEnd: 3 });
    expect(input.value).toBe("10,500,000");
    // two digits ("10") plus the new "5" are left of the caret
    expect(input.selectionStart).toBe(4);
  });

  it("does not stick when Backspace hits a comma: the digit before it goes", async () => {
    const { user, input } = setup({ initial: 1500 });
    // "1,500" with the caret right after the comma
    await user.type(input, "{Backspace}", { initialSelectionStart: 2, initialSelectionEnd: 2 });
    expect(input.value).toBe("500");
    expect(input.selectionStart).toBe(0);
  });

  it("does not stick when Delete hits a comma: the digit after it goes", async () => {
    const { user, input } = setup({ initial: 1500 });
    // "1,500" with the caret right before the comma
    await user.type(input, "{Delete}", { initialSelectionStart: 1, initialSelectionEnd: 1 });
    expect(input.value).toBe("100");
    expect(input.selectionStart).toBe(1);
  });
});

describe("NumberField: empty and invalid text revert", () => {
  it("reverts an empty field, with a hint", async () => {
    const { user, input, onCommit } = setup();
    await replaceText(user, input, "");
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("150,000");
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Field: Nothing there, so we kept your old number.");
  });

  it('keeps "abc" on screen while typing, then reverts on blur with a hint', async () => {
    const { user, input, onCommit } = setup();
    await user.click(input);
    await user.clear(input);
    await user.paste("abc");
    expect(input.value).toBe("abc");
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("150,000");
    expect(screen.getByRole("status").textContent).toBe(
      "Field: That number no make sense. We kept your old one.",
    );
  });

  it("treats a decimal as invalid instead of rounding it", async () => {
    const { user, input, onCommit } = setup();
    await user.click(input);
    await user.clear(input);
    await user.paste("1.5");
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("150,000");
  });

  it("links the hint to the input with aria-describedby", async () => {
    const { user, input } = setup();
    expect(input.getAttribute("aria-describedby")).toBeNull();
    await replaceText(user, input, "");
    await user.tab();
    const hintId = input.getAttribute("aria-describedby");
    expect(hintId).not.toBeNull();
    expect(document.getElementById(hintId ?? "")?.textContent).toMatch(/we kept your old number/);
  });

  it("clears the hint when you come back to the field", async () => {
    const { user, input } = setup();
    await replaceText(user, input, "");
    await user.tab();
    expect(screen.getByRole("status").textContent).not.toBe("");
    await user.click(input);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("drops the hint when the saved number changes some other way", async () => {
    const { user, input } = setup();
    await replaceText(user, input, "");
    await user.tab();
    expect(screen.getByRole("status").textContent).not.toBe("");
    await user.click(screen.getByRole("button", { name: "Outside change" }));
    expect(screen.getByRole("status").textContent).toBe("");
  });
});

describe("NumberField: clamping", () => {
  it("clamps a too-big number to the max and says so", async () => {
    const { user, input, onCommit } = setup();
    await replaceText(user, input, "99999999999");
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(50000000);
    expect(input.value).toBe("50,000,000");
    expect(screen.getByRole("status").textContent).toBe("Field: Max is ₦50,000,000, so we adjusted it.");
  });

  it("clamps an absurdly long number without losing the max", async () => {
    const { user, input, onCommit } = setup();
    await user.click(input);
    await user.clear(input);
    await user.paste("9".repeat(30));
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(50000000);
  });

  it("clamps up to the min and says so (headcount can't be 0)", async () => {
    const { user, input, onCommit } = setup({
      initial: 4,
      range: RANGES.headcount,
      prefix: "",
      label: "People sharing",
    });
    await replaceText(user, input, "0");
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(1);
    expect(input.value).toBe("1");
    expect(screen.getByRole("status").textContent).toBe("Field: Min is 1, so we adjusted it.");
  });

  it("takes the exact boundaries without a hint", async () => {
    const { user, input, onCommit } = setup();
    await replaceText(user, input, "50000000");
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(50000000);
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
