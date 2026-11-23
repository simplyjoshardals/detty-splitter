// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CurrencyControl } from "@/components/CurrencyControl";
import { RatesPanel } from "@/components/RatesPanel";
import { DEFAULT_RATES, RATES_AS_OF } from "@/config";
import { TIERS } from "@/data/tiers";
import { calculate } from "@/lib/calc";
import { formatAmount } from "@/lib/money";
import { formatAsOfDate } from "@/lib/rates";
import { AppStateProvider } from "@/state/AppStateProvider";
import { createInitialState } from "@/state/reducer";

afterEach(cleanup);

const AS_OF = `as of ${formatAsOfDate(RATES_AS_OF)}`;

function setup() {
  const user = userEvent.setup();
  render(
    <AppStateProvider>
      <CurrencyControl />
      <RatesPanel />
    </AppStateProvider>,
  );
  return { user };
}

const toggle = () => screen.getByRole("button", { name: /^Rates/ });
const usd = () => screen.getByRole("textbox", { name: "₦ per $1" }) as HTMLInputElement;
const gbp = () => screen.getByRole("textbox", { name: "₦ per £1" }) as HTMLInputElement;

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(toggle());
}

/**
 * Selects all and types, then clicks away from every field, the way a person finishes a number.
 * Tabbing to the other rate field would drop the hint: the latest focus wins (DESIGN §4).
 */
async function enterRate(
  user: ReturnType<typeof userEvent.setup>,
  box: HTMLInputElement,
  text: string,
) {
  await user.click(box);
  await user.clear(box);
  if (text !== "") await user.type(box, text);
  await user.click(document.body);
}

describe("RatesPanel: the closed row", () => {
  it("is collapsed by default and shows the defaults' date", () => {
    setup();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().textContent).toContain(AS_OF);
    expect(screen.queryByRole("textbox", { name: "₦ per $1" })).toBeNull();
    expect(screen.queryByText("Custom rates")).toBeNull();
  });

  it("opens and closes with the toggle, and points aria-controls at the panel", async () => {
    const { user } = setup();
    await open(user);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    const panelId = toggle().getAttribute("aria-controls") ?? "";
    expect(document.getElementById(panelId)?.hasAttribute("hidden")).toBe(false);
    await user.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(panelId)?.hasAttribute("hidden")).toBe(true);
  });

  it("opens from the keyboard", async () => {
    const { user } = setup();
    await user.tab(); // currency radio
    await user.tab(); // toggle
    expect(document.activeElement).toBe(toggle());
    await user.keyboard("{Enter}");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });
});

describe("RatesPanel: the open panel", () => {
  it("shows both saved rates with separators, and Reset rates", async () => {
    const { user } = setup();
    await open(user);
    expect(usd().value).toBe("1,500");
    expect(gbp().value).toBe("2,000");
    expect(usd().inputMode).toBe("decimal");
    expect(screen.getByRole("button", { name: "Reset rates" })).toBeTruthy();
  });

  it("takes a rate with decimals, formats it, and shows the Custom rates tag", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), "1600.5");
    expect(usd().value).toBe("1,600.5");
    expect(toggle().textContent).toContain("Custom rates");
    expect(toggle().textContent).not.toContain("as of");
  });

  it("shows the tag when only one rate is custom", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, gbp(), "2100");
    expect(gbp().value).toBe("2,100");
    expect(usd().value).toBe("1,500");
    expect(toggle().textContent).toContain("Custom rates");
  });

  it("drops the tag again when a rate is edited back to its default", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), "1600");
    expect(toggle().textContent).toContain("Custom rates");
    await enterRate(user, usd(), String(DEFAULT_RATES.ngnPerUsd));
    expect(toggle().textContent).toContain(AS_OF);
  });

  it("types 1,537.37 with the caret and separators behaving", async () => {
    const { user } = setup();
    await open(user);
    await user.click(usd());
    await user.clear(usd());
    await user.type(usd(), "1537.37");
    expect(usd().value).toBe("1,537.37");
    await user.tab();
    expect(usd().value).toBe("1,537.37");
  });
});

describe("RatesPanel: a bad rate keeps the old one and says why", () => {
  const status = () => screen.getByRole("status");

  it.each([
    ["49", "50 to 100,000"],
    ["100001", "50 to 100,000"],
    ["0", "50 to 100,000"],
    ["0.00", "50 to 100,000"],
  ])("rejects %s with a range hint (rate 0 is impossible)", async (typed, bounds) => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), typed);
    expect(usd().value).toBe("1,500");
    expect(status().textContent).toContain("₦ per $1:");
    expect(status().textContent).toContain(bounds);
    expect(status().textContent).toContain("We kept your old number.");
    expect(usd().getAttribute("aria-describedby")).toBe(status().id); // read out with the field
    expect(toggle().textContent).toContain(AS_OF); // nothing changed
  });

  it("names the second field in its hint", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, gbp(), "5");
    expect(gbp().value).toBe("2,000");
    expect(status().textContent).toContain("₦ per £1:");
  });

  it("rejects a third decimal instead of rounding", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), "1500.555");
    expect(usd().value).toBe("1,500");
    expect(status().textContent).toContain("Max 2 decimals.");
  });

  it("keeps the old rate for empty and for text", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), "");
    expect(usd().value).toBe("1,500");
    expect(status().textContent).toContain("Nothing there");
    await enterRate(user, gbp(), "abc");
    expect(gbp().value).toBe("2,000");
    expect(status().textContent).toContain("no make sense");
  });

  it("keeps the last good rate, not the default, when a custom rate is then rejected", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), "1700");
    await enterRate(user, usd(), "7");
    expect(usd().value).toBe("1,700");
    expect(toggle().textContent).toContain("Custom rates");
  });

  it("clears the hint when the panel is closed and opened again", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), "7");
    expect(status().textContent).toContain("We kept your old number.");
    await user.click(toggle());
    await user.click(toggle());
    expect(status().textContent).toBe("");
  });
});

describe("RatesPanel: Reset rates", () => {
  it("puts both rates back and says so", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), "1600");
    await enterRate(user, gbp(), "2100");
    await user.click(screen.getByRole("button", { name: "Reset rates" }));
    expect(usd().value).toBe("1,500");
    expect(gbp().value).toBe("2,000");
    expect(toggle().textContent).toContain(AS_OF);
    expect(screen.getByRole("status").textContent).toContain("Rates reset to the defaults.");
  });

  it("says so when there is nothing to reset", async () => {
    const { user } = setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Reset rates" }));
    expect(screen.getByRole("status").textContent).toContain("Rates already at the defaults.");
  });

  it("replaces a hint with its own status, so the slot never shows two messages", async () => {
    const { user } = setup();
    await open(user);
    await enterRate(user, usd(), "7");
    await user.click(screen.getByRole("button", { name: "Reset rates" }));
    expect(screen.getByRole("status").textContent).not.toContain("We kept your old number.");
    expect(screen.getByRole("status").textContent).toContain("already at the defaults");
  });
});

describe("RatesPanel: the rates change the converted amounts", () => {
  it("is the same state the totals read", async () => {
    // RatesPanel and the results share one provider; this checks the numbers the panel feeds.
    const base = createInitialState();
    const before = calculate({ ...base, currency: "USD" }, TIERS);
    const after = calculate(
      { ...base, currency: "USD", rates: { ...base.rates, ngnPerUsd: 3000 } },
      TIERS,
    );
    expect(formatAmount(after.perPersonMinor, "USD")).not.toBe(
      formatAmount(before.perPersonMinor, "USD"),
    );
    // and the panel itself still works with a non-NGN display currency selected
    const { user } = setup();
    await user.click(screen.getByRole("radio", { name: "USD" }));
    await open(user);
    await enterRate(user, usd(), "3000");
    expect(toggle().textContent).toContain("Custom rates");
  });
});
