// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DamageMeter } from "@/components/DamageMeter";
import { Receipt } from "@/components/Receipt";
import { TIERS } from "@/data/tiers";
import { RECEIPT_COPY } from "@/lib/receipt/view";
import { AppStateProvider, useAppState } from "@/state/AppStateProvider";

afterEach(cleanup);

/**
 * Plain buttons that dispatch, so these tests exercise the receipt alone. The default state is
 * Soft Life Standard (the golden example): per person ₦1,347,500, group of 4, tier 3.
 */
function Controls() {
  const { dispatch } = useAppState();
  return (
    <div>
      <button type="button" onClick={() => dispatch({ type: "selectPreset", presetId: "budget" })}>
        Budget
      </button>
      <button type="button" onClick={() => dispatch({ type: "setCurrency", currency: "USD" })}>
        Dollars
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: "setRate", rate: "ngnPerUsd", value: 1600 })}
      >
        Custom rate
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: "setBucketMode", bucketId: "stay", mode: "perPerson" })}
      >
        Stay per person
      </button>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "setBucketNumber", bucketId: "events", field: "quantity", value: 4 })
        }
      >
        One more event
      </button>
      <button
        type="button"
        onClick={() => {
          for (const bucketId of ["stay", "events", "tables", "transport", "food"] as const) {
            dispatch({ type: "setBucketNumber", bucketId, field: "quantity", value: 0 });
          }
        }}
      >
        Zero everything
      </button>
    </div>
  );
}

function renderReceipt() {
  render(
    <AppStateProvider>
      <Controls />
      <Receipt />
    </AppStateProvider>,
  );
}

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const receipt = () => screen.getByRole("region", { name: "Receipt" });
const perPerson = () => within(receipt()).getByText("PER PERSON").nextElementSibling?.textContent;
const SOFT = TIERS.find((tier) => tier.id === 3);
const SAPA = TIERS.find((tier) => tier.id === 1);

describe("the receipt", () => {
  it("is a named region that the meter can jump to and focus", () => {
    renderReceipt();
    expect(receipt().id).toBe("receipt");
    expect(receipt().getAttribute("tabindex")).toBe("-1");
    expect(within(receipt()).getByRole("heading", { name: "Receipt", level: 2 })).toBeTruthy();
  });

  it("follows the export bands, top to bottom", () => {
    renderReceipt();
    const text = receipt().textContent ?? "";
    const order = [
      "DETTY DECEMBER 2026",
      ...RECEIPT_COPY.posHeader,
      "Short-lets / Accommodation",
      "Daily Food & Drinks",
      "PER PERSON",
      "GROUP (4)",
      RECEIPT_COPY.status,
      SOFT?.badge ?? "",
      SOFT?.balanceLine ?? "",
      "AUTH: ",
      RECEIPT_COPY.customerCopy,
      "Rates as of ",
      "https://",
    ];
    const positions = order.map((part) => text.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("marks the totals block, which the meter watches to know when to hide", () => {
    renderReceipt();
    const totals = document.getElementById("receipt-totals");
    expect(totals).toBeTruthy();
    expect(receipt().contains(totals)).toBe(true);
    expect(within(totals as HTMLElement).getByText("PER PERSON")).toBeTruthy();
    expect(within(totals as HTMLElement).getByText("GROUP (4)")).toBeTruthy();
  });

  it("lists the five lines with the label, the formula and your share", () => {
    renderReceipt();
    const items = within(receipt()).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    const stay = within(items[0] as HTMLElement);
    expect(stay.getByText("Short-lets / Accommodation")).toBeTruthy();
    expect(stay.getByText("₦150,000 × 7 ÷ 4")).toBeTruthy();
    expect(stay.getByText("₦262,500")).toBeTruthy();
    const events = within(items[1] as HTMLElement);
    expect(events.getByText("₦100,000 × 3")).toBeTruthy();
    expect(events.getByText("₦300,000")).toBeTruthy();
  });

  it("shows the totals, the status, the balance line and a stable AUTH code", () => {
    renderReceipt();
    expect(perPerson()).toBe("₦1,347,500");
    expect(within(receipt()).getByText("GROUP (4)").nextElementSibling?.textContent).toBe(
      "₦5,390,000",
    );
    expect(within(receipt()).getByText("STATUS: APPROVED")).toBeTruthy();
    expect(within(receipt()).getByText(SOFT?.balanceLine ?? "")).toBeTruthy();
    expect(within(receipt()).getByText("AUTH: D1E6E16D")).toBeTruthy();
  });

  it("follows the display currency in the amounts, and keeps the formulas in naira", () => {
    renderReceipt();
    press("Dollars");
    expect(perPerson()).toBe("$898.34");
    const stay = within(within(receipt()).getAllByRole("listitem")[0] as HTMLElement);
    expect(stay.getByText("$175.00")).toBeTruthy();
    expect(stay.getByText("₦150,000 × 7 ÷ 4")).toBeTruthy();
    expect(within(receipt()).getByText(SOFT?.badge ?? "")).toBeTruthy();
  });

  it("keeps up with an edit: the golden stay line to per person makes the total ₦2,135,000", () => {
    renderReceipt();
    press("Stay per person");
    expect(perPerson()).toBe("₦2,135,000");
    const stay = within(within(receipt()).getAllByRole("listitem")[0] as HTMLElement);
    expect(stay.getByText("₦1,050,000")).toBeTruthy();
    expect(stay.getByText("₦150,000 × 7")).toBeTruthy();
  });

  it("says when the default rates were read, and Custom rates once one is edited", () => {
    renderReceipt();
    expect(within(receipt()).getByText(/^Rates as of \d{1,2} [A-Z][a-z]{2} \d{4}$/)).toBeTruthy();
    press("Custom rate");
    expect(within(receipt()).getByText("Custom rates")).toBeTruthy();
    expect(within(receipt()).queryByText(/^Rates as of/)).toBeNull();
  });

  it("shows zero lines for an empty calculation, still on the first tier", () => {
    renderReceipt();
    press("Zero everything");
    expect(perPerson()).toBe("₦0");
    expect(within(receipt()).getByText("GROUP (4)").nextElementSibling?.textContent).toBe("₦0");
    for (const item of within(receipt()).getAllByRole("listitem")) {
      expect(within(item).getByText("₦0")).toBeTruthy();
    }
    expect(within(receipt()).getByText(SAPA?.badge ?? "")).toBeTruthy();
    expect(within(receipt()).getByText("STATUS: APPROVED")).toBeTruthy();
  });

  it("changes the AUTH code with the tier and total", () => {
    renderReceipt();
    press("Budget");
    const code = within(receipt()).getByText(/^AUTH: /).textContent;
    expect(code).toMatch(/^AUTH: [0-9A-F]{8}$/);
    expect(code).not.toBe("AUTH: D1E6E16D");
  });
});

describe("the stamp on the receipt", () => {
  const stamp = (badge: string) => within(receipt()).getByText(badge);

  it("does not thump on first paint", () => {
    renderReceipt();
    expect(stamp(SOFT?.badge ?? "").hasAttribute("data-thump")).toBe(false);
  });

  it("changes with the tier and thumps", () => {
    renderReceipt();
    press("Budget");
    expect(within(receipt()).queryByText(SOFT?.badge ?? "")).toBeNull();
    expect(stamp(SAPA?.badge ?? "").hasAttribute("data-thump")).toBe(true);
    expect(within(receipt()).getByText(SAPA?.balanceLine ?? "")).toBeTruthy();
  });

  it("does not thump for an edit that stays in the same tier", () => {
    renderReceipt();
    press("One more event");
    expect(perPerson()).toBe("₦1,447,500");
    expect(stamp(SOFT?.badge ?? "").hasAttribute("data-thump")).toBe(false);
  });
});

describe("with the damage meter", () => {
  it("gives the meter's See receipt button a target, and the jump moves focus to the receipt", () => {
    render(
      <AppStateProvider>
        <Receipt />
        <DamageMeter />
      </AppStateProvider>,
    );
    const scrollIntoView = vi.fn();
    receipt().scrollIntoView = scrollIntoView;
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "See receipt" }));
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(receipt());
  });
});
