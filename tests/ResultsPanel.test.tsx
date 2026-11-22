// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Footer } from "@/components/Footer";
import { ResultsPanel } from "@/components/ResultsPanel";
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
    const names = screen.getAllByRole("textbox").map((el) => el.getAttribute("aria-labelledby"));
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

describe("footer", () => {
  it("tells people they can edit any number", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo").textContent).toContain(
      "Estimates only, not quotes. Tap any number to edit.",
    );
  });
});
