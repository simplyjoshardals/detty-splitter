// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HintMessage } from "@/components/HintMessage";
import { Stepper } from "@/components/Stepper";
import { hintText, useRowHint } from "@/components/numberHint";
import { RANGES, type NumberRange } from "@/lib/input";

afterEach(cleanup);

interface HarnessProps {
  initial?: number;
  range?: NumberRange;
  label?: string;
  onCommit?: (value: number) => void;
}

/**
 * Holds the saved number the way AppState would, reports every commit, and plays the row:
 * it owns the hint and draws it in one status slot, as BucketLine does.
 */
function Harness({
  initial = 7,
  range = RANGES.quantity,
  label = "Nights",
  onCommit,
}: HarnessProps) {
  const [value, setValue] = useState(initial);
  const hints = useRowHint({ field: value });
  return (
    <>
      <Stepper
        label={label}
        labelledBy={["heading"]}
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
          <HintMessage
            hint={hints.active.hint}
            field="Field"
            text={hintText(hints.active.hint, range, "")}
          />
        )}
      </div>
      <h3 id="heading">Short-lets</h3>
    </>
  );
}

function setup(props: HarnessProps = {}) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  const input = screen.getByRole("textbox", { name: "Nights Short-lets" });
  if (!(input instanceof HTMLInputElement)) throw new Error("expected an <input>");
  const decrease = screen.getByRole("button", { name: "Decrease Nights Short-lets" });
  const increase = screen.getByRole("button", { name: "Increase Nights Short-lets" });
  return { user, input, decrease, increase };
}

describe("Stepper buttons", () => {
  it("shows the saved value and names every part after the label and heading", () => {
    const { input } = setup();
    expect(input.value).toBe("7");
  });

  it("steps up and down by one", async () => {
    const onCommit = vi.fn();
    const { user, input, decrease, increase } = setup({ onCommit });
    await user.click(increase);
    expect(input.value).toBe("8");
    await user.click(decrease);
    await user.click(decrease);
    expect(input.value).toBe("6");
    expect(onCommit.mock.calls).toEqual([[8], [7], [6]]);
  });

  it("stops at the minimum without going below it, and keeps keyboard focus", async () => {
    const onCommit = vi.fn();
    const { user, input, decrease } = setup({
      initial: 2,
      range: RANGES.headcount,
      onCommit,
    });
    decrease.focus();
    await user.keyboard("{Enter}");
    expect(input.value).toBe("1");
    expect(decrease.getAttribute("aria-disabled")).toBe("true");

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(input.value).toBe("1");
    expect(onCommit).toHaveBeenCalledTimes(1);
    // aria-disabled, not disabled: focus is still on the button.
    expect(document.activeElement).toBe(decrease);
  });

  it("stops at the maximum", async () => {
    const { user, input, increase } = setup({ initial: 999 });
    expect(increase.getAttribute("aria-disabled")).toBe("true");
    await user.click(increase);
    expect(input.value).toBe("999");
  });

  it("allows quantity to reach 0", async () => {
    const { user, input, decrease } = setup({ initial: 1 });
    await user.click(decrease);
    expect(input.value).toBe("0");
    expect(decrease.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("Stepper keyboard", () => {
  it("steps with ArrowUp and ArrowDown in the box", async () => {
    const { user, input } = setup();
    await user.click(input);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(input.value).toBe("9");
    await user.keyboard("{ArrowDown}");
    expect(input.value).toBe("8");
  });

  it("does not step past the bounds with the arrow keys", async () => {
    const { user, input } = setup({ initial: 1, range: RANGES.headcount });
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input.value).toBe("1");
  });

  it("reaches the buttons by Tab, in order: minus, value, plus", async () => {
    const { user, input, decrease, increase } = setup();
    await user.tab();
    expect(document.activeElement).toBe(decrease);
    await user.tab();
    expect(document.activeElement).toBe(input);
    await user.tab();
    expect(document.activeElement).toBe(increase);
  });
});

describe("Stepper typed value", () => {
  it("commits on blur", async () => {
    const onCommit = vi.fn();
    const { user, input } = setup({ onCommit });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "12");
    expect(onCommit).not.toHaveBeenCalled();
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(12);
    expect(input.value).toBe("12");
  });

  it("commits on Enter and keeps focus", async () => {
    const onCommit = vi.fn();
    const { user, input } = setup({ onCommit });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "3{Enter}");
    expect(onCommit).toHaveBeenCalledWith(3);
    expect(document.activeElement).toBe(input);
  });

  it("clamps headcount 0 up to 1 and says so", async () => {
    const { user, input } = setup({ initial: 4, range: RANGES.headcount });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "0");
    await user.tab();
    expect(input.value).toBe("1");
    expect(screen.getByText("Min is 1, so we adjusted it.")).toBeTruthy();
  });

  it("clamps above the maximum and says so", async () => {
    const { user, input } = setup({ initial: 4, range: RANGES.headcount });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "500");
    await user.tab();
    expect(input.value).toBe("100");
    expect(screen.getByText("Max is 100, so we adjusted it.")).toBeTruthy();
  });

  it("keeps the old number for empty or invalid text, with a hint", async () => {
    const { user, input } = setup();
    await user.click(input);
    await user.clear(input);
    await user.tab();
    expect(input.value).toBe("7");
    expect(screen.getByText("Nothing there, so we kept your old number.")).toBeTruthy();

    await user.click(input);
    await user.clear(input);
    await user.paste("abc");
    await user.tab();
    expect(input.value).toBe("7");
    expect(screen.getByText("That number no make sense. We kept your old one.")).toBeTruthy();
  });

  it("clears the hint when the field is focused again", async () => {
    const { user, input } = setup({ initial: 4, range: RANGES.headcount });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "0");
    await user.tab();
    expect(screen.getByText("Min is 1, so we adjusted it.")).toBeTruthy();
    await user.click(input);
    expect(screen.queryByText("Min is 1, so we adjusted it.")).toBeNull();
  });
});

describe("Stepper hint wiring", () => {
  it("points aria-describedby at the row's hint slot only while a hint shows", async () => {
    const { user, input } = setup({ initial: 4, range: RANGES.headcount });
    expect(input.getAttribute("aria-describedby")).toBeNull();
    await user.click(input);
    await user.clear(input);
    await user.type(input, "0");
    await user.tab();
    const slot = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(slot?.textContent).toBe("Field: Min is 1, so we adjusted it.");
    await user.click(input);
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });
});
