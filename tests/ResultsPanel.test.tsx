// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Footer } from "@/components/Footer";
import { ResultsPanel, totalSizeToken } from "@/components/ResultsPanel";
import { AppStateProvider } from "@/state/AppStateProvider";

afterEach(cleanup);

function setup() {
  const user = userEvent.setup();
  render(
    <AppStateProvider>
      <ResultsPanel />
    </AppStateProvider>,
  );
  const stayPrice = screen.getByRole("textbox", {
    name: "Price per night Short-lets / Accommodation",
  });
  if (!(stayPrice instanceof HTMLInputElement)) throw new Error("expected an <input>");
  return { user, stayPrice };
}

describe("price fields in the results panel", () => {
  it("gives every bucket its own price field, each with a distinct accessible name", () => {
    setup();
    const names = screen
      .getAllByRole("textbox", { name: /^Price / })
      .map((el) => el.getAttribute("aria-labelledby"));
    expect(names).toHaveLength(5);
    expect(new Set(names).size).toBe(5);
    for (const name of [
      "Price per event Concerts & Raves",
      "Price per table night Club Tables",
      "Price per day Transport / SUV / Security",
      "Price per day Daily Food & Drinks",
    ]) {
      expect(screen.getByRole("textbox", { name })).toBeTruthy();
    }
  });

  it("starts from the golden example", () => {
    const { stayPrice } = setup();
    expect(stayPrice.value).toBe("150,000");
    expect(screen.getByText("₦262,500")).toBeTruthy();
  });

  it("updates the line total when the price is committed", async () => {
    const { user, stayPrice } = setup();
    await user.click(stayPrice);
    await user.clear(stayPrice);
    await user.type(stayPrice, "300000");
    await user.tab();
    expect(stayPrice.value).toBe("300,000");
    // 300,000 x 7 nights, split 4 ways
    expect(screen.getByText("₦525,000")).toBeTruthy();
    expect(screen.queryByText("₦262,500")).toBeNull();
  });

  it('never changes the totals while "1,5" is half typed', async () => {
    const { user, stayPrice } = setup();
    await user.click(stayPrice);
    await user.clear(stayPrice);
    await user.type(stayPrice, "1,5");
    expect(screen.getByText("₦262,500")).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("keeps the old price and totals for empty or invalid text", async () => {
    const { user, stayPrice } = setup();
    await user.click(stayPrice);
    await user.clear(stayPrice);
    await user.tab();
    expect(stayPrice.value).toBe("150,000");

    await user.click(stayPrice);
    await user.clear(stayPrice);
    await user.paste("abc");
    await user.tab();
    expect(stayPrice.value).toBe("150,000");
    expect(screen.getByText("₦262,500")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it("clamps to the max and shows the hint under that field", async () => {
    const { user, stayPrice } = setup();
    await user.click(stayPrice);
    await user.clear(stayPrice);
    await user.type(stayPrice, "99999999999");
    await user.tab();
    expect(stayPrice.value).toBe("50,000,000");
    expect(screen.getByText("Max is ₦50,000,000, so we adjusted it.")).toBeTruthy();
  });
});

const STAY = "Short-lets / Accommodation";
const EVENTS = "Concerts & Raves";

function modeRadio(bucket: string, mode: "Shared" | "Per person"): HTMLInputElement {
  const group = screen.getByRole("radiogroup", { name: `Cost split ${bucket}` });
  const radio = within(group).getByRole("radio", { name: mode });
  if (!(radio instanceof HTMLInputElement)) throw new Error("expected an <input>");
  return radio;
}

/** The list item of one bucket, found by its heading. */
function lineOf(bucket: string): HTMLElement {
  const item = screen.getByRole("heading", { name: bucket }).closest("li");
  if (item === null) throw new Error("expected the heading to be inside a list item");
  return item;
}

function headcountInput(bucket: string): HTMLInputElement | null {
  const input = screen.queryByRole("textbox", { name: `Split between ${bucket}` });
  if (input === null) return null;
  if (!(input instanceof HTMLInputElement)) throw new Error("expected an <input>");
  return input;
}

describe("mode switch in the results panel", () => {
  it("starts each bucket on its preset mode, with a headcount only where shared", () => {
    setup();
    expect(modeRadio(STAY, "Shared").checked).toBe(true);
    expect(modeRadio(EVENTS, "Per person").checked).toBe(true);
    expect(headcountInput(STAY)?.value).toBe("4");
    expect(headcountInput(EVENTS)).toBeNull();
  });

  it("golden: stay, shared to per person, makes the line the full ₦1,050,000", async () => {
    const { user } = setup();
    expect(screen.getByText("₦262,500")).toBeTruthy();
    expect(screen.getByText("₦1,050,000 total ÷ 4")).toBeTruthy();

    await user.click(modeRadio(STAY, "Per person"));

    expect(screen.getByText("₦1,050,000")).toBeTruthy();
    expect(screen.queryByText("₦262,500")).toBeNull();
    // The unit is now "each", so the per-person line no longer shows a split.
    expect(screen.queryByText("₦1,050,000 total ÷ 4")).toBeNull();
    // Per person total: 1,347,500 - 262,500 + 1,050,000
    expect(screen.getByText("₦2,135,000")).toBeTruthy();
  });

  it("golden: events, per person to shared, makes the line ₦75,000", async () => {
    const { user } = setup();
    expect(within(lineOf(EVENTS)).getByText("Each person pays this")).toBeTruthy();
    await user.click(modeRadio(EVENTS, "Shared"));
    const events = within(lineOf(EVENTS));
    expect(events.getByText("₦75,000")).toBeTruthy();
    expect(events.getByText("₦300,000 total ÷ 4")).toBeTruthy();
    expect(headcountInput(EVENTS)?.value).toBe("4");
  });

  it("hides the headcount when switched to per person, and brings the same split back", async () => {
    const { user } = setup();
    const headcount = headcountInput(STAY);
    if (headcount === null) throw new Error("stay should start shared");
    await user.click(headcount);
    await user.clear(headcount);
    await user.type(headcount, "6");
    await user.tab();
    expect(screen.getByText("₦175,000")).toBeTruthy();

    await user.click(modeRadio(STAY, "Per person"));
    expect(headcountInput(STAY)).toBeNull();

    await user.click(modeRadio(STAY, "Shared"));
    expect(headcountInput(STAY)?.value).toBe("6");
    expect(screen.getByText("₦175,000")).toBeTruthy();
  });

  it("switches mode with the arrow keys", async () => {
    const { user } = setup();
    modeRadio(STAY, "Shared").focus();
    await user.keyboard("{ArrowRight}");
    expect(modeRadio(STAY, "Per person").checked).toBe(true);
    expect(screen.getByText("₦1,050,000")).toBeTruthy();
    await user.keyboard("{ArrowLeft}");
    expect(modeRadio(STAY, "Shared").checked).toBe(true);
    expect(screen.getByText("₦262,500")).toBeTruthy();
  });
});

describe("steppers in the results panel", () => {
  it("headcount can't go below 1 with the minus button", async () => {
    const { user } = setup();
    const minus = screen.getByRole("button", { name: `Decrease Split between ${STAY}` });
    for (let i = 0; i < 6; i += 1) await user.click(minus);
    expect(headcountInput(STAY)?.value).toBe("1");
    expect(minus.getAttribute("aria-disabled")).toBe("true");
    // Split between 1 person: the share is the whole line.
    expect(screen.getByText("₦1,050,000 total ÷ 1")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Infinity|NaN/);
  });

  it("headcount can't go below 1 by typing 0", async () => {
    const { user } = setup();
    const headcount = headcountInput(STAY);
    if (headcount === null) throw new Error("stay should start shared");
    await user.click(headcount);
    await user.clear(headcount);
    await user.type(headcount, "0");
    await user.tab();
    expect(headcount.value).toBe("1");
    expect(screen.getByText("Min is 1, so we adjusted it.")).toBeTruthy();
  });

  it("quantity updates the line total", async () => {
    const { user } = setup();
    const plus = screen.getByRole("button", { name: `Increase Nights ${STAY}` });
    await user.click(plus);
    // 150,000 x 8 nights, split 4 ways
    const stay = within(lineOf(STAY));
    expect(stay.getByText("₦300,000")).toBeTruthy();
    expect(stay.getByText("₦1,200,000 total ÷ 4")).toBeTruthy();
  });

  it("drops the duplicated price from the formula line", () => {
    setup();
    expect(document.body.textContent).not.toMatch(/per night ×/);
    expect(document.body.textContent).not.toMatch(/ways|split 4/);
  });
});

describe("footer", () => {
  it("tells people they can edit any number", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo").textContent).toContain(
      "Estimates only, not quotes. Tap any number to edit.",
    );
  });
});

describe("totalSizeToken", () => {
  it("keeps 40px for 11 characters or fewer", () => {
    expect(totalSizeToken("₦0")).toBe("--t-2xl");
    expect(totalSizeToken("₦1,347,500")).toBe("--t-2xl");
    expect(totalSizeToken("₦12,345,678")).toBe("--t-2xl"); // 11 characters
  });

  it("drops to 28px at 12 characters or more", () => {
    expect(totalSizeToken("₦123,456,789")).toBe("--t-xl"); // 12 characters
    expect(totalSizeToken("₦249,750,000,000")).toBe("--t-xl"); // the max-values total
  });

  it("counts ₦ as one character, not by UTF-16 units", () => {
    expect(totalSizeToken("\u20A6".repeat(11))).toBe("--t-2xl");
    expect(totalSizeToken("\u20A6".repeat(12))).toBe("--t-xl");
  });
});

describe("hints in a bucket line", () => {
  async function typeInto(user: ReturnType<typeof userEvent.setup>, box: HTMLElement, text: string) {
    await user.click(box);
    await user.clear(box);
    await user.type(box, text);
    await user.tab();
  }

  it("replaces the formula line, and the formula comes back when the box is focused again", async () => {
    const { user, stayPrice } = setup();
    const stay = within(lineOf(STAY));
    expect(stay.getByText(/total ÷ 4/)).toBeTruthy();
    await typeInto(user, stayPrice, "99999999999");
    expect(stay.getByText("Max is ₦50,000,000, so we adjusted it.")).toBeTruthy();
    expect(stay.queryByText(/total ÷/)).toBeNull();
    await user.click(stayPrice);
    expect(stay.queryByText(/we adjusted/)).toBeNull();
    expect(stay.getByText(/total ÷ 4/)).toBeTruthy();
  });

  it("sits after the mode control in the DOM, so it never moves a control above it", async () => {
    const { user, stayPrice } = setup();
    await typeInto(user, stayPrice, "99999999999");
    const hint = screen.getByText("Max is ₦50,000,000, so we adjusted it.");
    const mode = screen.getByRole("radiogroup", { name: `Cost split ${STAY}` });
    expect(Boolean(mode.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("shows one hint per line: a newer one from another field takes the slot", async () => {
    const { user, stayPrice } = setup();
    await typeInto(user, stayPrice, "99999999999");
    const headcount = headcountInput(STAY);
    if (headcount === null) throw new Error("stay should start shared");
    await typeInto(user, headcount, "0");
    const stay = within(lineOf(STAY));
    expect(stay.getByText("Min is 1, so we adjusted it.")).toBeTruthy();
    expect(stay.queryByText(/Max is/)).toBeNull();
    // Both boxes of the line share one slot id, so a screen reader reads the same place.
    const slot = document.getElementById(headcount.getAttribute("aria-describedby") ?? "");
    expect(slot?.textContent).toBe("Min is 1, so we adjusted it.");
    expect(stayPrice.getAttribute("aria-describedby")).toBeNull();
  });

  it("keeps a hint out of the other lines", async () => {
    const { user, stayPrice } = setup();
    await typeInto(user, stayPrice, "99999999999");
    expect(within(lineOf(EVENTS)).queryByText(/we adjusted/)).toBeNull();
    expect(within(lineOf(EVENTS)).getByText("Each person pays this")).toBeTruthy();
  });
});
