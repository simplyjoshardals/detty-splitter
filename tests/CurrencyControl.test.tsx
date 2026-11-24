// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CurrencyControl } from "@/components/CurrencyControl";
import { Receipt } from "@/components/Receipt";
import { ResultsPanel } from "@/components/ResultsPanel";
import { AppStateProvider } from "@/state/AppStateProvider";

afterEach(cleanup);

function setup() {
  const user = userEvent.setup();
  render(
    <AppStateProvider>
      <CurrencyControl />
      <ResultsPanel />
      <Receipt />
    </AppStateProvider>,
  );
  const group = screen.getByRole("radiogroup", { name: "Currency" });
  const radio = (name: "NGN" | "USD" | "GBP") => within(group).getByRole("radio", { name });
  const choose = (name: "NGN" | "USD" | "GBP") => user.click(screen.getByText(name));
  return { user, radio, choose };
}

/** "$1,234.50" -> 123450 (minor units), "₦262,500" -> 262500. */
function minorUnits(text: string): number {
  const [whole = "", fraction] = text.slice(1).replace(/,/g, "").split(".");
  return fraction === undefined ? Number(whole) : Number(whole) * 100 + Number(fraction);
}

/** The five bucket amounts, read from the calculator's list (the receipt has its own). */
function lineAmounts(): string[] {
  return within(screen.getByRole("region", { name: "Your damage" }))
    .getAllByRole("listitem")
    .map((item) => within(item).getByText(/^[₦$£][\d,]+(\.\d{2})?$/).textContent ?? "");
}

describe("CurrencyControl", () => {
  it("is a named group of three labelled radios, naira selected first", () => {
    const { radio } = setup();
    expect(radio("NGN")).toHaveProperty("checked", true);
    expect(radio("USD")).toHaveProperty("checked", false);
    expect(radio("GBP")).toHaveProperty("checked", false);
  });

  it("shows the golden naira numbers to begin with", () => {
    setup();
    expect(screen.getByText("₦1,347,500")).toBeTruthy();
    expect(screen.getByText("₦5,390,000")).toBeTruthy();
    expect(screen.getByText("₦1,050,000 total ÷ 4")).toBeTruthy();
  });

  it("converts every amount to dollars: lines, totals and the formula", async () => {
    const { radio, choose } = setup();
    await choose("USD");
    expect(radio("USD")).toHaveProperty("checked", true);
    expect(lineAmounts()).toEqual(["$175.00", "$200.00", "$266.67", "$70.00", "$186.67"]);
    expect(screen.getByText("$898.34")).toBeTruthy();
    expect(screen.getByText("$3,593.36")).toBeTruthy();
    expect(screen.getByText("$700.00 total ÷ 4")).toBeTruthy();
    expect(screen.queryByText("₦1,347,500")).toBeNull();
  });

  it("converts to pounds", async () => {
    const { choose } = setup();
    await choose("GBP");
    expect(screen.getByText("£673.75")).toBeTruthy();
    expect(screen.getByText("£2,695.00")).toBeTruthy();
    expect(screen.getByText("£525.00 total ÷ 4")).toBeTruthy();
  });

  it("never changes the tier or the stored naira values", async () => {
    const { choose } = setup();
    const stayPrice = screen.getByRole("textbox", {
      name: "Price per night Short-lets / Accommodation",
    });
    expect(screen.getByText("Soft Life Certified")).toBeTruthy();
    for (const code of ["USD", "GBP", "NGN"] as const) {
      await choose(code);
      expect(screen.getByText("Soft Life Certified")).toBeTruthy();
      // Prices are always typed and shown in naira, whatever the display currency.
      expect(stayPrice).toHaveProperty("value", "150,000");
    }
    expect(screen.getByText("₦1,347,500")).toBeTruthy();
  });

  it.each(["USD", "GBP", "NGN"] as const)(
    "shows a total equal to the sum of the displayed lines in %s",
    async (code) => {
      const { choose } = setup();
      await choose(code);
      const sum = lineAmounts().reduce((total, text) => total + minorUnits(text), 0);
      const perPerson = screen
        .getAllByText("PER PERSON")
        .find((el) => el.tagName === "DT")?.nextElementSibling?.textContent;
      expect(perPerson).toBeTruthy();
      expect(minorUnits(perPerson ?? "")).toBe(sum);
    },
  );

  it("moves with the arrow keys, like the other segmented controls", async () => {
    const { user, radio } = setup();
    radio("NGN").focus();
    await user.keyboard("{ArrowRight}");
    expect(radio("USD")).toHaveProperty("checked", true);
    expect(screen.getByText("$898.34")).toBeTruthy();
  });

  it("says the price fields stay in naira, only while the amounts are not naira", async () => {
    const { choose } = setup();
    const group = screen.getByRole("radiogroup", { name: "Currency" });
    expect(screen.queryByText("Prices stay in ₦")).toBeNull();
    expect(group.getAttribute("aria-describedby")).toBeNull();
    await choose("USD");
    const note = screen.getByText("Prices stay in ₦");
    expect(group.getAttribute("aria-describedby")).toBe(note.id);
    await choose("GBP");
    expect(screen.getByText("Prices stay in ₦")).toBeTruthy();
    await choose("NGN");
    expect(screen.queryByText("Prices stay in ₦")).toBeNull();
  });
});
